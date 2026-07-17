import apiClient from "./authApi";

export const getBranchBrandFinanceMappings = async (branchId) => {
    return apiClient.get(`/branch-brand-finance-mapping/${branchId}`);
};

export const saveBranchBrandFinanceMappings = async (branchId, mappings) => {
    return apiClient.post(`/branch-brand-finance-mapping/${branchId}`, { mappings });
};
