import apiClient from "./authApi";

export const getTicketTypes = async () => {
    return apiClient.get("/ticket-types/all");
};

export const createTicketType = async (data) => {
    // data: { name }
    return apiClient.post("/ticket-types/add", data);
};

export const updateTicketType = async (id, data) => {
    // data: { name }
    return apiClient.put(`/ticket-types/update/${id}`, data);
};

export const deleteTicketType = async (id) => {
    return apiClient.delete(`/ticket-types/delete/${id}`);
};
