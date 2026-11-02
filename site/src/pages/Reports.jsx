import { useCallback, useEffect, useMemo, useState } from "react";
import { getActiveSessions, getAdminUsers, getAllSessions, getParkingAvailability } from "../services/api";
import useAutoRefresh from "../useAutoRefresh";
import { PageHead, Card, Stat, Notice, Updated } from "../components/ui";
import {
  bayLabel,
  describeLoadError,
  downloadCSV,
  estimateFee,
  formatDate,
  formatDateTime,
  formatDuration,
  formatMoney,
  localDate,
} from "../utils";

const TABS = [
  ["occupancy", "Parking Occupancy"],
  ["zones", "Zones"],
  ["sessions", "Active Sessions"],
  ["history", "History & Fees"],
  ["drivers", "Drivers"],
];

const DAY = 24 * 60 * 60 * 1000;

function getVehicle(session) {
  return (
    session.vehicle_registration_number ??
    session.vehicle_registration ??
    session.registration_number ??
    session.vehicle_plate ??
    "Not supplied"
  );
}

function getDriver(session) {
  return session.users?.full_name ?? session.driver_name ?? "Not supplied";
}

function getStartMs(session) {
  const ms = session.entry_time ? Date.parse(session.entry_time) : NaN;
  return Number.isNaN(ms) ? null : ms;
}

// Whole-day label such as 2026-11-02, in local time.
function dayKey(ms) {
  return localDate(new Date(ms));
}

