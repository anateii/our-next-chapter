import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

// localStorage key; index.html reads it too, before React loads.
const KEY = "theme";

const saved = (): Theme | null => {
  try {
    const t = localStorage.getItem(KEY);
    return t === "light" || t === "dark" ? t : null;
  } catch {
    return null; // storage blocked, e.g. some private windows
  }
};
const systemTheme = (): Theme =>
  globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

// The current theme, and a toggle that remembers the choice on this device.
// Until someone picks one, it follows the system setting.
export function useTheme() {
  const [theme, setTheme] = useState<Theme>(
    () => (document.documentElement.dataset.theme as Theme | undefined) ?? saved() ?? systemTheme(),
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    const mq = globalThis.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (!saved()) setTheme(systemTheme());
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Not saved; it still applies until the page reloads.
    }
    setTheme(next);
  };

  return { theme, toggle };
}
