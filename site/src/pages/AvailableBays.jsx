import { useCallback, useEffect, useMemo, useState } from "react";
import { getParkingAvailability } from "../services/api";
import useAutoRefresh from "../useAutoRefresh";

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

  const panel = { padding: 22, borderRadius: 14 };
  const th = { textAlign: "left", padding: 12, borderBottom: "1px solid #777" };
  const field = { padding: 12, borderRadius: 8, border: "1px solid #777", background: "transparent", color: "inherit" };

  return (
    <main className="page">
      <p style={{ color: "#a78bfa", marginBottom: 6 }}>PARKWISE / ADMINISTRATION</p>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0 }}>Available Bays</h1>
          <p style={{ opacity: 0.75 }}>Parking bays that are free right now. Updates automatically.</p>
          {lastUpdated && (
            <p style={{ fontSize: 13, opacity: 0.65 }}>Last refreshed: {lastUpdated.toLocaleTimeString("en-ZA")}</p>
          )}
        </div>
        <button type="button" className="secondary-button" onClick={() => load()} disabled={loading}>
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {error && (
        <section className="panel" style={panel}>
          <h3>Available bays could not be loaded</h3>
          <p role="alert">{error}</p>
        </section>
      )}

      {loading && !data && <p>Loading available bays...</p>}

      {data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, margin: "20px 0" }}>
            {[
              ["Available now", data.available_count],
              ["Accessible & available", data.accessible_available_count ?? "—"],
              ["Occupied", data.occupied_count],
              ["Out of service", data.disabled_count],
            ].map(([label, value]) => (
              <section key={label} className="panel" style={panel}>
                <p style={{ opacity: 0.7, marginTop: 0 }}>{label}</p>
                <h2 style={{ fontSize: 28, marginBottom: 0 }}>{value}</h2>
              </section>
            ))}
          </div>

          <section className="panel" style={{ ...panel, marginBottom: 20 }}>
            <h3 style={{ marginTop: 0 }}>Available by zone</h3>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>{["Zone", "Available bays", "Accessible bays"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {zones.map((z) => (
                    <tr key={z.zone}>
                      <td style={{ padding: 12 }}><strong>{z.zone}</strong></td>
                      <td style={{ padding: 12 }}>{z.available}</td>
                      <td style={{ padding: 12 }}>{z.accessible}</td>
                    </tr>
                  ))}
                  {zones.length === 0 && (
                    <tr><td colSpan={3} style={{ padding: 18 }}>No bays are available right now.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel" style={panel}>
            <h3 style={{ marginTop: 0 }}>Bay list</h3>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginBottom: 16 }}>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search bay, floor or gate..."
                aria-label="Search available bays"
                style={{ ...field, width: 260, maxWidth: "100%" }}
              />
              <select value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Filter by zone" style={field}>
                <option value="all">All zones</option>
                {zones.map((z) => <option key={z.zone} value={z.zone}>{z.zone}</option>)}
              </select>
              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="checkbox" checked={accessibleOnly} onChange={(e) => setAccessibleOnly(e.target.checked)} />
                Accessible bays only
              </label>
            </div>

            <p style={{ fontSize: 13, opacity: 0.7 }}>Showing {filtered.length} of {spaces.length} available bays.</p>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>{["Bay", "Floor", "Gate", "Accessible"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
                </thead>
                <tbody>
                  {filtered.map((s) => (
                    <tr key={s.id ?? bayLabel(s)}>
                      <td style={{ padding: 12 }}>{bayLabel(s)}</td>
                      <td style={{ padding: 12 }}>{s.floor ?? "—"}</td>
                      <td style={{ padding: 12 }}>{s.gate ?? "—"}</td>
                      <td style={{ padding: 12 }}>{s.is_accessible ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: 18 }}>
                      {spaces.length === 0 ? "No bays are available right now." : "No bays match your filters."}
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}
