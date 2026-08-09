const Review = require('../models/Review');

async function getReviewStats(match = { isPublished: true }) {
    const [result] = await Review.aggregate([
        { $match: match },
        { $group: {
            _id: null,
            total: { $sum: 1 },
            averageTrip: { $avg: '$tripRating' },
            averageDriver: { $avg: '$driverRating' },
            fiveStar: { $sum: { $cond: [{ $and: [{ $gte: ['$tripRating', 4] }, { $gte: ['$driverRating', 4] }] }, 1, 0] } }
        } }
    ]);
    if (!result) return { total: 0, averageTrip: 0, averageDriver: 0, averageOverall: 0, satisfaction: 0, positivePercent: 0 };
    const averageOverall = (result.averageTrip + result.averageDriver) / 2;
    return {
        total: result.total,
        averageTrip: Number(result.averageTrip.toFixed(1)),
        averageDriver: Number(result.averageDriver.toFixed(1)),
        averageOverall: Number(averageOverall.toFixed(1)),
        satisfaction: Math.round(averageOverall / 5 * 100),
        positivePercent: Math.round(result.fiveStar / result.total * 100)
    };
}

module.exports = { getReviewStats };
