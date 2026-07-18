const router = require('express').Router();
const auth = require('../controllers/authController');
const Booking = require('../models/Booking');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const PaymentSettings = require('../models/PaymentSettings');
const ImageAsset = require('../models/ImageAsset');
const upload = require('../config/upload');
const fs = require('fs/promises');
const path = require('path');

router.use(require('./authRoutes'));
router.use(require('./bookingRoutes'));
router.use(require('./vehicleRoutes'));

router.get('/', async (req, res, next) => {
    try { res.render('index', { title: 'SaiGonPhoenix - Đưa đón sân bay', vehicles: await Vehicle.find({ isAvailable: true }).sort({ price: 1 }).limit(4) }); } catch (error) { next(error); }
});
router.get('/about', (req, res) => res.render('about', { title: 'Giới thiệu' }));
router.get('/dashboard', auth.isAuthenticated, async (req, res, next) => {
    if (req.session.role === 'admin') return res.redirect('/admin');
    try {
        const bookings = await Booking.find({ user: req.session.userId }).populate('vehicle').sort({ createdAt: -1 });
        const stats = { total: bookings.length, pending: 0, confirmed: 0, completed: 0 };
        bookings.forEach(item => { if (stats[item.status] !== undefined) stats[item.status]++; });
        res.render('dashboard', { title: 'Đơn xe của tôi', bookings, stats });
    } catch (error) { next(error); }
});

