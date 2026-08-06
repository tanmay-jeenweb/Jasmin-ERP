import apiClient from "./authApi";

export const getPricingFormulas = async (includeDeleted = false) => {
    return apiClient.get(`/variations/all${includeDeleted ? `?includeDeleted=${includeDeleted}` : ""}`);
};

export const getPricingFormulaById = async (id) => {
    return apiClient.get(`/variations/${id}`);
};

export const createPricingFormula = async (data) => {
    return apiClient.post("/variations/add", data);
};

export const updatePricingFormula = async (id, data) => {
    return apiClient.put(`/variations/update/${id}`, data);
};

export const deletePricingFormula = async (id) => {
    return apiClient.delete(`/variations/delete/${id}`);
};

export const restorePricingFormula = async (id) => {
    return apiClient.post(`/variations/restore/${id}`);
};

// Aliases for compatibility
export const getVariations = getPricingFormulas;
export const getVariationById = getPricingFormulaById;
export const createVariation = createPricingFormula;
export const updateVariation = updatePricingFormula;
export const deleteVariation = deletePricingFormula;
export const restoreVariation = restorePricingFormula;
