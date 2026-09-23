const { getAllMobileBrands } = require('../models/mobileBrandModel.js');
const { getAllBanks } = require('../models/bankModel.js');
const { getAllFinanceMachines } = require('../models/financeMachineModel.js');

const getExternalMasterData = async (req, res) => {
    try {
        const useridHeader = req.headers['userid'];
        const securitycodeHeader = req.headers['securitycode'];

        const expectedUserid = process.env.EXTERNAL_API_USERID || process.env.MODEL_API_USERID || 'WebSite';
        const expectedSecuritycode = process.env.EXTERNAL_API_SECURITYCODE || process.env.MODEL_API_SECURITYCODE || '1151-8111-6444-4166';

        if (!useridHeader || !securitycodeHeader || useridHeader !== expectedUserid || securitycodeHeader !== expectedSecuritycode) {
            return res.status(401).json({
                success: false,
                message: 'Unauthorized. Invalid API headers.'
            });
        }

        // Fetch all master data in parallel
        const [brands, banks, machines] = await Promise.all([
            getAllMobileBrands(),
            getAllBanks(),
            getAllFinanceMachines()
        ]);

        // Format finance companies to have both bank_card_name and company_name for clarity
        const formattedCompanies = banks.map(bank => ({
            id: bank.id,
            company_name: bank.bank_card_name,
            bank_card_name: bank.bank_card_name,
            added_by_name: bank.added_by_name,
            device_id: bank.device_id,
            timestamp: bank.timestamp
        }));

        res.status(200).json({
            success: true,
            message: 'Master data retrieved successfully',
            data: {
                brands: brands.map(b => ({
                    id: b.id,
                    brand_name: b.mobile_brand,
                    mobile_brand: b.mobile_brand,
                    for_code: b.for_code,
                    added_by_name: b.added_by_name,
                    device_id: b.device_id,
                    timestamp: b.timestamp
                })),
                financeCompanies: formattedCompanies,
                financeMachines: machines.map(m => ({
                    id: m.id,
                    machine_name: m.machine_name,
                    added_by_name: m.added_by_name,
                    device_id: m.device_id,
                    timestamp: m.timestamp
                }))
            }
        });
    } catch (error) {
        console.error('Error retrieving external master data:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    getExternalMasterData
};
