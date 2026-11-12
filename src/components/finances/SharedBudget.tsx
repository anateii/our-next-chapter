import { useState } from "react";
import { ChartPie, ChevronLeft, ChevronRight, List, SlidersHorizontal } from "lucide-react";
import InfoTip from "../InfoTip";
import BudgetPie from "./BudgetPie";
import { smoothly } from "../../helpers/motion";
import {
  budgetTotalOf,
  categories,
  expensesIn,
  formatWhole,
  monthKey,
  monthTitle,
  pct,
  totalOf,
  type Finances,
} from "../../helpers/finances";

// The shared budget panel, for the month on screen: each category's spending
// against its limit (list), or the month's spending split by category (pie).
// Its arrows change the month for the whole page.
export default function SharedBudget({
  data,
  month,
  onShiftMonth,
  onEdit,
}: Readonly<{
  data: Finances;
  month: string;
  onShiftMonth: (n: number) => void;
  onEdit: () => void;
}>) {
  const monthExpenses = expensesIn(data, month);
  const isThisMonth = month === monthKey(new Date());
  const [view, setView] = useState<"list" | "pie">("list");

  return (
    <section className="card fin-panel" aria-labelledby="budget-title">
      <div className="fin-panel-head">
        <div className="fin-title">
          <h2 id="budget-title">Shared Budget</h2>
          <InfoTip label="Shared Budget">
            Your monthly spending limits by category, and what's left in each. Tap Edit to adjust them
            or change how you split costs.
          </InfoTip>
        </div>
        <div className="fin-head-actions">
          <fieldset className="view-toggle" aria-label="Budget view">
            <legend className="sr-only">Budget view</legend>
            <button
              type="button"
              className="icon-btn"
              aria-label="List view"
              aria-pressed={view === "list"}
              onClick={() => smoothly(() => setView("list"))}
            >
              <List aria-hidden="true" size={18} />
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Pie chart view"
              aria-pressed={view === "pie"}
              onClick={() => smoothly(() => setView("pie"))}
            >
              <ChartPie aria-hidden="true" size={18} />
            </button>
          </fieldset>
          <button type="button" className="btn-ghost" onClick={onEdit}>
            <SlidersHorizontal aria-hidden="true" size={16} /> Edit
          </button>
        </div>
      </div>
      <div className="fin-month">
        <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => onShiftMonth(-1)}>
          <ChevronLeft aria-hidden="true" size={18} />
        </button>
        <span aria-live="polite">{monthTitle(month)}</span>
        <button
          type="button"
          className="icon-btn"
          aria-label="Next month"
          disabled={isThisMonth}
          onClick={() => onShiftMonth(1)}
        >
          <ChevronRight aria-hidden="true" size={18} />
        </button>
      </div>
      {view === "pie" ? (
        <BudgetPie expenses={monthExpenses} budgetTotal={budgetTotalOf(data)} monthName={monthTitle(month)} />
      ) : (
      <ul className="cats">
        {categories.map((c) => {
          const spent = totalOf(monthExpenses.filter((x) => x.category === c.key));
          const budget = data.budgets[c.key] ?? 0;
          const over = budget > 0 && spent > budget;
          let status = "No budget";
          if (budget > 0) status = over ? `${formatWhole(spent - budget)} over` : `${formatWhole(budget - spent)} left`;
          const Icon = c.icon;
          return (
            <li key={c.key}>
              <span className={`cat-icon cat-${c.key}`} aria-hidden="true">
                <Icon size={18} />
              </span>
              <div className="cat-main">
                <span className="cat-name">
                  {c.label}
                  <span>
                    {formatWhole(spent)}
                    {budget > 0 && ` / ${formatWhole(budget)}`}
                  </span>
                </span>
                <progress
                  className={`fin-bar${over ? " over" : ""}`}
                  data-cat={c.key}
                  aria-label={`${c.label} budget used`}
                  value={pct(spent, budget)}
                  max={100}
                />
              </div>
              <span className={`cat-left${over ? " over" : ""}`}>{status}</span>
            </li>
          );
        })}
      </ul>
      )}
    </section>
  );
}
