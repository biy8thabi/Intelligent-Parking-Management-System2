
import { useCallback, useEffect, useState } from "react";
import { request } from "../services/api";

const money = (value) =>
  typeof value === "number" ? `R${value.toFixed(2)}` : "—";

const formatDate = (value) =>
  value ? new Date(value).toLocaleString() : "—";

function DataTable({ columns, rows, empty }) {
  if (!rows.length) return <p>{empty}</p>;

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          textAlign: "left",
          borderSpacing: "12px",
        }}
      >
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id || index}>
              {columns.map((column) => (
                <td key={column.key}>
                  {column.render
                    ? column.render(row)
                    : row[column.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CrudPage({ title }) {
  const [availability, setAvailability] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ticketSessionId, setTicketSessionId] = useState("");
  const [ticket, setTicket] = useState(null);
  const [ticketError, setTicketError] = useState("");
  const [ticketLoading, setTicketLoading] = useState(false);

  const token = sessionStorage.getItem("pw_admin_token");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      if (title === "Parking Slots" || title === "Parking Lots") {
        const result = await request("/api/parking/availability");
        setAvailability(result);
      }

      if (
        ["Bookings", "Drivers", "Vehicles", "Payments"].includes(title)
      ) {
        if (!token) throw new Error("Administrator login required.");

        const result = await request("/api/admin/sessions/active", {
          token,
        });

        if (!Array.isArray(result.active_sessions)) {
          throw new Error("Unexpected sessions response.");
        }

        setSessions(result.active_sessions);
      }
    } catch (err) {
      setError(err.message || "Unable to load records.");
    } finally {
      setLoading(false);
    }
  }, [title, token]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function findTicket(event) {
    event.preventDefault();
    setTicketError("");
    setTicket(null);
    setTicketLoading(true);

    try {
      if (!token) throw new Error("Administrator login required.");

      const id = ticketSessionId.trim();
      if (!id) throw new Error("Enter a session ID.");

      const result = await request(
        `/api/tickets/${encodeURIComponent(id)}`,
        { token }
      );

      setTicket(result);
    } catch (err) {
      setTicketError(
        err.message || "Unable to retrieve this ticket."
      );
    } finally {
      setTicketLoading(false);
    }
  }

  const spaces = availability?.available_spaces || [];

  const zones = Array.from(
    new Set(spaces.map((space) => space.zone).filter(Boolean))
  );

  const drivers = Array.from(
    new Map(
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
    ).values()
  );

  const vehicles = Array.from(
    new Map(
      sessions
        .filter((session) => session.vehicle_registration_number)
        .map((session) => [
          session.vehicle_registration_number,
          {
            id: session.vehicle_registration_number,
            registration: session.vehicle_registration_number,
            driver: session.users?.full_name || "—",
          },
        ])
    ).values()
  );

  return (
    <div className="page">
      <div className="title">
        <div>
          <h1>{title}</h1>
          <p>ParkWise Administration Dashboard</p>
        </div>

        {title !== "QR Tickets" && (
          <button
            className="primary"
            onClick={loadData}
            disabled={loading}
          >
            {loading ? "Loading..." : "Refresh"}
          </button>
        )}
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      {loading && <p>Loading real backend data...</p>}

      {!loading && !error && title === "Parking Slots" && (
        <section className="panel">
          <h3>Parking Availability</h3>
          <p>Total: {availability?.total_spaces ?? 0}</p>
          <p>Available: {availability?.available_count ?? 0}</p>
          <p>Occupied: {availability?.occupied_count ?? 0}</p>
          <p>Disabled: {availability?.disabled_count ?? 0}</p>

          <h3>Available Parking Slots</h3>
          <DataTable
            rows={spaces}
            empty="No available parking slots."
            columns={[
              { key: "zone", label: "Zone" },
              { key: "bay_number", label: "Bay Number" },
              { key: "status", label: "Status" },
            ]}
          />
          <p>
            Occupied and disabled slot details require an expanded
            administrator API.
          </p>
        </section>
      )}

      {!loading && !error && title === "Parking Lots" && (
        <section className="panel">
          <h3>Parking Zones</h3>
          <p>
            Zones derived from currently available parking spaces.
            These are not separate parking-lot records.
          </p>
          <DataTable
            rows={zones.map((zone) => ({
              id: zone,
              zone,
              available: spaces.filter((s) => s.zone === zone).length,
            }))}
            empty="No zones with available spaces found."
            columns={[
              { key: "zone", label: "Zone" },
              { key: "available", label: "Available Bays" },
            ]}
          />
          <p>
            Creating and editing parking lots requires backend
            management endpoints.
          </p>
        </section>
      )}

      {!loading && !error && title === "Bookings" && (
        <section className="panel">
          <h3>Active Parking Sessions</h3>
          <DataTable
            rows={sessions}
            empty="No active bookings found."
            columns={[
              {
                key: "vehicle_registration_number",
                label: "Vehicle",
              },
              {
                key: "driver",
                label: "Driver",
                render: (s) => s.users?.full_name || "—",
              },
              {
                key: "bay",
                label: "Parking Bay",
                render: (s) =>
                  s.parking_spaces
                    ? [
                        s.parking_spaces.zone,
                        s.parking_spaces.bay_number,
                      ]
                        .filter(Boolean)
                        .join("-")
                    : "—",
              },
              {
                key: "entry_time",
                label: "Started",
                render: (s) => formatDate(s.entry_time),
              },
              {
                key: "status",
                label: "Status",
                render: () => "Active",
              },
            ]}
          />
        </section>
      )}

      {!loading && !error && title === "Drivers" && (
        <section className="panel">
          <h3>Drivers With Active Sessions</h3>
          <DataTable
            rows={drivers}
            empty="No drivers with active sessions."
            columns={[
              { key: "name", label: "Name" },
              { key: "email", label: "Email" },
            ]}
          />
          <p>
            A complete registered-driver directory requires an
            administrator users endpoint.
          </p>
        </section>
      )}

      {!loading && !error && title === "Vehicles" && (
        <section className="panel">
          <h3>Vehicles Currently Parked</h3>
          <DataTable
            rows={vehicles}
            empty="No vehicles in active sessions."
            columns={[
              { key: "registration", label: "Registration" },
              { key: "driver", label: "Driver" },
            ]}
          />
          <p>
            This is based on active sessions, not a complete
            vehicle-registration database.
          </p>
        </section>
      )}

      {!loading && !error && title === "Payments" && (
        <section className="panel">
          <h3>Parking Fees and Payments</h3>
          <p>
            The backend calculates parking fees when sessions end,
            using a rate of R10 per hour.
          </p>
          <p>
            Active sessions: {sessions.length}
          </p>
          <p>
            Completed-session fees and payment transactions are
            not available through the confirmed administrator API.
          </p>
          <p>
            This page cannot display verified payment records
            until those endpoints are implemented.
          </p>
        </section>
      )}

      {title === "QR Tickets" && (
        <section className="panel">
          <h3>Find QR Ticket</h3>
          <p>Enter a real parking session ID to retrieve its ticket.</p>

          <form onSubmit={findTicket}>
            <input
              type="text"
              value={ticketSessionId}
              onChange={(e) => setTicketSessionId(e.target.value)}
              placeholder="Parking session ID"
              style={{
                padding: "12px",
                width: "100%",
                maxWidth: "400px",
                marginBottom: "12px",
              }}
            />

            <div>
              <button
                className="primary"
                type="submit"
                disabled={ticketLoading}
              >
                {ticketLoading ? "Searching..." : "Find Ticket"}
              </button>
            </div>
          </form>

          {ticketError && (
            <p className="error" role="alert">
              {ticketError}
            </p>
          )}

          {ticket && (
            <div style={{ marginTop: "20px" }}>
              <h3>Ticket Response</h3>
              <pre
                style={{
                  overflowX: "auto",
                  whiteSpace: "pre-wrap",
                  overflowWrap: "anywhere",
                }}
              >
                {JSON.stringify(ticket, null, 2)}
              </pre>
            </div>
          )}

          <p>
            Ticket generation and QR image rendering require
            confirmation of the backend ticket format and
            administrator permissions.
          </p>
        </section>
      )}
    </div>
  );
}
