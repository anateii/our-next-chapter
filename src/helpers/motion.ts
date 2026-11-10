import { flushSync } from "react-dom";

// Smooth UI changes with the View Transitions API. The state always changes
// at once; the animation is only drawn on top, so a second change mid-way just
// replaces the first. With "Reduce motion" on, or without browser support, the
// change is instant. See "View switches" and "Page transitions" in index.css.
//   "page": the main area fades and rises (moving between pages)
//   "view": changed parts cross-fade and cards slide into place (tabs, filters, layouts)
export type MotionKind = "page" | "view";

const reducedMotion = globalThis.matchMedia("(prefers-reduced-motion: reduce)");
let latest = 0; // the newest transition owns the class on <html>

export function smoothly(update: () => void, kind: MotionKind = "view") {
  if (!document.startViewTransition || reducedMotion.matches) return update();
  const root = document.documentElement;
  const id = ++latest;
  root.classList.remove("vt-page", "vt-view");
  root.classList.add(`vt-${kind}`);
  const t = document.startViewTransition(() => flushSync(update));
  void t.finished.finally(() => {
    if (id === latest) root.classList.remove(`vt-${kind}`);
  });
}