router.get('/admin', auth.isAdmin, async (req, res, next) => {
    try {
        const [bookings, vehicles, userCount, bank, imageAssets] = await Promise.all([Booking.find().populate('vehicle').populate('user', 'username email phone').sort({ createdAt: -1 }), Vehicle.find().sort({ createdAt: -1 }), User.countDocuments({ role: 'user' }), PaymentSettings.findOne({ key: 'bank-transfer' }).lean(), ImageAsset.find().sort({ createdAt: -1 }).lean()]);
        res.render('admin', { title: 'Quản trị hệ thống', bookings, vehicles, userCount, bank: bank || {}, imageAssets });
    } catch (error) { next(error); }
});
router.post('/admin/bookings/:id/status', auth.isAdmin, async (req, res, next) => {
    try {
        if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(req.body.status)) return res.status(400).send('Trạng thái không hợp lệ');
        await Booking.findByIdAndUpdate(req.params.id, { status: req.body.status }, { runValidators: true });
        req.flash('success', 'Đã cập nhật trạng thái đơn.'); res.redirect('/admin');
    } catch (error) { next(error); }
});
router.post('/admin/vehicles', auth.isAdmin, async (req, res, next) => {
    try {
        const data = { name: req.body.name, type: req.body.type, price: +req.body.price, capacity: +req.body.capacity, luggageCapacity: +req.body.luggageCapacity || 0, description: req.body.description };
        const selectedAsset = req.body.imageAssetId ? await ImageAsset.findById(req.body.imageAssetId) : null;
        if (selectedAsset) data.images = [selectedAsset.url];
        else if (req.body.image?.trim()) data.images = [req.body.image.trim()];
        await Vehicle.create(data);
        req.flash('success', 'Đã thêm xe mới.'); res.redirect('/admin#vehicles');
    } catch (error) { next(error); }
});
router.get('/admin/vehicles/:id/edit', auth.isAdmin, async (req, res, next) => {
    try {
        const [vehicle, imageAssets] = await Promise.all([Vehicle.findById(req.params.id), ImageAsset.find().sort({ createdAt: -1 }).lean()]);
        if (!vehicle) return res.status(404).render('error', { title: 'Không tìm thấy xe', error: { message: 'Xe này không tồn tại hoặc đã bị xóa.' } });
        res.render('vehicle-edit', { title: `Chỉnh sửa ${vehicle.name}`, vehicle, imageAssets, error: null });
    } catch (error) { next(error); }
});
router.post('/admin/vehicles/:id/edit', auth.isAdmin, async (req, res, next) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);
        if (!vehicle) return res.status(404).render('error', { title: 'Không tìm thấy xe', error: { message: 'Xe này không tồn tại hoặc đã bị xóa.' } });
        const price = Number(req.body.price);
        const capacity = Number(req.body.capacity);
        const luggageCapacity = Number(req.body.luggageCapacity || 0);
        if (!req.body.name?.trim() || !['4 cho','7 cho','9 cho','9 cho vip','16 cho','29 cho','45 cho'].includes(req.body.type) || !Number.isFinite(price) || price < 0 || !Number.isInteger(capacity) || capacity < 1 || !Number.isInteger(luggageCapacity) || luggageCapacity < 0) {
            const imageAssets = await ImageAsset.find().sort({ createdAt: -1 }).lean();
            return res.status(400).render('vehicle-edit', { title: `Chỉnh sửa ${vehicle.name}`, vehicle: Object.assign(vehicle, req.body), imageAssets, error: 'Thông tin xe chưa hợp lệ. Vui lòng kiểm tra lại.' });
        }
        vehicle.name = req.body.name.trim();
        vehicle.type = req.body.type;
        vehicle.price = price;
        vehicle.capacity = capacity;
        vehicle.luggageCapacity = luggageCapacity;
        vehicle.description = req.body.description?.trim() || '';
        vehicle.isAvailable = req.body.isAvailable === 'true';
        const selectedAsset = req.body.imageAssetId ? await ImageAsset.findById(req.body.imageAssetId) : null;
        if (selectedAsset) vehicle.images = [selectedAsset.url];
        else if (req.body.image?.trim()) vehicle.images = [req.body.image.trim()];
        await vehicle.save();
        req.flash('success', `Đã cập nhật xe ${vehicle.name}.`);
        res.redirect('/admin#vehicles');
    } catch (error) { next(error); }
});
router.post('/admin/vehicles/:id/toggle', auth.isAdmin, async (req, res, next) => {
    try { const vehicle = await Vehicle.findById(req.params.id); if (vehicle) { vehicle.isAvailable = !vehicle.isAvailable; await vehicle.save(); } res.redirect('/admin#vehicles'); } catch (error) { next(error); }
});
router.post('/admin/vehicles/:id/delete', auth.isAdmin, async (req, res, next) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);
        if (!vehicle) { req.flash('error', 'Không tìm thấy xe.'); return res.redirect('/admin#vehicles'); }
        await Booking.updateMany({ vehicle: vehicle._id }, { $set: { vehicleSnapshot: { name: vehicle.name, type: vehicle.type, image: vehicle.images[0] || '', capacity: vehicle.capacity } } });
        await vehicle.deleteOne();
        req.flash('success', `Đã xóa vĩnh viễn xe ${vehicle.name}. Lịch sử đơn cũ vẫn được giữ lại.`);
        res.redirect('/admin#vehicles');
    } catch (error) { next(error); }
});
router.post('/admin/images', auth.isAdmin, upload.single('vehicleImage'), async (req, res, next) => {
    try {
        if (!req.file) { req.flash('error', 'Vui lòng chọn một ảnh hợp lệ.'); return res.redirect('/admin#image-library'); }
        await ImageAsset.create({ filename: req.file.filename, originalName: req.file.originalname, url: `/uploads/vehicles/${req.file.filename}`, mimeType: req.file.mimetype, size: req.file.size, uploadedBy: req.session.userId });
        req.flash('success', 'Đã tải ảnh vào thư viện. Bạn có thể chọn ảnh này khi thêm xe.');
        res.redirect('/admin#image-library');
    } catch (error) { if (req.file) await fs.unlink(req.file.path).catch(() => {}); next(error); }
});
router.post('/admin/images/:id/delete', auth.isAdmin, async (req, res, next) => {
    try {
        const image = await ImageAsset.findById(req.params.id);
        if (!image) { req.flash('error', 'Không tìm thấy ảnh.'); return res.redirect('/admin#image-library'); }
        if (await Vehicle.exists({ images: image.url })) { req.flash('error', 'Ảnh đang được một xe sử dụng nên chưa thể xóa.'); return res.redirect('/admin#image-library'); }
        const uploadRoot = path.resolve(__dirname, '..', 'public', 'uploads', 'vehicles');
        const filePath = path.resolve(uploadRoot, image.filename);
        if (!filePath.startsWith(`${uploadRoot}${path.sep}`)) throw new Error('Đường dẫn ảnh không hợp lệ.');
        await fs.unlink(filePath).catch(error => { if (error.code !== 'ENOENT') throw error; });
        await image.deleteOne();
        req.flash('success', 'Đã xóa ảnh khỏi thư viện.'); res.redirect('/admin#image-library');
    } catch (error) { next(error); }
});
router.post('/admin/payment-settings', auth.isAdmin, async (req, res, next) => {
    try {
        const { bankId, bankName, accountNo, accountName } = req.body;
        if (!bankId || !bankName || !/^\d{6,19}$/.test(accountNo || '') || !accountName) {
            req.flash('error', 'Thông tin ngân hàng chưa hợp lệ. Số tài khoản phải gồm 6–19 chữ số.');
            return res.redirect('/admin#payment-settings');
        }
        await PaymentSettings.findOneAndUpdate({ key: 'bank-transfer' }, { bankId: bankId.trim(), bankName: bankName.trim(), accountNo: accountNo.trim(), accountName: accountName.trim().toUpperCase(), qrTemplate: 'compact2' }, { upsert: true, runValidators: true });
        req.flash('success', 'Đã cập nhật tài khoản nhận thanh toán và mã VietQR.');
        res.redirect('/admin#payment-settings');
    } catch (error) { next(error); }
});
router.post('/admin/bookings/:id/payment', auth.isAdmin, async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id);
        const paidAmount = Math.round(Number(req.body.paidAmount));
        if (!booking || !Number.isFinite(paidAmount) || paidAmount < 0 || paidAmount > booking.totalPrice) {
            req.flash('error', 'Số tiền đã nhận không hợp lệ.'); return res.redirect('/admin');
        }
        const minimumToConfirm = booking.payment.status === 'partial' ? booking.totalPrice : booking.payment.requiredAmount;
        if (paidAmount < minimumToConfirm) {
            req.flash('error', `Chưa thể xác nhận: cần nhận đủ ${minimumToConfirm.toLocaleString('vi-VN')}đ cho đợt thanh toán này.`);
            return res.redirect('/admin');
        }
        booking.payment.paidAmount = paidAmount;
        booking.payment.status = paidAmount >= booking.totalPrice ? 'paid' : 'partial';
        booking.payment.confirmedAt = new Date();
        await booking.save();
        req.flash('success', 'Đã xác nhận số tiền khách thanh toán.'); res.redirect('/admin');
    } catch (error) { next(error); }
});

module.exports = router;
