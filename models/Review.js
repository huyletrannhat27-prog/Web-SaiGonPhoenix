const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    vehicle: { type: mongoose.Schema.Types.ObjectId, ref: 'Vehicle', default: null },
    driver: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    vehicleName: { type: String, trim: true, required: true },
    driverName: { type: String, trim: true, default: 'Chưa gán tài xế' },
    tripRating: { type: Number, min: 1, max: 5, required: true },
    driverRating: { type: Number, min: 1, max: 5, required: true },
    comment: { type: String, trim: true, maxlength: 2000, required: true },
    images: [{ type: String, trim: true }],
    isPublished: { type: Boolean, default: true, index: true }
}, { timestamps: true });

reviewSchema.index({ isPublished: 1, createdAt: -1 });

module.exports = mongoose.model('Review', reviewSchema);
