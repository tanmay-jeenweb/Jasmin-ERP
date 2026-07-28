import apiClient from "./authApi";

export const getPriceListData = async (variationId) => {
    return apiClient.get(`/price-lists/${variationId}`);
};

export const importPriceListData = async (variationId, records) => {
    return apiClient.post(`/price-lists/import/${variationId}`, { records });
};

export const getPriceListReport = async (variationId, date = null) => {
    return apiClient.get(`/price-lists/report/${variationId}`, {
        params: date ? { date } : {}
    });
};

export const getModelGroupStockInfo = async (modelGroup, sync = false) => {
    return apiClient.get(`/price-lists/stock-info`, {
        params: { modelGroup, sync: sync ? 'true' : 'false' }
    });
};

export const getHistoryTimestamps = async (variationId) => {
    return apiClient.get(`/price-lists/history-timestamps/${variationId}`);
};


