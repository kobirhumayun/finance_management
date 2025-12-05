export const IMAGE_ATTACHMENT_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const PDF_ATTACHMENT_TYPE = "application/pdf";
export const TRANSACTION_ATTACHMENT_TYPES = [...IMAGE_ATTACHMENT_TYPES, PDF_ATTACHMENT_TYPE];

export const DEFAULT_MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export const resolveMaxAttachmentBytes = (value) => {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_MAX_ATTACHMENT_BYTES;
};

export const validateFileAttachment = (file, allowedTypes, maxBytes = DEFAULT_MAX_ATTACHMENT_BYTES, formatSize) => {
  if (!file) return null;
  if (file.size > maxBytes) {
    const sizeLabel = typeof formatSize === "function"
      ? formatSize(maxBytes)
      : `${Math.round(maxBytes / (1024 * 1024))} MB`;
    return `File is too large. Max size is ${sizeLabel}.`;
  }
  if (allowedTypes && file.type && !allowedTypes.includes(file.type)) {
    return "Unsupported file format.";
  }
  return null;
};

export const validateImageAttachment = (file, maxBytes = DEFAULT_MAX_ATTACHMENT_BYTES, formatSize) => {
  const error = validateFileAttachment(file, IMAGE_ATTACHMENT_TYPES, maxBytes, formatSize);
  if (error === "Unsupported file format.") {
    return "Unsupported image format. Upload a PNG, JPG, or WebP file.";
  }
  return error;
};

