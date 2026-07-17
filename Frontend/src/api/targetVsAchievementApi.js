import apiClient from "./authApi";

export const getTargetVsAchievements = async () => {
    return apiClient.get("/target-vs-achievement/all");
};

export const getABMWiseTargetVsAchievements = async () => {
    return apiClient.get("/target-vs-achievement/abm-wise");
};

export const importTargetVsAchievements = async (data) => {
    return apiClient.post("/target-vs-achievement/import", data);
};

export const syncTargetVsAchievements = async (date) => {
    return apiClient.post("/target-vs-achievement/sync", { date });
};
