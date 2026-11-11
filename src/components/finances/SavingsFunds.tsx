import { Heart, Plus } from "lucide-react";
import type { Goal } from "../../types";
import { usePeople } from "../../helpers/people";
import { formatWhole, paceText, pct, savedIn, type Finances, type Fund } from "../../helpers/finances";
import GoalMenu from "../GoalMenu";
import InfoTip from "../InfoTip";

// The savings funds panel (full width): the total of all funds, then each fund with who put in what.
export default function SavingsFunds({
  data,
  goals,
  onNewFund,
  onEditFund,
  onAddMoney,
}: Readonly<{
  data: Finances;
  goals: readonly Goal[];
  onNewFund: () => void;
  onEditFund: (f: Fund) => void;
  onAddMoney: (fundId: string) => void;
}>) {
  return (
    <section className="card fin-panel fin-funds" aria-labelledby="funds-title">
      <div className="fin-panel-head">
        <div className="fin-title">
          <h2 id="funds-title">Savings Funds</h2>
          <InfoTip label="Savings Funds">
            Your savings pots, each with its own goal. Add money and the bar shows who's put in what.
          </InfoTip>
        </div>
        <button type="button" className="btn-ghost" onClick={onNewFund}>
          <Plus aria-hidden="true" size={16} /> New fund
        </button>
      </div>
      {data.funds.length === 0 ? (
        <p className="empty">No funds yet. Start one for the flat, a trip, or a rainy day.</p>
      ) : (
        <>
          <SavedTogether data={data} />
          {/* Full width: the funds sit in columns, as many as fit */}
          <div className="funds">
            {data.funds.map((f) => (
              <FundCard
                key={f.id}
                fund={f}
                data={data}
                goal={goals.find((g) => g.id === f.goalId)}
                onEdit={() => onEditFund(f)}
                onAddMoney={() => onAddMoney(f.id)}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

// Saved together: all funds in one figure, the bar split by fund.
function SavedTogether({ data }: Readonly<{ data: Finances }>) {
  const saved = data.contributions.reduce((s, c) => s + c.cents, 0);
  const target = data.funds.reduce((s, f) => s + f.targetCents, 0);
  // Each fund's share of the total; colours repeat after six funds.
  const totals = data.funds.map((f, i) => {
    const by = savedIn(f.id, data.contributions);
    return { id: f.id, name: f.name, cents: by.owner + by.partner, color: (i % 6) + 1 };
  });

  return (
    <div className="fin-total">
      <div className="fin-total-head">
        <div className="fin-label-row">
          <span className="fin-label">Saved Together</span>
          <InfoTip label="Saved Together">
            All your savings in one place, and how far you've come toward your goals together.
          </InfoTip>
        </div>
        <span className="fin-line">
          <b>{Math.round(pct(saved, target))}%</b> of the way
        </span>
      </div>
      <span className="fin-big">
        {formatWhole(saved)}
        {target > 0 && <small> of {formatWhole(target)}</small>}
      </span>
      <div
        className="fin-bar fin-total-bar"
        role="img"
        aria-label={`Saved ${formatWhole(saved)} of ${formatWhole(target)}: ${totals
          .map((t) => `${t.name} ${formatWhole(t.cents)}`)
          .join(", ")}`}
      >
        {totals.map((t) => (
          <i key={t.id} className={`fund-c${t.color}`} style={{ width: `${pct(Math.max(0, t.cents), target)}%` }} />
        ))}
      </div>
      <div className="fund-legend">
        {totals.map((t) => (
          <span key={t.id}>
            <i className={`fund-c${t.color}`} />
            {t.name} {formatWhole(t.cents)}
          </span>
        ))}
      </div>
    </div>
  );
}

// One fund: name and goal (opens Edit), progress, and the split between you.
function FundCard({
  fund: f,
  data,
  goal,
  onEdit,
  onAddMoney,
}: Readonly<{ fund: Fund; data: Finances; goal?: Goal; onEdit: () => void; onAddMoney: () => void }>) {
  const { name, partner } = usePeople();
  const by = savedIn(f.id, data.contributions);
  const total = by.owner + by.partner;
  const partnerPart = partner ? `, ${name("partner")} ${formatWhole(by.partner)}` : "";

  return (
    <article className="fund">
      <div className="fund-top">
        <button type="button" className="fund-name" aria-haspopup="dialog" onClick={onEdit}>
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
        <GoalMenu
          label={`More options for ${f.name}`}
          actions={[
            { label: "Add money", onSelect: onAddMoney },
            { label: "Edit fund", onSelect: onEdit },
          ]}
        />
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
        aria-label={`${f.name}: ${name("owner")} ${formatWhole(by.owner)}${partnerPart}, ${Math.round(pct(total, f.targetCents))}% of the target`}
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
}
