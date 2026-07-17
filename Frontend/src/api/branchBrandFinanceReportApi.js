import apiClient from "./authApi";

export const getFinanceBrandReport = () => {
  return apiClient.get("/reports/finance-brand-report");
};