export default function Reports({ token, onUnauthorised }) {
  const [availability, setAvailability] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [history, setHistory] = useState(null);
  const [users, setUsers] = useState(null);

  const [errors, setErrors] = useState({ availability: "", sessions: "", history: "", users: "" });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reportType, setReportType] = useState("occupancy");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("longest");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const loadReports = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      const [availabilityResult, sessionsResult, historyResult, usersResult] = await Promise.allSettled([
        getParkingAvailability(),
        getActiveSessions(token),
        getAllSessions(token),
        getAdminUsers(token),
      ]);

      const next = { availability: "", sessions: "", history: "", users: "" };
      let expired = false;

      const note = (result) => {
        if (result.status === "rejected" && (result.reason?.status === 401 || result.reason?.status === 403)) {
          expired = true;
        }
      };
      [sessionsResult, historyResult, usersResult].forEach(note);

      if (availabilityResult.status === "fulfilled") {
        setAvailability(availabilityResult.value);
      } else {
        setAvailability(null);
        next.availability = availabilityResult.reason?.message || "Could not load parking availability.";
      }

      if (sessionsResult.status === "fulfilled") {
        const records = sessionsResult.value?.active_sessions;
        if (Array.isArray(records)) {
          setSessions(records);
        } else {
          setSessions([]);
          next.sessions = "Unexpected sessions response from backend.";
        }
      } else {
        setSessions([]);
        next.sessions = sessionsResult.reason?.message || "Could not load parking sessions.";
      }

      if (historyResult.status === "fulfilled" && Array.isArray(historyResult.value?.sessions)) {
        setHistory(historyResult.value.sessions);
      } else {
        setHistory(null);
        next.history =
          historyResult.status === "rejected"
            ? describeLoadError(historyResult.reason, "Session history")
            : "Unexpected session history response from backend.";
      }

      if (usersResult.status === "fulfilled") {
        const records = Array.isArray(usersResult.value) ? usersResult.value : usersResult.value?.users;
        if (Array.isArray(records)) {
          setUsers(records);
        } else {
          setUsers(null);
          next.users = "Unexpected drivers response from backend.";
        }
      } else {
        setUsers(null);
        next.users = describeLoadError(usersResult.reason, "The drivers list");
      }

      setErrors(next);
      setLastUpdated(new Date());
      setLoading(false);
      setRefreshing(false);

      if (expired) onUnauthorised?.();
    },
    [token, onUnauthorised]
  );

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useAutoRefresh(() => loadReports(true));

  // Keep "time parked" current between refreshes.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(tick);
  }, []);

  /* ---------- Occupancy ---------- */
  const totalSpaces = Number(availability?.total_spaces ?? 0);
  const availableSpaces = Number(availability?.available_count ?? 0);
  const occupiedSpaces = Number(availability?.occupied_count ?? 0);
  const disabledSpaces = Number(availability?.disabled_count ?? 0);
  const occupancyRate = totalSpaces > 0 ? Math.min(100, Math.max(0, (occupiedSpaces / totalSpaces) * 100)) : 0;

  /* ---------- Zones: free bays (availability) + occupied bays (active sessions) ---------- */
  const zoneRows = useMemo(() => {
    const map = new Map();
    const row = (zone) => {
      if (!map.has(zone)) map.set(zone, { zone, free: 0, accessible: 0, occupied: 0 });
      return map.get(zone);
    };
    (availability?.available_spaces ?? []).forEach((s) => {
      const r = row(s.zone ?? "—");
      r.free += 1;
      if (s.is_accessible) r.accessible += 1;
    });
    sessions.forEach((s) => {
      if (s.parking_spaces?.zone) row(s.parking_spaces.zone).occupied += 1;
    });
    return [...map.values()].sort((a, b) => String(a.zone).localeCompare(String(b.zone), undefined, { numeric: true }));
  }, [availability, sessions]);

  /* ---------- Active sessions ---------- */
  const filteredSessions = useMemo(() => {
    const term = search.trim().toLowerCase();

    const matches = term
      ? sessions.filter((session) =>
          [session.id, getVehicle(session), getDriver(session), bayLabel(session.parking_spaces)].some((value) =>
            String(value ?? "").toLowerCase().includes(term)
          )
        )
      : sessions;

    // Oldest start first = longest parked first.
    return [...matches].sort((x, y) => {
      const xs = getStartMs(x);
      const ys = getStartMs(y);
      if (xs === null && ys === null) return 0;
      if (xs === null) return 1;
      if (ys === null) return -1;
      return sortBy === "longest" ? xs - ys : ys - xs;
    });
  }, [sessions, search, sortBy]);

  const sessionStats = useMemo(() => {
    const durations = sessions
      .map((session) => {
        const start = getStartMs(session);
        return start === null ? null : { session, ms: now - start };
      })
      .filter(Boolean);

    const buckets = [
      { label: "Under 1 hour", count: 0 },
      { label: "1 to 3 hours", count: 0 },
      { label: "3 to 8 hours", count: 0 },
      { label: "Over 8 hours (check for stuck sessions)", count: 0 },
    ];
    let estimated = 0;

    durations.forEach(({ ms }) => {
      const hours = ms / 3600000;
      if (hours < 1) buckets[0].count += 1;
      else if (hours < 3) buckets[1].count += 1;
      else if (hours < 8) buckets[2].count += 1;
      else buckets[3].count += 1;
      estimated += estimateFee(ms / 60000);
    });

    if (durations.length === 0) return { average: null, longest: null, buckets, estimated: 0 };

    const total = durations.reduce((sum, item) => sum + item.ms, 0);
    const longest = durations.reduce((a, b) => (b.ms > a.ms ? b : a));

    return { average: total / durations.length, longest, buckets, estimated };
  }, [sessions, now]);

  /* ---------- History and fees (completed sessions) ---------- */
  const historyStats = useMemo(() => {
    if (!history) return null;

    const completed = history.filter((s) => s.session_status === "completed");
    const fees = completed.reduce((sum, s) => sum + Number(s.fee_amount || 0), 0);

    const stays = completed
      .map((s) => (s.entry_time && s.exit_time ? Date.parse(s.exit_time) - Date.parse(s.entry_time) : NaN))
      .filter((ms) => Number.isFinite(ms) && ms >= 0);

    // The last 7 days, today first.
    const days = [];
    for (let i = 0; i < 7; i += 1) {
      const key = dayKey(now - i * DAY);
      days.push({ key, sessions: 0, fees: 0 });
    }
    completed.forEach((s) => {
      const exit = s.exit_time ? Date.parse(s.exit_time) : NaN;
      if (Number.isNaN(exit)) return;
      const day = days.find((d) => d.key === dayKey(exit));
      if (day) {
        day.sessions += 1;
        day.fees += Number(s.fee_amount || 0);
      }
    });

    return {
      total: history.length,
      completed: completed.length,
      fees,
      averageFee: completed.length ? fees / completed.length : 0,
      averageStay: stays.length ? stays.reduce((a, b) => a + b, 0) / stays.length : null,
      days,
    };
  }, [history, now]);

  /* ---------- Drivers ---------- */
  const driverStats = useMemo(() => {
    if (!users) return null;
    const created = (u) => (u.created_at ? Date.parse(u.created_at) : NaN);
    const within = (days) => users.filter((u) => !Number.isNaN(created(u)) && now - created(u) <= days * DAY).length;
    const newest = [...users].sort((a, b) => (created(b) || 0) - (created(a) || 0));
    return { total: users.length, last7: within(7), last30: within(30), newest };
  }, [users, now]);

  /* ---------- Export ---------- */
  const canExport =
    !loading &&
    ((reportType === "occupancy" && Boolean(availability)) ||
      (reportType === "zones" && Boolean(availability)) ||
      (reportType === "sessions" && !errors.sessions) ||
      (reportType === "history" && Boolean(historyStats)) ||
      (reportType === "drivers" && Boolean(driverStats)));

  function exportReport() {
    if (!canExport) return;

    const generated = new Date().toLocaleString("en-ZA");
    let rows;

    if (reportType === "occupancy") {
      rows = [
        ["ParkWise Parking Occupancy Report"],
        ["Generated", generated],
        [],
        ["Metric", "Value"],
        ["Total spaces", totalSpaces],
        ["Available spaces", availableSpaces],
        ["Occupied spaces", occupiedSpaces],
        ["Out of service spaces", disabledSpaces],
        ["Occupancy rate (%)", occupancyRate.toFixed(1)],
      ];
    } else if (reportType === "zones") {
      rows = [
        ["ParkWise Zone Report"],
        ["Generated", generated],
        [],
        ["Zone", "Free bays", "Accessible free bays", "Occupied bays"],
        ...zoneRows.map((z) => [z.zone, z.free, z.accessible, z.occupied]),
      ];
    } else if (reportType === "sessions") {
      rows = [
        ["ParkWise Active Parking Sessions Report"],
        ["Generated", generated],
        [],
        ["Session ID", "Vehicle", "Driver", "Bay", "Started", "Time parked", "Estimated fee so far (R)"],
        ...filteredSessions.map((session) => {
          const start = getStartMs(session);
          return [
            session.id ?? "",
            getVehicle(session),
            getDriver(session),
            bayLabel(session.parking_spaces),
            formatDateTime(session.entry_time),
            start === null ? "" : formatDuration(now - start),
            start === null ? "" : estimateFee((now - start) / 60000).toFixed(2),
          ];
        }),
      ];
    } else if (reportType === "history") {
      rows = [
        ["ParkWise Session History and Fees Report"],
        ["Generated", generated],
        ["Note", "Fees charged on completed sessions. This is not a record of payments received."],
        [],
        ["Metric", "Value"],
        ["Sessions recorded", historyStats.total],
        ["Completed sessions", historyStats.completed],
        ["Fees charged (R)", historyStats.fees.toFixed(2)],
        ["Average fee (R)", historyStats.averageFee.toFixed(2)],
        ["Average stay", historyStats.averageStay === null ? "" : formatDuration(historyStats.averageStay)],
        [],
        ["Date", "Sessions completed", "Fees charged (R)"],
        ...historyStats.days.map((d) => [d.key, d.sessions, d.fees.toFixed(2)]),
      ];
    } else {
      rows = [
        ["ParkWise Drivers Report"],
        ["Generated", generated],
        [],
        ["Name", "Email", "Phone", "Registered"],
        ...driverStats.newest.map((u) => [u.full_name ?? "", u.email ?? "", u.phone_number ?? "", formatDate(u.created_at)]),
      ];
    }

    downloadCSV(`parkwise-${reportType}-${localDate()}.csv`, rows);
  }

  return (
    <div className="page">
      <PageHead title="Reports" subtitle="Occupancy, sessions, fees and drivers. Updates automatically.">
        <button className="btn" type="button" onClick={() => loadReports(true)} disabled={loading || refreshing}>
          {refreshing ? "Refreshing..." : "Refresh"}
        </button>
        <button className="btn" type="button" onClick={() => window.print()}>
          Print
        </button>
        <button className="btn btn-primary" type="button" onClick={exportReport} disabled={!canExport}>
          Export CSV
        </button>
      </PageHead>

      <div className="tabs no-print">
        {TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={"btn" + (reportType === value ? " btn-active" : "")}
            aria-pressed={reportType === value}
            onClick={() => setReportType(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <Updated time={lastUpdated} />

      {loading && <p className="muted">Loading report data...</p>}

      {/* ---------------- Parking occupancy ---------------- */}
      {!loading && reportType === "occupancy" && (
        <>
          {errors.availability && <Notice kind="error">{errors.availability}</Notice>}

          <div className="stats">
            <Stat label="Total Spaces" value={availability ? totalSpaces : "—"} />
            <Stat label="Available Spaces" value={availability ? availableSpaces : "—"} tone="good" />
            <Stat label="Occupied Spaces" value={availability ? occupiedSpaces : "—"} tone="brand" />
            <Stat label="Occupancy Rate" value={availability ? `${occupancyRate.toFixed(1)}%` : "—"} />
          </div>

          <Card title="Occupancy overview">
            <div className="meter" aria-hidden="true">
              <div style={{ width: `${occupancyRate}%` }} />
            </div>
            <p className="muted">
              {availability
                ? `${occupiedSpaces} of ${totalSpaces} parking spaces are occupied.`
                : "Occupancy information could not be loaded."}
            </p>

            {availability && (
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Bays</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Occupied</td>
                      <td>{occupiedSpaces}</td>
                    </tr>
                    <tr>
                      <td>Available</td>
                      <td>{availableSpaces}</td>
                    </tr>
                    <tr>
                      <td>Out of service</td>
                      <td>{disabledSpaces}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}

      {/* ---------------- Zones ---------------- */}
      {!loading && reportType === "zones" && (
        <>
          {errors.availability && <Notice kind="error">{errors.availability}</Notice>}
          {errors.sessions && <Notice kind="error">Occupied bays could not be counted: {errors.sessions}</Notice>}

          <Card title="Bays by zone" subtitle="Free bays come from the availability list. Occupied bays are counted from active sessions.">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Zone</th>
                    <th>Free bays</th>
                    <th>Accessible free</th>
                    <th>Occupied bays</th>
                    <th>In use</th>
                  </tr>
                </thead>
                <tbody>
                  {zoneRows.map((z) => {
                    const used = z.free + z.occupied;
                    return (
                      <tr key={z.zone}>
                        <td>
                          <b>{z.zone}</b>
                        </td>
                        <td>{z.free}</td>
                        <td>{z.accessible}</td>
                        <td>{z.occupied}</td>
                        <td>{used > 0 ? `${Math.round((z.occupied / used) * 100)}%` : "—"}</td>
                      </tr>
                    );
                  })}
                  {zoneRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="muted">
                        No zone information is available right now.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="hint" style={{ marginTop: 10 }}>
              Bays that are out of service are not counted in this table.
            </p>
          </Card>
        </>
      )}

      {/* ---------------- Active sessions ---------------- */}
      {!loading && reportType === "sessions" && (
        <>
          {errors.sessions && <Notice kind="error">{errors.sessions}</Notice>}

          <div className="stats">
            <Stat label="Active sessions" value={errors.sessions ? "—" : sessions.length} />
            <Stat
              label="Average time parked"
              value={sessionStats.average === null ? "—" : formatDuration(sessionStats.average)}
            />
            <Stat
              label="Longest parked"
              value={sessionStats.longest ? formatDuration(sessionStats.longest.ms) : "—"}
              note={sessionStats.longest ? getVehicle(sessionStats.longest.session) : undefined}
            />
            <Stat label="Estimated fees so far" value={formatMoney(sessionStats.estimated)} note="Estimate at R10/hour" tone="brand" />
          </div>

          <Card title="How long vehicles have been parked">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Stay so far</th>
                    <th>Vehicles</th>
                  </tr>
                </thead>
                <tbody>
                  {sessionStats.buckets.map((b) => (
                    <tr key={b.label}>
                      <td>{b.label}</td>
                      <td>{b.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Active Parking Sessions" subtitle={`${filteredSessions.length} shown`}>
            <div className="toolbar no-print">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search vehicle, driver or bay..."
                aria-label="Search sessions"
              />
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort sessions">
                <option value="longest">Longest parked first</option>
                <option value="newest">Newest first</option>
              </select>
            </div>

            <div className="table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Vehicle</th>
                    <th>Driver</th>
                    <th>Bay</th>
                    <th>Started</th>
                    <th>Time parked</th>
                    <th>Estimated fee</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSessions.map((session, index) => {
                    const start = getStartMs(session);
                    return (
                      <tr key={session.id ?? index}>
                        <td>
                          <b>{getVehicle(session)}</b>
                        </td>
                        <td>{getDriver(session)}</td>
                        <td>{bayLabel(session.parking_spaces)}</td>
                        <td>{formatDateTime(session.entry_time)}</td>
                        <td>{start === null ? "—" : formatDuration(now - start)}</td>
                        <td>{start === null ? "—" : formatMoney(estimateFee((now - start) / 60000))}</td>
                      </tr>
                    );
                  })}

                  {filteredSessions.length === 0 && (
                    <tr>
                      <td colSpan={6} className="muted">
                        {errors.sessions ? "Session records are unavailable." : "No matching active sessions."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ---------------- History and fees ---------------- */}
      {!loading && reportType === "history" && (
        <>
          {errors.history && <Notice kind="error">{errors.history}</Notice>}

          {historyStats && (
            <>
              <div className="stats">
                <Stat label="Sessions recorded" value={historyStats.total} />
                <Stat label="Completed sessions" value={historyStats.completed} />
                <Stat label="Fees charged" value={formatMoney(historyStats.fees)} note="Completed sessions" tone="brand" />
                <Stat label="Average fee" value={formatMoney(historyStats.averageFee)} />
              </div>

              <Card
                title="Last 7 days"
                subtitle="Completed sessions grouped by the day they ended. Fees are charged amounts, not confirmed payments."
              >
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Sessions completed</th>
                        <th>Fees charged</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyStats.days.map((d) => (
                        <tr key={d.key}>
                          <td>{d.key}</td>
                          <td>{d.sessions}</td>
                          <td>{formatMoney(d.fees)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="hint" style={{ marginTop: 10 }}>
                  Average stay on completed sessions: {historyStats.averageStay === null ? "—" : formatDuration(historyStats.averageStay)}.
                </p>
              </Card>
            </>
          )}
        </>
      )}

      {/* ---------------- Drivers ---------------- */}
      {!loading && reportType === "drivers" && (
        <>
          {errors.users && <Notice kind="error">{errors.users}</Notice>}

          {driverStats && (
            <>
              <div className="stats">
                <Stat label="Registered drivers" value={driverStats.total} />
                <Stat label="New in the last 7 days" value={driverStats.last7} tone="good" />
                <Stat label="New in the last 30 days" value={driverStats.last30} />
              </div>

              <Card title="Newest drivers" subtitle="The 10 most recent registrations.">
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Phone</th>
                        <th>Registered</th>
                      </tr>
                    </thead>
                    <tbody>
                      {driverStats.newest.slice(0, 10).map((u, index) => (
                        <tr key={u.id ?? index}>
                          <td>
                            <b>{u.full_name || "—"}</b>
                          </td>
                          <td>{u.email || "—"}</td>
                          <td>{u.phone_number || "—"}</td>
                          <td>{formatDate(u.created_at)}</td>
                        </tr>
                      ))}
                      {driverStats.newest.length === 0 && (
                        <tr>
                          <td colSpan={4} className="muted">
                            No drivers have registered yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
