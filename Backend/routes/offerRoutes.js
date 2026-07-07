const express = require('express');
const {
    createOfferController,
    getAllOffersController,
    getOfferByIdController,
    updateOfferController,
    deleteOfferController
} = require('../controllers/offerController.js');
const { verifyToken } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.post('/add', verifyToken, createOfferController);
router.get('/all', verifyToken, getAllOffersController);
router.get('/:id', verifyToken, getOfferByIdController);
router.put('/update/:id', verifyToken, updateOfferController);
router.delete('/delete/:id', verifyToken, deleteOfferController);

module.exports = router;
