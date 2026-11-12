import { useState } from "react";
import { ChartPie, List, SlidersHorizontal } from "lucide-react";
import InfoTip from "../InfoTip";
import BudgetPie from "./BudgetPie";
import { smoothly } from "../../helpers/motion";
import {
  budgetTotalOf,
  categories,
  expensesIn,
  formatWhole,
  monthTitle,
  pct,
  totalOf,
  type Finances,
} from "../../helpers/finances";

// The shared budget panel, for the month on screen: each category's spending
// against its limit (list), or the month's spending split by category (pie).
// The month comes from the page's month switcher (MonthNav).
export default function SharedBudget({
  data,
  month,
  onEdit,
}: Readonly<{
  data: Finances;
  month: string;
  onEdit: () => void;
}>) {
  const monthExpenses = expensesIn(data, month);
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
