const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const request = require('supertest');
const { JSDOM } = require('jsdom');
const dbName = `sgp_gallery_test_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
process.env.MONGODB_URI = `mongodb://127.0.0.1:27017/${dbName}`;
process.env.NODE_ENV = 'test';
const app = require('../server');
const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const ImageAsset = require('../models/ImageAsset');
const uploadRoot = path.resolve(__dirname, '../public/uploads/vehicles');
let checks = 0;
const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1cAAAAASUVORK5CYII=', 'base64');
const tick = () => new Promise(resolve => setTimeout(resolve, 30));

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    const password = crypto.randomBytes(16).toString('hex');
    await User.create({ username: 'Gallery admin', email: 'admin@gallery.test', password, role: 'admin', phone: '0900000000' });
    const admin = request.agent(app);
    await admin.post('/login').type('form').send({ email: 'admin@gallery.test', password });
    const fields = { name: 'Xe thử <img src=x>', type: '7 cho', price: '400000', capacity: '7', luggageCapacity: '4', description: 'Xe thử nghiệm', isAvailable: 'true' };
    check((await request(app).post('/admin/vehicles').field(fields).attach('interiorFiles', png, 'unauthorized.png')).status, 403, 'Uploads require admin');
    let create = admin.post('/admin/vehicles').field(fields).attach('exteriorFiles', png, 'cover.png').attach('exteriorFiles', png, 'outside.png').attach('interiorFiles', png, 'seats.png').attach('interiorFiles', png, 'luggage.png');
    for (const n of [8, 2, 6, 1, 7, 3, 5, 4]) create = create.attach('spinFiles', png, `${String(n).padStart(2, '0')}.png`);
    check((await create).status, 302, 'Admin uploads all three groups');
    let vehicle = await Vehicle.findOne({ name: fields.name }).lean();
    assert(vehicle); const id = String(vehicle._id);
    check(vehicle.images.length, 2, 'Exterior images saved'); check(vehicle.interiorImages.length, 2, 'Interior images saved'); check(vehicle.spinImages.length, 8, '360 images saved');
    const assets = await ImageAsset.find().lean();
    const names = new Map(assets.map(a => [a.url, a.originalName]));
    check(vehicle.spinImages.map(url => names.get(url)), ['01.png', '02.png', '03.png', '04.png', '05.png', '06.png', '07.png', '08.png'], 'Spin uploads naturally sorted');
    const gallery = await request(app).get(`/api/vehicles/${id}/gallery`);
    check(gallery.status, 200, 'Guests can view available vehicle gallery'); check(gallery.body.interiorImages.length, 2, 'API returns interior photos'); check(gallery.body.driver, undefined, 'API does not expose driver record');
    check((await request(app).get('/api/vehicles/invalid/gallery')).status, 400, 'Invalid gallery ID rejected');
    const home = await request(app).get('/'); check(home.status, 200, 'Homepage renders gallery buttons'); check(home.text.includes(`data-open-gallery="${id}"`), true, 'Homepage image opens its own gallery');
    check(home.text.includes('Xe thử &lt;img src=x&gt;'), true, 'Vehicle name escaped in template');
    const booking = await admin.get('/booking'); check(booking.status, 200, 'Booking page renders'); check(booking.text.includes(`data-open-gallery="${id}"`), true, 'Booking image opens gallery');
    check((await admin.get(`/admin/vehicles/${id}/edit`)).text.includes('name="interiorFiles"'), true, 'Edit form includes interior upload');
    check((await admin.get('/admin')).text.includes('name="spinFiles"'), true, 'Create form includes spin upload');
    const seat = assets.find(a => a.url === vehicle.interiorImages[0]);
    await admin.post(`/admin/images/${seat._id}/delete`);
    check(Boolean(await ImageAsset.findById(seat._id)), true, 'Cannot delete library image used by interior gallery');
    const countBefore = await ImageAsset.countDocuments();
    const filesBefore = (await fs.readdir(uploadRoot)).sort();
    const invalid = await admin.post(`/admin/vehicles/${id}/edit`).field(fields).attach('interiorFiles', Buffer.from('not an image'), { filename: 'fake.png', contentType: 'image/png' });
    check(invalid.status, 400, 'Fake image contents rejected');
    check(await ImageAsset.countDocuments(), countBefore, 'Failed upload leaves no library assets');
    check((await fs.readdir(uploadRoot)).sort(), filesBefore, 'Failed upload leaves no files');
    check((await admin.post(`/admin/vehicles/${id}/edit`).type('form').send({ ...fields, interiorUrls: 'javascript:alert(1)' })).status, 400, 'Unsafe image URL rejected');
    check((await admin.post(`/admin/vehicles/${id}/edit`).type('form').send({ ...fields, spinUrls: 'https://example.test/one.png' })).status, 400, 'Incomplete 360 photo set rejected');
    check((await admin.post(`/admin/vehicles/${id}/edit`).type('form').send({ ...fields, interiorUrls: Array.from({length:13}, (_,n)=>`https://example.test/${n}.png`).join('\n') })).status, 400, 'Interior count bounded');
    check((await admin.post(`/admin/vehicles/${id}/edit`).field(fields).attach('interiorFiles', Buffer.alloc(5 * 1024 * 1024 + 1), 'too-big.png')).status, 400, 'Oversized upload rejected');
    check((await fs.readdir(uploadRoot)).sort(), filesBefore, 'Oversized upload cleaned up');
    check((await admin.post(`/admin/vehicles/${id}/edit`).type('form').send(fields)).status, 302, 'Legacy edit preserves gallery');
    check((await Vehicle.findById(id)).interiorImages.length, 2, 'Omitted gallery fields preserve images');
    await admin.post(`/admin/vehicles/${id}/edit`).type('form').send({ ...fields, interiorUrls: vehicle.interiorImages[1] });
    check((await Vehicle.findById(id)).interiorImages.length, 1, 'Remove one photo from vehicle');
    check(Boolean(await ImageAsset.findById(seat._id)), true, 'Removing from vehicle keeps library asset');
    await admin.post(`/admin/vehicles/${id}/edit`).type('form').send({ ...fields, interiorUrls: '', interiorAssetIds: String(seat._id) });
    check(Array.from((await Vehicle.findById(id)).interiorImages), [seat.url], 'Reuse interior photo from library');
    await Vehicle.updateOne({ _id: id }, { isAvailable: false });
    check((await request(app).get(`/api/vehicles/${id}/gallery`)).status, 404, 'Hidden vehicle gallery not public');
    await Vehicle.updateOne({ _id: id }, { isAvailable: true });
    await domTests(home.text, gallery.body);
    console.log(`PASS: ${checks} vehicle gallery, uploads, permissions and DOM checks.`);
}

