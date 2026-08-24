import apiClient from "./authApi";

export const getIcatSettings = async () => {
    return apiClient.get("/settings/icat");
};

export const saveIcatSettings = async (settings) => {
    return apiClient.post("/settings/icat", { settings });
};
