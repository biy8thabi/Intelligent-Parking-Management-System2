
import { useCallback, useEffect, useMemo, useState } from "react";
import { request } from "../services/api";

function Table({ rows, columns, empty }) {
  if (!rows.length) return <p>{empty}</p>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          textAlign: "left",
          borderCollapse: "collapse",
        }}
      >
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.label}
                style={{
                  padding: "14px",
                  borderBottom: "1px solid #777",
                }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id ?? index}>
              {columns.map((column) => (
                <td
                  key={column.label}
                  style={{
                    padding: "14px",
                    borderBottom: "1px solid rgba(127,127,127,0.15)",
                  }}
                >
                  {column.value(row) ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const formatDate = (value) =>
  value ? new Date(value).toLocaleString("en-ZA") : "—";

export default function CrudPage({ title }) {
  const [availability, setAvailability] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [zoneSearch, setZoneSearch] = useState("");

  const [sessionId, setSessionId] = useState("");
  const [ticket, setTicket] = useState(null);
  const [ticketError, setTicketError] = useState("");
  const [ticketLoading, setTicketLoading] = useState(false);

  const token = sessionStorage.getItem("pw_admin_token");

  const needsSpaces = ["Parking Lots", "Parking Slots"].includes(title);
  const needsSessions = [
    "Bookings",
    "Drivers",
    "Vehicles",
    "Payments",
  ].includes(title);

  const load = useCallback(async () => {
    if (!needsSpaces && !needsSessions) return;

    setLoading(true);
    setError("");

    try {
      if (needsSpaces) {
        const result = await request("/api/parking/availability");
        setAvailability(result);
      }

      if (needsSessions) {
        if (!token) {
          throw new Error("Administrator login required");
        }

        const result = await request("/api/admin/sessions/active", {
          token,
        });

        const records = Array.isArray(result)
          ? result
          : result.active_sessions ?? result.sessions ?? result.data;

        if (!Array.isArray(records)) {
          throw new Error("Unexpected active sessions response");
        }

        setSessions(records);
      }
    } catch (err) {
      setError(err.message || "Unable to load data");
    } finally {
      setLoading(false);
    }
  }, [needsSpaces, needsSessions, token]);

  useEffect(() => {
    load();
  }, [load]);

  const spaces = Array.isArray(availability?.available_spaces)
    ? availability.available_spaces
    : [];

  // Only available bays are supplied by this endpoint.
  // Therefore zone totals represent AVAILABLE bays, not full lot capacity.
  const zones = useMemo(() => {
    const grouped = new Map();

    spaces.forEach((space) => {
      const zoneName = String(space.zone ?? "Unassigned").trim();

      if (!grouped.has(zoneName)) {
        grouped.set(zoneName, {
          id: zoneName,
          zone: zoneName,
          available: 0,
          bays: [],
        });
      }

      const zone = grouped.get(zoneName);
      zone.available += 1;
      zone.bays.push(space.bay_number ?? "—");
    });

    return [...grouped.values()].sort((a, b) =>
      a.zone.localeCompare(b.zone)
    );
  }, [spaces]);

  const filteredZones = useMemo(() => {
    const term = zoneSearch.trim().toLowerCase();

    if (!term) return zones;

    return zones.filter((zone) =>
      zone.zone.toLowerCase().includes(term)
    );
  }, [zones, zoneSearch]);

  const drivers = [
    ...new Map(
      sessions
        .filter((session) => session.users?.email)
        .map((session) => [
          session.users.email,
          {
            id: session.users.email,
            name: session.users.full_name,
            email: session.users.email,
          },
        ])
    ).values(),
  ];

  const vehicles = [
    ...new Map(
      sessions
        .filter((session) => session.vehicle_registration_number)
        .map((session) => [
          session.vehicle_registration_number,
          {
            id: session.vehicle_registration_number,
            registration: session.vehicle_registration_number,
            driver: session.users?.full_name,
          },
        ])
    ).values(),
  ];

  async function ticketAction(mode) {
    const id = sessionId.trim();

    setTicketError("");
    setTicket(null);

    if (!id) {
      setTicketError("Enter a parking session ID");
      return;
    }

    if (!token) {
      setTicketError("Administrator login required");
      return;
    }

    if (
      mode === "generate" &&
      !window.confirm(
        "Generate a new QR ticket for this parking session? This creates a database record."
      )
    ) {
      return;
    }

    setTicketLoading(true);

    try {
      const result =
        mode === "generate"
          ? await request("/api/tickets/generate", {
              token,
              method: "POST",
              body: JSON.stringify({ session_id: id }),
            })
          : await request(
              `/api/tickets/${encodeURIComponent(id)}`,
              { token }
            );

      if (!result.ticket) {
        throw new Error("Ticket missing from backend response");
      }

      setTicket(result.ticket);
    } catch (err) {
      setTicketError(err.message || "Ticket request failed");
    } finally {
      setTicketLoading(false);
    }
  }

  const totalSpaces = availability?.total_spaces ?? "—";
  const availableCount = availability?.available_count ?? "—";
  const occupiedCount = availability?.occupied_count ?? "—";
  const disabledCount = availability?.disabled_count ?? "—";

  const inputStyle = {
    padding: "12px",
    maxWidth: "420px",
    width: "100%",
    boxSizing: "border-box",
    marginBottom: "16px",
    borderRadius: "8px",
    border: "1px solid #777",
    background: "transparent",
    color: "inherit",
  };

  return (
    <div className="page">
      <div className="title">
        <div>
          <h1>{title}</h1>
          <p>ParkWise administrator workspace</p>
        </div>

        {(needsSpaces || needsSessions) && (
          <button
            className="primary"
            type="button"
            onClick={load}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        )}
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {loading && <p>Loading live data...</p>}

      {!loading && !error && title === "Parking Lots" && (
        <>
          <section className="panel" style={{ marginBottom: "20px" }}>
            <h3>Parking Overview</h3>

            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  "repeat(auto-fit, minmax(150px, 1fr))",
                gap: "14px",
              }}
            >
              {[
                { label: "Total Spaces", value: totalSpaces },
                { label: "Available", value: availableCount },
                { label: "Occupied", value: occupiedCount },
                { label: "Disabled", value: disabledCount },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    padding: "18px",
                    borderRadius: "12px",
                    background: "rgba(124,58,237,0.10)",
                    border: "1px solid rgba(124,58,237,0.25)",
                  }}
                >
                  <p style={{ opacity: 0.75, marginTop: 0 }}>
                    {item.label}
                  </p>
                  <h2 style={{ marginBottom: 0 }}>
                    {item.value}
                  </h2>
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <h3>Parking Zones</h3>

            <p>
              These zones are identified from the available parking
              bays returned by the backend.
            </p>

            <input
              type="search"
              value={zoneSearch}
              onChange={(event) =>
                setZoneSearch(event.target.value)
              }
              placeholder="Search parking zones..."
              aria-label="Search parking zones"
              style={inputStyle}
            />

            <p>
              Showing {filteredZones.length} of {zones.length} zones
              with available bays.
            </p>

            <Table
              rows={filteredZones}
              empty="No matching parking zones with available bays."
              columns={[
                {
                  label: "Zone",
                  value: (zone) => zone.zone,
                },
                {
                  label: "Available Bays",
                  value: (zone) => zone.available,
                },
                {
                  label: "Bay Numbers",
                  value: (zone) => zone.bays.join(", "),
                },
              ]}
            />

            <p
              style={{
                marginTop: "22px",
                opacity: 0.7,
                fontSize: "13px",
              }}
            >
              This is a live availability overview. It is not a
              complete parking-lot inventory: zones with no available
              bays may not appear. Creating, editing and deleting
              parking lots will become available when the backend
              exposes authorised parking-lot management endpoints.
            </p>
          </section>
        </>
      )}

      {!loading && !error && title === "Parking Slots" && (
        <section className="panel">
          <h3>Parking Availability</h3>

          <p>
            Total: {totalSpaces} | Available: {availableCount}
            {" | "}Occupied: {occupiedCount}
            {" | "}Disabled: {disabledCount}
          </p>

          <h3>Available Bays</h3>

          <Table
            rows={spaces}
            empty="No available bays found."
            columns={[
              { label: "Zone", value: (s) => s.zone },
              { label: "Bay", value: (s) => s.bay_number },
              { label: "Status", value: (s) => s.status },
            ]}
          />

          <p>
            Editing bays and viewing individual occupied or disabled
            bays requires additional admin endpoints.
          </p>
        </section>
      )}

      {!loading && !error && title === "Bookings" && (
        <section className="panel">
          <h3>Active Bookings</h3>

          <Table
            rows={sessions}
            empty="No active bookings."
            columns={[
              { label: "Session ID", value: (s) => s.id },
              {
                label: "Vehicle",
                value: (s) => s.vehicle_registration_number,
              },
              {
                label: "Driver",
                value: (s) => s.users?.full_name,
              },
              {
                label: "Bay",
                value: (s) =>
                  [
                    s.parking_spaces?.zone,
                    s.parking_spaces?.bay_number,
                  ]
                    .filter(Boolean)
                    .join("-"),
              },
              {
                label: "Started",
                value: (s) => formatDate(s.entry_time),
              },
            ]}
          />
        </section>
      )}

      {!loading && !error && title === "Drivers" && (
        <section className="panel">
          <h3>Drivers With Active Sessions</h3>

          <Table
            rows={drivers}
            empty="No drivers in active sessions."
            columns={[
              { label: "Name", value: (d) => d.name },
              { label: "Email", value: (d) => d.email },
            ]}
          />

          <p>
            This view includes drivers with active sessions only.
          </p>
        </section>
      )}

      {!loading && !error && title === "Vehicles" && (
        <section className="panel">
          <h3>Currently Parked Vehicles</h3>

          <Table
            rows={vehicles}
            empty="No vehicles in active sessions."
            columns={[
              {
                label: "Registration",
                value: (v) => v.registration,
              },
              { label: "Driver", value: (v) => v.driver },
            ]}
          />
        </section>
      )}

      {!loading && !error && title === "Payments" && (
        <section className="panel">
          <h3>Payments</h3>

          <p>
            There are currently {sessions.length} active parking
            sessions.
          </p>

          <p>
            Verified payments and completed-session charges require
            an authorised backend payment or history endpoint.
            Calculated fees are not proof of payment.
          </p>
        </section>
      )}

      {title === "QR Tickets" && (
        <section className="panel">
          <h3>QR Ticket Management</h3>

          <p>
            Enter a real parking session ID. You can copy it from
            Bookings while the session is active.
          </p>

          <input
            value={sessionId}
            onChange={(event) =>
              setSessionId(event.target.value)
            }
            placeholder="Parking session ID"
            aria-label="Parking session ID"
            style={inputStyle}
          />

          <div
            style={{
              display: "flex",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <button
              className="primary"
              disabled={ticketLoading}
              onClick={() => ticketAction("find")}
            >
              Find Ticket
            </button>

            <button
              className="secondary-button"
              disabled={ticketLoading}
              onClick={() => ticketAction("generate")}
            >
              Generate New Ticket
            </button>
          </div>

          {ticketLoading && <p>Loading ticket...</p>}

          {ticketError && (
            <p className="error" role="alert">
              {ticketError}
            </p>
          )}

          {ticket && (
            <div style={{ marginTop: "20px" }}>
              <h3>Ticket</h3>

              <p>Code: {ticket.ticket_code || "—"}</p>
              <p>Session: {ticket.session_id || sessionId}</p>

              {typeof ticket.qr_code_url === "string" &&
              ticket.qr_code_url.startsWith("data:image/") ? (
                <img
                  src={ticket.qr_code_url}
                  alt="Parking ticket QR code"
                  style={{
                    width: "220px",
                    maxWidth: "100%",
                    background: "white",
                    padding: "10px",
                  }}
                />
              ) : (
                <p>QR image unavailable in the response.</p>
              )}
            </div>
          )}

          <p>
            Generating a ticket creates a real record. Avoid
            generating duplicates for the same session.
          </p>
        </section>
      )}
    </div>
  );
}
