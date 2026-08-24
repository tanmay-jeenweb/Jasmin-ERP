import axios from "axios";
import { getDeviceId } from "../utils/device";

const getBaseURL = () => {
    return import.meta.env.VITE_API_URL || "http://localhost:5000/v1/api";
};

const apiClient = axios.create({
    baseURL: getBaseURL(),
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

// Response interceptor to handle 401 Unauthorized errors (expired tokens)
apiClient.interceptors.response.use(
    (response) => {
        return response;
    },
    async (error) => {
        const originalRequest = error.config;

        // Check if error is 401 or 403 and request has not been retried yet
        if ((error.response?.status === 401 || error.response?.status === 403) && !originalRequest._retry) {
            // Avoid infinite loop for auth endpoints
            const isAuthRoute = originalRequest.url.includes("/auth/login") || 
                                originalRequest.url.includes("/auth/refresh") || 
                                originalRequest.url.includes("/auth/logout");

            if (isAuthRoute) {
                return Promise.reject(error);
            }

            // Since refresh token logic is removed from the web app, we instantly log out the user on session expiration (401/403)
            localStorage.removeItem("token");
            localStorage.removeItem("user");
            sessionStorage.removeItem("loginTime");
            sessionStorage.removeItem("alertShown");
            
            // Notify React components so they unmount before redirect
            window.dispatchEvent(new Event("auth-change"));
            
            // Force redirect — use replace to prevent back-button returning to stale page
            window.location.replace("/");
            
            // Return a never-resolving promise so no component error handler
            // runs and shows stale UI (e.g. "No records found") before the redirect
            return new Promise(() => {});
        }

        return Promise.reject(error);
    }
);

export const loginUser = async (data) => {
    return apiClient.post("/auth/login", data);
};

export const requestDeviceRegistration = async (data) => {
    return apiClient.post("/auth/request-device", data);
};

export const getApprovedDevicesList = async (data) => {
    return apiClient.post("/auth/approved-devices", data);
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

export const fetchUserActiveDevices = async (userId) => {
    return apiClient.get(`/admin/devices/user/${userId}`);
};

export const revokeSpecificDevice = async (deviceRowId) => {
    return apiClient.put(`/admin/devices/revoke/${deviceRowId}`);
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

export const getSuperAdminUsers = async () => {
    return apiClient.get("/admin/super-admin/users");
};

export const updateUserBySuperAdmin = async (userId, data) => {
    return apiClient.put(`/admin/super-admin/users/${userId}`, data);
};

export default apiClient;
