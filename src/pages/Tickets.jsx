import { useCallback, useMemo, useState } from "react";
import { getAllTickets } from "../services/api";
import useLoader from "../useLoader";
import { PageHead, Card, Stat, Notice, Updated, Badge, ShowMore } from "../components/ui";
import { bayLabel, downloadCSV, formatDateTime, localDate } from "../utils";

const PAGE_SIZE = 50;

// Digital parking tickets from GET /api/admin/tickets (view only).
export default function Tickets({ token, onUnauthorised }) {
  const fetcher = useCallback(() => getAllTickets(token), [token]);
  const { data, loading, error, lastUpdated, load } = useLoader(fetcher, {
    what: "The tickets list",
    onUnauthorised,
  });

  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(PAGE_SIZE);

  const tickets = useMemo(() => (Array.isArray(data?.tickets) ? data.tickets : []), [data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return tickets;
    return tickets.filter((t) =>
      [t.ticket_code, t.parking_sessions?.vehicle_registration_number, bayLabel(t.parking_sessions?.parking_spaces)].some((v) =>
        String(v ?? "").toLowerCase().includes(term)
      )
    );
  }, [tickets, search]);

  const stillActive = tickets.filter((t) => t.parking_sessions?.session_status === "active").length;

  function exportCSV() {
    downloadCSV(`parkwise-tickets-${localDate()}.csv`, [
      ["ParkWise Tickets"],
      ["Generated", new Date().toLocaleString("en-ZA")],
      [],
      ["Ticket code", "Vehicle", "Bay", "Issued", "Session status"],
      ...filtered.map((t) => [
        t.ticket_code ?? "",
        t.parking_sessions?.vehicle_registration_number ?? "",
        bayLabel(t.parking_sessions?.parking_spaces),
        formatDateTime(t.issued_at),
        t.parking_sessions?.session_status ?? "",
      ]),
    ]);
  }

  return (
    <div className="page">
      <PageHead title="Tickets" subtitle="Digital tickets issued to drivers, newest first.">
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
            <Stat label="Tickets issued" value={tickets.length} />
            <Stat label="For active sessions" value={stillActive} tone="good" />
            <Stat label="For ended sessions" value={tickets.length - stillActive} />
          </div>

          <Card title="All tickets" subtitle={`${filtered.length} shown`}>
            <div className="toolbar">
              <input
                type="search"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setVisible(PAGE_SIZE);
                }}
                placeholder="Search ticket code, vehicle or bay..."
                aria-label="Search tickets"
              />
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Ticket code</th>
                    <th>Vehicle</th>
                    <th>Bay</th>
                    <th>Issued</th>
                    <th>Session</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, visible).map((t) => {
                    const s = t.parking_sessions;
                    return (
                      <tr key={t.id}>
                        <td>
                          <b>{t.ticket_code || "—"}</b>
                        </td>
                        <td>{s?.vehicle_registration_number || "—"}</td>
                        <td>{bayLabel(s?.parking_spaces)}</td>
                        <td>{formatDateTime(t.issued_at)}</td>
                        <td>
                          <Badge tone={s?.session_status === "active" ? "good" : undefined}>{s?.session_status || "unknown"}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="muted">
                        {tickets.length ? "No tickets match your search." : "No tickets have been issued yet."}
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

      {loading && !data && !error && <p className="muted">Loading tickets…</p>}
    </div>
  );
}
