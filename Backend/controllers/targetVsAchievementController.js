const { getAllTargetVsAchievements } = require('../models/targetVsAchievementModel.js');

const getAllTargetVsAchievementsController = async (req, res) => {
    try {
        const records = await getAllTargetVsAchievements();
        res.status(200).json({
            success: true,
            message: 'Target vs Achievement records retrieved successfully',
            data: records
        });
    } catch (error) {
        console.error('Error retrieving target vs achievement records:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    getAllTargetVsAchievementsController
};
