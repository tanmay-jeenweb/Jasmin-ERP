import apiClient from "./authApi";

export const getOffers = async () => {
    return apiClient.get("/offers/all");
};

export const getOfferById = async (id) => {
    return apiClient.get(`/offers/${id}`);
};

export const createOffer = async (data) => {
    return apiClient.post("/offers/add", data);
};

export const updateOffer = async (id, data) => {
    return apiClient.put(`/offers/update/${id}`, data);
};

export const deleteOffer = async (id) => {
    return apiClient.delete(`/offers/delete/${id}`);
};
