import apiClient from "./authApi";

export const syncContestWinnings = async () => {
    return apiClient.post("/contest-winnings/sync");
};

export const getContestWinningsMaster = async (params = {}) => {
    return apiClient.get("/contest-winnings/master", { params });
};

export const getLastSyncDetails = async () => {
    return apiClient.get("/contest-winnings/last-sync");
};

export const getScratchWinReconciliation = async (params = {}) => {
    return apiClient.get("/contest-winnings/reconciliation", { params });
};
