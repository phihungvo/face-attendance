import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "../shared/auth/auth";
import AppLayout from "./layout/AppLayout/AppLayout";
import AttendancePage from "./pages/AttendancePage/AttendancePage";
import DashboardPage from "./pages/DashboardPage/DashboardPage";
import LoginPage from "./pages/LoginPage/LoginPage";
import TimesheetPage from "./pages/TimesheetPage/TimesheetPage";
import EmployeesPage from "./pages/EmployeesPage/EmployeesPage";
import DepartmentsPage from "./pages/DepartmentsPage/DepartmentsPage";
import LeavePage from "./pages/LeavePage/LeavePage";
import ReportsPage from "./pages/ReportsPage/ReportsPage";
import OvertimePage from "./pages/OvertimePage/OvertimePage";
import PayrollPage from "./pages/PayrollPage/PayrollPage";
import NotificationsPage from "./pages/NotificationsPage/NotificationsPage";
import SettingsPage from "./pages/SettingsPage/SettingsPage";
import EmployeeApp from "../employee/EmployeeApp";
import IamUsersPage from "./pages/IamUsersPage/IamUsersPage";
import IamRolesPage from "./pages/IamRolesPage/IamRolesPage";
import IamPermissionsPage from "./pages/IamPermissionsPage/IamPermissionsPage";
import RequirePermission from "../shared/rbac/RequirePermission";

function PrivateRoutes() {
  const auth = useAuth();
  if (!auth.token) return <LoginPage />;
  if (auth.meLoading && auth.permissionKeys.length === 0) {
    return (
      <div style={{ padding: 24, fontFamily: "var(--font)", color: "var(--text2)", fontWeight: 800 }}>
        Đang tải quyền truy cập...
      </div>
    );
  }

  const canManager = auth.permissionKeys.includes("dashboard.read");
  const canEmployee = auth.permissionKeys.includes("employee.portal");

  if (canEmployee && !canManager) return <EmployeeApp />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route
          path="/"
          element={
            <RequirePermission permission="dashboard.read" fallback={<Navigate to="/notifications" replace />}>
              <DashboardPage />
            </RequirePermission>
          }
        />
        <Route
          path="/checkin"
          element={
            <RequirePermission permission="attendance.read" fallback={<Navigate to="/" replace />}>
              <AttendancePage />
            </RequirePermission>
          }
        />
        <Route
          path="/timelog"
          element={
            <RequirePermission permission="timesheet.read" fallback={<Navigate to="/" replace />}>
              <TimesheetPage />
            </RequirePermission>
          }
        />

        <Route
          path="/employees"
          element={
            <RequirePermission permission="employees.read" fallback={<Navigate to="/" replace />}>
              <EmployeesPage />
            </RequirePermission>
          }
        />
        <Route
          path="/departments"
          element={
            <RequirePermission permission="departments.read" fallback={<Navigate to="/" replace />}>
              <DepartmentsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/leave"
          element={
            <RequirePermission permission="leave.read" fallback={<Navigate to="/" replace />}>
              <LeavePage />
            </RequirePermission>
          }
        />

        <Route
          path="/reports"
          element={
            <RequirePermission permission="reports.read" fallback={<Navigate to="/" replace />}>
              <ReportsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/overtime"
          element={
            <RequirePermission permission="overtime.read" fallback={<Navigate to="/" replace />}>
              <OvertimePage />
            </RequirePermission>
          }
        />
        <Route
          path="/payroll"
          element={
            <RequirePermission permission="payroll.read" fallback={<Navigate to="/" replace />}>
              <PayrollPage />
            </RequirePermission>
          }
        />

        <Route
          path="/notifications"
          element={
            <RequirePermission permission="notifications.read" fallback={<Navigate to="/" replace />}>
              <NotificationsPage />
            </RequirePermission>
          }
        />
        <Route
          path="/settings"
          element={
            <RequirePermission permission="settings.read" fallback={<Navigate to="/" replace />}>
              <SettingsPage />
            </RequirePermission>
          }
        />

        <Route path="/iam/users" element={<IamUsersPage />} />
        <Route path="/iam/roles" element={<IamRolesPage />} />
        <Route path="/iam/permissions" element={<IamPermissionsPage />} />

        <Route path="/employee/*" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <PrivateRoutes />
    </AuthProvider>
  );
}
