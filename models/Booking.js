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
    airport: {
        type: String,
        required: true,
        enum: [
            'Sân bay Tân Sơn Nhất (SGN)',
            'Sân bay Nội Bài (HAN)',
            'Sân bay Cam Ranh (CXR)',
            'Sân bay Đà Nẵng (DAD)',
            'Sân bay Cần Thơ (VCA)'
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
    totalPrice: {
        type: Number,
        required: true,
        min: 0
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