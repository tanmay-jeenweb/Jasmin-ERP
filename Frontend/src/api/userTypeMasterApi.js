import apiClient from "./authApi";

export const getUserTypes = async () => {
    return apiClient.get("/usertypes/all");
};

export const createUserType = async (data) => {
    // data: { typeName, permissions: [{ masterName, canRead, canWrite, canUpdate, canDelete }] }
    return apiClient.post("/usertypes/add", data);
};

export const updateUserType = async (id, data) => {
    // data: { typeName, permissions: [{ masterName, canRead, canWrite, canUpdate, canDelete }] }
    return apiClient.put(`/usertypes/update/${id}`, data);
};

export const deleteUserType = async (id) => {
    return apiClient.delete(`/usertypes/delete/${id}`);
};