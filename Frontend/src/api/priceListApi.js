import apiClient from "./authApi";

export const getPriceListData = async (variationId) => {
    return apiClient.get(`/price-lists/${variationId}`);
};

export const importPriceListData = async (variationId, records) => {
    return apiClient.post(`/price-lists/import/${variationId}`, { records });
};

export const getPriceListReport = async (variationId) => {
    return apiClient.get(`/price-lists/report/${variationId}`);
};
