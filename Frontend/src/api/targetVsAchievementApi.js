import apiClient from "./authApi";

export const getTargetVsAchievements = async () => {
    return apiClient.get("/target-vs-achievement/all");
};
