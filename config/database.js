const mongoose = require('mongoose');
const { mongoUri } = require('./runtime');

const connectDB = async () => {
    await mongoose.connect(mongoUri(), { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 });
    console.log('MongoDB connected successfully.');
};

module.exports = connectDB;
