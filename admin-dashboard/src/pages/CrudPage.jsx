import { useEffect, useState } from "react";
import { request } from "../services/api";

export default function CrudPage({ title }) {
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const isParkingSlots = title === "Parking Slots";

  useEffect(() => {
    if (!isParkingSlots) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadSpaces() {
      try {
        setLoading(true);
        setError("");

        const data = await request("/api/parking/availability");

        if (!cancelled) {
          setSpaces(data.available_spaces || []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Could not load parking spaces.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadSpaces();

    return () => {
      cancelled = true;
    };
  }, [isParkingSlots]);

  if (!isParkingSlots) {
    return (
      <div className="page">
        <div className="title">
          <div>
            <h1>{title}</h1>
            <p>ParkWise administration</p>
          </div>
        </div>

        <section className="panel">
          <h3>Integration pending</h3>
          <p>
            This page needs its corresponding backend endpoints
            before it can manage real records.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="title">
        <div>
          <h1>Parking Slots</h1>
          <p>Parking space availability from the ParkWise backend.</p>
        </div>

        <button
          className="primary"
          onClick={() => window.location.reload()}
        >
          Refresh
        </button>
      </div>

      <section className="panel">
        {loading && <p>Loading parking spaces...</p>}

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        {!loading && !error && spaces.length === 0 && (
          <p>
            No available parking spaces were returned by the backend.
          </p>
        )}

        {!loading && !error && spaces.length > 0 && (
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
                  <th>Zone</th>
                  <th>Bay Number</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {spaces.map((space) => (
                  <tr key={space.id}>
                    <td>{space.zone || "—"}</td>
                    <td>{space.bay_number || "—"}</td>
                    <td>{space.status || "available"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
