import { useId, useRef, useState } from "react";
import { Info } from "lucide-react";

// A small ⓘ next to a heading that explains it. Opens on hover, on keyboard
// focus, or on tap (phones); Escape or moving away closes it.
export default function InfoTip({
  label,
  children,
}: Readonly<{ label: string; children: React.ReactNode }>) {
  const id = useId();
  const [open, setOpen] = useState(false);
  // Opens toward the side with more room, so it never runs off the screen.
  const [alignRight, setAlignRight] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const show = () => {
    const box = btnRef.current?.getBoundingClientRect();
    if (box) setAlignRight(box.left > globalThis.innerWidth / 2);
    setOpen(true);
  };

  return (
    <span className="infotip" onMouseEnter={show} onMouseLeave={() => setOpen(false)}>
      <button
        ref={btnRef}
        type="button"
        className="infotip-btn"
        aria-label={`About ${label}`}
        aria-describedby={id}
        aria-expanded={open}
        onClick={() => (open ? setOpen(false) : show())}
        onFocus={show}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
      >
        <Info aria-hidden="true" size={15} />
      </button>
      <span
        role="tooltip"
        id={id}
        className={`infotip-bubble${alignRight ? " right" : ""}`}
        hidden={!open}
      >
        {children}
      </span>
    </span>
  );
}
