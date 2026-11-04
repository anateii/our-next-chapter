import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ChevronLeft, ChevronRight, Handshake, Heart, PiggyBank, Plus, SlidersHorizontal } from "lucide-react";
import type { Goal, Person } from "../types";
import { toUserId, type ApiMember } from "../helpers/goals";
import { usePeople } from "../helpers/people";
import {
  balance,
  categories,
  categoryOf,
  formatMoney,
  formatWhole,
  fromApiFinances,
  ownerShareFor,
  paceText,
  savedIn,
  shareOf,
  type ApiFinances,
  type Category,
  type Expense,
  type Finances as FinanceData,
  type Fund,
  type Partner,
} from "../helpers/finances";
import Avatars from "../components/Avatars";
import InfoTip from "../components/InfoTip";
import ScrollFade from "../components/ScrollFade";
import {
  BudgetDialog,
  ExpenseDialog,
  FundDialog,
  SavingsDialog,
  type ExpenseFields,
  type FundFields,
} from "../components/FinanceDialogs";
import "./Finances.css";

type Api = <T>(path: string, init?: RequestInit) => Promise<T>;
type Notify = (t: { message: string; ok: boolean; undo?: () => void }) => void;

const monthName = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const dayName = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });
const monthOf = (day: string) => day.slice(0, 7); // "YYYY-MM"
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
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
const pct = (part: number, whole: number) => (whole ? Math.min(100, (part / whole) * 100) : 0);

