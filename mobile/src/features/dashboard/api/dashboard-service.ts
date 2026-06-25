import { apiClient } from '@/services/http/api-client';
import { DashboardSummary } from '@/features/dashboard/api/types/dashboardSummary';

export function getTenantDashboardSummary(authToken?: string) {
  return apiClient.get<DashboardSummary>('/user/dashboard/summary', { authToken });
}

export function getMyBalance(authToken?: string) {
  return apiClient.get<DashboardSummary>('/user/dashboard/summary', { authToken });
}
