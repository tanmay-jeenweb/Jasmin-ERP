import apiClient from "./authApi";

export const getBrandWiseSales = async (date, state) => {
    return apiClient.get("/brand-wise-sales/data", { params: { date, state } });
};

export const syncBrandWiseSales = async (date) => {
    return apiClient.post("/brand-wise-sales/sync", { date });
};
