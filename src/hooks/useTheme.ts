import { useCallback, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
/** "default" follows the device's `prefers-color-scheme`. */
export type ScreenMode = Theme | "default";

/** Also read by the inline script in `index.html` so the first paint is themed. */
const STORAGE_KEY = "student-atlas-theme";

function isScreenMode(value: unknown): value is ScreenMode {
  return value === "light" || value === "dark" || value === "default";
}

/** The mode currently applied to the page, which may differ from an unsaved
 * profile edit. */
export function readScreenMode(): ScreenMode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isScreenMode(stored) ? stored : "default";
  } catch {
    return "default";
  }
}

const media = window.matchMedia("(prefers-color-scheme: dark)");

function resolve(mode: ScreenMode): Theme {
  if (mode !== "default") return mode;
  return media.matches ? "dark" : "light";
}

const listeners = new Set<() => void>();

let snapshot = (() => {
  const mode = readScreenMode();
  return { mode, theme: resolve(mode) };
})();

function publish(mode: ScreenMode) {
  snapshot = { mode, theme: resolve(mode) };
  document.documentElement.classList.toggle("dark", snapshot.theme === "dark");
  for (const listener of listeners) listener();
}

media.addEventListener("change", () => {
  if (snapshot.mode === "default") publish("default");
});

/** Paints the page with `mode` for this visit only — does not remember it. */
export function previewScreenMode(mode: ScreenMode) {
  publish(mode);
}

/** Applies a mode to the page and remembers it for the next first paint. */
export function applyScreenMode(mode: ScreenMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage unavailable (e.g. private mode) — the choice lasts this visit.
  }
  publish(mode);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The theme the page is painted with. Toggling picks an explicit light or
 * dark mode, leaving "default" behind. */
export function useTheme() {
  const { theme } = useSyncExternalStore(subscribe, () => snapshot);

  const toggleTheme = useCallback(() => {
    applyScreenMode(theme === "dark" ? "light" : "dark");
  }, [theme]);

  return { theme, toggleTheme };
}
