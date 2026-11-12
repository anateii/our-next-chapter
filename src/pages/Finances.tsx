import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Plus } from "lucide-react";
import type { Goal, Person } from "../types";
import type { ApiMember } from "../helpers/goals";
import {
  balance,
  monthKey,
  paidIn,
  shiftMonthKey,
  type Expense,
  type Finances as FinanceData,
  type Fund,
  type Partner,
} from "../helpers/finances";
import ExpenseDialog from "../components/finances/ExpenseDialog";
import SavingsDialog from "../components/finances/SavingsDialog";
import FundDialog from "../components/finances/FundDialog";
import BudgetDialog from "../components/finances/BudgetDialog";
import SettleDialog from "../components/finances/SettleDialog";
import { useFinanceActions, type Api, type Notify } from "../components/finances/useFinanceActions";
import SpendingCard from "../components/finances/SpendingCard";
import BalanceCard from "../components/finances/BalanceCard";
import SavingsFunds from "../components/finances/SavingsFunds";
import SharedBudget from "../components/finances/SharedBudget";
import SharedExpenses from "../components/finances/SharedExpenses";
import MonthNav from "../components/finances/MonthNav";
import { smoothly } from "../helpers/motion";
import "./Finances.css";

// The Finances page: lays out the cards (components/finances/) and owns what
// they share: the month on screen and the dialogs. Saving lives in useFinanceActions.
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
  const me: Partner = viewer === "partner" ? "partner" : "owner";

  // The month the spending card, the budget and the expense list show.
  const [month, setMonth] = useState(() => monthKey(new Date()));
  const actions = useFinanceActions({ data, setData, api, notify, members, showMonth: setMonth });

  // Dialogs. Fill one for its item first, so showModal() focuses fresh fields.
  const expenseRef = useRef<HTMLDialogElement>(null);
  const savingsRef = useRef<HTMLDialogElement>(null);
  const fundRef = useRef<HTMLDialogElement>(null);
  const budgetRef = useRef<HTMLDialogElement>(null);
  const settleRef = useRef<HTMLDialogElement>(null);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [editingFund, setEditingFund] = useState<Fund | null>(null);
  const [savingsFund, setSavingsFund] = useState<string | null>(null);
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
  const openSettle = () => settleRef.current?.showModal();

  const editingFundSaved = editingFund
    ? data.contributions.filter((c) => c.fundId === editingFund.id).reduce((s, c) => s + c.cents, 0)
    : 0;

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
          <button type="button" className="btn-primary" onClick={() => openExpense(null)}>
            <Plus aria-hidden="true" size={18} strokeWidth={2.4} /> Add expense
          </button>
        </div>
      </header>

      <MonthNav
        month={month}
        onShift={(n) => smoothly(() => setMonth((m) => shiftMonthKey(m, n)))}
      />

      <section className="fin-summary" aria-label="Summary">
        <SpendingCard data={data} month={month} onSetBudget={openBudget} />
        <BalanceCard data={data} me={me} onSettleUp={openSettle} />
      </section>

      {/* Budget and expenses side by side; the expense list scrolls to match the budget's height */}
      <div className="fin-two">
        <SharedBudget
          data={data}
          month={month}
          onEdit={openBudget}
        />
        <SharedExpenses
          data={data}
          month={month}
          me={me}
          onOpen={openExpense}
          onRemoveSettlement={actions.deleteSettlement}
        />
      </div>

      <SavingsFunds
        data={data}
        goals={goals}
        onNewFund={() => openFund(null)}
        onEditFund={openFund}
        onAddMoney={openSavings}
      />

      <ExpenseDialog
        ref={expenseRef}
        expense={editingExpense}
        me={me}
        incomeSplit={data.incomeSplit}
        onSave={actions.saveExpense}
        onDelete={actions.deleteExpense}
      />
      <SavingsDialog
        ref={savingsRef}
        funds={data.funds}
        fundId={savingsFund}
        me={me}
        onSave={actions.addSavings}
        onNewFund={() => openFund(null)}
      />
      <FundDialog
        ref={fundRef}
        fund={editingFund}
        saved={editingFundSaved}
        paidThisMonth={editingFund ? paidIn(editingFund.id, monthKey(new Date()), data.contributions) : 0}
        goals={goals}
        onSave={actions.saveFund}
        onDelete={actions.deleteFund}
      />
      <SettleDialog ref={settleRef} owed={balance(data)} onSave={actions.settleUp} />
      <BudgetDialog
        ref={budgetRef}
        key={data.incomeSplit}
        budgets={data.budgets}
        incomeSplit={data.incomeSplit}
        onSave={actions.saveBudget}
      />
    </>
  );
}
