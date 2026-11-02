import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sessions from "./Sessions";
import { request } from "../services/api";
import useAutoRefresh from "../useAutoRefresh";
import { PageHead, Card, Stat, Notice, Updated } from "../components/ui";

export default function Dashboard({ token, onUnauthorised }) {
  const nav = useNavigate();

  const [stats, setStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const refresh = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");

    try {
      const data = await request("/api/parking/availability");
      setStats(data);
      setLastUpdated(new Date());
    } catch (e) {
      setError(e.message || "Unable to load parking statistics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useAutoRefresh(() => refresh({ silent: true }));

  const total = Number(stats?.total_spaces || 0);
  const available = Number(stats?.available_count || 0);
  const occupied = Number(stats?.occupied_count || 0);
  const disabled = Number(stats?.disabled_count || 0);

  const occupancy = total > 0 ? Math.min(100, Math.max(0, (occupied / total) * 100)) : 0;

  const dateLabel = new Intl.DateTimeFormat("en-ZA", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const show = (value) => (stats ? value : "—");

  return (
    <div className="page">
      <PageHead title="Dashboard" subtitle={`Live overview of the car park · ${dateLabel}`}>
        <button className="btn btn-primary" type="button" onClick={() => refresh()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </PageHead>

      {error && <Notice kind="error">{error}</Notice>}

      <div className="stats">
        <Stat label="Total parking bays" value={show(total)} note="All configured bays" />
        <Stat label="Available bays" value={show(available)} note="Free right now" tone="good" />
        <Stat label="Occupied bays" value={show(occupied)} note="Currently in use" tone="brand" />
        <Stat label="Unavailable bays" value={show(disabled)} note="Out of service" tone="warn" />
      </div>

      <Card
        title="Occupancy"
        actions={
          <button className="btn btn-small" type="button" onClick={() => nav("/available-bays")}>
            View available bays →
          </button>
        }
      >
        <div
          className="meter"
          role="progressbar"
          aria-label="Occupancy"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(occupancy)}
        >
          <div style={{ width: `${occupancy}%` }} />
        </div>
        <p className="muted">
          {stats
            ? `${occupied} of ${total} bays occupied (${occupancy.toFixed(0)}%).`
            : "Occupancy is not available right now."}
        </p>
        <Updated time={lastUpdated} />
      </Card>

      <Sessions token={token} onUnauthorised={onUnauthorised} embedded />

      <Card title="Quick links">
        <div className="actions">
          <button className="btn" type="button" onClick={() => nav("/sessions")}>
            Active sessions
          </button>
          <button className="btn" type="button" onClick={() => nav("/available-bays")}>
            Available bays
          </button>
          <button className="btn" type="button" onClick={() => nav("/history")}>
            Session history
          </button>
          <button className="btn" type="button" onClick={() => nav("/vehicles")}>
            Vehicles
          </button>
          <button className="btn" type="button" onClick={() => nav("/password-requests")}>
            Password requests
          </button>
          <button className="btn" type="button" onClick={() => nav("/reports")}>
            Reports
          </button>
        </div>
      </Card>
    </div>
  );
}
