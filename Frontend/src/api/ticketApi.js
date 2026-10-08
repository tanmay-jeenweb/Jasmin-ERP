import apiClient from "./authApi";

// 1. Create a ticket (FormData containing fields and up to 5 image files)
export const createTicket = async (formData) => {
    return apiClient.post("/tickets/add", formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        }
    });
};

// 2. Get tickets list for current user (params: tab = 'active' | 'history', search, ticket_type_id)
export const getTickets = async (params = {}) => {
    return apiClient.get("/tickets/list", { params });
};

// 3. Get single ticket details with remarks thread and actions permissions
export const getTicketDetails = async (id) => {
    return apiClient.get(`/tickets/details/${id}`);
};

// 4. Add a remark to a ticket (resolver or admin)
export const addTicketRemark = async (id, data) => {
    // data: { remark }
    return apiClient.post(`/tickets/remark/${id}`, data);
};

// 5. Shift ticket to new category/sub-category (resolver/admin with ticket management permission)
export const shiftTicket = async (id, data) => {
    // data: { new_ticket_type_id, new_sub_ticket_type_id, reason_remark }
    return apiClient.put(`/tickets/shift/${id}`, data);
};

// 6. Complete ticket
export const completeTicket = async (id, data = {}) => {
    // data: { resolution_remark }
    return apiClient.put(`/tickets/complete/${id}`, data);
};

// 7. Get form options (Ticket Types and Sub Ticket Types) for form dropdowns
export const getTicketFormOptions = async () => {
    return apiClient.get("/tickets/form-options");
};

// 8. Get ticket stats (counts for active, history, assigned)
export const getTicketStats = async () => {
    return apiClient.get("/tickets/stats");
};
