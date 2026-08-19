const {
    createBranch,
    getAllBranches,
    updateBranch,
    deleteBranch,
    getBranchById,
    upsertBranches
} = require('../models/branchModel.js');
const { createAuditLog } = require('../models/auditLogModel.js');
const { getEligibleAbms } = require('../models/userBranchMappingModel.js');
const db = require('../config/db.js');

const addBranchController = async (req, res) => {
    try {
        const { name, code, phone, email, pincode, GSTIN, opened_on, store_type, state_id, city, address, abm, status } = req.body;
        const addedBy = req.user.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        // Check required fields
        if (!name || !code || !phone || !email || !pincode || !GSTIN || !opened_on || !store_type || !state_id || !city || !address || !abm) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        const result = await createBranch(req.body, addedBy, deviceId);
        
        await createAuditLog(
            addedBy,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Branch Master',
            'created',
            null,
            {
                id: result.insertId,
                ...req.body,
                added_by: addedBy,
                device_id: deviceId
            }
        );

        res.status(201).json({
            success: true,
            message: 'Branch added successfully',
            data: { id: result.insertId }
        });
    } catch (error) {
        console.error('Error adding branch:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Branch code already exists' });
        }
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getAllBranchesController = async (req, res) => {
    try {
        let branches = await getAllBranches();

        // Fetch user's state restriction from DB
        const [userRows] = await db.execute("SELECT state FROM users WHERE id = ?", [req.user.id]);
        let userStates = null;
        if (userRows.length > 0 && userRows[0].state) {
            try {
                userStates = typeof userRows[0].state === 'string' ? JSON.parse(userRows[0].state) : userRows[0].state;
            } catch (e) {
                userStates = null;
            }
        }

        if (userStates && Array.isArray(userStates) && userStates.length > 0 && !userStates.includes("All")) {
            const upperUserStates = userStates.map(s => String(s).trim().toUpperCase());
            branches = branches.filter(b => b.state_name && upperUserStates.includes(String(b.state_name).trim().toUpperCase()));
        }

        res.status(200).json({
            success: true,
            message: 'Branches retrieved successfully',
            data: branches
        });
    } catch (error) {
        console.error('Error retrieving branches:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const updateBranchController = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, code, phone, email, pincode, GSTIN, opened_on, store_type, state_id, city, address, abm, status } = req.body;

        if (!name || !code || !phone || !email || !pincode || !GSTIN || !opened_on || !store_type || !state_id || !city || !address || !abm || !status) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }

        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        const beforeData = await getBranchById(id);
        if (!beforeData) {
            return res.status(404).json({ success: false, message: 'Branch not found' });
        }

        await updateBranch(id, req.body);
        
        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Branch Master',
            'updated',
            beforeData,
            {
                ...beforeData,
                ...req.body
            }
        );

        res.status(200).json({ success: true, message: 'Branch updated successfully' });
    } catch (error) {
        console.error('Error updating branch:', error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'Branch code already exists' });
        }
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const deleteBranchController = async (req, res) => {
    try {
        const { id } = req.params;
        const beforeData = await getBranchById(id);
        if (!beforeData) {
            return res.status(404).json({ success: false, message: 'Branch not found' });
        }

        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        await deleteBranch(id);
        
        await createAuditLog(
            req.user?.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Branch Master',
            'deleted',
            beforeData,
            null
        );

        res.status(200).json({ success: true, message: 'Branch deleted successfully' });
    } catch (error) {
        console.error('Error deleting branch:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const syncBranchesController = async (req, res) => {
    try {
        const addedBy = req.user.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        // 1. Fetch from external API
        const apiUrl = 'https://apxwapi.jasminmobile.com:81/api/apxapi/GetBranchInfo?CompanyCode=JITPL&Status=All';
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
                message: 'No branches retrieved from external API.'
            });
        }

        const parseOpenedOn = (val) => {
            if (!val) return '2000-01-01';
            const str = String(val);
            if (str.length === 8) {
                const y = str.substring(0, 4);
                const m = str.substring(4, 6);
                const d = str.substring(6, 8);
                return `${y}-${m}-${d}`;
            }
            return '2000-01-01';
        };

        // 2. Map items from API schema to DB schema
        const mappedBranches = items.map(item => {
            const address = [item.BRANCH_ADDLINE1, item.BRANCH_ADDLINE2, item.BRANCH_ADDLINE3]
                .filter(line => line && line.trim())
                .map(line => line.trim())
                .join(', ');

            const rawStoreType = (item.BRANCH_CLS_02 || '').toLowerCase();
            const storeType = (rawStoreType === 'franchise' || rawStoreType === 'branch') ? rawStoreType : 'branch';

            const status = (item.BRANCH_STATUS || '').toLowerCase() === 'active' ? 'active' : 'inactive';

            return {
                name: item.BRANCH_NAME || '',
                code: item.BRANCH_CODE || '',
                phone: item.BRANCH_PHONE || '',
                email: item.BRANCH_EMAIL || '',
                pincode: item.BRANCH_PINCODE || '',
                GSTIN: item.BRANCH_GSTIN || '',
                opened_on: parseOpenedOn(item.BRANCH_OPENEDON || item.BRANCH_OPENON),
                store_type: storeType,
                state_name: item.BRANCH_STATE || 'UNKNOWN',
                city: item.BRANCH_CITY || '',
                address: address,
                abm: item.BRANCH_CLS_01 || '',
                status: status
            };
        }).filter(b => b.code);

        // 3. Save to database (Upsert)
        await upsertBranches(mappedBranches, addedBy, deviceId);

        // 4. Create Audit Log
        await createAuditLog(
            addedBy,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Branch Master',
            'updated',
            null,
            {
                sync_count: mappedBranches.length,
                synced_at: new Date().toISOString()
            }
        );

        res.status(200).json({
            success: true,
            message: `Synced ${mappedBranches.length} branches successfully`,
            syncCount: mappedBranches.length
        });

    } catch (error) {
        console.error('Error syncing branches:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during synchronization'
        });
    }
};

const getEligibleAbmsController = async (req, res) => {
    try {
        const abms = await getEligibleAbms();
        res.status(200).json({
            success: true,
            message: 'Eligible ABMs retrieved successfully',
            data: abms
        });
    } catch (error) {
        console.error('Error retrieving eligible ABMs:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    addBranchController,
    getAllBranchesController,
    updateBranchController,
    deleteBranchController,
    syncBranchesController,
    getEligibleAbmsController
};
