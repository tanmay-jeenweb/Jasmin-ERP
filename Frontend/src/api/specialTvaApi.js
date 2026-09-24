import apiClient from "./authApi";

export const getAllSpecialTvas = async () => {
    return apiClient.get("/special-tva/all");
};

export const getSpecialTvaById = async (id) => {
    return apiClient.get(`/special-tva/details/${id}`);
};

export const createSpecialTva = async (data) => {
    // data: { title, start_date, end_date }
    return apiClient.post("/special-tva/create", data);
};

export const updateSpecialTva = async (id, data) => {
    // data: { title, start_date, end_date }
    return apiClient.put(`/special-tva/update/${id}`, data);
};

export const deleteSpecialTva = async (id) => {
    return apiClient.delete(`/special-tva/delete/${id}`);
};

export const getSpecialTvaReport = async (id) => {
    return apiClient.get(`/special-tva/report/${id}`);
};

export const importSpecialTvaTargets = async (id, records) => {
    // records: array of { branch_name, branch_code, target, mf }
    return apiClient.post(`/special-tva/import/${id}`, { records });
};
