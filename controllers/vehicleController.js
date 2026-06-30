const Vehicle = require('../models/Vehicle');

exports.getVehiclesByType = async (req, res) => {
    try {
        const { type } = req.params;
        const vehicles = await Vehicle.find({ type, isAvailable: true });
        res.json(vehicles);
    } catch (error) {
        res.status(500).json({ error: 'Error fetching vehicles' });
    }
};

exports.getVehicleImages = async (req, res) => {
    try {
        const vehicle = await Vehicle.findById(req.params.id);
        if (!vehicle) {
            return res.status(404).json({ error: 'Vehicle not found' });
        }
        res.json({ images: vehicle.images });
    } catch (error) {
        res.status(500).json({ error: 'Error fetching vehicle images' });
    }
};

// Admin function to add vehicles
exports.addVehicle = async (req, res) => {
    try {
        const vehicle = new Vehicle(req.body);
        await vehicle.save();
        res.status(201).json(vehicle);
    } catch (error) {
        res.status(500).json({ error: 'Error adding vehicle' });
    }
};