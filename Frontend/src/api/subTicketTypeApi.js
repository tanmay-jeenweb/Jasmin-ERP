import apiClient from "./authApi";

export const getSubTicketTypes = async () => {
    return apiClient.get("/sub-ticket-types/all");
};

export const getTicketAssignees = async () => {
    return apiClient.get("/sub-ticket-types/assignees");
};

export const createSubTicketType = async (data) => {
    // data: { ticket_type_id, name, assigned_to, remark }
    return apiClient.post("/sub-ticket-types/add", data);
};

export const updateSubTicketType = async (id, data) => {
    // data: { ticket_type_id, name, assigned_to, remark }
    return apiClient.put(`/sub-ticket-types/update/${id}`, data);
};

export const deleteSubTicketType = async (id) => {
    return apiClient.delete(`/sub-ticket-types/delete/${id}`);
};
