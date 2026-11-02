// Small helpers shared by several pages.

// 5h 0m, 2d 3h, 45m ... (input in milliseconds)
export function formatDuration(ms) {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return "—";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// "A-12" from a parking space object, or a dash.
export function bayLabel(space) {
  if (!space) return "—";
  return [space.zone, space.bay_number].filter(Boolean).join("-") || "—";
}

export function formatDateTime(value) {
  const ms = value ? Date.parse(value) : NaN;
  return Number.isNaN(ms) ? "—" : new Date(ms).toLocaleString("en-ZA");
}

export function formatDate(value) {
  const ms = value ? Date.parse(value) : NaN;
  return Number.isNaN(ms) ? "—" : new Date(ms).toLocaleDateString("en-ZA");
}

export function formatMoney(value) {
  return `R${Number(value || 0).toFixed(2)}`;
}

// The parking fee rule: R10 per hour, minimum one minute.
export const RATE_PER_HOUR = 10;
export function estimateFee(minutes) {
  const billable = Math.max(1, Math.round(minutes));
  return Math.round((billable / 60) * RATE_PER_HOUR * 100) / 100;
}

// Local calendar date as 2026-11-02 (toISOString would use UTC and be a day off after midnight).
export function localDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function escapeCSV(value) {
  const text = String(value ?? "");
  // Protect spreadsheet programs against CSV formula injection.
  const safe = /^[\s]*[=+\-@\t\r]/.test(text) ? "'" + text : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

// Downloads rows (an array of arrays) as a CSV file.
export function downloadCSV(filename, rows) {
  const csv = rows.map((row) => row.map(escapeCSV).join(",")).join("\r\n");
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// A friendly message for a failed list request. A 404 means the server has not got that route yet.
export function describeLoadError(err, what) {
  if (err?.status === 404) {
    return `${what} is not available on the server yet. Ask the backend developer to deploy it.`;
  }
  return err?.message || `Could not load ${what.toLowerCase()}.`;
}
