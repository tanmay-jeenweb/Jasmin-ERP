const express = require('express');
const {
    syncBrandWiseSalesController,
    getBrandWiseSalesController,
    getBrandWiseSalesTotalsController
} = require('../controllers/brandWiseSalesController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.post('/sync', verifyToken, verifyPermission('brand_wise_sales', 'write'), syncBrandWiseSalesController);
router.get('/data', verifyToken, verifyPermission('brand_wise_sales', 'read'), getBrandWiseSalesController);
router.get('/totals', verifyToken, verifyPermission('brand_wise_sales', 'read'), getBrandWiseSalesTotalsController);

module.exports = router;
