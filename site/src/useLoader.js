import { useCallback, useEffect, useRef, useState } from "react";
import { describeLoadError } from "./utils";

// Loads data once when the page opens, and again whenever load() is called.
//   fetcher        - a function (wrapped in useCallback) that returns the data
//   what           - a short name used in error messages, e.g. "Session history"
//   onUnauthorised - called when the server says the login is no longer valid
export default function useLoader(fetcher, { what, onUnauthorised }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  // Keep the latest callback without making load() change on every render.
  const unauthorised = useRef(onUnauthorised);
  unauthorised.current = onUnauthorised;

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      setError("");

      try {
        const result = await fetcher();
        setData(result);
        setLastUpdated(new Date());
      } catch (err) {
        if (err.status === 401 || err.status === 403) {
          unauthorised.current?.();
          return;
        }
        setError(describeLoadError(err, what));
      } finally {
        setLoading(false);
      }
    },
    [fetcher, what]
  );

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, lastUpdated, load };
}
