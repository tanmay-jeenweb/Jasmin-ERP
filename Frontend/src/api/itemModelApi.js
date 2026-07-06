import apiClient from "./authApi";

export const getItemModels = async () => {
    return apiClient.get("/itemmodels/all");
};

export const syncItemModels = async () => {
    return apiClient.post("/itemmodels/sync");
};

export const deleteItemModel = async (id) => {
    return apiClient.delete(`/itemmodels/delete/${id}`);
};
