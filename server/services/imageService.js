const path = require('path');
const fsp = require('fs/promises');
const sharp = require('sharp');
const { randomUUID } = require('crypto');

const DEFAULT_UPLOAD_DIR = path.resolve(__dirname, '..', 'uploads');
const UPLOADS_ROOT = path.resolve(process.env.UPLOADS_ROOT || DEFAULT_UPLOAD_DIR);
const DEFAULT_MAX_DIMENSION = Number.parseInt(process.env.UPLOAD_MAX_DIMENSION, 10) || 1600;
const PROFILE_IMAGE_MAX_DIMENSION = Number.parseInt(process.env.PROFILE_IMAGE_MAX_DIMENSION, 10) || 512;
const DEFAULT_SIZE_LIMIT = 5 * 1024 * 1024;
const UPLOAD_FILE_SIZE_LIMIT = Number.isFinite(Number(process.env.UPLOAD_MAX_BYTES)) && Number(process.env.UPLOAD_MAX_BYTES) > 0
    ? Number(process.env.UPLOAD_MAX_BYTES)
    : DEFAULT_SIZE_LIMIT;
const IMAGE_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
]);
const ACCEPTED_MIME_TYPES = new Set([
    ...IMAGE_MIME_TYPES,
    'application/pdf',
]);

let ensureRootPromise;

const ensureUploadsRoot = () => {
    if (!ensureRootPromise) {
        ensureRootPromise = fsp.mkdir(UPLOADS_ROOT, { recursive: true }).catch((error) => {
            console.error('Failed to prepare uploads directory:', error);
            throw error;
        });
    }
    return ensureRootPromise;
};

const sanitizeSegment = (value) => {
    if (!value) {
        return 'common';
    }
    const stringValue = value.toString().toLowerCase();
    const sanitized = stringValue.replace(/[^a-z0-9-_]/gi, '');
    return sanitized || 'common';
};

const buildRelativePath = (segments = []) => segments.filter(Boolean).join('/');

const toPublicUrl = (relativePath) => `/api/uploads/${relativePath}`;

const getMimeType = (file) => file?.mimetype?.toLowerCase() || '';

const isImageMimeType = (mimeType) => IMAGE_MIME_TYPES.has((mimeType || '').toLowerCase());

const validateFileInput = (file, { requireImage = false } = {}) => {
    if (!file || !file.buffer || !file.buffer.length) {
        throw new Error('No file provided.');
    }

    const size = typeof file.size === 'number' ? file.size : file.buffer.length;
    if (size > UPLOAD_FILE_SIZE_LIMIT) {
        throw new Error('File exceeds the allowed upload size.');
    }

    const mimeType = getMimeType(file);
    if (mimeType && !ACCEPTED_MIME_TYPES.has(mimeType)) {
        throw new Error('Unsupported file format. Upload a PNG, JPG, WebP image, or PDF document.');
    }

    if (requireImage && !isImageMimeType(mimeType)) {
        throw new Error('Unsupported image format. Upload a PNG, JPG, or WebP image.');
    }
};

const writeImageFile = async ({ data, relativePath }) => {
    await ensureUploadsRoot();
    const absolutePath = path.join(UPLOADS_ROOT, relativePath.split('/').join(path.sep));
    await fsp.mkdir(path.dirname(absolutePath), { recursive: true });
    await fsp.writeFile(absolutePath, data);
    return absolutePath;
};

const processImageBuffer = async (buffer, { maxDimension }) => {
    try {
        const pipeline = sharp(buffer, { failOn: 'none' }).rotate();
        if (maxDimension && Number.isFinite(maxDimension)) {
            pipeline.resize({
                width: maxDimension,
                height: maxDimension,
                fit: 'inside',
                withoutEnlargement: true,
            });
        }
        const { data, info } = await pipeline.webp({ quality: 80 }).toBuffer({ resolveWithObject: true });
        return { data, info };
    } catch (error) {
        console.error('Failed to process image buffer:', error);
        throw new Error('Unable to process the uploaded image.');
    }
};

