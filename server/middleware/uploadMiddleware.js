const multer = require('multer');
const { getUploadFileSizeLimit } = require('../services/imageService');

const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: {
        fileSize: getUploadFileSizeLimit(),
    },
});

module.exports = { upload };
