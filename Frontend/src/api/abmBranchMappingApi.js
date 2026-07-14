import apiClient from "./authApi";

export const getEligibleAbms = async () => {
    return apiClient.get("/abm-branch-mappings/abms");
};

export const getActiveBranches = async () => {
    return apiClient.get("/abm-branch-mappings/branches");
};

export const getAllAbmMappings = async () => {
    return apiClient.get("/abm-branch-mappings/all");
};

export const getAbmMappingById = async (id) => {
    return apiClient.get(`/abm-branch-mappings/${id}`);
};

export const saveAbmBranchMapping = async (data) => {
    return apiClient.post("/abm-branch-mappings/save", data);
};

export const deleteAbmMapping = async (id) => {
    return apiClient.delete(`/abm-branch-mappings/delete/${id}`);
};
