import apiClient from "./authApi";

export const getVariations = async () => {
    return apiClient.get("/variations/all");
};

export const getVariationById = async (id) => {
    return apiClient.get(`/variations/${id}`);
};

export const createVariation = async (data) => {
    return apiClient.post("/variations/add", data);
};

export const updateVariation = async (id, data) => {
    return apiClient.put(`/variations/update/${id}`, data);
};

export const deleteVariation = async (id) => {
    return apiClient.delete(`/variations/delete/${id}`);
};
