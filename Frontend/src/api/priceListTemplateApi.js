import apiClient from "./authApi";

export const getAllPriceListTemplates = async (includeDeleted = false) => {
    return apiClient.get(`/price-list-templates${includeDeleted ? '?includeDeleted=true' : ''}`);
};

export const getPriceListTemplateById = async (id) => {
    return apiClient.get(`/price-list-templates/${id}`);
};

export const createPriceListTemplate = async (data) => {
    return apiClient.post("/price-list-templates", data);
};

export const updatePriceListTemplate = async (id, data) => {
    return apiClient.put(`/price-list-templates/${id}`, data);
};

export const deletePriceListTemplate = async (id) => {
    return apiClient.delete(`/price-list-templates/${id}`);
};

export const getTemplateFilterOptions = async (id) => {
    return apiClient.get(`/price-list-templates/${id}/filter-options`);
};

export const getTemplateExportData = async (id, filterData) => {
    return apiClient.post(`/price-list-templates/${id}/export-data`, filterData);
};
