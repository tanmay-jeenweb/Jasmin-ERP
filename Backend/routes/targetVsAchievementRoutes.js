const express = require('express');
const { 
    getAllTargetVsAchievementsController,
    getABMWiseTargetVsAchievementsController,
    getABMWiseTargetVsAchievementsSummaryController,
    importTargetVsAchievementsController,
    syncTargetVsAchievementsController
} = require('../controllers/targetVsAchievementController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.get('/all', verifyToken, verifyPermission('target_vs_achievement', 'read'), getAllTargetVsAchievementsController);
router.get('/abm-wise', verifyToken, verifyPermission('target_vs_achievement', 'read'), getABMWiseTargetVsAchievementsController);
router.get('/abm-wise-summary', verifyToken, verifyPermission('target_vs_achievement', 'read'), getABMWiseTargetVsAchievementsSummaryController);
router.post('/import', verifyToken, verifyPermission('target_vs_achievement', 'write'), importTargetVsAchievementsController);
router.post('/sync', verifyToken, verifyPermission('target_vs_achievement', 'write'), syncTargetVsAchievementsController);

module.exports = router;
