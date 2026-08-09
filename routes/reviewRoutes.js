const router = require('express').Router();
const fs = require('fs/promises');
const auth = require('../controllers/authController');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const upload = require('../config/reviewUpload');
const { getReviewStats } = require('../services/reviewStats');

async function removeUploadedFiles(files = []) {
    await Promise.all(files.map(file => fs.unlink(file.path).catch(() => {})));
}

router.get('/bookings/:id/review', auth.isAuthenticated, async (req, res, next) => {
    try {
        if (req.session.role !== 'user') return res.redirect(`/bookings/${req.params.id}`);
        const booking = await Booking.findOne({ _id: req.params.id, user: req.session.userId })
            .populate({ path: 'vehicle', populate: { path: 'driver', select: 'username' } });
        if (!booking) return res.status(404).render('error', { title: 'Không tìm thấy', error: { message: 'Không tìm thấy đơn đặt xe.' } });
        if (booking.status !== 'completed') {
            req.flash('error', 'Bạn chỉ có thể đánh giá sau khi chuyến đi hoàn thành.');
            return res.redirect(`/bookings/${booking._id}`);
        }
        const review = await Review.findOne({ booking: booking._id }).lean();
        res.render('review-form', { title: 'Đánh giá chuyến đi', booking, review, error: null, form: {} });
    } catch (error) { next(error); }
});

router.post('/bookings/:id/review', auth.isAuthenticated, upload.array('images', 4), async (req, res, next) => {
    try {
        if (req.session.role !== 'user') { await removeUploadedFiles(req.files); return res.status(403).send('Không có quyền đánh giá.'); }
        const booking = await Booking.findOne({ _id: req.params.id, user: req.session.userId })
            .populate({ path: 'vehicle', populate: { path: 'driver', select: 'username' } });
        const tripRating = Number(req.body.tripRating);
        const driverRating = Number(req.body.driverRating);
        const comment = req.body.comment?.trim() || '';
        if (!booking || booking.status !== 'completed' || !Number.isInteger(tripRating) || tripRating < 1 || tripRating > 5 || !Number.isInteger(driverRating) || driverRating < 1 || driverRating > 5 || comment.length < 10 || comment.length > 2000) {
            await removeUploadedFiles(req.files);
            if (!booking) return res.status(404).render('error', { title: 'Không tìm thấy', error: { message: 'Không tìm thấy đơn đặt xe.' } });
            return res.status(400).render('review-form', { title: 'Đánh giá chuyến đi', booking, review: null, error: booking.status !== 'completed' ? 'Chuyến đi chưa hoàn thành.' : 'Vui lòng chấm đủ hai mục và nhập nhận xét từ 10–2.000 ký tự.', form: req.body });
        }
        if (await Review.exists({ booking: booking._id })) {
            await removeUploadedFiles(req.files);
            req.flash('error', 'Đơn này đã được đánh giá trước đó.');
            return res.redirect(`/bookings/${booking._id}`);
        }
        const driver = booking.vehicle?.driver;
        await Review.create({
            booking: booking._id,
            user: req.session.userId,
            vehicle: booking.vehicle?._id || booking.vehicle || null,
            driver: driver?._id || driver || null,
            vehicleName: booking.vehicle?.name || booking.vehicleSnapshot?.name || 'Xe đã phục vụ',
            driverName: driver?.username || 'Chưa gán tài xế',
            tripRating,
            driverRating,
            comment,
            images: (req.files || []).map(file => `/uploads/reviews/${file.filename}`)
        });
        req.flash('success', 'Cảm ơn bạn! Đánh giá đã được ghi nhận và cập nhật vào mức độ hài lòng.');
        res.redirect(`/bookings/${booking._id}`);
    } catch (error) {
        await removeUploadedFiles(req.files);
        if (error.code === 11000) { req.flash('error', 'Đơn này đã được đánh giá.'); return res.redirect(`/bookings/${req.params.id}`); }
        next(error);
    }
});

router.get('/reviews', async (req, res, next) => {
    try {
        const [reviews, reviewStats] = await Promise.all([
            Review.find({ isPublished: true }).populate('user', 'username').sort({ createdAt: -1 }).lean(),
            getReviewStats()
        ]);
        res.render('reviews', { title: 'Đánh giá khách hàng', reviews, reviewStats });
    } catch (error) { next(error); }
});

router.post('/admin/reviews/:id/toggle', auth.isAdmin, async (req, res, next) => {
    try {
        const review = await Review.findById(req.params.id);
        if (review) { review.isPublished = !review.isPublished; await review.save(); req.flash('success', `Đã ${review.isPublished ? 'hiện' : 'ẩn'} đánh giá.`); }
        res.redirect('/admin#reviews-management');
    } catch (error) { next(error); }
});

module.exports = router;
