import { Navigate, Route, Routes } from "react-router-dom";
import RequirePermission from "../shared/rbac/RequirePermission";
import EmployeeShell from "./layout/EmployeeShell/EmployeeShell";
import EmployeeHomePage from "./pages/EmployeeHomePage/EmployeeHomePage";
import EmployeeCheckinPage from "./pages/EmployeeCheckinPage/EmployeeCheckinPage";
import EmployeeLeavePage from "./pages/EmployeeLeavePage/EmployeeLeavePage";
import EmployeeTimesheetPage from "./pages/EmployeeTimesheetPage/EmployeeTimesheetPage";
import EmployeeProfilePage from "./pages/EmployeeProfilePage/EmployeeProfilePage";
import EmployeeSchedulesPage from "./pages/EmployeeSchedulesPage/EmployeeSchedulesPage";
import EmployeeChangePasswordPage from "./pages/EmployeeChangePasswordPage/EmployeeChangePasswordPage";

export default function EmployeeApp() {
  return (
    <RequirePermission permission="employee.portal" fallback={<Navigate to="/" replace />}>
      <Routes>
        <Route element={<EmployeeShell />}>
          <Route path="/employee" element={<EmployeeHomePage />} />
          <Route path="/employee/checkin" element={<EmployeeCheckinPage />} />
          <Route path="/employee/leave" element={<EmployeeLeavePage />} />
          <Route path="/employee/schedules" element={<EmployeeSchedulesPage />} />
          <Route path="/employee/timesheet" element={<EmployeeTimesheetPage />} />
          <Route path="/employee/profile" element={<EmployeeProfilePage />} />
          <Route path="/employee/change-password" element={<EmployeeChangePasswordPage />} />
          <Route path="*" element={<Navigate to="/employee" replace />} />
        </Route>
      </Routes>
    </RequirePermission>
  );
}
