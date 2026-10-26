const fs = require('fs/promises');
const path = require('path');
const ImageAsset = require('../models/ImageAsset');
const uploadRoot = path.resolve(__dirname, '..', 'public', 'uploads', 'vehicles');
const bad = message => Object.assign(new Error(message), { status: 400 });
const filesOf = req => Object.values(req.files || {}).flat();

function safeImageUrl(value) {
    if (typeof value !== 'string' || value.length > 2048) throw bad('Liên kết ảnh không hợp lệ.');
    const url = value.trim();
    if (/^\/(?:images|uploads\/vehicles)\/[a-zA-Z0-9._/-]+$/.test(url) && !url.includes('..')) return url;
    try { const parsed = new URL(url); if (parsed.protocol === 'https:' && !parsed.username && !parsed.password) return parsed.href; } catch {}
    throw bad('Ảnh phải dùng liên kết HTTPS hoặc ảnh trong thư viện của website.');
}
function list(body, field, previous = []) {
    if (body[field] === undefined) return Array.from(previous);
    if (typeof body[field] !== 'string') throw bad('Danh sách ảnh không hợp lệ.');
    return body[field].split(/\r?\n/).map(value => value.trim()).filter(Boolean).map(safeImageUrl);
}
async function selectedAssets(value) {
    const ids = value === undefined || value === '' ? [] : Array.isArray(value) ? value : [value];
    if (ids.length > 36 || ids.some(id => typeof id !== 'string' || !/^[a-f\d]{24}$/i.test(id))) throw bad('Ảnh thư viện không hợp lệ.');
    const assets = await ImageAsset.find({ _id: { $in: ids } }).lean();
    const byId = new Map(assets.map(asset => [String(asset._id), asset.url]));
    if (ids.some(id => !byId.has(id))) throw bad('Một ảnh đã bị xóa khỏi thư viện. Vui lòng chọn lại.');
    return ids.map(id => safeImageUrl(byId.get(id)));
}
async function verifyFile(file) {
    const handle = await fs.open(file.path, 'r');
    const header = Buffer.alloc(12);
    try { await handle.read(header, 0, 12, 0); } finally { await handle.close(); }
    const valid = file.mimetype === 'image/jpeg' ? header[0] === 255 && header[1] === 216 && header[2] === 255
        : file.mimetype === 'image/png' ? header.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : file.mimetype === 'image/gif' ? ['GIF87a', 'GIF89a'].includes(header.subarray(0, 6).toString())
        : file.mimetype === 'image/webp' && header.subarray(0, 4).toString() === 'RIFF' && header.subarray(8, 12).toString() === 'WEBP';
    if (!valid) throw bad('Nội dung tệp không phải ảnh đúng định dạng. Vui lòng chọn ảnh khác.');
}
async function prepareGallery(req, vehicle = {}) {
    await Promise.all(filesOf(req).map(verifyFile));
    const cover = req.body.imageAssetId ? (await selectedAssets(req.body.imageAssetId))[0] : req.body.image?.trim() ? safeImageUrl(req.body.image) : null;
    const groups = [
        ['images', 'exteriorUrls', 'exteriorAssetIds', 'exteriorFiles', 12],
        ['interiorImages', 'interiorUrls', 'interiorAssetIds', 'interiorFiles', 12],
        ['spinImages', 'spinUrls', 'spinAssetIds', 'spinFiles', 36]
    ];
    const result = {};
    for (const [key, urlsField, assetsField, filesField, max] of groups) {
        let urls = list(req.body, urlsField, vehicle[key] || []);
        if (key === 'images' && cover) urls = [cover, ...urls.slice(1)];
        const uploads = [...(req.files?.[filesField] || [])];
        if (key === 'spinImages') uploads.sort((a, b) => a.originalname.localeCompare(b.originalname, 'en', { numeric: true }));
        urls.push(...await selectedAssets(req.body[assetsField]), ...uploads.map(file => `/uploads/vehicles/${file.filename}`));
        result[key] = [...new Set(urls)];
        if (result[key].length > max) throw bad(`Tối đa ${max} ảnh cho mỗi nhóm. Hãy bỏ bớt ảnh cũ trước khi thêm.`);
    }
    if (!result.images.length) result.images = ['/images/vehicle-placeholder.svg'];
    if (result.spinImages.length && result.spinImages.length < 8) throw bad('Ảnh xoay 360° cần ít nhất 8 góc chụp cùng một xe, xếp theo thứ tự quanh xe.');
    return result;
}
async function saveUploadAssets(req) {
    for (const file of filesOf(req)) await ImageAsset.create({ filename: file.filename, originalName: file.originalname, url: `/uploads/vehicles/${file.filename}`, mimeType: file.mimetype, size: file.size, uploadedBy: req.session.userId });
}
async function discardUploads(req) {
    const files = filesOf(req);
    for (const file of files) {
        const resolved = path.resolve(file.path);
        if (resolved.startsWith(uploadRoot + path.sep)) await fs.unlink(resolved).catch(() => {});
    }
    if (files.length) await ImageAsset.deleteMany({ filename: { $in: files.map(file => file.filename) } });
}
module.exports = { prepareGallery, saveUploadAssets, discardUploads };
