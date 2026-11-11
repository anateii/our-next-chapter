import { toUserId, type ApiMember } from "../../helpers/goals";
import { usePeople } from "../../helpers/people";
import {
  balance,
  formatMoney,
  formatWhole,
  fromApiFinances,
  monthKey,
  monthOf,
  ownerShareFor,
  type ApiFinances,
  type Category,
  type Expense,
  type Finances,
  type Fund,
  type Partner,
} from "../../helpers/finances";
import type { ExpenseFields } from "./ExpenseDialog";
import type { FundFields } from "./FundDialog";

export type Api = <T>(path: string, init?: RequestInit) => Promise<T>;
export type Notify = (t: { message: string; ok: boolean; undo?: () => void }) => void;

// Every change on the Finances page: shown at once, saved in the background,
// then replaced with what the server has. A failed save says so and reloads.
export function useFinanceActions({
  data,
  setData,
  api,
  notify,
  members,
  showMonth,
}: Readonly<{
  data: Finances;
  setData: React.Dispatch<React.SetStateAction<Finances>>;
  api: Api;
  notify: Notify;
  members: readonly ApiMember[];
  showMonth: (month: string) => void; // move the page to the month a change belongs to
}>) {
  const { name } = usePeople();
  const userId = (p: Partner) => toUserId(p, members);

  const reload = () =>
    api<ApiFinances>("/finances")
      .then((f) => setData(fromApiFinances(f, members)))
      .catch((err) => console.warn("Reloading finances failed:", err));
  const failed = (what: string) => (err: unknown) => {
    console.error(`${what} failed:`, err);
    notify({ message: `Couldn't ${what.toLowerCase()}. Try again.`, ok: false });
    void reload();
  };
  const write = (path: string, method: string, body?: unknown) =>
    api(path, { method, body: body === undefined ? undefined : JSON.stringify(body) });

  /* Expenses */
  const saveExpense = (f: ExpenseFields, id?: string) => {
    const ownerShare = ownerShareFor(f.split, data.incomeSplit);
    const body = { ...f, paidBy: userId(f.paidBy) };
    if (id) {
      setData((d) => ({
        ...d,
        expenses: d.expenses.map((x) => (x.id === id ? { ...x, ...f, ownerShare } : x)),
      }));
      write("/finances", "PATCH", { type: "expense", id, ...body }).then(reload, failed("Save the expense"));
      notify({ message: "Saved", ok: true });
      return;
    }
    const temp: Expense = { id: `new-${crypto.randomUUID()}`, ...f, ownerShare };
    setData((d) => ({ ...d, expenses: [...d.expenses, temp] }));
    showMonth(monthOf(f.day));
    write("/finances", "POST", { type: "expense", ...body }).then(reload, failed("Add the expense"));
    notify({ message: `Added ${formatMoney(f.cents)} for ${f.title}`, ok: true });
  };
  const deleteExpense = (id: string) => {
    const x = data.expenses.find((e) => e.id === id);
    if (!x) return;
    setData((d) => ({ ...d, expenses: d.expenses.filter((e) => e.id !== id) }));
    write(`/finances?type=expense&id=${encodeURIComponent(id)}`, "DELETE").then(
      reload,
      failed("Delete the expense"),
    );
    notify({
      message: `Deleted “${x.title}”`,
      ok: true,
      // Undo adds it back (as a new expense with the same details).
      undo: () =>
        saveExpense({
          title: x.title,
          cents: x.cents,
          day: x.day,
          category: x.category,
          paidBy: x.paidBy,
          split: x.split,
        }),
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
        void saved
          .then((realId) =>
            realId ? write(`/finances?type=contribution&id=${encodeURIComponent(realId)}`, "DELETE") : null,
          )
          .then((result) => {
            if (result !== null) return reload();
          }, failed("Undo"));
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

  /* Settling up: record a payment that brings the balance back to €0 */
  // `amount`: part of what's owed (a partial payment); left out, all of it.
  const settleUp = (amount?: number) => {
    const owed = balance(data); // > 0: the partner owes the owner
    const from: Partner = owed > 0 ? "partner" : "owner";
    const to: Partner = from === "owner" ? "partner" : "owner";
    // Never more than what's owed: that would turn the debt the other way.
    const cents = Math.min(amount ?? Math.abs(owed), Math.abs(owed));
    if (cents <= 0) return;
    const left = Math.abs(owed) - cents;
    const temp = { id: `new-${crypto.randomUUID()}`, from, to, cents, at: new Date().toISOString() };
    setData((d) => ({ ...d, settlements: [...d.settlements, temp] }));
    showMonth(monthKey(new Date()));
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
      message:
        left > 0
          ? `${name(from)} paid ${name(to)} back ${formatMoney(cents)} · ${formatMoney(left)} left`
          : `Settled up: ${name(from)} paid ${name(to)} ${formatMoney(cents)}`,
      ok: true,
      undo: () => {
        setData((d) => ({ ...d, settlements: d.settlements.filter((s) => s.id !== temp.id) }));
        void saved.then(async (realId) => {
          if (!realId) return;
          try {
            await write(`/finances?type=settlement&id=${encodeURIComponent(realId)}`, "DELETE");
            await reload();
          } catch (err) {
            failed("Undo")(err);
          }
        });
      },
    });
  };

  // Remove a settle-up pressed by mistake: the balance goes back to what it was.
  // Undo puts it back with its original date.
  const deleteSettlement = (id: string) => {
    const s = data.settlements.find((x) => x.id === id);
    if (!s) return;
    setData((d) => ({ ...d, settlements: d.settlements.filter((x) => x.id !== id) }));
    write(`/finances?type=settlement&id=${encodeURIComponent(id)}`, "DELETE").then(
      reload,
      failed("Remove the settle-up"),
    );
    notify({
      message: `Removed the settle-up of ${formatMoney(s.cents)}`,
      ok: true,
      undo: () => {
        setData((d) => ({ ...d, settlements: [...d.settlements, { ...s, id: `new-${crypto.randomUUID()}` }] }));
        write("/finances", "POST", {
          type: "settlement",
          fromUserId: userId(s.from),
          toUserId: userId(s.to),
          cents: s.cents,
          at: s.at,
        }).then(reload, failed("Undo"));
      },
    });
  };

  /* Budget and how costs are split */
  const saveBudget = (budgets: Record<Category, number>, incomeSplit: number) => {
    setData((d) => ({ ...d, budgets, incomeSplit }));
    write("/finances", "PATCH", { type: "settings", budgets, incomeSplit }).then(reload, failed("Save the budget"));
    notify({ message: "Budget saved", ok: true });
  };

  return { saveExpense, deleteExpense, addSavings, saveFund, deleteFund, settleUp, deleteSettlement, saveBudget };
}
