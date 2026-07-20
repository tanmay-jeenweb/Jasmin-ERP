const express = require('express');
const {
    addPricingFormulaController,
    getAllPricingFormulasController,
    getPricingFormulaByIdController,
    updatePricingFormulaController,
    deletePricingFormulaController
} = require('../controllers/pricingFormulaController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.post('/add', verifyToken, verifyPermission('pricing_formula_master', 'write'), addPricingFormulaController);
router.get('/all', verifyToken, verifyPermission('pricing_formula_master', 'read'), getAllPricingFormulasController);
router.get('/:id', verifyToken, verifyPermission('pricing_formula_master', 'read'), getPricingFormulaByIdController);
router.put('/update/:id', verifyToken, verifyPermission('pricing_formula_master', 'update'), updatePricingFormulaController);
router.delete('/delete/:id', verifyToken, verifyPermission('pricing_formula_master', 'delete'), deletePricingFormulaController);

module.exports = router;
