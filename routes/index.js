const router = require('express').Router();
const auth = require('../controllers/authController');
const Booking = require('../models/Booking');
const Vehicle = require('../models/Vehicle');
const User = require('../models/User');
const PaymentSettings = require('../models/PaymentSettings');
const ImageAsset = require('../models/ImageAsset');
const SiteSettings = require('../models/SiteSettings');
const Review = require('../models/Review');
const upload = require('../config/upload');
const vehiclePhotosUpload = require('../config/vehiclePhotosUpload');
const { prepareGallery, saveUploadAssets, discardUploads } = require('../services/vehicleGallery');
const fs = require('fs/promises');
const path = require('path');
const { archiveOverdueBookings, findGloballyBusyVehicleIds } = require('../services/bookingLifecycle');
const { syncBookingFlight } = require('../services/flightTracker');
const { getReviewStats } = require('../services/reviewStats');
const { getUnansweredChatCounts } = require('../services/chatStatus');
const { getAdminAnalytics } = require('../services/analytics');

const vehicleTypes = ['4 cho','7 cho','9 cho','9 cho vip','16 cho','26 cho','29 cho','45 cho','limousine'];

router.use(require('./authRoutes'));
router.use(require('./bookingRoutes'));
router.use(require('./vehicleRoutes'));
router.use(require('./chatRoutes'));
router.use(require('./reviewRoutes'));
router.use(require('./localizationRoutes'));
router.use(require('./analyticsRoutes'));
router.use(require('./profileRoutes'));
router.use(require('./calendarRoutes'));

router.get('/', async (req, res, next) => {
    try {
        await archiveOverdueBookings();
        const busy = await findGloballyBusyVehicleIds();
        const [vehicles, reviewStats] = await Promise.all([
            Vehicle.find({ isAvailable: true, _id: { $nin: busy } }).sort({ price: 1 }).limit(8),
            getReviewStats()
        ]);
        res.render('index', { title: 'SaiGonPhoenix - Đưa đón sân bay', vehicles, reviewStats });
    } catch (error) { next(error); }
});
router.get('/about', (req, res) => res.render('about', { title: 'Giới thiệu' }));
router.get('/dashboard', auth.isAuthenticated, async (req, res, next) => {
    if (req.session.role === 'admin') return res.redirect('/admin');
    if (req.session.role === 'driver') return res.redirect('/driver');
    try {
        await archiveOverdueBookings();
        const bookings = await Booking.find({ user: req.session.userId }).populate({ path: 'vehicle', populate: { path: 'driver', select: 'username phone driverProfile' } }).sort({ createdAt: -1 });
        const stats = { total: bookings.length, pending: 0, confirmed: 0, completed: 0 };
        bookings.forEach(item => { if (stats[item.status] !== undefined) stats[item.status]++; });
        const reviewedBookingIds = new Set((await Review.find({ user: req.session.userId }).distinct('booking')).map(String));
        res.render('dashboard', { title: 'Đơn xe của tôi', bookings, stats, reviewedBookingIds });
    } catch (error) { next(error); }
});

router.get('/admin', auth.isAdmin, async (req, res, next) => {
    try {
        await archiveOverdueBookings();
        const [bookings, vehicles, drivers, userCount, bank, imageAssets, reviews, reviewStats, unansweredChats, analytics] = await Promise.all([
            Booking.find().populate('assignedDriver', 'username phone driverProfile').populate({ path: 'vehicle', populate: { path: 'driver', select: 'username phone driverProfile' } }).populate('user', 'username email phone').sort({ bookingDate: 1 }),
            Vehicle.find().populate('driver', 'username phone driverProfile').sort({ createdAt: -1 }),
            User.find({ role: 'driver' }).sort({ username: 1 }), User.countDocuments({ role: 'user' }),
            PaymentSettings.findOne({ key: 'bank-transfer' }).lean(), ImageAsset.find().sort({ createdAt: -1 }).lean(),
            Review.find().populate('user', 'username').sort({ createdAt: -1 }).lean(), getReviewStats(), getUnansweredChatCounts(), getAdminAnalytics(req.query)
        ]);
        const bookingGroups = {
            pending: bookings.filter(item => item.status === 'pending'),
            serving: bookings.filter(item => item.status === 'confirmed'),
            completed: bookings.filter(item => ['completed', 'cancelled', 'expired'].includes(item.status)).sort((a, b) => new Date(b.bookingDate) - new Date(a.bookingDate))
        };
        res.render('admin', { title: 'Quản trị hệ thống', bookings, bookingGroups, vehicles, drivers, vehicleTypes, userCount, bank: bank || {}, imageAssets, reviews, reviewStats, analytics, unansweredChatCounts: unansweredChats.byUser, unansweredChatTotal: unansweredChats.total });
    } catch (error) { next(error); }
});

