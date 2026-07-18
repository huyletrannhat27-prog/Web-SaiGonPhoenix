const User = require('../models/User');
const Vehicle = require('../models/Vehicle');
const PaymentSettings = require('../models/PaymentSettings');
const Booking = require('../models/Booking');

const vehicles = [
    { name: 'Toyota Vios', type: '4 cho', price: 250000, capacity: 4, luggageCapacity: 2, description: 'Gọn gàng, tiết kiệm, phù hợp cá nhân và gia đình nhỏ.', images: ['https://images.unsplash.com/photo-1550355291-bbee04a92027?auto=format&fit=crop&w=900&q=80'] },
    { name: 'Toyota Innova', type: '7 cho', price: 380000, capacity: 7, luggageCapacity: 4, description: 'Không gian rộng rãi cho gia đình và nhóm bạn.', images: ['https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=900&q=80'] },
    { name: 'Kia Carnival VIP', type: '9 cho vip', price: 750000, capacity: 9, luggageCapacity: 5, description: 'Khoang xe cao cấp, tiện nghi cho khách VIP.', images: ['https://images.unsplash.com/photo-1609521263047-f8f205293f24?auto=format&fit=crop&w=900&q=80'] },
    { name: 'Ford Transit', type: '16 cho', price: 950000, capacity: 16, luggageCapacity: 12, description: 'Phù hợp đoàn du lịch và doanh nghiệp.', images: ['https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=900&q=80'] }
];

exports.seedInitialData = async () => {
    const adminEmail = (process.env.ADMIN_EMAIL || 'admin@saigonphoenix.com').toLowerCase();
    if (!await User.findOne({ email: adminEmail })) {
        await User.create({ username: 'Quản trị viên', email: adminEmail, password: process.env.ADMIN_PASSWORD || 'admin123', phone: '0900000000', role: 'admin' });
        console.log(`Đã tạo tài khoản admin: ${adminEmail}`);
    }
    if (await Vehicle.countDocuments() === 0) await Vehicle.insertMany(vehicles);
    await PaymentSettings.findOneAndUpdate(
        { key: 'bank-transfer' },
        { $setOnInsert: { bankId: process.env.BANK_ID || '', bankName: process.env.BANK_NAME || '', accountNo: process.env.BANK_ACCOUNT_NO || '', accountName: process.env.BANK_ACCOUNT_NAME || '', qrTemplate: 'compact2' } },
        { upsert: true }
    );
    const legacyBookings = await Booking.find({ $or: [{ 'vehicleSnapshot.name': { $exists: false } }, { 'payment.requiredAmount': { $exists: false } }] }).populate('vehicle');
    for (const booking of legacyBookings) {
        if (booking.vehicle) booking.vehicleSnapshot = { name: booking.vehicle.name, type: booking.vehicle.type, image: booking.vehicle.images[0] || '', capacity: booking.vehicle.capacity };
        if (!booking.payment?.requiredAmount) booking.payment = { option: 'deposit', requiredAmount: Math.round(booking.totalPrice * 0.3), paidAmount: 0, status: 'awaiting_payment' };
        await booking.save();
    }
};
