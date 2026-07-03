const express = require('express');
const {
    addMobileBrandController,
    getAllMobileBrandsController,
    updateMobileBrandController,
    deleteMobileBrandController
} = require('../controllers/mobileBrandController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.post('/add', verifyToken, verifyPermission('mobile_brand_master', 'write'), addMobileBrandController);
router.get('/all', verifyToken, verifyPermission('mobile_brand_master', 'read'), getAllMobileBrandsController);
router.put('/update/:id', verifyToken, verifyPermission('mobile_brand_master', 'update'), updateMobileBrandController);
router.delete('/delete/:id', verifyToken, verifyPermission('mobile_brand_master', 'delete'), deleteMobileBrandController);

module.exports = router;
