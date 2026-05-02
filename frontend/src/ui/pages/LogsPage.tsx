import { useEffect, useState } from "react";
import { api, ApiResponse, getApiErrorMessage } from "../apiClient";

type Log = { id: number; user_id: number; type: string; confidence: number; timestamp: string };

export default function LogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const res = await api.get<ApiResponse<Log[]>>("/attendance/logs");
        setLogs(res.data.result ?? []);
      } catch (e: any) {
        setError(getApiErrorMessage(e));
      }
    })();
  }, []);

  return (
    <div className="page">
      <h1>Attendance Logs</h1>
      {error ? <div className="alert error">{error}</div> : null}
      <div className="card">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>User ID</th>
              <th>Type</th>
              <th>Confidence</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{l.id}</td>
                <td>{l.user_id}</td>
                <td>{l.type}</td>
                <td>{l.confidence.toFixed(3)}</td>
                <td>{new Date(l.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {logs.length === 0 ? <div className="muted">No logs yet.</div> : null}
      </div>
    </div>
  );
}
