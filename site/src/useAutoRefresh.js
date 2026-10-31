import { useEffect, useRef } from "react";

// The interval is chosen on the Settings page (kept in this browser).
export function readRefreshSeconds() {
  try {
    const prefs = JSON.parse(localStorage.getItem("pw_settings") || "{}");
    const seconds = Number(prefs.refreshInterval);
    return Number.isFinite(seconds) && seconds >= 10 ? seconds : 30;
  } catch {
    return 30;
  }
}

// Calls `callback` on the chosen interval, but only while this tab is visible.
export default function useAutoRefresh(callback) {
  const latest = useRef(callback);

  useEffect(() => {
    latest.current = callback;
  });

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") latest.current();
    }, readRefreshSeconds() * 1000);

    return () => clearInterval(id);
  }, []);
}
