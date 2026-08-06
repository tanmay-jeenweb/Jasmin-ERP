const express = require('express');
const {
    createOfferController,
    getAllOffersController,
    getOfferByIdController,
    updateOfferController,
    deleteOfferController
} = require('../controllers/offerController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.post('/add', verifyToken, verifyPermission('offer_master', 'write'), createOfferController);
router.get('/all', verifyToken, verifyPermission('offer_master', 'read'), getAllOffersController);
router.get('/:id', verifyToken, verifyPermission('offer_master', 'read'), getOfferByIdController);
router.put('/update/:id', verifyToken, verifyPermission('offer_master', 'write'), updateOfferController);
router.delete('/delete/:id', verifyToken, verifyPermission('offer_master', 'write'), deleteOfferController);

module.exports = router;
