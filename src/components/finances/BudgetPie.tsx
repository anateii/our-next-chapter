import { useState } from "react";
import { categories, formatWhole, pct, totalOf, type Category, type Expense } from "../../helpers/finances";

// The month's spending by category as a donut, with the total in the middle
// and a legend of names, amounts and shares (so colour is never the only cue).
// Colours follow the category, never its rank: slots 1-8 of the chart palette
// (.budget-pie in Finances.css) in category order, grey for "Other". Past six
// slices, the smallest fold into "Other" so neighbours stay easy to tell apart.
const MAX_SLICES = 6;
const SIZE = 200;
const R_OUT = 96;
const R_IN = 66;

interface Slice {
  key: Category | "rest";
  label: string;
  cents: number;
  color: string; // CSS variable
  includes?: string[]; // "Other" only: the categories folded into it
}

function slicesFor(expenses: readonly Expense[]): Slice[] {
  const named = categories
    .filter((c) => c.key !== "other")
    .map((c, i) => ({
      key: c.key as Category,
      label: c.label,
      cents: totalOf(expenses.filter((x) => x.category === c.key)),
      color: `var(--viz-${i + 1})`,
    }))
    .filter((s) => s.cents > 0);
  let rest = totalOf(expenses.filter((x) => x.category === "other"));
  let shown = named;
  let folded: string[] = [];
  // Too many slices: keep the largest, fold the others into "Other".
  if (named.length + (rest > 0 ? 1 : 0) > MAX_SLICES) {
    const keep = new Set([...named].sort((a, b) => b.cents - a.cents).slice(0, MAX_SLICES - 1).map((s) => s.key));
    const small = named.filter((s) => !keep.has(s.key));
    rest += totalOf(small);
    folded = small.map((s) => s.label);
    shown = named.filter((s) => keep.has(s.key));
  }
  if (rest === 0) return shown;
  return [...shown, { key: "rest", label: "Other", cents: rest, color: "var(--viz-other)", includes: folded }];
}

// One ring segment from angle a0 to a1 (radians, 0 = 12 o'clock, clockwise).
function arc(a0: number, a1: number) {
  const c = SIZE / 2;
  const at = (r: number, a: number) => `${c + r * Math.sin(a)} ${c - r * Math.cos(a)}`;
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return [
    `M ${at(R_OUT, a0)}`,
    `A ${R_OUT} ${R_OUT} 0 ${large} 1 ${at(R_OUT, a1)}`,
    `L ${at(R_IN, a1)}`,
    `A ${R_IN} ${R_IN} 0 ${large} 0 ${at(R_IN, a0)}`,
    "Z",
  ].join(" ");
}

// The whole ring, as one shape with a hole (drawn with fill-rule evenodd).
function ring() {
  const c = SIZE / 2;
  const circle = (r: number) => `M ${c - r} ${c} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0`;
  return `${circle(R_OUT)} ${circle(R_IN)}`;
}

export default function BudgetPie({
  expenses,
  budgetTotal,
  monthName,
}: Readonly<{ expenses: readonly Expense[]; budgetTotal: number; monthName: string }>) {
  const [active, setActive] = useState<Slice["key"] | null>(null);
  const slices = slicesFor(expenses);
  const total = totalOf(slices);
  const on = slices.find((s) => s.key === active);
  const share = (s: Slice) => `${Math.round(pct(s.cents, total))}%`;

  if (total === 0)
    return (
      <div className="budget-pie empty-pie">
        <p className="empty">Nothing spent together in {monthName} yet.</p>
      </div>
    );

  // One slice is a whole ring (an SVG arc can't start and end at the same point).
  const angle = (cents: number) => (cents / total) * 2 * Math.PI;
  const paths = slices.map((s, i) => {
    const a0 = angle(totalOf(slices.slice(0, i))); // where this slice starts
    return { s, d: slices.length === 1 ? ring() : arc(a0, a0 + angle(s.cents)), id: s.key };
  });

  const summary = slices
    .map((s) => `${s.label}${s.includes?.length ? ` (${s.includes.join(", ")})` : ""} ${formatWhole(s.cents)} (${share(s)})`)
    .join(", ");

  return (
    <div className="budget-pie">
      <div className="pie-figure">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`Spending in ${monthName} by category: ${summary}`}
          onMouseLeave={() => setActive(null)}
        >
          {paths.map(({ s, d, id }) => (
            <path
              key={id}
              d={d}
              fill={s.color}
              fillRule="evenodd"
              className={active && active !== s.key ? "pie-dim" : undefined}
              onMouseEnter={() => setActive(s.key)}
            />
          ))}
        </svg>
        {/* The middle shows the total, or the slice under the pointer */}
        <div className="pie-center" aria-hidden="true">
          {on ? (
            <>
              <span className="pie-center-label">{on.label}</span>
              {on.includes?.length ? <span className="pie-center-sub">incl. {on.includes.join(", ")}</span> : null}
              <b>{formatWhole(on.cents)}</b>
              <span className="pie-center-sub">{share(on)} of spending</span>
            </>
          ) : (
            <>
              <span className="pie-center-label">Spent</span>
              <b>{formatWhole(total)}</b>
              {budgetTotal > 0 && <span className="pie-center-sub">of {formatWhole(budgetTotal)}</span>}
            </>
          )}
        </div>
      </div>
      <ul className="pie-legend">
        {slices.map((s) => (
          <li
            key={s.key}
            className={active && active !== s.key ? "pie-dim" : undefined}
            onMouseEnter={() => setActive(s.key)}
            onMouseLeave={() => setActive(null)}
          >
            <i style={{ background: s.color }} aria-hidden="true" />
            <span className="pie-legend-name">
              {s.label}
              {/* Name what "Other" holds, so a small category never seems to vanish */}
              {s.includes?.length ? <small> · {s.includes.join(", ")}</small> : null}
            </span>
            <span className="pie-legend-amt">{formatWhole(s.cents)}</span>
            <span className="pie-legend-share">{share(s)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
