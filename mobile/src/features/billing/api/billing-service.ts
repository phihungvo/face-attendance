import { apiClient } from '@/services/http/api-client';
import type { PageResponse } from '@/shared/types/api';

import type { BillSummary } from '../types';

type GetMyBillsParams = {
  authToken?: string;
  page?: number;
  size?: number;
};

export function getMyBills({ authToken, page = 0, size = 10 }: GetMyBillsParams = {}) {
  return apiClient.get<PageResponse<BillSummary>>('/user/bills/paged', {
    authToken,
    query: { page, size },
  });
}
