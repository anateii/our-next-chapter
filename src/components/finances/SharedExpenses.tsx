import { useState } from "react";
import { Handshake } from "lucide-react";
import Avatars from "../Avatars";
import GoalMenu from "../GoalMenu";
import InfoTip from "../InfoTip";
import ScrollFade from "../ScrollFade";
import { usePeople } from "../../helpers/people";
import { smoothly } from "../../helpers/motion";
import {
  categories,
  categoryOf,
  expensesIn,
  formatMoney,
  monthOf,
  monthShort,
  monthTitle,
  shareOf,
  type Category,
  type Expense,
  type Finances,
  type Partner,
  type Settlement,
} from "../../helpers/finances";

const dayName = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
// "YYYY-MM-DD" -> "Today", "Yesterday" or "Tue, 4 Nov"
const relDay = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const n = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (n === 0) return "Today";
  if (n === -1) return "Yesterday";
  return dayName.format(date);
};

type Row = { kind: "expense"; day: string; x: Expense } | { kind: "settle"; day: string; s: Settlement };

// The month's shared expenses and settle-ups, newest first, grouped by day,
// filtered by who paid and by category.
export default function SharedExpenses({
  data,
  month,
  me,
  onOpen,
  onRemoveSettlement,
}: Readonly<{
  data: Finances;
  month: string;
  me: Partner;
  onOpen: (x: Expense) => void;
  onRemoveSettlement: (id: string) => void;
}>) {
  const { name, partner } = usePeople();
  const other: Partner = me === "owner" ? "partner" : "owner";
  const [paidFilter, setPaidFilter] = useState<"all" | Partner>("all");
  const [catFilter, setCatFilter] = useState<"all" | Category>("all");

  const monthExpenses = expensesIn(data, month);
  const rows: Row[] = [
    ...monthExpenses
      .filter(
        (x) =>
          (paidFilter === "all" || x.paidBy === paidFilter) && (catFilter === "all" || x.category === catFilter),
      )
      .map((x) => ({ kind: "expense" as const, day: x.day, x })),
    // Settle-ups have no category, so a category filter hides them.
    ...(catFilter === "all"
      ? data.settlements
          .map((s) => ({ s, day: s.at.slice(0, 10) }))
          .filter(({ s, day }) => monthOf(day) === month && (paidFilter === "all" || s.from === paidFilter))
          .map(({ s, day }) => ({ kind: "settle" as const, day, s }))
      : []),
  ].sort((a, b) => b.day.localeCompare(a.day));
  const groups = new Map<string, Row[]>();
  for (const row of rows) groups.set(row.day, [...(groups.get(row.day) ?? []), row]);

  const paidOptions: [string, string][] = [
    ["all", "Everyone"],
    [me, "You"],
    ...(partner ? [[other, name(other)] as [string, string]] : []),
  ];

  return (
    <section className="card fin-panel fin-expenses" aria-labelledby="exp-title">
      <div className="fin-panel-head">
        <div className="fin-title">
          <h2 id="exp-title">Shared Expenses</h2>
          <InfoTip label="Shared Expenses">
            Everything you've paid for together this month: who paid, how it's split, and your share.
            Tap an expense to edit or delete it.
          </InfoTip>
        </div>
        <span className="fin-sub">
          {monthExpenses.length} in {monthShort(month)}
        </span>
      </div>
      {/* One quiet row: who paid as small text pills, the category as a plain-text dropdown */}
      <div className="fin-filters">
        <div className="exp-pills" role="group" aria-label="Paid by">
          {paidOptions.map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={paidFilter === k}
              onClick={() => smoothly(() => setPaidFilter(k as "all" | Partner))}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="exp-category">
          Category
        </label>
        <select
          id="exp-category"
          className={`fin-select${catFilter === "all" ? "" : " filtered"}`}
          value={catFilter}
          onChange={(e) => setCatFilter(e.target.value as "all" | Category)}
        >
          <option value="all">All categories</option>
          {categories.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="empty">
          {monthExpenses.length ? "Nothing matches these filters." : `No shared expenses in ${monthTitle(month)}.`}
        </div>
      ) : (
        // As tall as the budget card beside it; days that don't fit scroll inside.
        <ScrollFade className="exp-days" fill label="Shared Expenses">
          {[...groups].map(([day, list]) => (
          <div key={day}>
            <h3 className="fin-day">{relDay(day)}</h3>
            <ul className="exps">
              {list.map((row) =>
                row.kind === "settle" ? (
                  <SettleRow key={row.s.id} settlement={row.s} onRemove={() => onRemoveSettlement(row.s.id)} />
                ) : (
                  <ExpenseRow key={row.x.id} expense={row.x} me={me} onOpen={onOpen} />
                ),
              )}
            </ul>
          </div>
          ))}
        </ScrollFade>
      )}
    </section>
  );
}

// A settle-up in the list: who paid whom back.
// Its menu removes a settle-up pressed by mistake (not while it's still saving).
function SettleRow({ settlement: s, onRemove }: Readonly<{ settlement: Settlement; onRemove: () => void }>) {
  const { name } = usePeople();
  return (
    <li className="exp settle">
      <span className="cat-icon cat-food" aria-hidden="true">
        <Handshake size={18} />
      </span>
      <div className="exp-main">
        <span className="exp-title">
          {name(s.from)} paid {name(s.to)} back
        </span>
        <span className="exp-sub">Settled up</span>
      </div>
      <span className="exp-amt">
        <b>{formatMoney(s.cents)}</b>
      </span>
      <GoalMenu
        label={`More options for the settle-up of ${formatMoney(s.cents)}`}
        actions={[{ label: "Remove settle-up", onSelect: onRemove, disabled: s.id.startsWith("new-") }]}
      />
    </li>
  );
}

// One expense in the list; opens it for editing (not while it's still saving).
function ExpenseRow({
  expense: x,
  me,
  onOpen,
}: Readonly<{ expense: Expense; me: Partner; onOpen: (x: Expense) => void }>) {
  const { name } = usePeople();
  const c = categoryOf(x.category);
  const Icon = c.icon;
  let split = "split equally";
  if (x.split === "income") split = `by income (${x.ownerShare}/${100 - x.ownerShare})`;
  else if (x.split !== "equal") split = `all for ${name(x.split)}`;
  return (
    <li className="exp">
      <span className={`cat-icon cat-${c.key}`} aria-hidden="true">
        <Icon size={18} />
      </span>
      <button
        type="button"
        className="exp-main"
        aria-haspopup="dialog"
        disabled={x.id.startsWith("new-")}
        onClick={() => onOpen(x)}
      >
        <span className="exp-title">{x.title}</span>
        <span className="exp-sub">
          <Avatars owner={x.paidBy} />
          Paid by {x.paidBy === me ? "you" : name(x.paidBy)} · {split}
        </span>
      </button>
      <span className="exp-amt">
        <b>{formatMoney(x.cents)}</b>
        <span>Your share {formatMoney(shareOf(x, me))}</span>
      </span>
    </li>
  );
}
