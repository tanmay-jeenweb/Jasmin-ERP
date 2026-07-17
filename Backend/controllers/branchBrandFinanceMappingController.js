const { getBranchById } = require('../models/branchModel.js');
const { getAllBanks } = require('../models/bankModel.js');
const { getAllMobileBrands } = require('../models/mobileBrandModel.js');
const {
    getMappingsByBranchId,
    saveBranchBrandFinanceMappings
} = require('../models/branchBrandFinanceMappingModel.js');
const { createAuditLog } = require('../models/auditLogModel.js');

const getBranchMappingsController = async (req, res) => {
    try {
        const { branchId } = req.params;
        const branch = await getBranchById(branchId);
        if (!branch) {
            return res.status(404).json({ success: false, message: 'Branch not found' });
        }

        // Fetch all active finance companies (bank_master)
        const companies = await getAllBanks();

        // Fetch all mobile brands where for_code = 'Yes'
        const allBrands = await getAllMobileBrands();
        const brands = allBrands.filter(b => b.for_code === 'Yes');

        // Fetch current mappings for this branch
        const mappings = await getMappingsByBranchId(branchId);

        res.status(200).json({
            success: true,
            message: 'Branch brand-finance mappings retrieved successfully',
            data: {
                branch,
                companies,
                brands,
                mappings
            }
        });
    } catch (error) {
        console.error('Error fetching branch mappings:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const saveBranchMappingsController = async (req, res) => {
    try {
        const { branchId } = req.params;
        const { mappings } = req.body; // Array of { brand_id, company_id }
        const userId = req.user.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        const branch = await getBranchById(branchId);
        if (!branch) {
            return res.status(404).json({ success: false, message: 'Branch not found' });
        }

        if (!Array.isArray(mappings)) {
            return res.status(400).json({ success: false, message: 'Invalid mappings parameter' });
        }

        const beforeMappings = await getMappingsByBranchId(branchId);

        await saveBranchBrandFinanceMappings(branchId, mappings, userId);

        await createAuditLog(
            userId,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Finance Brand Mapping',
            'updated',
            beforeMappings,
            mappings
        );

        res.status(200).json({
            success: true,
            message: 'Branch brand-finance mappings saved successfully'
        });
    } catch (error) {
        console.error('Error saving branch mappings:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    getBranchMappingsController,
    saveBranchMappingsController
};
