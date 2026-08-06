const {
    upsertModelGroups,
    getAllModelGroups,
    deleteModelGroup,
    getModelGroupById
} = require('../models/modelGroupModel.js');
const { createAuditLog } = require('../models/auditLogModel.js');

const syncModelGroupsController = async (req, res) => {
    try {
        const addedBy = req.user.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        // 1. Fetch from external API
        const apiUrl = 'https://apxwapi.jasminmobile.com:81/api/apxapi/GetItemModelInfo?CompanyCode=JITPL&Status=Active&ItemClassificationType=0';
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'userid': process.env.MODEL_API_USERID || 'WebSite',
                'Securitycode': process.env.MODEL_API_SECURITYCODE || '1151-8111-6444-4166',
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            return res.status(response.status).json({
                success: false,
                message: `Failed to fetch from external API: Server returned ${response.statusText}`
            });
        }

        const result = await response.json();

        if (result.StatusCode !== 0) {
            return res.status(400).json({
                success: false,
                message: `API Error: ${result.StatusMessage || 'Unknown error'}`
            });
        }

        const items = result.Data || [];
        if (items.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No item data retrieved from external API.'
            });
        }

        // 2. Extract unique combinations of Brand Name and Model Group Name (ITEM_CLS_01)
        const uniqueGroupsMap = new Map();
        items.forEach(item => {
            const brand = (item.BRAND_NAME || '').trim();
            const group = (item.ITEM_CLS_01 || '').trim();
            if (brand && group) {
                const key = `${brand.toLowerCase()}|||${group.toLowerCase()}`;
                if (!uniqueGroupsMap.has(key)) {
                    uniqueGroupsMap.set(key, { brand_name: brand, model_group_name: group });
                }
            }
        });

        const mappedGroups = Array.from(uniqueGroupsMap.values());

        // 3. Save to database (Upsert)
        await upsertModelGroups(mappedGroups, addedBy, deviceId);

        // 4. Create Audit Log
        await createAuditLog(
            addedBy,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Model Group Master',
            'updated',
            null,
            {
                sync_count: mappedGroups.length,
                synced_at: new Date().toISOString()
            }
        );

        res.status(200).json({
            success: true,
            message: `Synced ${mappedGroups.length} unique model groups successfully`,
            syncCount: mappedGroups.length
        });

    } catch (error) {
        console.error('Error syncing model groups:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during synchronization'
        });
    }
};

const getAllModelGroupsController = async (req, res) => {
    try {
        const modelGroups = await getAllModelGroups();
        res.status(200).json({
            success: true,
            message: 'Model groups retrieved successfully',
            data: modelGroups
        });
    } catch (error) {
        console.error('Error retrieving model groups:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const deleteModelGroupController = async (req, res) => {
    try {
        const { id } = req.params;
        const beforeData = await getModelGroupById(id);
        if (!beforeData) {
            return res.status(404).json({ success: false, message: 'Model group not found' });
        }

        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        await deleteModelGroup(id);
        
        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Model Group Master',
            'deleted',
            beforeData,
            null
        );

        res.status(200).json({ success: true, message: 'Model group deleted successfully from local database' });
    } catch (error) {
        console.error('Error deleting model group:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    syncModelGroupsController,
    getAllModelGroupsController,
    deleteModelGroupController
};
