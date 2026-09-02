import { useEffect, useState } from "react";

/** Minimum gap between refreshes so rapid tab-switching doesn't spam refetches. */
const MIN_REFRESH_INTERVAL_MS = 5_000;

/**
 * Returns a counter that increments each time the user returns to this tab
 * (the tab becomes visible again or the window regains focus). Pass it as a
 * `reloadKey` to the data hooks so the catalog and student data refetch when
 * the user comes back — e.g. after editing in another tab or on another
 * computer. Purely a refetch signal; sign-in state is never touched.
 */
export function useRefreshOnVisible(): number {
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    // Start the clock at mount so the initial load doesn't double-fetch.
    let lastRefresh = Date.now();

    const refresh = () => {
      const now = Date.now();
      if (now - lastRefresh < MIN_REFRESH_INTERVAL_MS) return;
      lastRefresh = now;
      setRefreshKey((k) => k + 1);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return refreshKey;
}
