import apiClient from "./authApi";

export const getMobileBrands = async () => {
    return apiClient.get("/mobilebrands/all");
};

export const createMobileBrand = async (data) => {
    // data: { mobileBrand }
    return apiClient.post("/mobilebrands/add", data);
};

export const updateMobileBrand = async (id, data) => {
    // data: { mobileBrand }
    return apiClient.put(`/mobilebrands/update/${id}`, data);
};

export const deleteMobileBrand = async (id) => {
    return apiClient.delete(`/mobilebrands/delete/${id}`);
};
