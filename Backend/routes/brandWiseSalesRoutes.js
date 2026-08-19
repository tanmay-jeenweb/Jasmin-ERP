const express = require('express');
const {
    syncBrandWiseSalesController,
    getBrandWiseSalesController,
    getBrandWiseSalesTotalsController
} = require('../controllers/brandWiseSalesController.js');
const { verifyToken } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.post('/sync', verifyToken, syncBrandWiseSalesController);
router.get('/data', verifyToken, getBrandWiseSalesController);
router.get('/totals', verifyToken, getBrandWiseSalesTotalsController);

module.exports = router;
