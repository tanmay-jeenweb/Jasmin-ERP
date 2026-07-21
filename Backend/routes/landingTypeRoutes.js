const express = require('express');
const {
    addLandingTypeController,
    getAllLandingTypesController,
    updateLandingTypeController,
    deleteLandingTypeController
} = require('../controllers/landingTypeController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.post('/add', verifyToken, verifyPermission('landing_type_master', 'write'), addLandingTypeController);
router.get('/all', verifyToken, verifyPermission('landing_type_master', 'read'), getAllLandingTypesController);
router.put('/update/:id', verifyToken, verifyPermission('landing_type_master', 'update'), updateLandingTypeController);
router.delete('/delete/:id', verifyToken, verifyPermission('landing_type_master', 'delete'), deleteLandingTypeController);

module.exports = router;
