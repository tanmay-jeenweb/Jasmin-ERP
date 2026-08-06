import apiClient from "./authApi";

export const getAlerts = async () => {
    return apiClient.get("/alerts");
};

export const getActiveAlerts = async () => {
    return apiClient.get("/alerts/active");
};

export const createAlert = async (formData) => {
    return apiClient.post("/alerts", formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        }
    });
};

export const updateAlert = async (id, formData) => {
    return apiClient.put(`/alerts/${id}`, formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        }
    });
};

export const deleteAlert = async (id) => {
    return apiClient.delete(`/alerts/${id}`);
};

export const toggleAlertActive = async (id, active) => {
    return apiClient.patch(`/alerts/${id}/toggle`, { active });
};
