const express = require('express');
const { getAllTargetVsAchievementsController } = require('../controllers/targetVsAchievementController.js');
const { verifyToken } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.get('/all', verifyToken, getAllTargetVsAchievementsController);

module.exports = router;
