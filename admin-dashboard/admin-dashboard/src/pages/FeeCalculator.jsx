
import { useState } from "react";

const RATE_PER_HOUR = 10;

function calculateFee(minutes) {
  const billableMinutes = Math.max(1, Math.round(minutes));
  return Math.round(
    (billableMinutes / 60) * RATE_PER_HOUR * 100
  ) / 100;
}

export default function FeeCalculator() {
  const [hours, setHours] = useState("1");
  const [minutes, setMinutes] = useState("0");

  const valid =
    hours !== "" &&
    minutes !== "" &&
    Number.isInteger(Number(hours)) &&
    Number.isInteger(Number(minutes)) &&
    Number(hours) >= 0 &&
    Number(minutes) >= 0 &&
    Number(minutes) <= 59;

  const totalMinutes = valid
    ? Number(hours) * 60 + Number(minutes)
    : 0;

  const fee = valid ? calculateFee(totalMinutes) : 0;

  function reset() {
    setHours("1");
    setMinutes("0");
  }

  return (
    <div className="page">
      <div className="title">
        <div>
          <h1>Parking Fee Calculator</h1>
          <p>Calculate parking fees using the ParkWise rate.</p>
        </div>
      </div>

      <section className="panel">
        <h3>Parking Duration</h3>

        <div
          style={{
            display: "flex",
            gap: "16px",
            flexWrap: "wrap",
            marginBottom: "20px",
          }}
        >
          <label>
            Hours
            <input
              type="number"
              min="0"
              step="1"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              style={{
                display: "block",
                padding: "12px",
                marginTop: "8px",
                width: "150px",
              }}
            />
          </label>

          <label>
            Minutes
            <input
              type="number"
              min="0"
              max="59"
              step="1"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              style={{
                display: "block",
                padding: "12px",
                marginTop: "8px",
                width: "150px",
              }}
            />
          </label>
        </div>

        {!valid && (
          <p className="error" role="alert">
            Enter valid hours and minutes (0–59).
          </p>
        )}

        {valid && (
          <>
            <p>
              <strong>Hourly Rate:</strong> R10.00
            </p>
            <p>
              <strong>Total Duration:</strong> {totalMinutes} minutes
            </p>
            <p>
              <strong>Billable Duration:</strong>{" "}
              {Math.max(1, Math.round(totalMinutes))} minutes
            </p>

            <div
              style={{
                padding: "20px",
                borderRadius: "12px",
                marginTop: "20px",
                marginBottom: "20px",
                background: "rgba(130, 80, 220, 0.12)",
              }}
            >
              <h3>Estimated Parking Fee</h3>
              <h1>R{fee.toFixed(2)}</h1>
            </div>

            <p>
              This is an estimate. The backend calculates and saves
              the final fee when the parking session ends.
            </p>
          </>
        )}

        <button className="secondary-button" onClick={reset}>
          Reset Calculator
        </button>
      </section>
    </div>
  );
}
