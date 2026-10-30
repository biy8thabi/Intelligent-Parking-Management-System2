
import { useCallback, useEffect, useMemo, useState } from "react";
import { getParkingAvailability } from "../services/api";

const API_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

function getVehicle(session) {
  return (
    session.vehicle_registration ??
    session.registration_number ??
    session.vehicle_plate ??
    "Not supplied"
  );
}

function getDriver(session) {
  return (
    session.driver_name ??
    session.user?.full_name ??
    session.driver?.full_name ??
    "Not supplied"
  );
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

      const sessionsRequest = API_URL
        ? fetch(`${API_URL}/api/admin/sessions/active`, {
            signal,
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }).then(async (response) => {
            if (response.status === 401 || response.status === 403) {
              const error = new Error("Your admin session is not authorised.");
              error.unauthorised = true;
              throw error;
            }

            if (!response.ok) {
              throw new Error(
                `Could not load sessions (HTTP ${response.status}).`
              );
            }

            const data = await response.json();
            const records = Array.isArray(data)
              ? data
              : data.sessions ?? data.data ?? [];

            if (!Array.isArray(records)) {
              throw new Error("Unexpected sessions response from backend.");
            }

            return records;
          })
        : Promise.reject(
            new Error("The backend API URL is not configured.")
          );

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
        if (sessionsResult.reason?.unauthorised) {
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

    if (!term) return sessions;

    return sessions.filter((session) =>
      [
        session.id,
        getVehicle(session),
        getDriver(session),
        session.status,
      ].some((value) =>
        String(value ?? "").toLowerCase().includes(term)
      )
    );
  }, [sessions, search]);

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
        : false);

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
    } else {
      rows = [
        ["ParkWise Active Parking Sessions Report"],
        ["Generated", generated],
        [],
        ["Session ID", "Vehicle", "Driver", "Status"],
        ...filteredSessions.map((session) => [
          session.id ?? "",
          getVehicle(session),
          getDriver(session),
          session.status ?? "Active",
        ]),
      ];
    }

    downloadCSV(
      `parkwise-${reportType}-${new Date().toISOString().slice(0, 10)}.csv`,
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

          .report-actions,
          .report-tabs,
          .report-search {
            display: none !important;
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
            onClick={() => loadReports(undefined, true)}
            disabled={loading || refreshing}
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
                    margin: "20px 0 12px",
                  }}
                >
                  <div
                    style={{
                      width: `${occupancyRate}%`,
                      height: "100%",
                      background: "#8b5cf6",
                      borderRadius: "20px",
                    }}
                  />
                </div>

                <p>
                  {occupiedSpaces} of {totalSpaces} parking spaces are
                  occupied ({occupancyRate.toFixed(1)}%).
                </p>

                <p>
                  Available: {availableSpaces} | Occupied: {occupiedSpaces}
                  {" | "}Disabled: {disabledSpaces}
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
              <p>
                {sessions.length} active sessions returned by the backend.
              </p>

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

              <p style={{ fontSize: "13px", opacity: 0.7 }}>
                Showing {filteredSessions.length} of {sessions.length} sessions.
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
                      {["Session ID", "Vehicle", "Driver", "Status"].map(
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
                        <td style={{ padding: "12px" }}>
                          {session.status ?? "Active"}
                        </td>
                      </tr>
                    ))}

                    {filteredSessions.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ padding: "18px" }}>
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

      {!loading && reportType === "revenue" && (
        <section className="panel" style={panelStyle}>
          <h3>Revenue data not connected</h3>

          <p>
            A reliable revenue report requires verified payment records
            or an approved backend revenue endpoint.
          </p>

          <p>
            Calculated parking fees do not necessarily mean payments
            have been received.
          </p>

          <p>
            No revenue totals will be displayed or exported until
            confirmed financial data is available.
          </p>
        </section>
      )}
    </div>
  );
}
