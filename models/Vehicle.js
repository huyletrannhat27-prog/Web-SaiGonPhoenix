const mongoose = require('mongoose');

const vehicleSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        required: true,
        enum: ['4 cho', '7 cho', '9 cho', '16 cho', '26 cho', '29 cho', '45 cho', '9 cho vip', 'limousine']
    },
    price: {
        type: Number,
        required: true,
        min: 0
    },
    capacity: {
        type: Number,
        required: true,
        min: 1
    },
    luggageCapacity: {
        type: Number,
        default: 0
    },
    images: {
        type: [String],
        default: ['/images/vehicle-placeholder.svg']
    },
    interiorImages: { type: [String], default: [] },
    spinImages: { type: [String], default: [] },
    description: {
        type: String,
        default: ''
    },
    driver: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    isAvailable: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Vehicle', vehicleSchema);
