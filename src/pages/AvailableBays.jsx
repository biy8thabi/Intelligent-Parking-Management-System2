import { useCallback, useEffect, useMemo, useState } from "react";
import { getParkingAvailability } from "../services/api";
import useAutoRefresh from "../useAutoRefresh";
import { PageHead, Card, Stat, Notice, Updated } from "../components/ui";

function bayLabel(space) {
  return [space.zone, space.bay_number].filter(Boolean).join("-") || "—";
}

// Built from GET /api/parking/availability, which lists the bays that are free right now.
export default function AvailableBays() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState("");
  const [zone, setZone] = useState("all");
  const [accessibleOnly, setAccessibleOnly] = useState(false);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");

    try {
      const result = await getParkingAvailability();

      if (!Array.isArray(result?.available_spaces)) {
        throw new Error("The availability response did not include the list of available bays.");
      }

      setData(result);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || "Could not load available bays.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useAutoRefresh(() => load({ silent: true }));

  const spaces = useMemo(() => data?.available_spaces ?? [], [data]);

  // One row per zone: how many bays are free, and how many of those are accessible.
  const zones = useMemo(() => {
    const map = new Map();
    spaces.forEach((s) => {
      const key = s.zone ?? "—";
      const entry = map.get(key) ?? { zone: key, available: 0, accessible: 0 };
      entry.available += 1;
      if (s.is_accessible) entry.accessible += 1;
      map.set(key, entry);
    });
    return [...map.values()].sort((a, b) => a.zone.localeCompare(b.zone, undefined, { numeric: true }));
  }, [spaces]);

  // The bay list after the search box, zone menu and accessible tick-box are applied.
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return spaces
      .filter((s) => (zone === "all" || s.zone === zone) && (!accessibleOnly || s.is_accessible))
      .filter(
        (s) =>
          !term ||
          [bayLabel(s), s.floor, s.gate].some((v) => String(v ?? "").toLowerCase().includes(term))
      )
      .sort((a, b) => bayLabel(a).localeCompare(bayLabel(b), undefined, { numeric: true }));
  }, [spaces, search, zone, accessibleOnly]);

  return (
    <div className="page">
      <PageHead title="Available Bays" subtitle="Parking bays that are free right now. Updates automatically.">
        <button className="btn btn-primary" type="button" onClick={() => load()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </PageHead>

      <Updated time={lastUpdated} />

      {error && <Notice kind="error">{error}</Notice>}

      {!error && data && (
        <>
          <div className="stats">
            <Stat label="Available now" value={Number(data.available_count ?? spaces.length)} tone="good" />
            <Stat label="Accessible & available" value={Number(data.accessible_available_count ?? 0)} tone="brand" />
            <Stat label="Occupied" value={Number(data.occupied_count ?? 0)} />
            <Stat label="Out of service" value={Number(data.disabled_count ?? 0)} tone="warn" />
          </div>

          <Card title="Available by zone">
            {zones.length === 0 ? (
              <p className="muted">No bays are available right now.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Zone</th>
                      <th>Available bays</th>
                      <th>Accessible bays</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zones.map((z) => (
                      <tr key={z.zone}>
                        <td>
                          <b>{z.zone}</b>
                        </td>
                        <td>{z.available}</td>
                        <td>{z.accessible}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Bay list">
            <div className="toolbar">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search bay, floor or gate..."
                aria-label="Search available bays"
              />
              <select value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Filter by zone">
                <option value="all">All zones</option>
                {zones.map((z) => (
                  <option key={z.zone} value={z.zone}>
                    {z.zone}
                  </option>
                ))}
              </select>
              <label className="check">
                <input
                  type="checkbox"
                  checked={accessibleOnly}
                  onChange={(e) => setAccessibleOnly(e.target.checked)}
                />
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
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id ?? bayLabel(s)}>
                      <td>
                        <b>{bayLabel(s)}</b>
                      </td>
                      <td>{s.floor ?? "—"}</td>
                      <td>{s.gate ?? "—"}</td>
                      <td>{s.is_accessible ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="muted">
                        No bays match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}

      {!error && !data && loading && <p className="muted">Loading available bays…</p>}
    </div>
  );
}
