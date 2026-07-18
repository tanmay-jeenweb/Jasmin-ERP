import apiClient from "./authApi";

export const getEligibleUsers = async () => {
    return apiClient.get("/user-branch-mapping/users");
};

export const getActiveBranches = async () => {
    return apiClient.get("/user-branch-mapping/branches");
};

export const getAllUserMappings = async () => {
    return apiClient.get("/user-branch-mapping/all");
};

export const getUserMappingById = async (id) => {
    return apiClient.get(`/user-branch-mapping/${id}`);
};

export const saveUserBranchMapping = async (data) => {
    return apiClient.post("/user-branch-mapping/save", data);
};

export const deleteUserMapping = async (id) => {
    return apiClient.delete(`/user-branch-mapping/delete/${id}`);
};
