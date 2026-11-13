import { useId } from "react";

// One half of the logo's heart: a petal with its tip at 0,0, pointing up.
const PETAL = "M0 0C-34-22-50-58-50-80A50 50 0 1 1 50-80C50-58 34-22 0 0Z";

// The loading mark: the two halves of the Ourly heart drift together, merge
// into the logo, beat once and part again. Decorative; pair it with sr-only text.
export default function HeartLoader({ size = 64 }: Readonly<{ size?: number }>) {
  const id = useId();
  return (
    <svg
      className="heart-loader"
      viewBox="-125 -132 250 140"
      width={size}
      height={(size * 140) / 250}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}l`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#b79cff" />
          <stop offset="1" stopColor="#6d28d9" />
        </linearGradient>
        <linearGradient id={`${id}r`} x1="0.1" y1="1" x2="0.9" y2="0">
          <stop offset="0" stopColor="#a21caf" />
          <stop offset="0.5" stopColor="#ff5c8a" />
          <stop offset="1" stopColor="#ffb057" />
        </linearGradient>
      </defs>
      <g className="heart-half heart-half-left">
        <path d={PETAL} fill={`url(#${id}l)`} transform="rotate(-27)" />
      </g>
      <g className="heart-half heart-half-right">
        <path d={PETAL} fill={`url(#${id}r)`} transform="rotate(27)" />
      </g>
    </svg>
  );
}
