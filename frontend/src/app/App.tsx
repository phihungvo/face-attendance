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

function PrivateRoutes() {
  const auth = useAuth();
  if (!auth.token) return <LoginPage />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/checkin" element={<AttendancePage />} />
        <Route path="/timelog" element={<TimesheetPage />} />

        <Route path="/employees" element={<EmployeesPage />} />
        <Route path="/departments" element={<DepartmentsPage />} />
        <Route path="/leave" element={<LeavePage />} />

        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/overtime" element={<OvertimePage />} />
        <Route path="/payroll" element={<PayrollPage />} />

        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/settings" element={<SettingsPage />} />

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
