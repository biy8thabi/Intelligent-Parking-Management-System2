import { useCallback, useEffect, useState } from "react";
import { getActiveSessions, forceEndSession } from "../services/api";
import useAutoRefresh from "../useAutoRefresh";

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export default function Sessions({ token, onUnauthorised, embedded = false }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [ending, setEnding] = useState("");
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      setError("");

      try {
        const data = await getActiveSessions(token);

        if (!Array.isArray(data?.active_sessions)) {
          throw new Error("Unexpected sessions response");
        }

        setSessions(data.active_sessions);
      } catch (e) {
        if (e.status === 401 || e.status === 403) {
          onUnauthorised?.();
          return;
        }
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [token, onUnauthorised]
  );

  useEffect(() => {
    load();
  }, [load]);

  useAutoRefresh(() => load({ silent: true }));

  // Keep "time parked" current between refreshes.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(tick);
  }, []);

  async function end(s) {
    const label = s.vehicle_registration_number || s.id;

    if (!window.confirm(`Force-end the parking session for ${label}? This ends the session, charges the fee and frees the bay.`)) {
      return;
    }

    setEnding(s.id);
    setNotice("");
    setError("");

    try {
      await forceEndSession(s.id, token);
      setNotice("Session ended successfully.");
      await load({ silent: true });
    } catch (e) {
      if (e.status === 401 || e.status === 403) {
        onUnauthorised?.();
        return;
      }
      setError(e.message);
    } finally {
      setEnding("");
    }
  }

  return (
    <div className={embedded ? "" : "page"}>
      <div className="title">
        <div>
          <h1>Active Parking Sessions</h1>
          <p>Live data from the ParkWise backend. Updates automatically.</p>
        </div>
        <button className="primary" onClick={() => load()} disabled={loading}>
          Refresh
        </button>
      </div>

      <section className="panel">
        {notice && <p role="status">{notice}</p>}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {loading ? (
          <p>Loading sessions…</p>
        ) : sessions.length === 0 ? (
          <p>No active sessions found.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", textAlign: "left", borderSpacing: "12px" }}>
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Driver</th>
                  <th>Parking bay</th>
                  <th>Started</th>
                  <th>Time parked</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const start = s.entry_time ? Date.parse(s.entry_time) : NaN;
                  return (
                    <tr key={s.id}>
                      <td>{s.vehicle_registration_number || "—"}</td>
                      <td>{s.users?.full_name || "—"}</td>
                      <td>
                        {s.parking_spaces
                          ? [s.parking_spaces.zone, s.parking_spaces.bay_number].filter(Boolean).join("-")
                          : "—"}
                      </td>
                      <td>{Number.isNaN(start) ? "—" : new Date(start).toLocaleString("en-ZA")}</td>
                      <td>{Number.isNaN(start) ? "—" : formatDuration(now - start)}</td>
                      <td>
                        <button
                          className="secondary-button"
                          disabled={Boolean(ending)}
                          onClick={() => end(s)}
                        >
                          {ending === s.id ? "Ending…" : "Force End"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
