import { NavLink, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth";
import DashboardPage from "./pages/DashboardPage";
import UsersPage from "./pages/UsersPage";
import LogsPage from "./pages/LogsPage";
import CheckInPage from "./pages/CheckInPage";
import LoginPage from "./pages/LoginPage";

function Shell() {
  const auth = useAuth();

  if (!auth.token) return <LoginPage />;

  return (
    <div className="appShell">
      <aside className="sidebar">
        <div className="brand">Face Attendance</div>
        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "navItem active" : "navItem")}>
            Dashboard
          </NavLink>
          <NavLink to="/users" className={({ isActive }) => (isActive ? "navItem active" : "navItem")}>
            Users
          </NavLink>
          <NavLink to="/logs" className={({ isActive }) => (isActive ? "navItem active" : "navItem")}>
            Attendance Logs
          </NavLink>
          <NavLink to="/checkin" className={({ isActive }) => (isActive ? "navItem active" : "navItem")}>
            Check-in
          </NavLink>
        </nav>
        <div className="sidebarFooter">
          <a className="link" href="/docs" target="_blank" rel="noreferrer">
            Swagger
          </a>
          <button className="linkBtn" onClick={auth.logout} style={{ display: "block", marginTop: 10 }}>
            Đăng xuất
          </button>
        </div>
      </aside>
      <main className="content">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/checkin" element={<CheckInPage />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}
