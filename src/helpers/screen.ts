import { useEffect, useState } from "react";

// The app is offered on desktop-size windows only; below this width
// MobileGate shows instead. Keep in step with the 900px rule in MobileGate.css.
const WIDE = "(min-width: 901px)";

// True once the window has been wide enough at least once. It never goes back
// to false: after the app has mounted, narrowing the window only hides it
// (in CSS), so open forms and unsaved input survive a resize.
export function useEverWide() {
  const [wide, setWide] = useState(() => globalThis.matchMedia(WIDE).matches);
  useEffect(() => {
    if (wide) return;
    const mq = globalThis.matchMedia(WIDE);
    const check = () => {
      if (mq.matches) setWide(true);
    };
    mq.addEventListener("change", check);
    return () => mq.removeEventListener("change", check);
  }, [wide]);
  return wide;
}
