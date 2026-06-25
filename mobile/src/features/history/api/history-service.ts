import { apiClient } from '@/services/http/api-client';
import type { AttendanceType, HistoryAttendanceRecord } from '@/features/history/api/types/attendanceHistory';
import { ENDPOINTS } from '@/config/endpoints';

type GetMyHistoryAttendanceParams = {
  authToken?: string;
  limit?: number;
  offset?: number;
  type?: AttendanceType;
};

export function getMyHistoryAttendance({
  authToken,
  limit = 100,
  offset = 0,
  type,
}: GetMyHistoryAttendanceParams = {}) {
  return apiClient.get<HistoryAttendanceRecord[]>(ENDPOINTS.ATTENDANCE.MY_HISTORY, {
    authToken,
    query: {
      limit,
      offset,
      type,
    },
  });
}
