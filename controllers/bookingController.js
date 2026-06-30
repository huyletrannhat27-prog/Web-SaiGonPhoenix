const Vehicle = require('../models/Vehicle');

// Lấy danh sách tất cả xe
exports.getAllVehicles = async (req, res) => {
    try {
        const vehicles = await Vehicle.find({ isAvailable: true });
        res.json(vehicles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Lấy xe theo loại
exports.getVehiclesByType = async (req, res) => {
    try {
        const { type } = req.params;
        const vehicles = await Vehicle.find({ 
            type: type, 
            isAvailable: true 
        });
        res.json(vehicles);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Lấy hình ảnh của xe
exports.getVehicleImages = async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);
        if (!vehicle) {
            return res.status(404).json({ error: 'Không tìm thấy xe' });
        }
        res.json({ 
            images: vehicle.images || ['/default-car.jpg'],
            name: vehicle.name 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Lấy chi tiết xe
exports.getVehicleDetail = async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);
        if (!vehicle) {
            return res.status(404).json({ error: 'Không tìm thấy xe' });
        }
        res.json(vehicle);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ADMIN: Thêm xe mới
exports.addVehicle = async (req, res) => {
    try {
        const { name, type, price, capacity, luggageCapacity, description, images } = req.body;
        
        const vehicle = new Vehicle({
            name,
            type,
            price: parseInt(price),
            capacity: parseInt(capacity) || 0,
            luggageCapacity: parseInt(luggageCapacity) || 0,
            description: description || '',
            images: images || ['/default-car.jpg'],
            isAvailable: true
        });

        await vehicle.save();
        res.status(201).json({ 
            success: true, 
            message: 'Thêm xe thành công', 
            vehicle 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ADMIN: Cập nhật xe
exports.updateVehicle = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;
        
        const vehicle = await Vehicle.findByIdAndUpdate(
            id, 
            updateData, 
            { new: true, runValidators: true }
        );
        
        if (!vehicle) {
            return res.status(404).json({ error: 'Không tìm thấy xe' });
        }
        
        res.json({ 
            success: true, 
            message: 'Cập nhật xe thành công', 
            vehicle 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// ADMIN: Xóa xe
exports.deleteVehicle = async (req, res) => {
    try {
        const { id } = req.params;
        const vehicle = await Vehicle.findByIdAndDelete(id);
        
        if (!vehicle) {
            return res.status(404).json({ error: 'Không tìm thấy xe' });
        }
        
        res.json({ 
            success: true, 
            message: 'Xóa xe thành công' 
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};