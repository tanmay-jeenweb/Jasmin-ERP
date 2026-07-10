const express = require('express');
const { 
    getAllTargetVsAchievementsController,
    importTargetVsAchievementsController,
    syncTargetVsAchievementsController
} = require('../controllers/targetVsAchievementController.js');
const { verifyToken } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.get('/all', verifyToken, getAllTargetVsAchievementsController);
router.post('/import', verifyToken, importTargetVsAchievementsController);
router.post('/sync', verifyToken, syncTargetVsAchievementsController);

module.exports = router;
