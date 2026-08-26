const express = require('express');
console.log("🚀 externalRoutes.js is being loaded by index.js!");
const router = express.Router();
const { getExternalMasterData } = require('../controllers/externalController.js');

// Route to fetch brand, finance company, and finance machine master data
router.get('/master-data', getExternalMasterData);

module.exports = router;
