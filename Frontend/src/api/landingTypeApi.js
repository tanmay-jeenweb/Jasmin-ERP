import apiClient from "./authApi";

export const getLandingTypes = async () => {
    return apiClient.get("/landingtypes/all");
};

export const createLandingType = async (data) => {
    // data: { name, live }
    return apiClient.post("/landingtypes/add", data);
};

export const updateLandingType = async (id, data) => {
    // data: { name, live }
    return apiClient.put(`/landingtypes/update/${id}`, data);
};

export const deleteLandingType = async (id) => {
    return apiClient.delete(`/landingtypes/delete/${id}`);
};
