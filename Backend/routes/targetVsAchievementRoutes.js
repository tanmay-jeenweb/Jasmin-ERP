const express = require('express');
const { 
    getAllTargetVsAchievementsController,
    getABMWiseTargetVsAchievementsController,
    importTargetVsAchievementsController,
    syncTargetVsAchievementsController
} = require('../controllers/targetVsAchievementController.js');
const { verifyToken } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.get('/all', verifyToken, getAllTargetVsAchievementsController);
router.get('/abm-wise', verifyToken, getABMWiseTargetVsAchievementsController);
router.post('/import', verifyToken, importTargetVsAchievementsController);
router.post('/sync', verifyToken, syncTargetVsAchievementsController);

module.exports = router;
