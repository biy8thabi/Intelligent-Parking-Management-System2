
import { useEffect, useMemo, useState } from "react";
import { request } from "../services/api";

export default function Vehicles() {
  const [vehicles, setVehicles] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadVehicles() {
      setLoading(true);
      setError("");

      try {
        const token = sessionStorage.getItem("pw_admin_token");

        const response = await request("/api/admin/vehicles", {
          token,
        });

        const records = Array.isArray(response)
          ? response
          : response?.vehicles;

        if (!Array.isArray(records)) {
          throw new Error("The vehicle API returned an unexpected response.");
        }

        if (!cancelled) {
          setVehicles(records);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load vehicles.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadVehicles();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredVehicles = useMemo(() => {
    const term = search.toLowerCase().trim();

    return vehicles.filter((vehicle) =>
      [
        vehicle.registration_number,
        vehicle.make,
        vehicle.model,
        vehicle.color,
        vehicle.colour,
        vehicle.vehicle_type,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [vehicles, search]);

  return (
    <main className="page">
      <div className="page-header">
        <div>
          <h1>Vehicle Management</h1>
          <p>View and search registered vehicles in ParkWise.</p>
        </div>
      </div>

      <div className="card">
        <h2>Vehicles</h2>

        <p>
          Total vehicles: <strong>{vehicles.length}</strong>
        </p>

        <input
          type="search"
          placeholder="Search registration, make or model..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search vehicles"
          style={{
            width: "100%",
            maxWidth: 420,
            padding: 12,
            marginBottom: 20,
          }}
        />

        {loading && <p role="status">Loading vehicles...</p>}

        {error && (
          <div className="error" role="alert">
            {error}
            <p>
              The backend must provide GET /api/admin/vehicles
              before the complete vehicle register can load.
            </p>
          </div>
        )}

        {!loading && !error && filteredVehicles.length === 0 && (
          <p>No vehicles found.</p>
        )}

        {!loading && !error && filteredVehicles.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%" }}>
              <thead>
                <tr>
                  <th>Registration</th>
                  <th>Make</th>
                  <th>Model</th>
                  <th>Colour</th>
                  <th>Type</th>
                </tr>
              </thead>

              <tbody>
                {filteredVehicles.map((vehicle, index) => (
                  <tr key={vehicle.id ?? index}>
                    <td>{vehicle.registration_number ?? "—"}</td>
                    <td>{vehicle.make ?? "—"}</td>
                    <td>{vehicle.model ?? "—"}</td>
                    <td>{vehicle.color ?? vehicle.colour ?? "—"}</td>
                    <td>{vehicle.vehicle_type ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
