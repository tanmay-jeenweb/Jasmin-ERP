import apiClient from "./authApi";

export const getSupports = async () => {
    return apiClient.get("/support/all");
};

export const createSupport = async (data) => {
    // data: { name, designation, mobile_no, work }
    return apiClient.post("/support/add", data);
};

export const updateSupport = async (id, data) => {
    // data: { name, designation, mobile_no, work }
    return apiClient.put(`/support/update/${id}`, data);
};

export const deleteSupport = async (id) => {
    return apiClient.delete(`/support/delete/${id}`);
};
