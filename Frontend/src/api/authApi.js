import axios from "axios";
import { getDeviceId } from "../utils/device";

const apiClient = axios.create({
    baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
    withCredentials: true
});

apiClient.interceptors.request.use(async (config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }

    try {
        const deviceId = await getDeviceId();
        if (deviceId) {
            config.headers["x-device-id"] = deviceId;
            config.headers["device-id"] = deviceId;
        }
    } catch (error) {
        console.error("Failed to resolve device id for request headers", error);
    }

    // Method tunneling fallback for live environments where firewalls or web servers block PUT/DELETE/PATCH requests
    const methodLower = config.method ? config.method.toLowerCase() : "";
    if (methodLower === "put" || methodLower === "delete" || methodLower === "patch") {
        config.headers["X-HTTP-Method-Override"] = methodLower.toUpperCase();
        config.method = "post";
    }

    return config;
}, (error) => {
    return Promise.reject(error);
});

export const loginUser = async (data) => {
    return apiClient.post("/auth/login", data);
};

export const requestDeviceRegistration = async (data) => {
    return apiClient.post("/auth/request-device", data);
};

export const logoutUser = async () => {
    return apiClient.post("/auth/logout");
};

export const getAllUsers = async (includeInactive = false) => {
    return apiClient.get(`/admin/users${includeInactive ? '?includeInactive=true' : ''}`);
};

export const toggleUserActive = async (id, active) => {
    return apiClient.patch(`/admin/user/${id}/toggle-active`, { active });
};

export const getPendingDevices = async () => {
    return apiClient.get("/admin/pending-devices");
};

export const approveDevice = async (deviceRowId) => {
    return apiClient.put(`/admin/approve-device/${deviceRowId}`);
};

export const revokeDevice = async (userId) => {
    return apiClient.put(`/admin/revoke-device/${userId}`);
};


export const createUserByAdmin = async (data) => {
    return apiClient.post("/admin/create-user", data);
};

export const fetchAuditLogs = async (userId = null) => {
    if (userId) {
        return apiClient.get(`/admin/audit-logs/${userId}`);
    }
    return apiClient.get("/admin/audit-logs");
};

export const fetchActivityLogs = async () => {
    return apiClient.get("/admin/activity-logs");
};

export const updateProfile = async (data) => {
    return apiClient.put("/auth/update-profile", data);
};

export const getMyPermissions = async () => {
    return apiClient.get("/auth/my-permissions");
};

export default apiClient;