const buildDescriptor = ({
    originalName,
    storedRelativePath,
    absolutePath,
    info,
}) => ({
    filename: originalName || 'image.webp',
    mimeType: 'image/webp',
    size: info.size || info?.size || null,
    width: info.width || null,
    height: info.height || null,
    url: toPublicUrl(storedRelativePath),
    path: absolutePath,
    uploadedAt: new Date(),
});

const buildPassThroughDescriptor = ({
    originalName,
    storedRelativePath,
    absolutePath,
    mimeType,
    size,
}) => ({
    filename: originalName || 'file',
    mimeType: mimeType || 'application/octet-stream',
    size: typeof size === 'number' ? size : null,
    width: null,
    height: null,
    url: toPublicUrl(storedRelativePath),
    path: absolutePath,
    uploadedAt: new Date(),
});

const saveImage = async ({ file, scopeSegments, maxDimension }) => {
    validateFileInput(file, { requireImage: true });
    const storedFileName = `${randomUUID()}.webp`;
    const relativePath = buildRelativePath([...scopeSegments, storedFileName]);
    const { data, info } = await processImageBuffer(file.buffer, { maxDimension });
    const absolutePath = await writeImageFile({ data, relativePath });
    return buildDescriptor({
        originalName: file.originalname,
        storedRelativePath: relativePath,
        absolutePath,
        info,
    });
};

const resolveFileExtension = (file) => {
    const mimeType = getMimeType(file);
    if (mimeType === 'application/pdf') {
        return '.pdf';
    }
    const ext = path.extname(file?.originalname || '').toLowerCase();
    return ext || '';
};

const savePassThroughFile = async ({ file, scopeSegments }) => {
    validateFileInput(file);
    const extension = resolveFileExtension(file) || '.bin';
    const storedFileName = `${randomUUID()}${extension}`;
    const relativePath = buildRelativePath([...scopeSegments, storedFileName]);
    const absolutePath = await writeImageFile({ data: file.buffer, relativePath });
    return buildPassThroughDescriptor({
        originalName: file.originalname || storedFileName,
        storedRelativePath: relativePath,
        absolutePath,
        mimeType: getMimeType(file) || undefined,
        size: typeof file.size === 'number' ? file.size : file.buffer?.length,
    });
};

const saveSmartAttachment = async ({ file, scopeSegments, maxDimension = DEFAULT_MAX_DIMENSION }) => {
    const mimeType = getMimeType(file);
    const baseOptions = { scopeSegments };

    if (isImageMimeType(mimeType)) {
        return saveImage({ ...baseOptions, file, maxDimension });
    }

    return savePassThroughFile({ ...baseOptions, file });
};

const saveTransactionAttachment = async ({ file, userId, projectId }) => saveSmartAttachment({
    file,
    scopeSegments: ['transactions', sanitizeSegment(userId), sanitizeSegment(projectId)],
});

const saveTicketAttachment = async ({ file, userId, ticketId }) => saveSmartAttachment({
    file,
    scopeSegments: ['tickets', sanitizeSegment(userId), sanitizeSegment(ticketId)],
});

const saveProfileImage = async ({ file, userId }) => saveImage({
    file,
    scopeSegments: ['profile', sanitizeSegment(userId)],
    maxDimension: PROFILE_IMAGE_MAX_DIMENSION,
});

const deleteStoredFile = async (filePath) => {
    if (!filePath) {
        return;
    }
    const absolutePath = path.resolve(filePath);
    if (!absolutePath.startsWith(UPLOADS_ROOT)) {
        return;
    }
    try {
        await fsp.unlink(absolutePath);
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }
};

const discardDescriptor = async (descriptor) => {
    if (!descriptor || !descriptor.path) {
        return;
    }
    await deleteStoredFile(descriptor.path);
};

const getUploadsRoot = () => UPLOADS_ROOT;
const getUploadFileSizeLimit = () => UPLOAD_FILE_SIZE_LIMIT;

module.exports = {
    saveTransactionAttachment,
    saveTicketAttachment,
    saveProfileImage,
    deleteStoredFile,
    discardDescriptor,
    ensureUploadsRoot,
    getUploadsRoot,
    getUploadFileSizeLimit,
};
