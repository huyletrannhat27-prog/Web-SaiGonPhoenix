const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    phone: {
        type: String,
        trim: true
    },
    profile: {
        dateOfBirth: { type: Date, default: null },
        gender: { type: String, enum: ['', 'male', 'female', 'other'], default: '' },
        address: { type: String, trim: true, maxlength: 250, default: '' },
        city: { type: String, trim: true, maxlength: 100, default: '' },
        country: { type: String, trim: true, maxlength: 100, default: '' },
        emergencyContactName: { type: String, trim: true, maxlength: 100, default: '' },
        emergencyContactPhone: { type: String, trim: true, maxlength: 30, default: '' }
    },
    role: {
        type: String,
        enum: ['user', 'admin', 'driver'],
        default: 'user'
    },
    driverProfile: {
        licensePlate: { type: String, trim: true, default: '' },
        yearsExperience: { type: Number, min: 0, default: 0 },
        zalo: { type: String, trim: true, default: '' },
        photo: { type: String, trim: true, default: '' },
        note: { type: String, trim: true, maxlength: 500, default: '' }
    },
    isActive: {
        type: Boolean,
        default: true
    },
    resetPasswordToken: { type: String, select: false },
    resetPasswordExpires: { type: Date, select: false }
}, {
    timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.index({ email: 1 }, { unique: true });

module.exports = mongoose.model('User', userSchema);