router.get('/driver', auth.isDriver, async (req, res, next) => {
    try {
        await archiveOverdueBookings();
        const vehicleIds = await Vehicle.distinct('_id', { driver: req.session.userId });
        const bookings = await Booking.find({ $or: [{ assignedDriver: req.session.userId }, { vehicle: { $in: vehicleIds } }], status: 'confirmed' }).populate('vehicle').populate('user', 'username phone').sort({ bookingDate: 1 });
        res.render('driver', { title: 'Chuyến xe của tài xế', bookings });
    } catch (error) { next(error); }
});
router.post('/admin/bookings/:id/status', auth.isAdmin, async (req, res, next) => {
    try {
        const labels = { pending: 'Chờ xác nhận', confirmed: 'Chờ phục vụ', completed: 'Hoàn thành', cancelled: 'Đã hủy', expired: 'Quá hạn' };
        if (!['pending', 'confirmed', 'completed', 'cancelled'].includes(req.body.status)) return res.status(400).send('Trạng thái không hợp lệ');
        const booking = await Booking.findById(req.params.id).populate({ path: 'vehicle', populate: { path: 'driver', select: 'username driverProfile' } });
        if (!booking) { req.flash('error', 'Không tìm thấy đơn cần cập nhật.'); return res.redirect('/admin'); }
        if (req.body.status === 'confirmed') {
            const busy = await Booking.exists({ _id: { $ne: booking._id }, vehicle: booking.vehicle?._id || booking.vehicle, status: 'confirmed', bookingDate: { $gt: new Date(Date.now() - Number(process.env.BOOKING_ARCHIVE_HOURS || 2) * 3600000) } });
            if (busy) { req.flash('error', `Không thể xác nhận: xe ${booking.vehicle?.name || booking.vehicleSnapshot.name} đang phục vụ một đơn khác.`); return res.redirect('/admin#pending-bookings'); }
            const driver = booking.vehicle?.driver;
            booking.assignedDriver = driver?._id || driver || null;
            booking.driverSnapshot = { name: driver?.username || '', licensePlate: driver?.driverProfile?.licensePlate || '' };
        }
        booking.status = req.body.status;
        await booking.save();
        req.flash('success', `Đơn #${booking._id.toString().slice(-8).toUpperCase()} đã chuyển sang “${labels[req.body.status]}”. Xe đã chọn: ${booking.vehicle?.name || booking.vehicleSnapshot.name}.`);
        res.redirect(`/admin#${req.body.status === 'pending' ? 'pending-bookings' : req.body.status === 'confirmed' ? 'serving-bookings' : 'completed-bookings'}`);
    } catch (error) { next(error); }
});
router.post('/admin/bookings/:id/sync-flight', auth.isAdmin, async (req, res, next) => {
    try {
        const booking = await Booking.findById(req.params.id);
        if (!booking) { req.flash('error', 'Không tìm thấy đơn.'); return res.redirect('/admin'); }
        const tracking = await syncBookingFlight(booking);
        req.flash(tracking?.status === 'error' ? 'error' : 'success', tracking ? `Chuyến bay ${booking.customerInfo.flightNumber}: ${tracking.message}` : 'Đơn này không cần theo dõi chuyến bay.');
        res.redirect('/admin#serving-bookings');
    } catch (error) { next(error); }
});

