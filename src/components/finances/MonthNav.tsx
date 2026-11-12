import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthKey, monthTitle } from "../../helpers/finances";

// The page's month switcher, like the Calendar's: it sets the month for
// Shared Spending, Shared Budget and Shared Expenses. No months after this one.
export default function MonthNav({
  month,
  onShift,
}: Readonly<{ month: string; onShift: (n: number) => void }>) {
  const isThisMonth = month === monthKey(new Date());
  return (
    <div className="fin-toolbar">
      <div className="fin-nav">
        <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => onShift(-1)}>
          <ChevronLeft aria-hidden="true" size={20} />
        </button>
        <h2 className="fin-month-title" aria-live="polite">
          {monthTitle(month)}
        </h2>
        <button
          type="button"
          className="icon-btn"
          aria-label="Next month"
          disabled={isThisMonth}
          onClick={() => onShift(1)}
        >
          <ChevronRight aria-hidden="true" size={20} />
        </button>
      </div>
    </div>
  );
}
