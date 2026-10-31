import { useCallback, useEffect, useMemo, useState } from "react";
import { getActiveSessions, getParkingAvailability } from "../services/api";
import useAutoRefresh from "../useAutoRefresh";

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

function getBay(session) {
  const bay = session.parking_spaces;
  if (!bay) return "—";
  return [bay.zone, bay.bay_number].filter(Boolean).join("-") || "—";
}

function getStartMs(session) {
  const ms = session.entry_time ? Date.parse(session.entry_time) : NaN;
  return Number.isNaN(ms) ? null : ms;
}

function getStarted(session) {
  const ms = getStartMs(session);
  return ms === null ? "—" : new Date(ms).toLocaleString("en-ZA");
}

function formatDuration(ms) {
  if (ms === null || ms < 0) return "—";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Local calendar date (toISOString would use UTC and be a day off after midnight in SAST).
function localDate() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function escapeCSV(value) {
  const text = String(value ?? "");
  // Protect spreadsheet programs against CSV formula injection.
  const safe = /^[\s]*[=+\-@\t\r]/.test(text) ? "'" + text : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function downloadCSV(filename, rows) {
  const csv = rows.map((row) => row.map(escapeCSV).join(",")).join("\r\n");
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Reports({ token, onUnauthorised }) {
  const [availability, setAvailability] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [availabilityError, setAvailabilityError] = useState("");
  const [sessionsError, setSessionsError] = useState("");
  const [reportType, setReportType] = useState("occupancy");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("longest");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const loadReports = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const [availabilityResult, sessionsResult] = await Promise.allSettled([
        getParkingAvailability(),
        getActiveSessions(token),
      ]);

      if (availabilityResult.status === "fulfilled") {
        setAvailability(availabilityResult.value);
        setAvailabilityError("");
      } else {
        setAvailability(null);
        setAvailabilityError(
          availabilityResult.reason?.message || "Could not load parking availability."
        );
      }

      if (sessionsResult.status === "fulfilled") {
        const records = sessionsResult.value?.active_sessions;

        if (Array.isArray(records)) {
          setSessions(records);
          setSessionsError("");
        } else {
          setSessions([]);
          setSessionsError("Unexpected sessions response from backend.");
        }
      } else {
        setSessions([]);
        const reason = sessionsResult.reason;
        if (reason?.status === 401 || reason?.status === 403) {
          onUnauthorised?.();
        }
        setSessionsError(reason?.message || "Could not load parking sessions.");
      }

      setLastUpdated(new Date());
      setLoading(false);
      setRefreshing(false);
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

  const totalSpaces = Number(availability?.total_spaces ?? 0);
  const availableSpaces = Number(availability?.available_count ?? 0);
  const occupiedSpaces = Number(availability?.occupied_count ?? 0);
  const disabledSpaces = Number(availability?.disabled_count ?? 0);

  const occupancyRate =
    totalSpaces > 0 ? Math.min(100, Math.max(0, (occupiedSpaces / totalSpaces) * 100)) : 0;

  const filteredSessions = useMemo(() => {
    const term = search.trim().toLowerCase();

    const matches = term
      ? sessions.filter((session) =>
          [session.id, getVehicle(session), getDriver(session), getBay(session)].some((value) =>
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

    if (durations.length === 0) return { average: null, longest: null };

    const total = durations.reduce((sum, item) => sum + item.ms, 0);
    const longest = durations.reduce((a, b) => (b.ms > a.ms ? b : a));

    return { average: total / durations.length, longest };
  }, [sessions, now]);

  const canExport =
    !loading && (reportType === "occupancy" ? Boolean(availability) : !sessionsError);

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
    } else {
      rows = [
        ["ParkWise Active Parking Sessions Report"],
        ["Generated", generated],
        [],
        ["Session ID", "Vehicle", "Driver", "Bay", "Started", "Time parked"],
        ...filteredSessions.map((session) => [
          session.id ?? "",
          getVehicle(session),
          getDriver(session),
          getBay(session),
          getStarted(session),
          getStartMs(session) === null ? "" : formatDuration(now - getStartMs(session)),
        ]),
      ];
    }

    downloadCSV(`parkwise-${reportType}-${localDate()}.csv`, rows);
  }

  const buttonStyle = {
    padding: "11px 16px",
    borderRadius: "10px",
    border: "1px solid #7c3aed",
    cursor: "pointer",
    fontWeight: 600,
  };

  const panelStyle = { padding: "22px", borderRadius: "14px" };

  return (
    <div className="page">
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .side, .topbar, .report-actions, .report-tabs, .report-search { display: none !important; }
          .shell { display: block !important; }
          .main-area { margin: 0 !important; padding: 0 !important; }
          .page { color: black !important; background: white !important; }
          .panel { color: black !important; background: white !important; border: 1px solid #ddd !important; break-inside: avoid; }
          .report-table th, .report-table td { color: black !important; }
        }
      `}</style>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div>
          <p style={{ color: "#a78bfa", marginBottom: "6px" }}>PARKWISE / ADMINISTRATION</p>
          <h1 style={{ margin: 0 }}>Reports</h1>
          <p style={{ opacity: 0.75 }}>Parking activity and operational performance.</p>
          {lastUpdated && (
            <p style={{ fontSize: "13px", opacity: 0.65 }}>
              Last refreshed: {lastUpdated.toLocaleString("en-ZA")}
            </p>
          )}
        </div>

        <div className="report-actions" style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          <button
            type="button"
            onClick={() => loadReports(true)}
            disabled={loading || refreshing}
            style={{ ...buttonStyle, background: "transparent", color: "inherit" }}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            onClick={exportReport}
            disabled={!canExport}
            style={{ ...buttonStyle, background: "#7c3aed", color: "#fff", opacity: canExport ? 1 : 0.5 }}
          >
            Export CSV
          </button>

          <button
            type="button"
            onClick={() => canExport && window.print()}
            disabled={!canExport}
            style={{ ...buttonStyle, background: "#4c1d95", color: "#fff", opacity: canExport ? 1 : 0.5 }}
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      <div className="report-tabs" style={{ display: "flex", flexWrap: "wrap", gap: "12px", marginBottom: "24px" }}>
        {[
          { value: "occupancy", label: "Parking Occupancy" },
          { value: "sessions", label: "Active Sessions" },
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setReportType(item.value)}
            aria-pressed={reportType === item.value}
            style={{
              ...buttonStyle,
              background: reportType === item.value ? "#7c3aed" : "transparent",
              color: reportType === item.value ? "#fff" : "inherit",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading && <p>Loading report data...</p>}

      {!loading && reportType === "occupancy" && (
        <>
          {availabilityError && (
            <section className="panel" style={panelStyle}>
              <h3>Availability unavailable</h3>
              <p>{availabilityError}</p>
            </section>
          )}

          {availability && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                  gap: "16px",
                  marginBottom: "24px",
                }}
              >
                {[
                  { label: "Total Spaces", value: totalSpaces },
                  { label: "Available", value: availableSpaces },
                  { label: "Occupied", value: occupiedSpaces },
                  { label: "Out of service", value: disabledSpaces },
                  { label: "Occupancy Rate", value: `${occupancyRate.toFixed(1)}%` },
                ].map((item) => (
                  <section key={item.label} className="panel" style={panelStyle}>
                    <p style={{ opacity: 0.7, marginTop: 0 }}>{item.label}</p>
                    <h2 style={{ fontSize: "29px", marginBottom: 0 }}>{item.value}</h2>
                  </section>
                ))}
              </div>

              <section className="panel" style={panelStyle}>
                <h3>Occupancy Overview</h3>

                <div
                  style={{
                    width: "100%",
                    height: "18px",
                    background: "rgba(127,127,127,0.2)",
                    borderRadius: "20px",
                    overflow: "hidden",
                    display: "flex",
                    margin: "20px 0 12px",
                  }}
                >
                  {[
                    { n: occupiedSpaces, color: "#8b5cf6" },
                    { n: availableSpaces, color: "#34d399" },
                    { n: disabledSpaces, color: "#fbbf24" },
                  ].map((part, i) => (
                    <div
                      key={i}
                      style={{
                        width: `${totalSpaces > 0 ? Math.min(100, (part.n / totalSpaces) * 100) : 0}%`,
                        height: "100%",
                        background: part.color,
                      }}
                    />
                  ))}
                </div>

                <p>
                  {occupiedSpaces} of {totalSpaces} parking spaces are occupied (
                  {occupancyRate.toFixed(1)}%).
                </p>

                <p>
                  <span style={{ color: "#8b5cf6" }}>●</span> Occupied: {occupiedSpaces}
                  {"  "}
                  <span style={{ color: "#34d399" }}>●</span> Available: {availableSpaces}
                  {"  "}
                  <span style={{ color: "#fbbf24" }}>●</span> Out of service: {disabledSpaces}
                </p>
              </section>
            </>
          )}
        </>
      )}

      {!loading && reportType === "sessions" && (
        <section className="panel" style={panelStyle}>
          {sessionsError ? (
            <p role="alert">{sessionsError}</p>
          ) : (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                  gap: "16px",
                  marginBottom: "8px",
                }}
              >
                {[
                  { label: "Active sessions", value: sessions.length },
                  { label: "Average time parked", value: formatDuration(sessionStats.average) },
                  {
                    label: "Longest session",
                    value: sessionStats.longest
                      ? `${formatDuration(sessionStats.longest.ms)} · ${getVehicle(sessionStats.longest.session)}`
                      : "—",
                  },
                ].map((item) => (
                  <section key={item.label} className="panel" style={panelStyle}>
                    <p style={{ opacity: 0.7, marginTop: 0 }}>{item.label}</p>
                    <h2 style={{ fontSize: "22px", marginBottom: 0 }}>{item.value}</h2>
                  </section>
                ))}
              </div>

              <input
                className="report-search"
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search session, vehicle or driver..."
                aria-label="Search parking sessions"
                style={{
                  width: "100%",
                  maxWidth: "420px",
                  padding: "12px",
                  margin: "12px 0 20px",
                  borderRadius: "8px",
                  border: "1px solid #777",
                  background: "transparent",
                  color: "inherit",
                  boxSizing: "border-box",
                }}
              />

              <div
                className="report-search"
                style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginBottom: "8px" }}
              >
                <label style={{ fontSize: "13px", opacity: 0.8 }}>
                  Sort:{" "}
                  <select
                    value={sortBy}
                    onChange={(event) => setSortBy(event.target.value)}
                    style={{ padding: "6px", borderRadius: "6px", background: "transparent", color: "inherit", border: "1px solid #777" }}
                  >
                    <option value="longest">Longest parked first</option>
                    <option value="newest">Newest first</option>
                  </select>
                </label>
              </div>

              <p style={{ fontSize: "13px", opacity: 0.7 }}>
                Showing {filteredSessions.length} of {sessions.length} sessions. Time parked updates automatically.
              </p>

              <div style={{ overflowX: "auto" }}>
                <table className="report-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Session ID", "Vehicle", "Driver", "Bay", "Started", "Time parked"].map((heading) => (
                        <th
                          key={heading}
                          style={{ textAlign: "left", padding: "12px", borderBottom: "1px solid #777" }}
                        >
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {filteredSessions.map((session, index) => (
                      <tr key={session.id ?? index}>
                        <td style={{ padding: "12px" }}>{session.id ?? "—"}</td>
                        <td style={{ padding: "12px" }}>{getVehicle(session)}</td>
                        <td style={{ padding: "12px" }}>{getDriver(session)}</td>
                        <td style={{ padding: "12px" }}>{getBay(session)}</td>
                        <td style={{ padding: "12px" }}>{getStarted(session)}</td>
                        <td style={{ padding: "12px" }}>
                          {getStartMs(session) === null ? "—" : formatDuration(now - getStartMs(session))}
                        </td>
                      </tr>
                    ))}

                    {filteredSessions.length === 0 && (
                      <tr>
                        <td colSpan={6} style={{ padding: "18px" }}>
                          No matching active sessions.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
