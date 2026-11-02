import { useState } from "react";
import { PageHead, Card, Notice } from "../components/ui";

// Same rate as the backend: R10 per hour, minimum one minute.
const RATE_PER_HOUR = 10;

function calculateFee(minutes) {
  const billableMinutes = Math.max(1, Math.round(minutes));
  return Math.round((billableMinutes / 60) * RATE_PER_HOUR * 100) / 100;
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

  const totalMinutes = valid ? Number(hours) * 60 + Number(minutes) : 0;
  const fee = valid ? calculateFee(totalMinutes) : 0;

  function reset() {
    setHours("1");
    setMinutes("0");
  }

  return (
    <div className="page">
      <PageHead title="Parking Fee Calculator" subtitle="Calculate parking fees using the standard rate." />

      <Card title="Parking duration">
        <div className="form-row">
          <label>
            Hours
            <input type="number" min="0" step="1" value={hours} onChange={(e) => setHours(e.target.value)} />
          </label>
          <label>
            Minutes
            <input type="number" min="0" max="59" step="1" value={minutes} onChange={(e) => setMinutes(e.target.value)} />
          </label>
        </div>

        {!valid && <Notice kind="error">Enter valid hours and minutes (0–59).</Notice>}

        {valid && (
          <>
            <p>
              <b>Hourly rate:</b> R10.00
            </p>
            <p>
              <b>Total duration:</b> {totalMinutes} minutes
            </p>
            <p>
              <b>Billable duration:</b> {Math.max(1, Math.round(totalMinutes))} minutes
            </p>

            <div className="fee-result">
              <h3>Estimated Parking Fee</h3>
              <h2>R{fee.toFixed(2)}</h2>
            </div>

            <p className="muted small">
              This is an estimate. The backend calculates and saves the final fee when the parking session ends.
            </p>
          </>
        )}

        <div className="actions" style={{ marginTop: 16 }}>
          <button className="btn" type="button" onClick={reset}>
            Reset Calculator
          </button>
        </div>
      </Card>
    </div>
  );
}
