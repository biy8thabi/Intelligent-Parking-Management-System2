import { useCallback, useEffect, useMemo, useState } from "react";
import {
  getActiveSessions,
  getParkingAvailability,
  request,
} from "../services/api";


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
  return (
    session.driver_name ??
    session.users?.full_name ??
    session.user?.full_name ??
    session.driver?.full_name ??
    "Not supplied"
  );
}

function getBay(session) {
  const bay = session.parking_spaces;
  if (!bay) return "—";
  return [bay.zone, bay.bay_number].filter(Boolean).join("-") || "—";
}

function getStarted(session) {
  const raw = session.entry_time ?? session.start_time ?? session.created_at;
  if (!raw) return "—";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en-ZA");
}

function getStatus(session) {
  return session.session_status ?? session.status ?? "Active";
}

// Local calendar date (toISOString would use UTC and be a day off after midnight in SAST).
function localDate() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function getStartMs(session) {
  const raw = session.entry_time ?? session.start_time ?? session.created_at;
  const ms = raw ? Date.parse(raw) : NaN;
  return Number.isNaN(ms) ? null : ms;
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

const money = (value) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(
    Number(value) || 0
  );

const RECEIVED = ["completed", "successful", "paid"];
const FAILED = ["failed", "cancelled"];

function paymentStatus(payment) {
  return String(payment.status ?? payment.payment_status ?? "unknown").toLowerCase();
}

function paymentAmount(payment) {
  const amount = Number(
    payment.amount ?? payment.amount_paid ?? payment.total_amount ?? 0
  );
  return Number.isFinite(amount) ? amount : 0;
}

function paymentDate(payment) {
  const raw = payment.paid_at ?? payment.payment_date ?? payment.created_at;
  const date = raw ? new Date(raw) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function dayKey(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const RANGES = [
  { value: "today", label: "Today", days: 1 },
  { value: "7", label: "Last 7 days", days: 7 },
  { value: "30", label: "Last 30 days", days: 30 },
  { value: "all", label: "All time", days: null },
];

function readRefreshSeconds() {
  try {
    const prefs = JSON.parse(localStorage.getItem("pw_settings") || "{}");
    const seconds = Number(prefs.refreshInterval);
    return Number.isFinite(seconds) && seconds >= 10 ? seconds : 30;
  } catch {
    return 30;
  }
}

function escapeCSV(value) {
  const text = String(value ?? "");
  // Protect spreadsheet programs against CSV formula injection.
  const safe = /^[\s]*[=+\-@\t\r]/.test(text) ? "'" + text : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

function downloadCSV(filename, rows) {
  const csv = rows.map((row) => row.map(escapeCSV).join(",")).join("\r\n");
  const blob = new Blob(["\uFEFF", csv], {
    type: "text/csv;charset=utf-8",
  });

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
  const [lastUpdated, setLastUpdated] = useState(null);
  const [sortBy, setSortBy] = useState("longest");
  const [now, setNow] = useState(() => Date.now());

  const [payments, setPayments] = useState(null);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [paymentsError, setPaymentsError] = useState("");
  const [range, setRange] = useState("30");

  const loadReports = useCallback(
    async (signal, isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setAvailabilityError("");
      setSessionsError("");

      const availabilityRequest = getParkingAvailability();

      const sessionsRequest = getActiveSessions(token).then((data) => {
        const records = Array.isArray(data)
          ? data
          : data?.active_sessions ?? data?.sessions ?? data?.data ?? [];

        if (!Array.isArray(records)) {
          throw new Error("Unexpected sessions response from backend.");
        }

        return records;
      });

      const [availabilityResult, sessionsResult] =
        await Promise.allSettled([
          availabilityRequest,
          sessionsRequest,
        ]);

      if (signal?.aborted) return;

      if (availabilityResult.status === "fulfilled") {
        setAvailability(availabilityResult.value);
      } else {
        setAvailability(null);
        setAvailabilityError(
          availabilityResult.reason?.message ||
            "Could not load parking availability."
        );
      }

      if (sessionsResult.status === "fulfilled") {
        setSessions(sessionsResult.value);
      } else {
        setSessions([]);
        if (
          sessionsResult.reason?.status === 401 ||
          sessionsResult.reason?.status === 403
        ) {
          onUnauthorised?.();
        }
        setSessionsError(
          sessionsResult.reason?.message ||
            "Could not load parking sessions."
        );
      }

      setLastUpdated(new Date());
      setLoading(false);
      setRefreshing(false);
    },
    [token, onUnauthorised]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadReports(controller.signal);

    return () => controller.abort();
  }, [loadReports]);

  const loadPayments = useCallback(async () => {
    setPaymentsLoading(true);
    setPaymentsError("");

    try {
      const result = await request("/api/admin/payments", { token });
      const records = Array.isArray(result)
        ? result
        : result?.payments ?? result?.transactions ?? result?.data;

      if (!Array.isArray(records)) {
        throw new Error(
          "The payments endpoint did not return a list of payments."
        );
      }

      setPayments(records);
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        onUnauthorised?.();
      }
      setPayments(null);
      setPaymentsError(
        err.status === 404
          ? "The backend does not have a payments endpoint yet (/api/admin/payments), so revenue cannot be calculated."
          : err.message || "Could not load payments."
      );
    } finally {
      setPaymentsLoading(false);
    }
  }, [token, onUnauthorised]);

  // Load payments the first time the Revenue tab is opened.
  useEffect(() => {
    if (
      reportType === "revenue" &&
      payments === null &&
      !paymentsError &&
      !paymentsLoading
    ) {
      loadPayments();
    }
  }, [reportType, payments, paymentsError, paymentsLoading, loadPayments]);

  // Keep "time parked" current, and refresh live data on the interval from Settings.
  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (reportType === "revenue") return undefined;

    const refresh = setInterval(() => {
      if (document.visibilityState === "visible") {
        loadReports(undefined, true);
      }
    }, readRefreshSeconds() * 1000);

    return () => clearInterval(refresh);
  }, [reportType, loadReports]);

  const totalSpaces = Number(availability?.total_spaces ?? 0);
  const availableSpaces = Number(availability?.available_count ?? 0);
  const occupiedSpaces = Number(availability?.occupied_count ?? 0);
  const disabledSpaces = Number(availability?.disabled_count ?? 0);

  const occupancyRate =
    totalSpaces > 0
      ? Math.min(100, Math.max(0, (occupiedSpaces / totalSpaces) * 100))
      : 0;

  const filteredSessions = useMemo(() => {
    const term = search.trim().toLowerCase();

    const matches = term
      ? sessions.filter((session) =>
          [
            session.id,
            getVehicle(session),
            getDriver(session),
            getBay(session),
            getStatus(session),
          ].some((value) =>
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

    if (durations.length === 0) {
      return { average: null, longest: null };
    }

    const total = durations.reduce((sum, item) => sum + item.ms, 0);
    const longest = durations.reduce((a, b) => (b.ms > a.ms ? b : a));

    return {
      average: total / durations.length,
      longest,
    };
  }, [sessions, now]);

  const revenue = useMemo(() => {
    if (!payments) return null;

    const rangeInfo = RANGES.find((item) => item.value === range);
    let from = null;

    if (rangeInfo?.days) {
      from = new Date();
      from.setHours(0, 0, 0, 0);
      from.setDate(from.getDate() - (rangeInfo.days - 1));
    }

    let undated = 0;
    const inRange = payments.filter((payment) => {
      if (!from) return true;
      const date = paymentDate(payment);
      if (!date) {
        undated += 1;
        return false;
      }
      return date >= from;
    });

    const received = inRange.filter((p) => RECEIVED.includes(paymentStatus(p)));
    const pending = inRange.filter((p) => paymentStatus(p) === "pending");
    const failed = inRange.filter((p) => FAILED.includes(paymentStatus(p)));
    const refunded = inRange.filter((p) => paymentStatus(p) === "refunded");

    const sum = (list) => list.reduce((t, p) => t + paymentAmount(p), 0);
    const total = sum(received);

    const byDay = new Map();
    received.forEach((payment) => {
      const date = paymentDate(payment);
      if (!date) return;
      const key = dayKey(date);
      const entry = byDay.get(key) ?? { day: key, count: 0, total: 0 };
      entry.count += 1;
      entry.total += paymentAmount(payment);
      byDay.set(key, entry);
    });

    return {
      total,
      receivedCount: received.length,
      average: received.length ? total / received.length : 0,
      pendingCount: pending.length,
      pendingTotal: sum(pending),
      failedCount: failed.length,
      refundedCount: refunded.length,
      refundedTotal: sum(refunded),
      days: [...byDay.values()].sort((x, y) => (x.day < y.day ? 1 : -1)),
      undatedCount: received.filter((p) => !paymentDate(p)).length,
      undatedSkipped: undated,
    };
  }, [payments, range]);

  const reportNames = {
    occupancy: "Parking Occupancy",
    sessions: "Active Parking Sessions",
    revenue: "Revenue",
  };

  const canExport =
    !loading &&
    (reportType === "occupancy"
      ? Boolean(availability)
      : reportType === "sessions"
        ? !sessionsError
        : Boolean(revenue));

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
        ["Disabled spaces", disabledSpaces],
        ["Occupancy rate (%)", occupancyRate.toFixed(1)],
      ];
    } else if (reportType === "revenue") {
      const label = RANGES.find((item) => item.value === range)?.label ?? range;
      rows = [
        ["ParkWise Revenue Report"],
        ["Generated", generated],
        ["Period", label],
        ["Only payments with a completed/paid status are counted as revenue."],
        [],
        ["Metric", "Value"],
        ["Revenue received (ZAR)", revenue.total.toFixed(2)],
        ["Payments received", revenue.receivedCount],
        ["Average payment (ZAR)", revenue.average.toFixed(2)],
        ["Pending payments", revenue.pendingCount],
        ["Pending amount (ZAR)", revenue.pendingTotal.toFixed(2)],
        ["Failed or cancelled", revenue.failedCount],
        ["Refunded (ZAR)", revenue.refundedTotal.toFixed(2)],
        [],
        ["Date", "Payments", "Revenue (ZAR)"],
        ...revenue.days.map((d) => [d.day, d.count, d.total.toFixed(2)]),
      ];
    } else {
      rows = [
        ["ParkWise Active Parking Sessions Report"],
        ["Generated", generated],
        [],
        ["Session ID", "Vehicle", "Driver", "Bay", "Started", "Time parked", "Status"],
        ...filteredSessions.map((session) => [
          session.id ?? "",
          getVehicle(session),
          getDriver(session),
          getBay(session),
          getStarted(session),
          getStartMs(session) === null ? "" : formatDuration(now - getStartMs(session)),
          getStatus(session),
        ]),
      ];
    }

    downloadCSV(
      `parkwise-${reportType}-${localDate()}.csv`,
      rows
    );
  }

  function printReport() {
    if (!canExport) return;
    window.print();
  }

  const buttonStyle = {
    padding: "11px 16px",
    borderRadius: "10px",
    border: "1px solid #7c3aed",
    cursor: "pointer",
    fontWeight: 600,
  };

  const panelStyle = {
    padding: "22px",
    borderRadius: "14px",
  };

  return (
    <div className="page">
      <style>{`
        @media print {
          body {
            background: white !important;
            color: black !important;
          }

          .side,
          .topbar,
          .report-actions,
          .report-tabs,
          .report-search {
            display: none !important;
          }

          .shell {
            display: block !important;
          }

          .main-area {
            margin: 0 !important;
            padding: 0 !important;
          }

          .page {
            color: black !important;
            background: white !important;
          }

          .panel {
            color: black !important;
            background: white !important;
            border: 1px solid #ddd !important;
            break-inside: avoid;
          }

          .report-table th,
          .report-table td {
            color: black !important;
          }
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
          <p style={{ color: "#a78bfa", marginBottom: "6px" }}>
            PARKWISE / ADMINISTRATION
          </p>

          <h1 style={{ margin: 0 }}>Reports</h1>

          <p style={{ opacity: 0.75 }}>
            Parking activity and operational performance.
          </p>

          {lastUpdated && (
            <p style={{ fontSize: "13px", opacity: 0.65 }}>
              Last refreshed: {lastUpdated.toLocaleString("en-ZA")}
            </p>
          )}
        </div>

        <div
          className="report-actions"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <button
            type="button"
            onClick={() => {
              loadReports(undefined, true);
              if (reportType === "revenue") loadPayments();
            }}
            disabled={loading || refreshing || paymentsLoading}
            style={{
              ...buttonStyle,
              background: "transparent",
              color: "inherit",
            }}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>

          <button
            type="button"
            onClick={exportReport}
            disabled={!canExport}
            style={{
              ...buttonStyle,
              background: "#7c3aed",
              color: "#fff",
              opacity: canExport ? 1 : 0.5,
            }}
          >
            Export CSV
          </button>

          <button
            type="button"
            onClick={printReport}
            disabled={!canExport}
            style={{
              ...buttonStyle,
              background: "#4c1d95",
              color: "#fff",
              opacity: canExport ? 1 : 0.5,
            }}
          >
            Print / Save PDF
          </button>
        </div>
      </div>

      <div
        className="report-tabs"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "12px",
          marginBottom: "24px",
        }}
      >
        {[
          { value: "occupancy", label: "Parking Occupancy" },
          { value: "sessions", label: "Active Sessions" },
          { value: "revenue", label: "Revenue" },
        ].map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setReportType(item.value)}
            aria-pressed={reportType === item.value}
            style={{
              ...buttonStyle,
              background:
                reportType === item.value ? "#7c3aed" : "transparent",
              color: reportType === item.value ? "#fff" : "inherit",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      <h2 style={{ marginBottom: "18px" }}>
        {reportNames[reportType]} Report
      </h2>

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
                  gridTemplateColumns:
                    "repeat(auto-fit, minmax(170px, 1fr))",
                  gap: "16px",
                  marginBottom: "24px",
                }}
              >
                {[
                  { label: "Total Spaces", value: totalSpaces },
                  { label: "Available", value: availableSpaces },
                  { label: "Occupied", value: occupiedSpaces },
                  { label: "Disabled", value: disabledSpaces },
                  {
                    label: "Occupancy Rate",
                    value: `${occupancyRate.toFixed(1)}%`,
                  },
                ].map((item) => (
                  <section
                    key={item.label}
                    className="panel"
                    style={panelStyle}
                  >
                    <p style={{ opacity: 0.7, marginTop: 0 }}>
                      {item.label}
                    </p>
                    <h2 style={{ fontSize: "29px", marginBottom: 0 }}>
                      {item.value}
                    </h2>
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
                  {occupiedSpaces} of {totalSpaces} parking spaces are
                  occupied ({occupancyRate.toFixed(1)}%).
                </p>

                <p>
                  <span style={{ color: "#8b5cf6" }}>●</span> Occupied:{" "}
                  {occupiedSpaces}
                  {"  "}
                  <span style={{ color: "#34d399" }}>●</span> Available:{" "}
                  {availableSpaces}
                  {"  "}
                  <span style={{ color: "#fbbf24" }}>●</span> Disabled:{" "}
                  {disabledSpaces}
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
                  {
                    label: "Average time parked",
                    value: formatDuration(sessionStats.average),
                  },
                  {
                    label: "Longest session",
                    value: sessionStats.longest
                      ? `${formatDuration(sessionStats.longest.ms)} · ${getVehicle(sessionStats.longest.session)}`
                      : "—",
                  },
                ].map((item) => (
                  <section key={item.label} className="panel" style={panelStyle}>
                    <p style={{ opacity: 0.7, marginTop: 0 }}>{item.label}</p>
                    <h2 style={{ fontSize: "22px", marginBottom: 0 }}>
                      {item.value}
                    </h2>
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
                Showing {filteredSessions.length} of {sessions.length} sessions.
                Time parked updates automatically.
              </p>

              <div style={{ overflowX: "auto" }}>
                <table
                  className="report-table"
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                  }}
                >
                  <thead>
                    <tr>
                      {["Session ID", "Vehicle", "Driver", "Bay", "Started", "Time parked", "Status"].map(
                        (heading) => (
                          <th
                            key={heading}
                            style={{
                              textAlign: "left",
                              padding: "12px",
                              borderBottom: "1px solid #777",
                            }}
                          >
                            {heading}
                          </th>
                        )
                      )}
                    </tr>
                  </thead>

                  <tbody>
                    {filteredSessions.map((session, index) => (
                      <tr key={session.id ?? index}>
                        <td style={{ padding: "12px" }}>
                          {session.id ?? "—"}
                        </td>
                        <td style={{ padding: "12px" }}>
                          {getVehicle(session)}
                        </td>
                        <td style={{ padding: "12px" }}>
                          {getDriver(session)}
                        </td>
                        <td style={{ padding: "12px" }}>{getBay(session)}</td>
                        <td style={{ padding: "12px" }}>
                          {getStarted(session)}
                        </td>
                        <td style={{ padding: "12px" }}>
                          {formatDuration(
                            getStartMs(session) === null ? null : now - getStartMs(session)
                          )}
                        </td>
                        <td style={{ padding: "12px" }}>
                          {getStatus(session)}
                        </td>
                      </tr>
                    ))}

                    {filteredSessions.length === 0 && (
                      <tr>
                        <td colSpan={7} style={{ padding: "18px" }}>
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

      {reportType === "revenue" && (
        <>
          {paymentsLoading && <p>Loading payments...</p>}

          {!paymentsLoading && paymentsError && (
            <section className="panel" style={panelStyle}>
              <h3>Revenue unavailable</h3>
              <p role="alert">{paymentsError}</p>
              <p style={{ opacity: 0.75 }}>
                No revenue figures are shown or exported until real payment
                records can be loaded.
              </p>
              <button
                type="button"
                onClick={loadPayments}
                style={{ ...buttonStyle, background: "transparent", color: "inherit" }}
              >
                Try again
              </button>
            </section>
          )}

          {!paymentsLoading && revenue && (
            <>
              <div
                className="report-tabs"
                style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginBottom: "20px" }}
              >
                {RANGES.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    aria-pressed={range === item.value}
                    onClick={() => setRange(item.value)}
                    style={{
                      ...buttonStyle,
                      padding: "8px 14px",
                      background: range === item.value ? "#7c3aed" : "transparent",
                      color: range === item.value ? "#fff" : "inherit",
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
                  gap: "16px",
                  marginBottom: "24px",
                }}
              >
                {[
                  { label: "Revenue received", value: money(revenue.total) },
                  { label: "Payments received", value: revenue.receivedCount },
                  { label: "Average payment", value: money(revenue.average) },
                  {
                    label: "Pending",
                    value: `${revenue.pendingCount} · ${money(revenue.pendingTotal)}`,
                  },
                  { label: "Failed / cancelled", value: revenue.failedCount },
                  {
                    label: "Refunded",
                    value: `${revenue.refundedCount} · ${money(revenue.refundedTotal)}`,
                  },
                ].map((item) => (
                  <section key={item.label} className="panel" style={panelStyle}>
                    <p style={{ opacity: 0.7, marginTop: 0 }}>{item.label}</p>
                    <h2 style={{ fontSize: "24px", marginBottom: 0 }}>{item.value}</h2>
                  </section>
                ))}
              </div>

              <section className="panel" style={panelStyle}>
                <h3>Revenue by day</h3>

                <div style={{ overflowX: "auto" }}>
                  <table className="report-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["Date", "Payments", "Revenue"].map((heading) => (
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
                      {revenue.days.map((day) => (
                        <tr key={day.day}>
                          <td style={{ padding: "12px" }}>{day.day}</td>
                          <td style={{ padding: "12px" }}>{day.count}</td>
                          <td style={{ padding: "12px" }}>{money(day.total)}</td>
                        </tr>
                      ))}
                      {revenue.days.length === 0 && (
                        <tr>
                          <td colSpan={3} style={{ padding: "18px" }}>
                            No received payments in this period.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <p style={{ fontSize: "13px", opacity: 0.7, marginBottom: 0 }}>
                  Only payments marked completed, successful or paid count as
                  revenue. Pending, failed and refunded payments are shown
                  separately.
                  {revenue.undatedSkipped > 0 &&
                    ` ${revenue.undatedSkipped} payment(s) with no date were left out of this period.`}
                  {revenue.undatedCount > 0 &&
                    ` ${revenue.undatedCount} received payment(s) have no date and are not in the daily table.`}
                </p>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
