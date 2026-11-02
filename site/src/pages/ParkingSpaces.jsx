import { useCallback, useMemo, useState } from "react";
import { getAllParkingSpaces } from "../services/api";
import useLoader from "../useLoader";
import useAutoRefresh from "../useAutoRefresh";
import { PageHead, Card, Stat, Notice, Updated, Badge, ShowMore } from "../components/ui";
import { bayLabel, downloadCSV, formatDateTime, localDate } from "../utils";

const PAGE_SIZE = 50;

// "disabled" is how the backend marks a bay that is out of service.
const STATUS_LABEL = { available: "Available", occupied: "Occupied", disabled: "Out of service" };
const STATUS_TONE = { available: "good", occupied: undefined, disabled: "warn" };

// All bays with their current status, from GET /api/admin/parking-spaces (view only).
export default function ParkingSpaces({ token, onUnauthorised }) {
  const fetcher = useCallback(() => getAllParkingSpaces(token), [token]);
  const { data, loading, error, lastUpdated, load } = useLoader(fetcher, {
    what: "The parking spaces list",
    onUnauthorised,
  });

  useAutoRefresh(() => load({ silent: true }));

  const [search, setSearch] = useState("");
  const [zone, setZone] = useState("all");
  const [status, setStatus] = useState("all");
  const [accessibleOnly, setAccessibleOnly] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const spaces = useMemo(() => (Array.isArray(data?.parking_spaces) ? data.parking_spaces : []), [data]);

  const zones = useMemo(
    () => [...new Set(spaces.map((s) => s.zone).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
    [spaces]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return spaces
      .filter((s) => (zone === "all" || s.zone === zone) && (status === "all" || s.status === status))
      .filter((s) => !accessibleOnly || s.is_accessible)
      .filter((s) => !term || [bayLabel(s), s.floor, s.gate].some((v) => String(v ?? "").toLowerCase().includes(term)))
      .sort((a, b) => bayLabel(a).localeCompare(bayLabel(b), undefined, { numeric: true }));
  }, [spaces, search, zone, status, accessibleOnly]);

  const count = (name) => spaces.filter((s) => s.status === name).length;

  function resetPaging(setter) {
    return (value) => {
      setter(value);
      setVisible(PAGE_SIZE);
    };
  }

  function exportCSV() {
    downloadCSV(`parkwise-parking-spaces-${localDate()}.csv`, [
      ["ParkWise Parking Spaces"],
      ["Generated", new Date().toLocaleString("en-ZA")],
      [],
      ["Bay", "Zone", "Floor", "Gate", "Accessible", "Status", "Last updated"],
      ...filtered.map((s) => [
        bayLabel(s),
        s.zone ?? "",
        s.floor ?? "",
        s.gate ?? "",
        s.is_accessible ? "Yes" : "No",
        STATUS_LABEL[s.status] ?? s.status ?? "",
        formatDateTime(s.updated_at),
      ]),
    ]);
  }

  return (
    <div className="page">
      <PageHead title="Parking Spaces" subtitle="Every bay and its current status. Updates automatically.">
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
            <Stat label="Total bays" value={spaces.length} />
            <Stat label="Available" value={count("available")} tone="good" />
            <Stat label="Occupied" value={count("occupied")} tone="brand" />
            <Stat label="Out of service" value={count("disabled")} tone="warn" />
          </div>

          <Card title="Bays" subtitle={`${filtered.length} shown`}>
            <div className="toolbar">
              <input
                type="search"
                value={search}
                onChange={(e) => resetPaging(setSearch)(e.target.value)}
                placeholder="Search bay, floor or gate..."
                aria-label="Search bays"
              />
              <select value={zone} onChange={(e) => resetPaging(setZone)(e.target.value)} aria-label="Filter by zone">
                <option value="all">All zones</option>
                {zones.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
              <select value={status} onChange={(e) => resetPaging(setStatus)(e.target.value)} aria-label="Filter by status">
                <option value="all">All statuses</option>
                <option value="available">Available</option>
                <option value="occupied">Occupied</option>
                <option value="disabled">Out of service</option>
              </select>
              <label className="check">
                <input type="checkbox" checked={accessibleOnly} onChange={(e) => resetPaging(setAccessibleOnly)(e.target.checked)} />
                Accessible only
              </label>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Bay</th>
                    <th>Floor</th>
                    <th>Gate</th>
                    <th>Accessible</th>
                    <th>Status</th>
                    <th>Last updated</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, visible).map((s) => (
                    <tr key={s.id ?? bayLabel(s)}>
                      <td>
                        <b>{bayLabel(s)}</b>
                      </td>
                      <td>{s.floor ?? "—"}</td>
                      <td>{s.gate ?? "—"}</td>
                      <td>{s.is_accessible ? "Yes" : "No"}</td>
                      <td>
                        <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status] ?? s.status ?? "Unknown"}</Badge>
                      </td>
                      <td>{formatDateTime(s.updated_at)}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="muted">
                        {spaces.length ? "No bays match your filters." : "No parking bays have been set up yet."}
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

      {loading && !data && !error && <p className="muted">Loading parking spaces…</p>}
    </div>
  );
}
