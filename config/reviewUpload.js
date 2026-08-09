const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const uploadDirectory = path.join(__dirname, '..', 'public', 'uploads', 'reviews');
fs.mkdirSync(uploadDirectory, { recursive: true });
const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };

const storage = multer.diskStorage({
    destination: (req, file, callback) => callback(null, uploadDirectory),
    filename: (req, file, callback) => callback(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extensions[file.mimetype] || ''}`)
});

module.exports = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 4 },
    fileFilter: (req, file, callback) => extensions[file.mimetype]
        ? callback(null, true)
        : callback(new Error('Ảnh đánh giá chỉ nhận JPG, PNG hoặc WEBP.'))
});
