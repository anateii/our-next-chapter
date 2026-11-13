import { useEffect, useRef, useState } from "react";
import HeartLoader from "./HeartLoader";

// Keep these three in step with the "Splash" rules in App.css.
const HEART_PX = 64; // HeartLoader's width; the mask's hole starts at this size
const JOIN_MS = 280; // the halves close from wherever the loop had them
const REVEAL_MS = 800; // the heart-shaped window grows past the screen edges

const reducedMotion = globalThis.matchMedia("(prefers-reduced-motion: reduce)");

type Stage = "waiting" | "revealing" | "gone";

// The full-screen loading cover. While `done` is false the heart's halves loop.
// When it turns true the halves join, then the heart becomes a window that
// grows until the page underneath fills the screen. The page is already
// mounted and usable below; the cover never takes clicks while it leaves.
export default function Splash({ done }: Readonly<{ done: boolean }>) {
  const [stage, setStage] = useState<Stage>("waiting");
  const ref = useRef<HTMLOutputElement>(null);

  // Loading again (e.g. after onboarding): start over from the loop.
  const [wasDone, setWasDone] = useState(done);
  if (wasDone !== done) {
    setWasDone(done);
    setStage("waiting");
  }

  useEffect(() => {
    if (!done) return;
    const el = ref.current;
    if (!el || reducedMotion.matches) {
      const t = setTimeout(() => setStage("gone"), 0);
      return () => clearTimeout(t);
    }

    // Join: glide each part from where the loop had it to the merged heart.
    // (.is-joining stops the loop, so "merged" is each part's resting style.)
    for (const part of el.querySelectorAll(".heart-loader, .heart-half")) {
      const { transform, opacity } = getComputedStyle(part);
      part.animate(
        [
          { transform, opacity },
          { transform: "none", opacity: 1 },
        ],
        { duration: JOIN_MS, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
      );
    }

    // How far the window must grow: about 2.6 half-diagonals wide puts the
    // heart's edges well past the corners by the time the cover has faded.
    const halfDiagonal = Math.hypot(globalThis.innerWidth, globalThis.innerHeight) / 2;
    el.style.setProperty("--splash-z-end", String((2.6 * halfDiagonal) / HEART_PX));

    // Timers, not animationend: the state must end up right even if an
    // animation is skipped or interrupted.
    const reveal = setTimeout(() => setStage("revealing"), JOIN_MS);
    const leave = setTimeout(() => setStage("gone"), JOIN_MS + REVEAL_MS);
    return () => {
      clearTimeout(reveal);
      clearTimeout(leave);
    };
  }, [done]);

  if (done && stage === "gone") return null;
  const revealing = done && stage === "revealing";
  return (
    <output
      ref={ref}
      className={`splash${done ? " is-joining" : ""}${revealing ? " is-revealing" : ""}`}
    >
      {/* The cover is its own layer so that its mask does not cut the heart */}
      <span className="splash-cover" aria-hidden="true" />
      <HeartLoader size={HEART_PX} />
      {!done && <span className="sr-only">Loading your space…</span>}
    </output>
  );
}
