import InfoTip from "../InfoTip";
import {
  budgetTotalOf,
  expensesIn,
  formatWhole,
  monthKey,
  monthShort,
  pct,
  totalOf,
  type Finances,
} from "../../helpers/finances";

// Summary: shared spending in the month on screen, against the monthly budget.
export default function SpendingCard({
  data,
  month,
  onSetBudget,
}: Readonly<{ data: Finances; month: string; onSetBudget: () => void }>) {
  const spent = totalOf(expensesIn(data, month));
  const budgetTotal = budgetTotalOf(data);
  const now = new Date();
  const isThisMonth = month === monthKey(now);
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();

  let status: React.ReactNode;
  if (budgetTotal === 0)
    status = (
      <button type="button" className="link-btn" onClick={onSetBudget}>
        Set a monthly budget
      </button>
    );
  else if (spent <= budgetTotal)
    status = (
      <>
        <b>{formatWhole(budgetTotal - spent)}</b> left
        {isThisMonth ? ` · ${daysLeft} days to go` : ""}
      </>
    );
  else
    status = (
      <>
        <b>{formatWhole(spent - budgetTotal)}</b> over budget
      </>
    );

  return (
    <article className="card fin-sum">
      <div className="fin-label-row">
        <span className="fin-label">Shared Spending · {monthShort(month)}</span>
        <InfoTip label="Shared Spending">
          Your shared spending this month and how much budget is left. Check other months with the
          month arrows at the top of the page.
        </InfoTip>
      </div>
      <span className="fin-big">
        {formatWhole(spent)}
        {budgetTotal > 0 && <small> of {formatWhole(budgetTotal)}</small>}
      </span>
      <progress
        className={`fin-bar${budgetTotal > 0 && spent > budgetTotal ? " over" : ""}`}
        aria-label="Budget used"
        value={Math.round(pct(spent, budgetTotal))}
        max={100}
      />
      <p className="fin-line">{status}</p>
    </article>
  );
}
