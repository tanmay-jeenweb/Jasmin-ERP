const {
    createOffer,
    getAllOffers,
    getOfferById,
    updateOffer,
    deleteOffer
} = require('../models/offerModel.js');
const { createAuditLog } = require('../models/auditLogModel.js');

const createOfferController = async (req, res) => {
    try {
        const addedBy = req.user.id;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        const { brand_name, model_groups, state_id, offer_type, from_date, to_date, transactions } = req.body;

        // Validation
        if (!brand_name || !state_id || !offer_type || !from_date || !to_date) {
            return res.status(400).json({
                success: false,
                message: 'All fields (brand_name, state_id, offer_type, from_date, to_date) are required.'
            });
        }

        if (!model_groups || !Array.isArray(model_groups) || model_groups.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one model group must be selected.'
            });
        }

        if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one transaction type row is required.'
            });
        }

        const offerId = await createOffer(
            { brand_name, state_id, offer_type, from_date, to_date },
            model_groups,
            transactions,
            addedBy,
            deviceId
        );

        // Audit log
        await createAuditLog(
            addedBy,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Offer Master',
            'created',
            null,
            {
                offer_id: offerId,
                brand_name,
                model_groups,
                state_id,
                offer_type
            }
        );

        res.status(201).json({
            success: true,
            message: 'Offer created successfully',
            offerId
        });
    } catch (error) {
        console.error('Error creating offer:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getAllOffersController = async (req, res) => {
    try {
        const offers = await getAllOffers();
        res.status(200).json({
            success: true,
            message: 'Offers retrieved successfully',
            data: offers
        });
    } catch (error) {
        console.error('Error retrieving offers:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const getOfferByIdController = async (req, res) => {
    try {
        const { id } = req.params;
        const offer = await getOfferById(id);
        if (!offer) {
            return res.status(404).json({
                success: false,
                message: 'Offer not found'
            });
        }
        res.status(200).json({
            success: true,
            message: 'Offer retrieved successfully',
            data: offer
        });
    } catch (error) {
        console.error('Error retrieving offer by id:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const updateOfferController = async (req, res) => {
    try {
        const { id } = req.params;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';
        const { brand_name, model_groups, state_id, offer_type, from_date, to_date, transactions } = req.body;

        const beforeData = await getOfferById(id);
        if (!beforeData) {
            return res.status(404).json({
                success: false,
                message: 'Offer not found'
            });
        }

        // Validation
        if (!brand_name || !state_id || !offer_type || !from_date || !to_date) {
            return res.status(400).json({
                success: false,
                message: 'All fields (brand_name, state_id, offer_type, from_date, to_date) are required.'
            });
        }

        if (!model_groups || !Array.isArray(model_groups) || model_groups.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one model group must be selected.'
            });
        }

        if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one transaction type row is required.'
            });
        }

        await updateOffer(
            id,
            { brand_name, state_id, offer_type, from_date, to_date },
            model_groups,
            transactions,
            deviceId
        );

        // Audit log
        await createAuditLog(
            req.user.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Offer Master',
            'updated',
            beforeData,
            {
                id,
                brand_name,
                model_groups,
                state_id,
                offer_type
            }
        );

        res.status(200).json({
            success: true,
            message: 'Offer updated successfully'
        });
    } catch (error) {
        console.error('Error updating offer:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

const deleteOfferController = async (req, res) => {
    try {
        const { id } = req.params;
        const deviceId = req.headers['x-device-id'] || req.headers['device-id'] || 'Unknown';

        const beforeData = await getOfferById(id);
        if (!beforeData) {
            return res.status(404).json({
                success: false,
                message: 'Offer not found'
            });
        }

        await deleteOffer(id);

        // Audit log
        await createAuditLog(
            req.user.id,
            req.user?.name || req.user?.username || 'Unknown',
            deviceId,
            'Offer Master',
            'deleted',
            beforeData,
            null
        );

        res.status(200).json({
            success: true,
            message: 'Offer deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting offer:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error'
        });
    }
};

module.exports = {
    createOfferController,
    getAllOffersController,
    getOfferByIdController,
    updateOfferController,
    deleteOfferController
};
