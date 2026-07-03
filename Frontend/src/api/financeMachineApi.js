import apiClient from "./authApi";

export const getFinanceMachines = async () => {
    return apiClient.get("/financemachines/all");
};

export const createFinanceMachine = async (data) => {
    // data: { machineName, forCode }
    return apiClient.post("/financemachines/add", data);
};

export const updateFinanceMachine = async (id, data) => {
    // data: { machineName, forCode }
    return apiClient.put(`/financemachines/update/${id}`, data);
};

export const deleteFinanceMachine = async (id) => {
    return apiClient.delete(`/financemachines/delete/${id}`);
};