export default function Finances({
  data,
  setData,
  api,
  notify,
  me: viewer,
  members,
  goals,
}: Readonly<{
  data: FinanceData;
  setData: React.Dispatch<React.SetStateAction<FinanceData>>;
  api: Api;
  notify: Notify;
  me: Person;
  members: readonly ApiMember[];
  goals: readonly Goal[];
}>) {
  const { name, partner } = usePeople();
  const me: Partner = viewer === "partner" ? "partner" : "owner";
  const other: Partner = me === "owner" ? "partner" : "owner";
  const userId = (p: Partner) => toUserId(p, members);

  const now = new Date();
  const [month, setMonth] = useState(() => monthKey(now));
  const isThisMonth = month === monthKey(now);
  const [paidFilter, setPaidFilter] = useState<"all" | Partner>("all");
  const [catFilter, setCatFilter] = useState<"all" | Category>("all");

  // Dialogs
  const expenseRef = useRef<HTMLDialogElement>(null);
  const savingsRef = useRef<HTMLDialogElement>(null);
  const fundRef = useRef<HTMLDialogElement>(null);
  const budgetRef = useRef<HTMLDialogElement>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingFund, setEditingFund] = useState<Fund | null>(null);
  const [savingsFund, setSavingsFund] = useState<string | null>(null);
  // Fill a dialog for this item first, so showModal() focuses fresh fields.
  const openExpense = (x: Expense | null) => {
    flushSync(() => setEditingExpense(x));
    expenseRef.current?.showModal();
  };
  const openSavings = (fundId: string | null) => {
    flushSync(() => setSavingsFund(fundId));
    savingsRef.current?.showModal();
  };
  const openFund = (f: Fund | null) => {
    flushSync(() => setEditingFund(f));
    fundRef.current?.showModal();
  };
  const openBudget = () => budgetRef.current?.showModal();

  // Saves and replaces the whole data set with what the server has after a write.
  const reload = () =>
    api<ApiFinances>("/finances")
      .then((f) => setData(fromApiFinances(f, members)))
      .catch((err) => console.warn("Reloading finances failed:", err));
  const failed = (what: string) => (err: unknown) => {
    console.error(`${what} failed:`, err);
    notify({ message: `Couldn't ${what.toLowerCase()}. Try again.`, ok: false });
    void reload();
  };
  // A write that shows at once and is put right from the server afterwards.
  const write = (path: string, method: string, body?: unknown) =>
    api(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

  /* Expenses */
  const saveExpense = (f: ExpenseFields, id?: string) => {
    const ownerShare = ownerShareFor(f.split, data.incomeSplit);
    const body = { ...f, paidBy: userId(f.paidBy) };
    if (id) {
      setData((d) => ({ ...d, expenses: d.expenses.map((x) => (x.id === id ? { ...x, ...f, ownerShare } : x)) }));
      write("/finances", "PATCH", { type: "expense", id, ...body }).then(reload, failed("Save the expense"));
      notify({ message: "Saved", ok: true });
      return;
    }
    const temp: Expense = { id: `new-${crypto.randomUUID()}`, ...f, ownerShare };
    setData((d) => ({ ...d, expenses: [...d.expenses, temp] }));
    setMonth(monthOf(f.day));
    write("/finances", "POST", { type: "expense", ...body }).then(reload, failed("Add the expense"));
    notify({ message: `Added ${formatMoney(f.cents)} for ${f.title}`, ok: true });
  };
  const deleteExpense = (id: string) => {
    const x = data.expenses.find((e) => e.id === id);
    if (!x) return;
    setData((d) => ({ ...d, expenses: d.expenses.filter((e) => e.id !== id) }));
    write(`/finances?type=expense&id=${encodeURIComponent(id)}`, "DELETE").then(reload, failed("Delete the expense"));
    notify({
      message: `Deleted “${x.title}”`,
      ok: true,
      // Undo adds it back (as a new expense with the same details).
      undo: () => saveExpense({ title: x.title, cents: x.cents, day: x.day, category: x.category, paidBy: x.paidBy, split: x.split }),
    });
  };

  /* Savings */
  const addSavings = (fundId: string, cents: number, who: Partner) => {
    const fund = data.funds.find((f) => f.id === fundId);
    const temp = { id: `new-${crypto.randomUUID()}`, fundId, who, cents, at: new Date().toISOString() };
    setData((d) => ({ ...d, contributions: [...d.contributions, temp] }));
    const saved = write("/finances", "POST", { type: "contribution", fundId, cents, userId: userId(who) })
      .then((res) => {
        void reload();
        return (res as { contribution: { id: string } }).contribution.id;
      })
      .catch((err) => {
        failed("Add to savings")(err);
        return null;
      });
    notify({
      message: `${formatWhole(cents)} added to ${fund?.name ?? "the fund"}`,
      ok: true,
      undo: () => {
        setData((d) => ({ ...d, contributions: d.contributions.filter((c) => c.id !== temp.id) }));
        void saved.then((realId) => {
          if (realId)
            write(`/finances?type=contribution&id=${encodeURIComponent(realId)}`, "DELETE").then(reload, failed("Undo"));
        });
      },
    });
  };
  const saveFund = (f: FundFields, id?: string) => {
    if (id) {
      setData((d) => ({
        ...d,
        funds: d.funds.map((x) => (x.id === id ? { ...x, ...f, goalId: f.goalId ?? undefined } : x)),
      }));
      write("/finances", "PATCH", { type: "fund", id, ...f }).then(reload, failed("Save the fund"));
      notify({ message: "Fund saved", ok: true });
      return;
    }
    const temp: Fund = { id: `new-${crypto.randomUUID()}`, ...f, goalId: f.goalId ?? undefined };
    setData((d) => ({ ...d, funds: [...d.funds, temp] }));
    write("/finances", "POST", { type: "fund", ...f }).then(reload, failed("Create the fund"));
    notify({ message: `Started “${f.name}”`, ok: true });
  };
  const deleteFund = (id: string) => {
    const fund = data.funds.find((f) => f.id === id);
    setData((d) => ({
      ...d,
      funds: d.funds.filter((f) => f.id !== id),
      contributions: d.contributions.filter((c) => c.fundId !== id),
    }));
    write(`/finances?type=fund&id=${encodeURIComponent(id)}`, "DELETE").then(reload, failed("Delete the fund"));
    notify({ message: `Deleted “${fund?.name ?? "fund"}”`, ok: true });
  };

  /* Settling up */
  const owed = balance(data); // > 0: the partner owes the owner
  const settleUp = () => {
    const from: Partner = owed > 0 ? "partner" : "owner";
    const to: Partner = from === "owner" ? "partner" : "owner";
    const cents = Math.abs(owed);
    const temp = { id: `new-${crypto.randomUUID()}`, from, to, cents, at: new Date().toISOString() };
    setData((d) => ({ ...d, settlements: [...d.settlements, temp] }));
    setMonth(monthKey(new Date()));
    const saved = write("/finances", "POST", {
      type: "settlement",
      fromUserId: userId(from),
      toUserId: userId(to),
      cents,
    })
      .then((res) => {
        void reload();
        return (res as { settlement: { id: string } }).settlement.id;
      })
      .catch((err) => {
        failed("Settle up")(err);
        return null;
      });
    notify({
      message: `Settled up: ${name(from)} paid ${name(to)} ${formatMoney(cents)}`,
      ok: true,
      undo: () => {
        setData((d) => ({ ...d, settlements: d.settlements.filter((s) => s.id !== temp.id) }));
        void saved.then((realId) => {
          if (realId)
            write(`/finances?type=settlement&id=${encodeURIComponent(realId)}`, "DELETE").then(reload, failed("Undo"));
        });
      },
    });
  };

  const saveBudget = (budgets: Record<Category, number>, incomeSplit: number) => {
    setData((d) => ({ ...d, budgets, incomeSplit }));
    write("/finances", "PATCH", { type: "settings", budgets, incomeSplit }).then(reload, failed("Save the budget"));
    notify({ message: "Budget saved", ok: true });
  };

  /* Figures for the month on screen */
  const monthExpenses = data.expenses.filter((x) => monthOf(x.day) === month);
  const spent = monthExpenses.reduce((s, x) => s + x.cents, 0);
  const budgetTotal = categories.reduce((s, c) => s + (data.budgets[c.key] ?? 0), 0);
  const saved = data.contributions.reduce((s, c) => s + c.cents, 0);
  const target = data.funds.reduce((s, f) => s + f.targetCents, 0);
  const daysLeft = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate() - now.getDate();
  const iOwe = (me === "owner" ? -owed : owed) > 0;

  const shiftMonth = (n: number) => {
    const [y, m] = month.split("-").map(Number);
    setMonth(monthKey(new Date(y, m - 1 + n, 1)));
  };
  const [my, mm] = month.split("-").map(Number);
  const monthLabel = monthName.format(new Date(my, mm - 1, 1));

  // The list: this month's expenses and settle-ups, newest first, grouped by day.
  type Row = { kind: "expense"; day: string; x: Expense } | { kind: "settle"; day: string; s: FinanceData["settlements"][number] };
  const rows: Row[] = [
    ...monthExpenses
      .filter((x) => (paidFilter === "all" || x.paidBy === paidFilter) && (catFilter === "all" || x.category === catFilter))
      .map((x) => ({ kind: "expense" as const, day: x.day, x })),
    ...(catFilter === "all"
      ? data.settlements
          .map((s) => ({ s, day: s.at.slice(0, 10) }))
          .filter(({ s, day }) => monthOf(day) === month && (paidFilter === "all" || s.from === paidFilter))
          .map(({ s, day }) => ({ kind: "settle" as const, day, s }))
      : []),
  ].sort((a, b) => b.day.localeCompare(a.day));
  const groups = new Map<string, Row[]>();
  for (const r of rows) groups.set(r.day, [...(groups.get(r.day) ?? []), r]);

  const editingFundSaved = editingFund ? data.contributions.filter((c) => c.fundId === editingFund.id).reduce((s, c) => s + c.cents, 0) : 0;

  return (
    <>
      <header className="page-head">
        <div>
          <h1 id="page-title" tabIndex={-1}>
            Finances
          </h1>
          <p>Saving and spending, together.</p>
        </div>
        <div className="fin-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => openSavings(null)}
          >
            <PiggyBank aria-hidden="true" size={18} /> Add to savings
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => openExpense(null)}
          >
            <Plus aria-hidden="true" size={18} strokeWidth={2.4} /> Add expense
          </button>
        </div>
      </header>

      <section className="fin-summary" aria-label="Summary">
        <article className="card fin-sum">
          <div className="fin-label-row">
            <span className="fin-label">Saved together</span>
            <InfoTip label="Saved together">
              All your savings in one place, and how far you've come toward your goals together.
            </InfoTip>
          </div>
          <span className="fin-big">
            {formatWhole(saved)}
            {target > 0 && <small> of {formatWhole(target)}</small>}
          </span>
          <div
            className="fin-bar"
            role="progressbar"
            aria-label="Saved toward all funds"
            aria-valuenow={Math.round(pct(saved, target))}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <i className="fill" style={{ width: `${pct(saved, target)}%` }} />
          </div>
          <p className="fin-line">
            {data.funds.length ? (
              <>
                Across {data.funds.length} {data.funds.length === 1 ? "fund" : "funds"} ·{" "}
                <b>{Math.round(pct(saved, target))}%</b> of the way
              </>
            ) : (
              "Start a fund to save toward a goal."
            )}
          </p>
        </article>

        <article className="card fin-sum">
          <div className="fin-label-row">
            <span className="fin-label">Shared spending · {monthLabel.split(" ")[0]}</span>
            <InfoTip label="Shared spending">
              Your shared spending this month and how much budget is left. Check other months with
              the arrows in Shared budget.
            </InfoTip>
          </div>
          <span className="fin-big">
            {formatWhole(spent)}
            {budgetTotal > 0 && <small> of {formatWhole(budgetTotal)}</small>}
          </span>
          <div
            className="fin-bar"
            role="progressbar"
            aria-label="Budget used"
            aria-valuenow={Math.round(pct(spent, budgetTotal))}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <i className={spent > budgetTotal && budgetTotal ? "over" : "fill"} style={{ width: `${pct(spent, budgetTotal)}%` }} />
          </div>
          <p className="fin-line">
            {budgetTotal === 0 ? (
              <button type="button" className="link-btn" onClick={() => openBudget()}>
                Set a monthly budget
              </button>
            ) : spent <= budgetTotal ? (
              <>
                <b>{formatWhole(budgetTotal - spent)}</b> left{isThisMonth ? ` · ${daysLeft} days to go` : ""}
              </>
            ) : (
              <>
                <b>{formatWhole(spent - budgetTotal)}</b> over budget
              </>
            )}
          </p>
        </article>

        <article className="card fin-sum fin-balance">
          <div className="fin-label-row">
            <span className="fin-label">Between you</span>
            <InfoTip label="Between you">
              Keeps track of who owes whom from your shared expenses. When you've paid each other
              back, tap Settle up to reset it to €0.
            </InfoTip>
          </div>
          <span className="fin-big">{formatMoney(Math.abs(owed))}</span>
          <div className="fin-balance-row">
            <p className="fin-line">
              {owed === 0 ? (
                "You're all square"
              ) : iOwe ? (
                <>
                  You owe <b>{name(other)}</b>
                </>
              ) : (
                <>
                  <b>{name(other)}</b> owes you
                </>
              )}
            </p>
            {owed !== 0 && partner && (
              <button type="button" className="btn-ghost" onClick={settleUp}>
                <Handshake aria-hidden="true" size={16} /> Settle up
              </button>
            )}
          </div>
        </article>
      </section>

      <div className="fin-two">
        <section className="card fin-panel" aria-labelledby="funds-title">
          <div className="fin-panel-head">
            <div className="fin-title">
              <h2 id="funds-title">Savings funds</h2>
              <InfoTip label="Savings funds">
                Your savings pots, each with its own goal. Add money and the bar shows who's put in
                what.
              </InfoTip>
            </div>
            <button type="button" className="btn-ghost" onClick={() => openFund(null)}>
              <Plus aria-hidden="true" size={16} /> New fund
            </button>
          </div>
          {data.funds.length === 0 ? (
            <p className="empty">No funds yet. Start one for the flat, a trip, or a rainy day.</p>
          ) : (
            // More than 3 funds: the rest scroll inside the card.
            <ScrollFade className="funds" visible={3} label="Savings funds">
              {data.funds.map((f) => {
                const by = savedIn(f.id, data.contributions);
                const total = by.owner + by.partner;
                const goal = goals.find((g) => g.id === f.goalId);
                return (
                  <article className="fund" key={f.id}>
                    <div className="fund-top">
                      <button
                        type="button"
                        className="fund-name"
                        aria-haspopup="dialog"
                        onClick={() => openFund(f)}
                      >
                        <h3>{f.name}</h3>
                        <span className="fund-meta">
                          {goal && (
                            <span className="chip-goal">
                              <Heart aria-hidden="true" size={12} /> {goal.title}
                            </span>
                          )}
                          {f.monthlyCents > 0 && <span>{formatWhole(f.monthlyCents)} a month</span>}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="btn-ghost"
                        aria-label={`Add money to ${f.name}`}
                        onClick={() => openSavings(f.id)}
                      >
                        <Plus aria-hidden="true" size={16} /> Add
                      </button>
                    </div>
                    <div className="fund-nums">
                      <span>
                        <b>{formatWhole(total)}</b> of {formatWhole(f.targetCents)}
                      </span>
                      <span className={`pace${total >= f.targetCents ? " done" : ""}`}>
                        {paceText(f.targetCents - total, f.monthlyCents)}
                      </span>
                    </div>
                    <div
                      className="fin-bar split-bar"
                      role="img"
                      aria-label={`${f.name}: ${name("owner")} ${formatWhole(by.owner)}${partner ? `, ${name("partner")} ${formatWhole(by.partner)}` : ""}, ${Math.round(pct(total, f.targetCents))}% of the target`}
                    >
                      <i className="owner" style={{ width: `${pct(Math.max(0, by.owner), f.targetCents)}%` }} />
                      <i className="partner" style={{ width: `${pct(Math.max(0, by.partner), f.targetCents)}%` }} />
                    </div>
                    <div className="fund-legend">
                      <span>
                        <i className="owner" />
                        {name("owner")} {formatWhole(by.owner)}
                      </span>
                      {partner && (
                        <span>
                          <i className="partner" />
                          {name("partner")} {formatWhole(by.partner)}
                        </span>
                      )}
                    </div>
                  </article>
                );
              })}
            </ScrollFade>
          )}
        </section>

        <section className="card fin-panel" aria-labelledby="budget-title">
          <div className="fin-panel-head">
            <div className="fin-title">
              <h2 id="budget-title">Shared budget</h2>
              <InfoTip label="Shared budget">
                Your monthly spending limits by category, and what's left in each. Tap Edit to adjust
                them or change how you split costs.
              </InfoTip>
            </div>
            <button type="button" className="btn-ghost" onClick={() => openBudget()}>
              <SlidersHorizontal aria-hidden="true" size={16} /> Edit
            </button>
          </div>
          <div className="fin-month">
            <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
              <ChevronLeft aria-hidden="true" size={18} />
            </button>
            <span aria-live="polite">{monthLabel}</span>
            <button
              type="button"
              className="icon-btn"
              aria-label="Next month"
              disabled={isThisMonth}
              onClick={() => shiftMonth(1)}
            >
              <ChevronRight aria-hidden="true" size={18} />
            </button>
          </div>
          <ul className="cats">
            {categories.map((c) => {
              const spentHere = monthExpenses.filter((x) => x.category === c.key).reduce((s, x) => s + x.cents, 0);
              const budget = data.budgets[c.key] ?? 0;
              const over = budget > 0 && spentHere > budget;
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
                        {formatWhole(spentHere)}
                        {budget > 0 && ` / ${formatWhole(budget)}`}
                      </span>
                    </span>
                    <div
                      className="fin-bar"
                      role="progressbar"
                      aria-label={`${c.label} budget used`}
                      aria-valuenow={Math.round(pct(spentHere, budget))}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <i className={over ? "over" : "fill"} style={{ width: `${budget ? pct(spentHere, budget) : 0}%` }} />
                    </div>
                  </div>
                  <span className={`cat-left${over ? " over" : ""}`}>
                    {budget === 0 ? "No budget" : over ? `${formatWhole(spentHere - budget)} over` : `${formatWhole(budget - spentHere)} left`}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section className="card fin-panel" aria-labelledby="exp-title">
        <div className="fin-panel-head">
          <div className="fin-title">
            <h2 id="exp-title">Shared expenses</h2>
            <InfoTip label="Shared expenses">
              Everything you've paid for together this month: who paid, how it's split, and your
              share. Tap an expense to edit or delete it.
            </InfoTip>
          </div>
          <span className="fin-sub">
            {monthExpenses.length} in {monthLabel.split(" ")[0]}
          </span>
        </div>
        <div className="fin-filters">
          <div className="segmented" aria-label="Paid by">
            {(
              [
                ["all", "Everyone"],
                [me, "Paid by you"],
                ...(partner ? [[other, `Paid by ${name(other)}`]] : []),
              ] as [string, string][]
            ).map(([k, l]) => (
              <button
                key={k}
                type="button"
                aria-pressed={paidFilter === k}
                className={paidFilter === k ? "active" : ""}
                onClick={() => setPaidFilter(k as "all" | Partner)}
              >
                {k !== "all" && <Avatars owner={k as Partner} />}
                {l}
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
            {monthExpenses.length ? "Nothing matches these filters." : `No shared expenses in ${monthLabel}.`}
          </div>
        ) : (
          [...groups].map(([day, list]) => (
            <div key={day}>
              <h3 className="fin-day">{relDay(day)}</h3>
              <ul className="exps">
                {list.map((r) => {
                  if (r.kind === "settle") {
                    return (
                      <li key={r.s.id} className="exp settle">
                        <span className="cat-icon cat-food" aria-hidden="true">
                          <Handshake size={18} />
                        </span>
                        <div className="exp-main">
                          <span className="exp-title">
                            {name(r.s.from)} paid {name(r.s.to)} back
                          </span>
                          <span className="exp-sub">Settled up</span>
                        </div>
                        <span className="exp-amt">
                          <b>{formatMoney(r.s.cents)}</b>
                        </span>
                      </li>
                    );
                  }
                  return <ExpenseRow key={r.x.id} expense={r.x} me={me} onOpen={openExpense} />;
                })}
              </ul>
            </div>
          ))
        )}
      </section>

      <ExpenseDialog
        ref={expenseRef}
        expense={editingExpense}
        me={me}
        incomeSplit={data.incomeSplit}
        onSave={saveExpense}
        onDelete={deleteExpense}
      />
      <SavingsDialog
        ref={savingsRef}
        funds={data.funds}
        fundId={savingsFund}
        me={me}
        onSave={addSavings}
        onNewFund={() => openFund(null)}
      />
      <FundDialog
        ref={fundRef}
        fund={editingFund}
        saved={editingFundSaved}
        goals={goals}
        onSave={saveFund}
        onDelete={deleteFund}
      />
      <BudgetDialog
        ref={budgetRef}
        key={data.incomeSplit}
        budgets={data.budgets}
        incomeSplit={data.incomeSplit}
        onSave={saveBudget}
      />
    </>
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
