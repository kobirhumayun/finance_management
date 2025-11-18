const path = require('path');
const fs = require('fs');
const fsp = require('fs/promises');
const { pipeline } = require('stream/promises');
const { getUploadsRoot } = require('../services/imageService');

const sanitizeFilename = (name, fallback = 'file') => {
    if (!name || typeof name !== 'string') {
        return fallback;
    }
    const base = path.basename(name);
    const sanitized = base.replace(/[^a-zA-Z0-9._-]/g, '_');
    return sanitized || fallback;
};

const resolveDescriptorPath = (descriptor) => {
    if (!descriptor?.path) {
        const error = new Error('FILE_NOT_FOUND');
        error.code = 'ENOENT';
        throw error;
    }
    const uploadsRoot = path.resolve(getUploadsRoot());
    const absolutePath = path.resolve(descriptor.path);
    if (!absolutePath.startsWith(uploadsRoot)) {
        const error = new Error('INVALID_FILE_PATH');
        error.code = 'ERR_INVALID_PATH';
        throw error;
    }
    return absolutePath;
};

const streamStoredFile = async ({ descriptor, res, fallbackFilename = 'file', disposition = 'inline' }) => {
    const absolutePath = resolveDescriptorPath(descriptor);
    await fsp.access(absolutePath, fs.constants.R_OK);
    const stats = await fsp.stat(absolutePath);
    const mimeType = descriptor?.mimeType || 'application/octet-stream';
    const filename = sanitizeFilename(descriptor?.filename, fallbackFilename);

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `${disposition}; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');

    await pipeline(fs.createReadStream(absolutePath), res);
};

module.exports = {
    streamStoredFile,
    sanitizeFilename,
};
