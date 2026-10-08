const express = require('express');
const router = express.Router();
const {
    createSpecialTvaController,
    getAllSpecialTvasController,
    getSpecialTvaByIdController,
    updateSpecialTvaController,
    deleteSpecialTvaController,
    getSpecialTvaReportController,
    importSpecialTvaTargetController
} = require('../controllers/specialTvaController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

// Master endpoints
router.post('/create', verifyToken, verifyPermission('special_tva_master', 'write'), createSpecialTvaController);
router.get('/all', verifyToken, verifyPermission(['special_tva_master', 'special_tva_report'], 'read'), getAllSpecialTvasController);
router.get('/details/:id', verifyToken, verifyPermission(['special_tva_master', 'special_tva_report'], 'read'), getSpecialTvaByIdController);
router.put('/update/:id', verifyToken, verifyPermission('special_tva_master', 'update'), updateSpecialTvaController);
router.delete('/delete/:id', verifyToken, verifyPermission('special_tva_master', 'delete'), deleteSpecialTvaController);

// Dynamic Report & Target Import endpoints
router.get('/report/:id', verifyToken, verifyPermission(['special_tva_report', 'special_tva_master'], 'read'), getSpecialTvaReportController);
router.post('/import/:id', verifyToken, verifyPermission(['special_tva_master', 'special_tva_report'], 'write'), importSpecialTvaTargetController);

module.exports = router;
