const express = require('express');
const {
    getIcatSettingsController,
    saveIcatSettingsController
} = require('../controllers/settingController.js');
const { verifyToken, verifyPermission } = require('../middleware/authMiddleware.js');

const router = express.Router();

router.get('/icat', verifyToken, verifyPermission('price_list', 'read'), getIcatSettingsController);
router.post('/icat', verifyToken, verifyPermission('price_list', 'write'), saveIcatSettingsController);

module.exports = router;
