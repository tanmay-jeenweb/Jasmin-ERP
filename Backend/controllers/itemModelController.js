const {
    upsertItemModels,
    getAllItemModels,
    deleteItemModel,
    getItemModelById,
    getDistinctBrands
} = require('../models/itemModelModel.js');
const { createAuditLog } = require('../models/auditLogModel.js');

const syncItemModelsController = async (req, res) => {
    try {
        const addedBy = req.user.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        // 1. Fetch from external API
        const apiUrl = 'https://apxwapi.jasminmobile.com:81/api/apxapi/GetItemModelInfo?CompanyCode=JITPL&Status=ALL&ItemClassificationType=0';
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
                message: 'No item models retrieved from external API.'
            });
        }

        // 2. Map items from API schema to DB schema
        const mappedModels = items.map(item => ({
            item_code: String(item.ITEM_CODE || ''),
            brand_name: item.BRAND_NAME || null,
            model_name: item.ITEM_NAME || null,
            model_group_name: item.ITEM_CLS_01 || null,
            created_on: item.CREATED_ON || null,
            product_name: item.PRODUCT_NAME || null,
            icat_name: item.ICAT_NAME || null,
            prod_catg_name: item.PROD_CATG_NAME || null,
            uqc: item.UQC || null,
            serialno_status: item.SERIALNO_STATUS || null,
            item_status: item.ITEM_STATUS || null
        })).filter(m => m.item_code);

        // 3. Save to database (Upsert)
        await upsertItemModels(mappedModels, addedBy, deviceId);

        // 4. Create Audit Log
        await createAuditLog(
            addedBy,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Model Master',
            'updated', // Action category is updated since it updates/creates the models list
            null,
            {
                sync_count: mappedModels.length,
                synced_at: new Date().toISOString()
            }
        );

        res.status(200).json({
            success: true,
            message: `Synced ${mappedModels.length} item models successfully`,
            syncCount: mappedModels.length
        });

    } catch (error) {
        console.error('Error syncing item models:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during synchronization'
        });
    }
};

const getAllItemModelsController = async (req, res) => {
    try {
        const itemModels = await getAllItemModels();
        res.status(200).json({
            success: true,
            message: 'Item models retrieved successfully',
            data: itemModels
        });
    } catch (error) {
        console.error('Error retrieving item models:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const deleteItemModelController = async (req, res) => {
    try {
        const { id } = req.params;
        const beforeData = await getItemModelById(id);
        if (!beforeData) {
            return res.status(404).json({ success: false, message: 'Item model not found' });
        }

        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        await deleteItemModel(id);
        
        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Model Master',
            'deleted',
            beforeData,
            null
        );

        res.status(200).json({ success: true, message: 'Item model deleted successfully from local database' });
    } catch (error) {
        console.error('Error deleting item model:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const getDistinctBrandsController = async (req, res) => {
    try {
        const brands = await getDistinctBrands();
        res.status(200).json({
            success: true,
            data: brands
        });
    } catch (error) {
        console.error('Error retrieving distinct brands:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    syncItemModelsController,
    getAllItemModelsController,
    deleteItemModelController,
    getDistinctBrandsController
};
