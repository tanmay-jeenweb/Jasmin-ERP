import apiClient from "./authApi";

export const getPricingFormulas = async () => {
    return apiClient.get("/pricing-formulas/all");
};

export const getPricingFormulaById = async (id) => {
    return apiClient.get(`/pricing-formulas/${id}`);
};

export const createPricingFormula = async (data) => {
    return apiClient.post("/pricing-formulas/add", data);
};

export const updatePricingFormula = async (id, data) => {
    return apiClient.put(`/pricing-formulas/update/${id}`, data);
};

export const deletePricingFormula = async (id) => {
    return apiClient.delete(`/pricing-formulas/delete/${id}`);
};

// Re-export aliases for backward compatibility
export const getVariations = getPricingFormulas;
export const getVariationById = getPricingFormulaById;
export const createVariation = createPricingFormula;
export const updateVariation = updatePricingFormula;
export const deleteVariation = deletePricingFormula;
