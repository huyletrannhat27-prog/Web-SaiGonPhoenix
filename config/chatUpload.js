const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const uploadDirectory = path.join(__dirname, '..', 'uploads', 'chat');
fs.mkdirSync(uploadDirectory, { recursive: true });

const allowedMimeTypes = new Set([
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/webm', 'video/quicktime'
]);

const extensionByMime = {
    'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif',
    'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov'
};

const storage = multer.diskStorage({
    destination: (req, file, callback) => callback(null, uploadDirectory),
    filename: (req, file, callback) => callback(null, `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${extensionByMime[file.mimetype] || ''}`)
});

module.exports = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, callback) => allowedMimeTypes.has(file.mimetype)
        ? callback(null, true)
        : callback(new Error('Chat chỉ hỗ trợ ảnh hoặc video tối đa 25 MB.'))
});
