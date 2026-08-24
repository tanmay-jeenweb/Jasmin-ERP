const { getSetting, setSetting } = require('../models/settingModel.js');
const { getDistinctIcatNames } = require('../models/itemModelModel.js');
const { createAuditLog } = require('../models/auditLogModel.js');

const getIcatSettingsController = async (req, res) => {
    try {
        const icats = await getDistinctIcatNames();
        const rawSettings = await getSetting('icat_settings');
        const settings = rawSettings ? JSON.parse(rawSettings) : {};

        res.status(200).json({
            success: true,
            message: 'ICAT settings retrieved successfully',
            icats,
            settings
        });
    } catch (error) {
        console.error('Error retrieving ICAT settings:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while retrieving settings'
        });
    }
};

const saveIcatSettingsController = async (req, res) => {
    try {
        const { settings } = req.body;
        if (!settings || typeof settings !== 'object') {
            return res.status(400).json({
                success: false,
                message: 'Invalid settings payload'
            });
        }

        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        const beforeRaw = await getSetting('icat_settings');
        const beforeData = beforeRaw ? JSON.parse(beforeRaw) : null;

        await setSetting('icat_settings', JSON.stringify(settings));

        // Create Audit Log
        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'ICAT Settings',
            'updated',
            beforeData,
            settings
        );

        res.status(200).json({
            success: true,
            message: 'ICAT settings saved successfully'
        });
    } catch (error) {
        console.error('Error saving ICAT settings:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error while saving settings'
        });
    }
};

module.exports = {
    getIcatSettingsController,
    saveIcatSettingsController
};
