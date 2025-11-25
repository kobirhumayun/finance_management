export const IMAGE_ATTACHMENT_TYPES = ["image/png", "image/jpeg", "image/webp"];
export const DEFAULT_MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export const resolveMaxAttachmentBytes = (value) => {
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return DEFAULT_MAX_ATTACHMENT_BYTES;
};

export const validateImageAttachment = (file, maxBytes = DEFAULT_MAX_ATTACHMENT_BYTES, formatSize) => {
  if (!file) return null;
  if (file.size > maxBytes) {
    const sizeLabel = typeof formatSize === "function"
      ? formatSize(maxBytes)
      : `${Math.round(maxBytes / (1024 * 1024))} MB`;
    return `File is too large. Max size is ${sizeLabel}.`;
  }
  if (file.type && !IMAGE_ATTACHMENT_TYPES.includes(file.type)) {
    return "Unsupported image format. Upload a PNG, JPG, or WebP file.";
  }
  return null;
};
