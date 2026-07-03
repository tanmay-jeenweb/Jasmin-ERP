import apiClient from "./authApi";

export const getBanks = async () => {
    return apiClient.get("/banks/all");
};

export const createBank = async (data) => {
    // data: { bankCardName }
    return apiClient.post("/banks/add", data);
};

export const updateBank = async (id, data) => {
    // data: { bankCardName }
    return apiClient.put(`/banks/update/${id}`, data);
};

export const deleteBank = async (id) => {
    return apiClient.delete(`/banks/delete/${id}`);
};
