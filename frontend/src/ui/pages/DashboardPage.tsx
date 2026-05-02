import { useEffect, useMemo, useState } from "react";
import { api, ApiResponse, getApiErrorMessage } from "../apiClient";

type User = { id: number; name: string; created_at: string };
type Log = { id: number; user_id: number; type: string; confidence: number; timestamp: string };

export default function DashboardPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [error, setError] = useState<string | null>(null);

  const latestLogs = useMemo(() => logs.slice(0, 5), [logs]);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const [uRes, lRes] = await Promise.all([
          api.get<ApiResponse<User[]>>("/users"),
          api.get<ApiResponse<Log[]>>("/attendance/logs")
        ]);
        setUsers(uRes.data.result ?? []);
        setLogs(lRes.data.result ?? []);
      } catch (e: any) {
        setError(getApiErrorMessage(e));
      }
    })();
  }, []);

  return (
    <div className="page">
      <h1>Dashboard</h1>
      {error ? <div className="alert error">{error}</div> : null}
      <div className="grid2">
        <div className="card">
          <div className="cardTitle">Users</div>
          <div className="metric">{users.length}</div>
        </div>
        <div className="card">
          <div className="cardTitle">Attendance Logs</div>
          <div className="metric">{logs.length}</div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <div className="cardTitle">Latest Check-ins</div>
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>User ID</th>
              <th>Type</th>
              <th>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {latestLogs.map((l) => (
              <tr key={l.id}>
                <td>{new Date(l.timestamp).toLocaleString()}</td>
                <td>{l.user_id}</td>
                <td>{l.type}</td>
                <td>{l.confidence.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {latestLogs.length === 0 ? <div className="muted">No logs yet.</div> : null}
      </div>
    </div>
  );
}
