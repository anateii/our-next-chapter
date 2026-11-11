import { Handshake } from "lucide-react";
import InfoTip from "../InfoTip";
import { usePeople } from "../../helpers/people";
import { balance, formatMoney, type Finances, type Partner } from "../../helpers/finances";

// Summary: who owes whom from shared expenses. Settle up records a payment back, all or part of it.
export default function BalanceCard({
  data,
  me,
  onSettleUp,
}: Readonly<{ data: Finances; me: Partner; onSettleUp: () => void }>) {
  const { name, partner } = usePeople();
  const other: Partner = me === "owner" ? "partner" : "owner";
  const owed = balance(data); // > 0: the partner owes the owner
  const iOwe = (me === "owner" ? -owed : owed) > 0;

  let status: React.ReactNode = "You're all square";
  if (owed !== 0 && iOwe)
    status = (
      <>
        You owe <b>{name(other)}</b>
      </>
    );
  else if (owed !== 0)
    status = (
      <>
        <b>{name(other)}</b> owes you
      </>
    );

  return (
    <article className="card fin-sum fin-balance">
      <div className="fin-label-row">
        <span className="fin-label">Between You</span>
        <InfoTip label="Between You">
          Keeps track of who owes whom from your shared expenses. When one of you pays the other
          back, tap Settle up and enter the amount, all of it or just part.
        </InfoTip>
      </div>
      <span className="fin-big">{formatMoney(Math.abs(owed))}</span>
      <div className="fin-balance-row">
        <p className="fin-line">{status}</p>
        {owed !== 0 && partner && (
          <button type="button" className="btn-ghost" onClick={onSettleUp}>
            <Handshake aria-hidden="true" size={16} /> Settle up
          </button>
        )}
      </div>
    </article>
  );
}
