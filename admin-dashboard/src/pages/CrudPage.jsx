
import { useCallback, useEffect, useMemo, useState } from 'react';
import { request } from '../services/api';

const money = value =>
  value === null || value === undefined || value === ''
    ? '—'
    : new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: 'ZAR',
      }).format(Number(value));

const date = value => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString();
};

const text = value =>
  value === null || value === undefined || value === ''
    ? '—'
    : String(value);

function getErrorMessage(error) {
  return error?.message || 'Something went wrong. Please try again.';
}

function downloadCsv(filename, rows, columns) {
  if (!rows.length) {
    window.alert('There is no data to export.');
    return;
  }

  const escapeCell = value => {
    const result = String(value ?? '');
    return `"${result.replace(/"/g, '""')}"`;
  };

  const csv = [
    columns.map(column => escapeCell(column.label)).join(','),
    ...rows.map(row =>
      columns.map(column => escapeCell(column.value(row))).join(',')
    ),
  ].join('\r\n');

  const blob = new Blob(['\uFEFF', csv], {
    type: 'text/csv;charset=utf-8;',
  });

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function DataTable({ rows, columns, emptyMessage }) {
  if (!rows.length) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          textAlign: 'left',
          borderSpacing: 0,
          borderCollapse: 'collapse',
        }}
      >
        <thead>
          <tr>
            {columns.map(column => (
              <th
                key={column.label}
                style={{
                  padding: '13px 12px',
                  borderBottom: '1px solid var(--border, #ddd)',
                  whiteSpace: 'nowrap',
                }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id ?? row.session_id ?? index}>
              {columns.map(column => (
                <td
                  key={column.label}
                  style={{
                    padding: '13px 12px',
                    borderBottom: '1px solid var(--border, #ddd)',
                    verticalAlign: 'top',
                  }}
                >
                  {column.value(row) ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ label, value, description }) {
  return (
    <div className="panel" style={{ minWidth: 0 }}>
      <p style={{ margin: 0, opacity: 0.75 }}>{label}</p>
      <h2 style={{ margin: '10px 0', overflowWrap: 'anywhere' }}>
        {value}
      </h2>
      {description && <small>{description}</small>}
    </div>
  );
}

function Notice({ children, type = 'info' }) {
  const color =
    type === 'error'
      ? '#dc2626'
      : type === 'success'
        ? '#15803d'
        : '#7c3aed';

  return (
    <div
      role={type === 'error' ? 'alert' : 'status'}
      style={{
        borderLeft: `4px solid ${color}`,
        padding: '12px 15px',
        margin: '12px 0',
        background: 'var(--panel-bg, rgba(124, 58, 237, 0.07))',
        borderRadius: 6,
      }}
    >
      {children}
    </div>
  );
}

export default function CrudPage({ title = 'Parking Slots' }) {
  const [availability, setAvailability] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  const [sessionId, setSessionId] = useState('');
  const [ticket, setTicket] = useState(null);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [ticketError, setTicketError] = useState('');
  const [ticketMessage, setTicketMessage] = useState('');

  const token = sessionStorage.getItem('pw_admin_token');

  const needsSpaces = ['Parking Lots', 'Parking Slots'].includes(title);
  const needsSessions = ['Bookings'].includes(title);
  const needsTicket = title === 'QR Tickets';

  const load = useCallback(async () => {
    if (!needsSpaces && !needsSessions) return;

    setLoading(true);
    setError('');

    try {
      if (needsSpaces) {
        const result = await request('/api/parking/availability');

        if (
          !result ||
          !Array.isArray(result.available_spaces)
        ) {
          throw new Error(
            'The availability API returned an unexpected response.'
          );
        }

        setAvailability(result);
      }

      if (needsSessions) {
        if (!token) {
          throw new Error('Your administrator session has expired. Please log in again.');
        }

        const result = await request('/api/admin/sessions/active', {
          token,
        });

        if (!Array.isArray(result?.active_sessions)) {
          throw new Error(
            'The active-sessions API returned an unexpected response.'
          );
        }

        setSessions(result.active_sessions);
      }

      setLastUpdated(new Date());
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [needsSpaces, needsSessions, token]);

  useEffect(() => {
    setSearch('');
    setError('');
    setTicket(null);
    setTicketError('');
    setTicketMessage('');
    load();
  }, [load]);

  const availableSpaces = availability?.available_spaces ?? [];

  const zones = useMemo(() => {
    const grouped = new Map();

    for (const space of availableSpaces) {
      const zone = space.zone || 'Unassigned zone';

      if (!grouped.has(zone)) {
        grouped.set(zone, {
          id: zone,
          zone,
          available: 0,
          bays: [],
        });
      }

      const item = grouped.get(zone);
      item.available += 1;
      item.bays.push(space.bay_number);
    }

    return Array.from(grouped.values()).sort((a, b) =>
      a.zone.localeCompare(b.zone)
    );
  }, [availableSpaces]);

  const filteredSpaces = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return availableSpaces;

    return availableSpaces.filter(space =>
      [
        space.id,
        space.zone,
        space.bay_number,
        space.status,
      ]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query))
    );
  }, [availableSpaces, search]);

  const filteredSessions = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return sessions;

    return sessions.filter(session =>
      [
        session.id,
        session.vehicle_registration_number,
        session.users?.full_name,
        session.users?.email,
        session.parking_spaces?.zone,
        session.parking_spaces?.bay_number,
      ]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query))
    );
  }, [sessions, search]);

  const filteredZones = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return zones;

    return zones.filter(zone =>
      zone.zone.toLowerCase().includes(query)
    );
  }, [zones, search]);

  async function ticketAction(mode) {
    const id = sessionId.trim();

    setTicket(null);
    setTicketError('');
    setTicketMessage('');

    if (!id) {
      setTicketError('Enter a parking session ID first.');
      return;
    }

    if (!token) {
      setTicketError('Administrator login required. Please log in again.');
      return;
    }

    if (
      mode === 'generate' &&
      !window.confirm(
        'Attempt to generate a ticket for this session? Only continue if the backend permits this operation.'
      )
    ) {
      return;
    }

    setTicketLoading(true);

    try {
      const result =
        mode === 'generate'
          ? await request('/api/tickets/generate', {
              token,
              method: 'POST',
              body: JSON.stringify({ session_id: id }),
            })
          : await request(
              `/api/tickets/${encodeURIComponent(id)}`,
              { token }
            );

      if (!result?.ticket) {
        throw new Error(
          'The ticket endpoint did not return a ticket. Check the backend response format.'
        );
      }

      setTicket(result.ticket);
      setTicketMessage(
        mode === 'generate'
          ? 'The backend returned a ticket. Verify that it was saved and is valid before using it.'
          : 'Ticket information loaded from the backend.'
      );
    } catch (err) {
      setTicketError(getErrorMessage(err));
    } finally {
      setTicketLoading(false);
    }
  }

  const spaceColumns = [
    { label: 'Zone', value: space => text(space.zone) },
    { label: 'Bay', value: space => text(space.bay_number) },
    { label: 'Status', value: space => text(space.status) },
    { label: 'Space ID', value: space => text(space.id) },
  ];

  const sessionColumns = [
    { label: 'Session ID', value: session => text(session.id) },
    {
      label: 'Vehicle',
      value: session => text(session.vehicle_registration_number),
    },
    {
      label: 'Driver',
      value: session => text(session.users?.full_name),
    },
    {
      label: 'Driver email',
      value: session => text(session.users?.email),
    },
    {
      label: 'Bay',
      value: session =>
        [
          session.parking_spaces?.zone,
          session.parking_spaces?.bay_number,
        ]
          .filter(Boolean)
          .join(' - ') || '—',
    },
    {
      label: 'Entry time',
      value: session => date(session.entry_time),
    },
  ];

  return (
    <div className="page">
      <div
        className="title"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <h1>{title}</h1>
          <p>ParkWise administrator workspace</p>
          {lastUpdated && (
            <small>Last refreshed: {lastUpdated.toLocaleTimeString()}</small>
          )}
        </div>

        {(needsSpaces || needsSessions) && (
          <button
            type="button"
            className="primary"
            onClick={load}
            disabled={loading}
          >
            {loading ? 'Refreshing…' : 'Refresh data'}
          </button>
        )}
      </div>

      {error && <Notice type="error">{error}</Notice>}

      {loading && <p role="status">Loading live data from ParkWise…</p>}

      {!loading && !error && needsSpaces && availability && (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(155px, 1fr))',
              gap: 14,
              marginBottom: 20,
            }}
          >
            <StatCard
              label="Total spaces"
              value={availability.total_spaces ?? '—'}
              description="Reported by the backend"
            />
            <StatCard
              label="Available"
              value={availability.available_count ?? availableSpaces.length}
              description="Currently returned as available"
            />
            <StatCard
              label="Occupied"
              value={availability.occupied_count ?? '—'}
              description="Reported by the backend"
            />
            <StatCard
              label="Disabled"
              value={availability.disabled_count ?? '—'}
              description="Reported by the backend"
            />
          </div>

          {title === 'Parking Slots' && (
            <section className="panel">
              <h2>Available parking bays</h2>
              <p>
                This endpoint returns available bays only. It does not provide
                a complete list of occupied or disabled bay records.
              </p>

              <input
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search zone, bay or ID…"
                aria-label="Search available parking bays"
                style={{
                  padding: 12,
                  width: '100%',
                  maxWidth: 420,
                  margin: '8px 0 16px',
                }}
              />

              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  flexWrap: 'wrap',
                  marginBottom: 16,
                }}
              >
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() =>
                    downloadCsv(
                      'parkwise-available-bays.csv',
                      filteredSpaces,
                      spaceColumns
                    )
                  }
                >
                  Export available bays CSV
                </button>

                <span>
                  Showing {filteredSpaces.length} of {availableSpaces.length}
                </span>
              </div>

              <DataTable
                rows={filteredSpaces}
                columns={spaceColumns}
                emptyMessage="No available bays match your search."
              />

              <Notice>
                Adding, editing, deleting, and changing bay status are not
                enabled because the confirmed backend does not provide the
                required management endpoints.
              </Notice>
            </section>
          )}

          {title === 'Parking Lots' && (
            <section className="panel">
              <h2>Zones with available bays</h2>
              <p>
                These are zones derived from available parking bays. They are
                not a list of separately stored parking-lot records.
              </p>

              <input
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Search zones…"
                aria-label="Search parking zones"
                style={{
                  padding: 12,
                  width: '100%',
                  maxWidth: 420,
                  margin: '8px 0 16px',
                }}
              />

              <button
                type="button"
                className="secondary-button"
                onClick={() =>
                  downloadCsv(
                    'parkwise-available-zones.csv',
                    filteredZones,
                    [
                      { label: 'Zone', value: zone => zone.zone },
                      {
                        label: 'Available bays',
                        value: zone => zone.available,
                      },
                      {
                        label: 'Bay numbers',
                        value: zone => zone.bays.join('; '),
                      },
                    ]
                  )
                }
              >
                Export zones CSV
              </button>

              <DataTable
                rows={filteredZones}
                columns={[
                  { label: 'Zone', value: zone => zone.zone },
                  {
                    label: 'Available bays',
                    value: zone => zone.available,
                  },
                  {
                    label: 'Bay numbers',
                    value: zone => zone.bays.join(', ') || '—',
                  },
                ]}
                emptyMessage="No zones with available bays were found."
              />

              <Notice>
                Actual parking-lot create, edit, and delete operations require
                a dedicated parking-lot API and a confirmed database schema.
              </Notice>
            </section>
          )}
        </>
      )}

      {!loading && !error && title === 'Bookings' && (
        <section className="panel">
          <h2>Active parking sessions</h2>
          <Notice>
            The confirmed endpoint returns active parking sessions, not a
            complete reservation or booking history. Completed sessions cannot
            be shown here unless the backend provides a history endpoint.
          </Notice>

          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search session, driver, vehicle or bay…"
            aria-label="Search active sessions"
            style={{
              padding: 12,
              width: '100%',
              maxWidth: 460,
              margin: '8px 0 16px',
            }}
          />

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginBottom: 16,
            }}
          >
            <StatCard
              label="Active sessions"
              value={sessions.length}
              description="Live backend result"
            />

            <button
              type="button"
              className="secondary-button"
              onClick={() =>
                downloadCsv(
                  'parkwise-active-sessions.csv',
                  filteredSessions,
                  sessionColumns
                )
              }
            >
              Export active sessions CSV
            </button>
          </div>

          <DataTable
            rows={filteredSessions}
            columns={sessionColumns}
            emptyMessage="No active sessions match your search."
          />
        </section>
      )}

      {!loading && !error && title === 'Drivers' && (
        <section className="panel">
          <h2>Driver management</h2>
          <Notice>
            A complete driver directory cannot be loaded from the active-session
            endpoint. The backend needs an admin-protected users endpoint, such
            as GET /api/admin/users, before this page can safely show all
            registered drivers.
          </Notice>
          <p>
            This page does not create fake driver records or offer edit/delete
            controls that cannot save to the database.
          </p>
        </section>
      )}

      {!loading && !error && title === 'Vehicles' && (
        <section className="panel">
          <h2>Vehicle management</h2>
          <Notice>
            The confirmed active-session response can show vehicles currently
            parked, but it is not a complete vehicle register. A dedicated
            vehicle endpoint and confirmed vehicle schema are needed for a
            reliable list and persistent management.
          </Notice>
        </section>
      )}

      {!loading && !error && title === 'Payments' && (
        <section className="panel">
          <h2>Payment management</h2>
          <Notice>
            A completed parking fee is not proof that a payment was received.
            A verified payment-history endpoint is required before this page
            can display transaction records or calculate actual revenue.
          </Notice>
          <p>
            Payment processing, verification, refunds, and receipt history
            are not enabled by this frontend component.
          </p>
        </section>
      )}

      {needsTicket && (
        <section className="panel">
          <h2>QR ticket management</h2>
          <p>
            Enter the real parking session ID to request its ticket from the
            backend. Use the generate action only when the ticket controller's
            required payload and authorization have been confirmed.
          </p>

          <label
            htmlFor="ticket-session-id"
            style={{ display: 'block', marginBottom: 8 }}
          >
            Parking session ID
          </label>

          <input
            id="ticket-session-id"
            value={sessionId}
            onChange={event => setSessionId(event.target.value)}
            placeholder="Enter parking session ID"
            style={{
              padding: 12,
              width: '100%',
              maxWidth: 420,
              marginBottom: 12,
            }}
          />

          <div
            style={{
              display: 'flex',
              gap: 10,
              flexWrap: 'wrap',
              marginBottom: 12,
            }}
          >
            <button
              type="button"
              className="primary"
              disabled={ticketLoading}
              onClick={() => ticketAction('find')}
            >
              {ticketLoading ? 'Please wait…' : 'Find ticket'}
            </button>

            <button
              type="button"
              className="secondary-button"
              disabled={ticketLoading}
              onClick={() => ticketAction('generate')}
            >
              Generate ticket
            </button>
          </div>

          {ticketError && <Notice type="error">{ticketError}</Notice>}
          {ticketMessage && <Notice type="success">{ticketMessage}</Notice>}

          {ticket && (
            <div style={{ marginTop: 20 }}>
              <h3>Ticket details</h3>

              <p>
                <strong>Ticket code:</strong>{' '}
                {text(ticket.ticket_code)}
              </p>

              <p>
                <strong>Session ID:</strong>{' '}
                {text(ticket.session_id || sessionId)}
              </p>

              <p>
                <strong>Status:</strong>{' '}
                {text(ticket.status)}
              </p>

              {typeof ticket.qr_code_url === 'string' &&
                ticket.qr_code_url.startsWith('data:image/') && (
                  <img
                    src={ticket.qr_code_url}
                    alt="Parking ticket QR code"
                    style={{
                      width: 220,
                      maxWidth: '100%',
                      background: '#fff',
                      padding: 10,
                      borderRadius: 8,
                    }}
                  />
                )}

              {typeof ticket.qr_code_url === 'string' &&
                ticket.qr_code_url.startsWith('https://') && (
                  <img
                    src={ticket.qr_code_url}
                    alt="Parking ticket QR code"
                    style={{
                      width: 220,
                      maxWidth: '100%',
                      background: '#fff',
                      padding: 10,
                      borderRadius: 8,
                    }}
                  />
                )}

              <div style={{ marginTop: 16 }}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => window.print()}
                >
                  Print ticket details
                </button>
              </div>
            </div>
          )}

          <Notice>
            Ticket generation is only fully working when the backend confirms
            that the ticket was created, stored, and can be retrieved. The
            frontend cannot verify those database operations on its own.
          </Notice>
        </section>
      )}
    </div>
  );
}
