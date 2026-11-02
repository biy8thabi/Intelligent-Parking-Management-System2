import { useCallback, useMemo, useState } from "react";
import { getAllSessions } from "../services/api";
import useLoader from "../useLoader";
import { PageHead, Card, Stat, Notice, Updated, Badge, ShowMore } from "../components/ui";
import { bayLabel, downloadCSV, formatDateTime, formatDuration, formatMoney, localDate } from "../utils";

const PAGE_SIZE = 50;

const STATUS_TONE = { active: "good", completed: undefined, cancelled: "warn" };

function durationMs(session, now) {
  const start = session.entry_time ? Date.parse(session.entry_time) : NaN;
  if (Number.isNaN(start)) return null;
  const end = session.exit_time ? Date.parse(session.exit_time) : now;
  return Number.isNaN(end) ? null : end - start;
}

// Every parking session (past and present) from GET /api/admin/sessions.
export default function SessionHistory({ token, onUnauthorised }) {
  const fetcher = useCallback(() => getAllSessions(token), [token]);
  const { data, loading, error, lastUpdated, load } = useLoader(fetcher, {
    what: "Session history",
    onUnauthorised,
  });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const sessions = useMemo(() => (Array.isArray(data?.sessions) ? data.sessions : []), [data]);
  const now = Date.now();

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sessions.filter((s) => {
      if (status !== "all" && s.session_status !== status) return false;
      if (!term) return true;
      return [s.vehicle_registration_number, s.users?.full_name, s.users?.email, bayLabel(s.parking_spaces)].some((v) =>
        String(v ?? "").toLowerCase().includes(term)
      );
    });
  }, [sessions, search, status]);

  const completed = sessions.filter((s) => s.session_status === "completed");
  const active = sessions.filter((s) => s.session_status === "active");
  const feesCharged = completed.reduce((sum, s) => sum + Number(s.fee_amount || 0), 0);

  function exportCSV() {
    downloadCSV(`parkwise-session-history-${localDate()}.csv`, [
      ["ParkWise Session History"],
      ["Generated", new Date().toLocaleString("en-ZA")],
      [],
      ["Vehicle", "Driver", "Email", "Bay", "Entered", "Exited", "Duration", "Fee (R)", "Status"],
      ...filtered.map((s) => [
        s.vehicle_registration_number ?? "",
        s.users?.full_name ?? "",
        s.users?.email ?? "",
        bayLabel(s.parking_spaces),
        formatDateTime(s.entry_time),
        formatDateTime(s.exit_time),
        formatDuration(durationMs(s, now)),
        s.session_status === "completed" ? Number(s.fee_amount || 0).toFixed(2) : "",
        s.session_status ?? "",
      ]),
    ]);
  }

  return (
    <div className="page">
      <PageHead title="Session History" subtitle="Every parking session, past and present, newest first.">
        <button className="btn" type="button" onClick={() => load()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
        <button className="btn btn-primary" type="button" onClick={exportCSV} disabled={!filtered.length}>
          Export CSV
        </button>
      </PageHead>

      <Updated time={lastUpdated} />
      {error && <Notice kind="error">{error}</Notice>}

      {!error && data && (
        <>
          <div className="stats">
            <Stat label="Total sessions" value={sessions.length} />
            <Stat label="Completed" value={completed.length} />
            <Stat label="Active now" value={active.length} tone="good" />
            <Stat label="Fees charged" value={formatMoney(feesCharged)} note="Completed sessions" tone="brand" />
          </div>

          <Card title="Sessions" subtitle={`${filtered.length} shown`}>
            <div className="toolbar">
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setVisible(PAGE_SIZE);
                }}
                placeholder="Search vehicle, driver or bay..."
                aria-label="Search sessions"
              />
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setVisible(PAGE_SIZE);
                }}
                aria-label="Filter by status"
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Driver</th>
                    <th>Bay</th>
                    <th>Entered</th>
                    <th>Exited</th>
                    <th>Duration</th>
                    <th>Fee</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, visible).map((s) => (
                    <tr key={s.id}>
                      <td>
                        <b>{s.vehicle_registration_number || "—"}</b>
                      </td>
                      <td>{s.users?.full_name || "—"}</td>
                      <td>{bayLabel(s.parking_spaces)}</td>
                      <td>{formatDateTime(s.entry_time)}</td>
                      <td>{formatDateTime(s.exit_time)}</td>
                      <td>{formatDuration(durationMs(s, now))}</td>
                      <td>{s.session_status === "completed" ? formatMoney(s.fee_amount) : "—"}</td>
                      <td>
                        <Badge tone={STATUS_TONE[s.session_status]}>{s.session_status || "unknown"}</Badge>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={8} className="muted">
                        {sessions.length ? "No sessions match your filters." : "No sessions have been recorded yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <ShowMore shown={visible} total={filtered.length} onMore={() => setVisible((v) => v + PAGE_SIZE)} />
          </Card>
        </>
      )}

      {loading && !data && !error && <p className="muted">Loading session history…</p>}
    </div>
  );
}
