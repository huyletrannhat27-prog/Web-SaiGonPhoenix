const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const extensions = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp', 'image/gif': '.gif' };
const upload = multer({
    storage: multer.diskStorage({
        destination: path.join(__dirname, '..', 'public', 'uploads', 'vehicles'),
        filename: (req, file, done) => done(null, `${Date.now()}-${crypto.randomBytes(12).toString('hex')}${extensions[file.mimetype] || ''}`)
    }),
    limits: { fileSize: 5 * 1024 * 1024, files: 36, fields: 60, fieldSize: 100000 },
    fileFilter: (req, file, done) => extensions[file.mimetype] ? done(null, true) : done(new Error('Chỉ nhận ảnh JPG, PNG, WEBP hoặc GIF.'))
}).fields([{ name: 'exteriorFiles', maxCount: 12 }, { name: 'interiorFiles', maxCount: 12 }, { name: 'spinFiles', maxCount: 36 }]);

module.exports = (req, res, next) => upload(req, res, error => {
    if (!error) return next();
    const message = error.code === 'LIMIT_FILE_SIZE' ? 'Mỗi ảnh tối đa 5 MB.' : error.code === 'LIMIT_FILE_COUNT' || error.code === 'LIMIT_UNEXPECTED_FILE' ? 'Tối đa 36 ảnh mỗi lần lưu, 12 ảnh ngoại thất và 12 ảnh nội thất.' : 'Không thể tải ảnh. Chỉ nhận JPG, PNG, WEBP hoặc GIF, mỗi ảnh tối đa 5 MB.';
    res.status(400).render('error', { title: 'Chưa tải được ảnh', error: { message } });
});