router.post('/admin/drivers', auth.isAdmin, async (req, res, next) => {
    try {
        const { username, email, phone, password, licensePlate, yearsExperience, zalo, photo, note } = req.body;
        if (!username?.trim() || !email?.trim() || !phone?.trim() || !password || password.length < 6) {
            req.flash('error', 'Thông tin tài xế chưa đủ hoặc mật khẩu dưới 6 ký tự.'); return res.redirect('/admin#drivers');
        }
        await User.create({ username: username.trim(), email: email.toLowerCase().trim(), phone: phone.trim(), password, role: 'driver', driverProfile: { licensePlate, yearsExperience: Number(yearsExperience || 0), zalo, photo, note } });
        req.flash('success', `Đã tạo tài khoản tài xế ${username.trim()}.`); res.redirect('/admin#drivers');
    } catch (error) { if (error.code === 11000) { req.flash('error', 'Email tài xế đã được sử dụng.'); return res.redirect('/admin#drivers'); } next(error); }
});
router.post('/admin/drivers/:id/edit', auth.isAdmin, async (req, res, next) => {
    try {
        const driver = await User.findOne({ _id: req.params.id, role: 'driver' });
        if (!driver) { req.flash('error', 'Không tìm thấy tài xế.'); return res.redirect('/admin#drivers'); }
        driver.username = req.body.username?.trim() || driver.username;
        driver.phone = req.body.phone?.trim() || driver.phone;
        driver.isActive = req.body.isActive === 'true';
        driver.driverProfile = { licensePlate: req.body.licensePlate, yearsExperience: Number(req.body.yearsExperience || 0), zalo: req.body.zalo, photo: req.body.photo, note: req.body.note };
        if (req.body.password) driver.password = req.body.password;
        await driver.save();
        req.flash('success', `Đã cập nhật tài xế ${driver.username}.`); res.redirect('/admin#drivers');
    } catch (error) { next(error); }
});
router.post('/admin/vehicles', auth.isAdmin, vehiclePhotosUpload, async (req, res, next) => {
    try {
        const data = { name: req.body.name, type: req.body.type, price: +req.body.price, capacity: +req.body.capacity, luggageCapacity: +req.body.luggageCapacity || 0, description: req.body.description, driver: req.body.driverId || null };
        Object.assign(data, await prepareGallery(req));
        const vehicle = new Vehicle(data);
        await vehicle.validate();
        await saveUploadAssets(req);
        await vehicle.save();
        req.flash('success', 'Đã thêm xe mới.'); res.redirect('/admin#vehicles');
    } catch (error) { await discardUploads(req); next(error); }
});
router.get('/admin/vehicles/:id/edit', auth.isAdmin, async (req, res, next) => {
    try {
        const [vehicle, imageAssets, drivers] = await Promise.all([Vehicle.findById(req.params.id), ImageAsset.find().sort({ createdAt: -1 }).lean(), User.find({ role: 'driver', isActive: true }).sort({ username: 1 })]);
        if (!vehicle) return res.status(404).render('error', { title: 'Không tìm thấy xe', error: { message: 'Xe này không tồn tại hoặc đã bị xóa.' } });
        res.render('vehicle-edit', { title: `Chỉnh sửa ${vehicle.name}`, vehicle, imageAssets, drivers, vehicleTypes, error: null });
    } catch (error) { next(error); }
});
router.post('/admin/vehicles/:id/edit', auth.isAdmin, vehiclePhotosUpload, async (req, res, next) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);
        if (!vehicle) { await discardUploads(req); return res.status(404).render('error', { title: 'Không tìm thấy xe', error: { message: 'Xe này không tồn tại hoặc đã bị xóa.' } }); }
        const price = Number(req.body.price);
        const capacity = Number(req.body.capacity);
        const luggageCapacity = Number(req.body.luggageCapacity || 0);
        if (!req.body.name?.trim() || !vehicleTypes.includes(req.body.type) || !Number.isFinite(price) || price < 0 || !Number.isInteger(capacity) || capacity < 1 || !Number.isInteger(luggageCapacity) || luggageCapacity < 0) {
            await discardUploads(req);
            const [imageAssets, drivers] = await Promise.all([ImageAsset.find().sort({ createdAt: -1 }).lean(), User.find({ role: 'driver', isActive: true })]);
            return res.status(400).render('vehicle-edit', { title: `Chỉnh sửa ${vehicle.name}`, vehicle: Object.assign(vehicle, req.body), imageAssets, drivers, vehicleTypes, error: 'Thông tin xe chưa hợp lệ. Vui lòng kiểm tra lại.' });
        }
        vehicle.name = req.body.name.trim();
        vehicle.type = req.body.type;
        vehicle.price = price;
        vehicle.capacity = capacity;
        vehicle.luggageCapacity = luggageCapacity;
        vehicle.description = req.body.description?.trim() || '';
        vehicle.isAvailable = req.body.isAvailable === 'true';
        vehicle.driver = req.body.driverId || null;
        Object.assign(vehicle, await prepareGallery(req, vehicle));
        await vehicle.validate();
        await saveUploadAssets(req);
        await vehicle.save();
        req.flash('success', `Đã cập nhật xe ${vehicle.name}.`);
        res.redirect('/admin#vehicles');
    } catch (error) { await discardUploads(req); next(error); }
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
        if (await Vehicle.exists({ $or: [{ images: image.url }, { interiorImages: image.url }, { spinImages: image.url }] })) { req.flash('error', 'Ảnh đang được một xe sử dụng nên chưa thể xóa.'); return res.redirect('/admin#image-library'); }
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
router.post('/admin/contact-settings', auth.isAdmin, async (req, res, next) => {
    try {
        const hotline = req.body.hotline?.trim() || '';
        const zaloPhone = req.body.zaloPhone?.replace(/\s/g, '') || '';
        const zaloUrl = req.body.zaloUrl?.trim() || '';
        if (zaloPhone && !/^\+?\d{9,15}$/.test(zaloPhone)) {
            req.flash('error', 'Số Zalo chưa hợp lệ. Vui lòng nhập 9–15 chữ số.');
            return res.redirect('/admin#contact-settings');
        }
        if (zaloUrl && !/^https:\/\/(zalo\.me|oa\.zalo\.me)\//i.test(zaloUrl)) {
            req.flash('error', 'Liên kết Zalo phải bắt đầu bằng https://zalo.me/ hoặc https://oa.zalo.me/.');
            return res.redirect('/admin#contact-settings');
        }
        const socialFields = ['wechat','whatsapp','facebook','tiktok','line','viber','x','instagram','telegram'];
        const social = Object.fromEntries(socialFields.map(field => [field, req.body[field]?.trim() || '']));
        const autoReplyTemplates = String(req.body.autoReplyTemplates || '').split(/\r?\n/).map(item => item.trim()).filter(Boolean).slice(0, 30).map(item => item.slice(0, 300));
        await SiteSettings.findOneAndUpdate({ key: 'support-contact' }, { hotline, zaloPhone, zaloUrl, supportHours: req.body.supportHours?.trim() || 'Hỗ trợ 24/7', ...social, autoReplyEnabled: req.body.autoReplyEnabled === 'true', autoReplyTemplates: autoReplyTemplates.length ? autoReplyTemplates : SiteSettings.defaultAutoReplyTemplates }, { upsert: true, runValidators: true });
        req.flash('success', 'Đã cập nhật hotline và kênh chat Zalo.');
        res.redirect('/admin#contact-settings');
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
        const paymentLabel = booking.payment.status === 'paid' ? 'Đã trả đủ 100%' : 'Đã nhận cọc';
        req.flash('success', `Đơn #${booking._id.toString().slice(-8).toUpperCase()}: ${paymentLabel}, đã nhận ${paidAmount.toLocaleString('vi-VN')}đ / ${booking.totalPrice.toLocaleString('vi-VN')}đ.`); res.redirect('/admin');
    } catch (error) { next(error); }
});

module.exports = router;
