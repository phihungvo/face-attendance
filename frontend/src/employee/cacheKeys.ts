import { makeKey } from "../shared/lib/queryCache";

export const EMP_CACHE_PREFIX = "emp";

export const empKeys = {
  meProfile: () => makeKey([EMP_CACHE_PREFIX, "meProfile"]),
  myCompany: () => makeKey([EMP_CACHE_PREFIX, "myCompany"]),
  myFaceStatus: () => makeKey([EMP_CACHE_PREFIX, "myFaceStatus"]),
  myLeaveBalance: (year: number | null) => makeKey([EMP_CACHE_PREFIX, "myLeaveBalance", year ?? "current"]),
  myTimelogMonth: (ym: string) => makeKey([EMP_CACHE_PREFIX, "myTimelogMonth", ym]),
  myAttendanceLogs: (limit: number, offset: number) => makeKey([EMP_CACHE_PREFIX, "myAttendanceLogs", limit, offset]),
  schedules: () => makeKey([EMP_CACHE_PREFIX, "schedules"]),
  myScheduleRegs: () => makeKey([EMP_CACHE_PREFIX, "myScheduleRegs"])
};

