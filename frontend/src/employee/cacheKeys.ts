import { makeKey } from "../shared/lib/queryCache";
import { getAuthCacheScope } from "../shared/lib/apiClient";

export const EMP_CACHE_PREFIX = "emp";
function empScope() {
  return getAuthCacheScope();
}

export const empKeys = {
  meProfile: () => makeKey([EMP_CACHE_PREFIX, empScope(), "meProfile"]),
  myCompany: () => makeKey([EMP_CACHE_PREFIX, empScope(), "myCompany"]),
  myFaceStatus: () => makeKey([EMP_CACHE_PREFIX, empScope(), "myFaceStatus"]),
  myLeaveBalance: (year: number | null) => makeKey([EMP_CACHE_PREFIX, empScope(), "myLeaveBalance", year ?? "current"]),
  myTimelogMonth: (ym: string) => makeKey([EMP_CACHE_PREFIX, empScope(), "myTimelogMonth", ym]),
  myAttendanceLogs: (limit: number, offset: number) => makeKey([EMP_CACHE_PREFIX, empScope(), "myAttendanceLogs", limit, offset]),
  schedules: () => makeKey([EMP_CACHE_PREFIX, empScope(), "schedules"]),
  myScheduleRegs: () => makeKey([EMP_CACHE_PREFIX, empScope(), "myScheduleRegs"])
};