async function domTests(html, data) {
    const dom = new JSDOM(html, { url: 'https://test.invalid/', runScripts: 'outside-only' });
    const w = dom.window, d = w.document;
    await new Promise(resolve => w.addEventListener('load', resolve, { once: true }));
    let language = 'vi', imageError = false, fetchError = false, reduced = false;
    w.matchMedia = () => ({ get matches() { return reduced; }, addEventListener() {} });
    w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
    w.HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new w.Event('close')); };
    w.Image = class { set src(value) { setTimeout(() => imageError ? this.onerror?.() : this.onload?.(), 1); } };
    w.fetch = async () => ({ ok: !fetchError, json: async () => structuredClone(data) });
    w.SGP_COPY = { vi: {}, en: {} };
    w.eval(await fs.readFile(path.join(__dirname, '../public/js/vehicle-gallery-copy.js'), 'utf8'));
    w.SGP_LOCALIZATION = { text: key => w.SGP_COPY[language][key] || key };
    w.eval(await fs.readFile(path.join(__dirname, '../public/js/vehicle-gallery.js'), 'utf8'));
    d.dispatchEvent(new w.Event('DOMContentLoaded'));
    const trigger = d.querySelector('[data-open-gallery]'), dialog = d.querySelector('[data-vehicle-gallery]'), image = d.querySelector('[data-gallery-image]');
    trigger.click(); await tick();
    check(dialog.open, true, 'Click opens modal'); check(image.hidden, false, 'First photo loads');
    check(d.querySelector('[data-gallery-name]').textContent, data.name, 'Gallery name safe text');
    check(d.querySelector('[data-gallery-name] img'), null, 'No HTML injection through name');
    check(image.classList.contains('gallery-photo-moving'), true, 'Still photo has automatic motion');
    d.querySelector('[data-gallery-motion]').click(); check(image.classList.contains('gallery-photo-moving'), false, 'Motion can be stopped');
    d.querySelector('[data-gallery-next]').click(); await tick(); check(image.getAttribute('src'), data.images[1], 'Next image');
    d.querySelector('[data-gallery-stage]').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); await tick(); check(image.getAttribute('src'), data.images[0], 'Keyboard navigation');
    d.querySelector('[data-gallery-mode="interior"]').click(); await tick(); check(image.getAttribute('src'), data.interiorImages[0], 'Interior tab selects correct group');
    check(d.querySelectorAll('[data-gallery-thumbnails] button').length, 2, 'Interior thumbnails');
    d.querySelector('[data-gallery-mode="spin"]').click(); await tick(); check(d.querySelector('[data-gallery-stage]').classList.contains('is-spin'), true, '360 stage enabled');
    d.querySelector('[data-gallery-motion]').click();
    const stage = d.querySelector('[data-gallery-stage]');
    for (const [type, x] of [['pointerdown', 120], ['pointermove', 150], ['pointerup', 150]]) { const event = new w.Event(type, { bubbles: true }); Object.assign(event, { clientX: x, pointerId: 1, button: 0 }); stage.dispatchEvent(event); }
    await tick(); check(image.getAttribute('src'), data.spinImages[6], 'Dragging rotates frame sequence');
    language = 'en'; w.dispatchEvent(new w.Event('sgp:languagechange')); check(d.querySelector('[data-gallery-mode="interior"]').textContent, 'Interior (2)', 'Gallery UI follows language');
    d.querySelector('[data-gallery-close]').click(); check(dialog.open, false, 'Close works'); check(d.activeElement, trigger, 'Focus returns to opener');
    data.interiorImages = []; data.spinImages = []; reduced = true;
    trigger.click(); await tick(); check(image.classList.contains('gallery-photo-moving'), false, 'Reduced motion disables autoplay');
    d.querySelector('[data-gallery-mode="interior"]').click(); check(d.querySelector('[data-gallery-status]').textContent.includes('not available'), true, 'Missing interior photos explained');
    check(image.hidden, true, 'No unrelated picture shown for empty group');
    d.querySelector('[data-gallery-close]').click(); imageError = true; trigger.click(); await tick();
    check(d.querySelector('[data-gallery-status]').textContent.includes('could not load'), true, 'Image failure explained');
    imageError = false; d.querySelector('[data-gallery-status] button').click(); await tick(); check(image.hidden, false, 'Image retry recovers');
    d.querySelector('[data-gallery-close]').click(); fetchError = true; trigger.click(); await tick();
    check(d.querySelector('[data-gallery-status]').textContent.includes('could not load the gallery'), true, 'API error shown');
    fetchError = false; d.querySelector('[data-gallery-status] button').click(); await tick(); check(image.hidden, false, 'API retry recovers');
    dialog.close(); w.close();
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
    if (mongoose.connection.readyState === 1 && mongoose.connection.name === dbName && dbName.startsWith('sgp_gallery_test_')) {
        const assets = await ImageAsset.find().lean();
        for (const asset of assets) { const filename = path.resolve(uploadRoot, asset.filename); if (filename.startsWith(uploadRoot + path.sep)) await fs.unlink(filename).catch(() => {}); }
        await mongoose.connection.dropDatabase();
    }
    await mongoose.disconnect(); process.exit(process.exitCode || 0);
});
