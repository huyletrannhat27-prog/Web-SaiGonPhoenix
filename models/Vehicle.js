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
        enum: ['4 cho', '7 cho', '9 cho', 'Sedona', '16 cho', '29 cho', '45 cho', '9 cho vip']
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
        default: ['/images/default-car.jpg']
    },
    description: {
        type: String,
        default: ''
    },
    isAvailable: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Vehicle', vehicleSchema);