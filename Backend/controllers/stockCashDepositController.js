const { 
    getStockCashDepositReportData, 
    importStockCashDepositData, 
    importCurrentStockData,
    importOpeningCashAndCreditData,
    importCashDepositData
} = require('../models/stockCashDepositModel.js');

const getStockCashDepositReportController = async (req, res) => {
    try {
        const records = await getStockCashDepositReportData();
        res.status(200).json({
            success: true,
            message: 'Stock vs Cash Deposit report data retrieved successfully',
            data: records
        });
    } catch (error) {
        console.error('Error retrieving Stock vs Cash Deposit report data:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const importStockCashDepositController = async (req, res) => {
    try {
        const { records } = req.body;
        if (!records || !Array.isArray(records)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid records format. Expected an array of records.'
            });
        }
        await importStockCashDepositData(records);
        res.status(200).json({
            success: true,
            message: 'Records imported successfully'
        });
    } catch (error) {
        console.error('Error importing Stock vs Cash Deposit data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to import records'
        });
    }
};

const importCurrentStockController = async (req, res) => {
    try {
        const { records } = req.body;
        if (!records || !Array.isArray(records)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid records format. Expected an array of records.'
            });
        }
        await importCurrentStockData(records);
        res.status(200).json({
            success: true,
            message: 'Current Stock records imported successfully'
        });
    } catch (error) {
        console.error('Error importing Current Stock data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to import Current Stock records'
        });
    }
};

const importOpeningCashAndCreditController = async (req, res) => {
    try {
        const { records } = req.body;
        if (!records || !Array.isArray(records)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid records format. Expected an array of records.'
            });
        }
        await importOpeningCashAndCreditData(records);
        res.status(200).json({
            success: true,
            message: 'Opening Cash & Credit records imported successfully'
        });
    } catch (error) {
        console.error('Error importing Opening Cash & Credit data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to import Opening Cash & Credit records'
        });
    }
};

const importCashDepositController = async (req, res) => {
    try {
        const { records } = req.body;
        if (!records || !Array.isArray(records)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid records format. Expected an array of records.'
            });
        }
        await importCashDepositData(records);
        res.status(200).json({
            success: true,
            message: 'Cash Deposit records imported successfully'
        });
    } catch (error) {
        console.error('Error importing Cash Deposit data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to import Cash Deposit records'
        });
    }
};

module.exports = {
    getStockCashDepositReportController,
    importStockCashDepositController,
    importCurrentStockController,
    importOpeningCashAndCreditController,
    importCashDepositController
};
