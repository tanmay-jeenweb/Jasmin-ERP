import apiClient from "./authApi";

export const getStates = async () => {
    return apiClient.get("/states/all");
};

export const createState = async (data) => {
    // data: { name }
    return apiClient.post("/states/add", data);
};

export const updateState = async (id, data) => {
    // data: { name }
    return apiClient.put(`/states/update/${id}`, data);
};

export const deleteState = async (id) => {
    return apiClient.delete(`/states/delete/${id}`);
};
