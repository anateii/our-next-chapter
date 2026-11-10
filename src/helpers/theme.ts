import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
// What the person picked: a theme, or "system" to follow the device.
export type ThemePref = Theme | "system";

// localStorage key; index.html reads it too, before React loads.
const KEY = "theme";
const mq = globalThis.matchMedia("(prefers-color-scheme: dark)");

const saved = (): Theme | null => {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null; // storage blocked, e.g. some private windows
  }
};
const systemTheme = (): Theme => (mq.matches ? "dark" : "light");

// One shared value, so the account menu and Settings always agree.
let pref: ThemePref = saved() ?? "system";
let theme: Theme = "light";
// Changes whenever the preference or the theme it resolves to changes.
let snapshot = "";
const listeners = new Set<() => void>();
const apply = () => {
  theme = pref === "system" ? systemTheme() : pref;
  document.documentElement.dataset.theme = theme;
  snapshot = `${pref}:${theme}`;
  for (const l of listeners) l();
};
apply();

/* Smooth switching. The new theme is always set at once; the motion is only
   on top, so a second switch mid-fade just replaces the first. */
const FADE_MS = 320; // keep in step with --dur-theme in index.css
const reducedMotion = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
let fading: ViewTransition | null = null;
let fallbackTimer: ReturnType<typeof setTimeout> | undefined;

const applySmoothly = () => {
  const root = document.documentElement;
  const next = pref === "system" ? systemTheme() : pref;
  if (next === root.dataset.theme || reducedMotion.matches) return apply();

  fading?.skipTransition();
  if (document.startViewTransition) {
    // Cross-fade a snapshot of the old page into the new one (see ::view-transition in index.css).
    fading = document.startViewTransition(apply);
    void fading.finished.finally(() => (fading = null));
    return;
  }
  // Older browsers: let colours ease for a moment instead of snapping.
  clearTimeout(fallbackTimer);
  root.classList.add("theme-changing");
  apply();
  fallbackTimer = setTimeout(() => root.classList.remove("theme-changing"), FADE_MS);
};

mq.addEventListener("change", () => {
  if (pref === "system") applySmoothly();
});

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

// The current theme and preference; the choice is remembered on this device.
export function useTheme() {
  useSyncExternalStore(subscribe, () => snapshot);

  const setPref = (next: ThemePref) => {
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // Not saved; it still applies until the page reloads.
    }
    pref = next;
    applySmoothly();
  };

  return { theme, pref, setPref };
}
