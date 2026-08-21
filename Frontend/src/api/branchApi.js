import apiClient from "./authApi";

export const getBranches = async (params) => {
    return apiClient.get("/branches/all", { params });
};

export const createBranch = async (data) => {
    return apiClient.post("/branches/add", data);
};

export const updateBranch = async (id, data) => {
    return apiClient.put(`/branches/update/${id}`, data);
};

export const deleteBranch = async (id) => {
    return apiClient.delete(`/branches/delete/${id}`);
};

export const syncBranches = async () => {
    return apiClient.post("/branches/sync");
};

export const getBranchFinanceCodes = async (branchId) => {
    return apiClient.get(`/branches/finance-codes/${branchId}`);
};

export const saveBranchFinanceCodes = async (branchId, data) => {
    return apiClient.post(`/branches/finance-codes/${branchId}`, data);
};

export const getEligibleAbms = async () => {
    return apiClient.get("/branches/eligible-abms");
};
