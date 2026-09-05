import apiClient from "./authApi";

export const getTargetVsAchievements = async (date) => {
    const params = date ? { date } : {};
    return apiClient.get("/target-vs-achievement/all", { params });
};

export const getABMWiseTargetVsAchievements = async (date) => {
    const params = date ? { date } : {};
    return apiClient.get("/target-vs-achievement/abm-wise", { params });
};

export const importTargetVsAchievements = async (data) => {
    return apiClient.post("/target-vs-achievement/import", data);
};

export const syncTargetVsAchievements = async (date) => {
    return apiClient.post("/target-vs-achievement/sync", { date });
};
