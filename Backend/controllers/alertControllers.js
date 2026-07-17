const {
    createAlert,
    getAllAlerts,
    getActiveAlerts,
    getAlertById,
    updateAlert,
    deleteAlert,
    toggleAlertActive
} = require("../models/alertModel.js");
const { getFileUrl } = require("../config/uploadConfig.js");

const createAlertController = async (req, res) => {
    try {
        const { title, description } = req.body;
        if (!title || !description) {
            return res.status(400).json({
                success: false,
                message: "Title and description are required."
            });
        }

        const imagePath = req.file ? req.file.filename : null;
        const result = await createAlert(title, description, imagePath);

        return res.status(201).json({
            success: true,
            message: "Alert created successfully.",
            alertId: result.insertId
        });
    } catch (error) {
        console.error("Error creating alert:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to create alert."
        });
    }
};

const getAllAlertsController = async (req, res) => {
    try {
        const alerts = await getAllAlerts();
        const formattedAlerts = alerts.map(alert => ({
            ...alert,
            image_url: alert.image_path ? getFileUrl(alert.image_path) : null
        }));

        return res.status(200).json({
            success: true,
            data: formattedAlerts
        });
    } catch (error) {
        console.error("Error fetching alerts:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch alerts."
        });
    }
};

const getActiveAlertsController = async (req, res) => {
    try {
        const alerts = await getActiveAlerts();
        const formattedAlerts = alerts.map(alert => ({
            ...alert,
            image_url: alert.image_path ? getFileUrl(alert.image_path) : null
        }));

        return res.status(200).json({
            success: true,
            data: formattedAlerts
        });
    } catch (error) {
        console.error("Error fetching active alerts:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch active alerts."
        });
    }
};

const updateAlertController = async (req, res) => {
    try {
        const { id } = req.params;
        const { title, description, active, clearImage } = req.body;

        if (!title || !description) {
            return res.status(400).json({
                success: false,
                message: "Title and description are required."
            });
        }

        // Determine if image should change
        let newImagePath;
        if (req.file) {
            newImagePath = req.file.filename;
        } else if (clearImage === "true" || clearImage === true) {
            newImagePath = null;
        } else {
            newImagePath = undefined; // Do not modify
        }

        const isActive = active === "true" || active === true || active === "1" || active === 1;

        await updateAlert(id, title, description, newImagePath, isActive);

        return res.status(200).json({
            success: true,
            message: "Alert updated successfully."
        });
    } catch (error) {
        console.error("Error updating alert:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update alert."
        });
    }
};

const deleteAlertController = async (req, res) => {
    try {
        const { id } = req.params;
        await deleteAlert(id);

        return res.status(200).json({
            success: true,
            message: "Alert deleted successfully."
        });
    } catch (error) {
        console.error("Error deleting alert:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to delete alert."
        });
    }
};

const toggleAlertActiveController = async (req, res) => {
    try {
        const { id } = req.params;
        const { active } = req.body;

        const isActive = active === "true" || active === true || active === "1" || active === 1;
        await toggleAlertActive(id, isActive);

        return res.status(200).json({
            success: true,
            message: `Alert ${isActive ? "activated" : "deactivated"} successfully.`
        });
    } catch (error) {
        console.error("Error toggling alert active status:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to toggle alert status."
        });
    }
};

module.exports = {
    createAlertController,
    getAllAlertsController,
    getActiveAlertsController,
    updateAlertController,
    deleteAlertController,
    toggleAlertActiveController
};
