
import { useEffect, useMemo, useState } from "react";
import { getParkingAvailability } from "../services/api";

export default function Reports({ token, onUnauthorised }) {
  const [availability, setAvailability] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sessionError, setSessionError] = useState("");
  const [reportType, setReportType] = useState("occupancy");
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;

    async function loadReports() {
      setLoading(true);
      setError("");
      setSessionError("");

      try {
        const data = await getParkingAvailability();

        if (active) {
          setAvailability(data);
        }
      } catch (err) {
        if (active) {
          setError(err.message || "Could not load parking availability.");
        }
      }

      try {
        const response = await fetch(
          `${import.meta.env.VITE_API_URL}/api/admin/sessions/active`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (response.status === 401 || response.status === 403) {
          if (active && onUnauthorised) onUnauthorised();
          return;
        }

        if (!response.ok) {
          throw new Error("The sessions report is unavailable.");
        }

        const data = await response.json();

        if (active) {
          const records = Array.isArray(data)
            ? data
            : data.sessions || data.data || [];

          setSessions(Array.isArray(records) ? records : []);
        }
      } catch (err) {
        if (active) {
          setSessionError(
            err.message || "Could not load active parking sessions."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadReports();

    return () => {
      active = false;
    };
  }, [token, onUnauthorised]);

  const totalSpaces = Number(availability?.total_spaces ?? 0);
  const availableSpaces = Number(availability?.available_count ?? 0);
  const occupiedSpaces = Number(availability?.occupied_count ?? 0);
  const disabledSpaces = Number(availability?.disabled_count ?? 0);

  const occupancyRate =
    totalSpaces > 0
      ? Math.round((occupiedSpaces / totalSpaces) * 100)
      : 0;

  const filteredSessions = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) return sessions;

    return sessions.filter((session) =>
      [
        session.id,
        session.vehicle_registration,
        session.registration_number,
        session.vehicle_plate,
        session.driver_name,
        session.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [sessions, search]);

  function downloadCSV() {
    let rows = [];

    if (reportType === "occupancy") {
      rows = [
        ["Parking Occupancy Report"],
        ["Generated", new Date().toLocaleString("en-ZA")],
        [],
        ["Metric", "Value"],
        ["Total spaces", totalSpaces],
        ["Available spaces", availableSpaces],
        ["Occupied spaces", occupiedSpaces],
        ["Disabled spaces", disabledSpaces],
        ["Occupancy rate (%)", occupancyRate],
      ];
    } else if (reportType === "sessions") {
      rows = [
        ["Active Parking Sessions Report"],
        ["Generated", new Date().toLocaleString("en-ZA")],
        [],
        ["Session ID", "Vehicle Registration", "Driver", "Status"],
        ...filteredSessions.map((session) => [
          session.id ?? "",
          session.vehicle_registration ??
            session.registration_number ??
            session.vehicle_plate ??
            "",
          session.driver_name ?? "",
          session.status ?? "Active",
        ]),
      ];
    } else {
      alert(
        "A revenue report cannot be generated until the backend provides verified payment or revenue data."
      );
      return;
    }

    const csv = rows
      .map((row) =>
        row
          .map((value) => {
            const text = String(value ?? "");
            return `"${text.replace(/"/g, '""')}"`;
          })
          .join(",")
      )
      .join("\r\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `parkwise-${reportType}-report-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  const money = (value) =>
    new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency: "ZAR",
    }).format(value);

  return (
    <div className="page">
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
        </div>

        <button
          type="button"
          onClick={downloadCSV}
          style={{
            background: "#7c3aed",
            color: "#fff",
            border: "none",
            borderRadius: "10px",
            padding: "12px 18px",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Export CSV
        </button>
      </div>

      <div
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
              padding: "11px 16px",
              borderRadius: "10px",
              border: "1px solid #7c3aed",
              background:
                reportType === item.value ? "#7c3aed" : "transparent",
              color: reportType === item.value ? "#fff" : "inherit",
              cursor: "pointer",
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {loading && <p>Loading report data...</p>}

      {error && (
        <section className="panel" style={{ marginBottom: "16px" }}>
          <h3>Parking availability unavailable</h3>
          <p>{error}</p>
        </section>
      )}

      {!loading && reportType === "occupancy" && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "16px",
              marginBottom: "24px",
            }}
          >
            {[
              {
                label: "Total Spaces",
                value: availability ? totalSpaces : "—",
              },
              {
                label: "Available Spaces",
                value: availability ? availableSpaces : "—",
              },
              {
                label: "Occupied Spaces",
                value: availability ? occupiedSpaces : "—",
              },
              {
                label: "Occupancy Rate",
                value: availability ? `${occupancyRate}%` : "—",
              },
            ].map((item) => (
              <section
                className="panel"
                key={item.label}
                style={{ padding: "22px" }}
              >
                <p style={{ opacity: 0.7, marginTop: 0 }}>
                  {item.label}
                </p>
                <h2 style={{ fontSize: "30px", marginBottom: 0 }}>
                  {item.value}
                </h2>
              </section>
            ))}
          </div>

          <section className="panel" style={{ padding: "24px" }}>
            <h2>Occupancy Overview</h2>

            <div
              style={{
                height: "14px",
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
                  transition: "width 0.3s ease",
                }}
              />
            </div>

            <p>
              {availability
                ? `${occupiedSpaces} of ${totalSpaces} parking spaces are occupied.`
                : "Occupancy information could not be loaded."}
            </p>

            <div
              style={{
                display: "flex",
                gap: "20px",
                flexWrap: "wrap",
                marginTop: "20px",
              }}
            >
              <span>🟣 Occupied: {occupiedSpaces}</span>
              <span>🟢 Available: {availableSpaces}</span>
              <span>⚪ Disabled: {disabledSpaces}</span>
            </div>
          </section>
        </>
      )}

      {!loading && reportType === "sessions" && (
        <section className="panel" style={{ padding: "24px" }}>
          <h2>Active Parking Sessions</h2>
          <p>
            {sessionError
              ? sessionError
              : `${sessions.length} active sessions returned by the backend.`}
          </p>

          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by session, vehicle or driver..."
            aria-label="Search sessions"
            style={{
              width: "100%",
              maxWidth: "420px",
              boxSizing: "border-box",
              padding: "12px",
              margin: "12px 0 20px",
              borderRadius: "8px",
              border: "1px solid #777",
              background: "transparent",
              color: "inherit",
            }}
          />

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
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
                      {session.vehicle_registration ??
                        session.registration_number ??
                        session.vehicle_plate ??
                        "Not supplied"}
                    </td>
                    <td style={{ padding: "12px" }}>
                      {session.driver_name ?? "Not supplied"}
                    </td>
                    <td style={{ padding: "12px" }}>
                      {session.status ?? "Active"}
                    </td>
                  </tr>
                ))}

                {filteredSessions.length === 0 && (
                  <tr>
                    <td colSpan={4} style={{ padding: "18px" }}>
                      {sessionError
                        ? "Session records are unavailable."
                        : "No matching active sessions were returned."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!loading && reportType === "revenue" && (
        <section className="panel" style={{ padding: "24px" }}>
          <h2>Revenue Report</h2>
          <p>
            {money(0)} is not displayed as revenue because no verified
            revenue total has been loaded.
          </p>
          <p>
            The current frontend needs a backend endpoint that returns
            confirmed payment or completed-session fee totals before it
            can calculate an accurate revenue report.
          </p>
          <p>
            No revenue figures are fabricated. Once the backend provides
            those totals, this section can be connected to them.
          </p>
        </section>
      )}
    </div>
  );
}
