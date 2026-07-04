import apiClient from "./authApi";

export const getProductTypes = async () => {
    return apiClient.get("/producttypes/all");
};

export const createProductType = async (data) => {
    // data: { productTypeName }
    return apiClient.post("/producttypes/add", data);
};

export const updateProductType = async (id, data) => {
    // data: { productTypeName }
    return apiClient.put(`/producttypes/update/${id}`, data);
};

export const deleteProductType = async (id) => {
    return apiClient.delete(`/producttypes/delete/${id}`);
};
