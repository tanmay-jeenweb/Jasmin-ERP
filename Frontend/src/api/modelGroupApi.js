import apiClient from "./authApi";

export const getModelGroups = async () => {
    return apiClient.get("/modelgroups/all");
};

export const syncModelGroups = async () => {
    return apiClient.post("/modelgroups/sync");
};

export const deleteModelGroup = async (id) => {
    return apiClient.delete(`/modelgroups/delete/${id}`);
};
