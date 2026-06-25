import { useCallback, useEffect, useMemo, useState } from 'react';

import { getMyHistoryAttendance } from '@/features/history/api/history-service';
import type { AttendanceType, HistoryAttendanceRecord } from '@/features/history/api/types/attendanceHistory';

export type AttendanceHistoryFilter = 'all' | AttendanceType;

type UseAttendanceHistoryParams = {
  token?: string;
};

const DEFAULT_LIMIT = 100;

function filterRecords(records: HistoryAttendanceRecord[], filter: AttendanceHistoryFilter) {
  if (filter === 'all') {
    return records;
  }

  return records.filter((record) => record.type === filter);
}

export function useAttendanceHistory({ token }: UseAttendanceHistoryParams) {
  const [filter, setFilter] = useState<AttendanceHistoryFilter>('all');
  const [records, setRecords] = useState<HistoryAttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadHistory = useCallback(
    async ({ refreshing = false }: { refreshing?: boolean } = {}) => {
      if (!token) {
        setRecords([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorMessage(null);

      try {
        const nextRecords = await getMyHistoryAttendance({
          authToken: token,
          limit: DEFAULT_LIMIT,
        });
        setRecords(nextRecords);
      } catch (error) {
        setRecords([]);
        setErrorMessage(error instanceof Error ? error.message : 'Không thể tải lịch sử chấm công');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token]
  );

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const filteredRecords = useMemo(() => filterRecords(records, filter), [filter, records]);

  const summary = useMemo(
    () => ({
      checkinCount: records.filter((record) => record.type === 'checkin').length,
      checkoutCount: records.filter((record) => record.type === 'checkout').length,
      totalCount: records.length,
    }),
    [records]
  );

  return {
    errorMessage,
    filter,
    isLoading,
    isRefreshing,
    records: filteredRecords,
    refresh: () => loadHistory({ refreshing: true }),
    setFilter,
    summary,
  };
}
