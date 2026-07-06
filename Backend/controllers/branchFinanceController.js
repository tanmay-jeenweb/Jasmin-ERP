const { getBranchById } = require('../models/branchModel.js');
const {
    getBranchFinanceCodesByBranchId,
    saveBranchFinanceCodes
} = require('../models/branchFinanceModel.js');
const { createAuditLog } = require('../models/auditLogModel.js');

const getBranchFinanceCodesController = async (req, res) => {
    try {
        const { id } = req.params;
        const branch = await getBranchById(id);
        if (!branch) {
            return res.status(404).json({ success: false, message: 'Branch not found' });
        }

        const financeCodes = await getBranchFinanceCodesByBranchId(id);
        res.status(200).json({
            success: true,
            message: 'Branch finance codes retrieved successfully',
            data: {
                branch,
                ...financeCodes
            }
        });
    } catch (error) {
        console.error('Error fetching branch finance codes:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const saveBranchFinanceCodesController = async (req, res) => {
    try {
        const { id } = req.params;
        const { brands, machines, companies, details } = req.body;
        const submittedBy = req.user.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        const branch = await getBranchById(id);
        if (!branch) {
            return res.status(404).json({ success: false, message: 'Branch not found' });
        }

        const beforeData = await getBranchFinanceCodesByBranchId(id);

        await saveBranchFinanceCodes(id, { brands, machines, companies, details }, submittedBy);

        await createAuditLog(
            submittedBy,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Branch Master',
            'updated',
            beforeData,
            { brands, machines, companies, details }
        );

        res.status(200).json({
            success: true,
            message: 'Branch finance codes saved successfully'
        });
    } catch (error) {
        console.error('Error saving branch finance codes:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

module.exports = {
    getBranchFinanceCodesController,
    saveBranchFinanceCodesController
};
