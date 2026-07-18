const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    vehicle: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Vehicle',
        required: true
    },
    vehicleSnapshot: {
        name: { type: String, default: 'Xe không xác định' },
        type: { type: String, default: '' },
        image: { type: String, default: '' },
        capacity: { type: Number, default: 0 }
    },
    airport: {
        type: String,
        required: true,
        enum: [
            'Sân bay Tân Sơn Nhất (SGN)',
            'Sân bay Nội Bài (HAN)',
            'Sân bay Cam Ranh (CXR)',
            'Sân bay Đà Nẵng (DAD)',
            'Sân bay Cần Thơ (VCA)',
            'Sân bay Phú Quốc (PQC)'
        ]
    },
    customerInfo: {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        pickupLocation: { type: String, default: '' },
        dropoffLocation: { type: String, default: '' },
        luggageCount: { type: Number, default: 0 },
        passengerCount: { type: Number, required: true, min: 1 },
        flightNumber: { type: String, default: '' }
    },
    bookingDate: {
        type: Date,
        required: true
    },
    tripType: { type: String, enum: ['airport-pickup', 'airport-dropoff'], default: 'airport-pickup' },
    note: { type: String, trim: true, maxlength: 500, default: '' },
    totalPrice: {
        type: Number,
        required: true,
        min: 0
    },
    payment: {
        option: { type: String, enum: ['deposit', 'full'], default: 'deposit' },
        requiredAmount: { type: Number, default: 0, min: 0 },
        paidAmount: { type: Number, default: 0, min: 0 },
        status: { type: String, enum: ['awaiting_payment', 'pending_review', 'partial', 'paid'], default: 'awaiting_payment' },
        submittedAt: Date,
        confirmedAt: Date
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'completed', 'cancelled'],
        default: 'pending'
    },
    socialApps: {
        whatsapp: { type: String, default: '' },
        line: { type: String, default: '' },
        viber: { type: String, default: '' },
        wechat: { type: String, default: '' }
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Booking', bookingSchema);
