import apiClient from "./authApi";

export const getStockCashDepositReport = async () => {
    return apiClient.get("/stock-cash-deposit/all");
};

export const importStockCashDepositReport = async (records) => {
    return apiClient.post("/stock-cash-deposit/import", { records });
};

export const importCurrentStockReport = async (records) => {
    return apiClient.post("/stock-cash-deposit/import-current-stock", { records });
};

export const importOpeningCashAndCreditReport = async (records) => {
    return apiClient.post("/stock-cash-deposit/import-opening-credit", { records });
};

export const importCashDepositReport = async (records) => {
    return apiClient.post("/stock-cash-deposit/import-cash-deposit", { records });
};

export const getAbmWiseCashDepositReport = async (state = "All") => {
    return apiClient.get("/stock-cash-deposit/abm-wise", {
        params: { state }
    });
};
