const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const uploadDirectory = path.join(__dirname, '..', 'public', 'uploads', 'vehicles');
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const storage = multer.diskStorage({
    destination: (req, file, callback) => callback(null, uploadDirectory),
    filename: (req, file, callback) => {
        const extension = ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' })[file.mimetype];
        callback(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${extension || ''}`);
    }
});

module.exports = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, callback) => allowedMimeTypes.has(file.mimetype)
        ? callback(null, true)
        : callback(new Error('Chỉ chấp nhận ảnh JPG, PNG, WEBP hoặc GIF.'))
});
