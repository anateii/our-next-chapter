import { useState, useSyncExternalStore } from "react";

const motionQuery = "(prefers-reduced-motion: reduce)";
const subscribe = (cb: () => void) => {
  const mq = globalThis.matchMedia(motionQuery);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const useReducedMotion = () =>
  useSyncExternalStore(subscribe, () => globalThis.matchMedia(motionQuery).matches);

// One split-flap card. When `value` changes, the top half of the old value
// falls away and the bottom half of the new one drops into place.
export default function FlipUnit({ value, label }: Readonly<{ value: string; label: string }>) {
  const [prev, setPrev] = useState(value);
  const reduced = useReducedMotion();
  const flipping = prev !== value && !reduced;

  return (
    <div className="flip-unit">
      <div className="flip" aria-hidden="true">
        <div className="flip-half flip-top">
          <span>{value}</span>
        </div>
        <div className="flip-half flip-bottom">
          <span>{flipping ? prev : value}</span>
        </div>
        {flipping && (
          <>
            <div key={`t${value}`} className="flip-half flip-top flip-flap-top">
              <span>{prev}</span>
            </div>
            <div
              key={`b${value}`}
              className="flip-half flip-bottom flip-flap-bottom"
              onAnimationEnd={() => setPrev(value)}
            >
              <span>{value}</span>
            </div>
          </>
        )}
      </div>
      <span className="flip-label">{label}</span>
    </div>
  );
}
