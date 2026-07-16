import apiClient from "./authApi";

export const getBrandWiseSales = async (date) => {
    return apiClient.get("/brand-wise-sales/data", { params: { date } });
};

export const syncBrandWiseSales = async (date) => {
    return apiClient.post("/brand-wise-sales/sync", { date });
};
