import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { useBanke } from "@/lib/banke";
import { decimalFromCents, formatMoney } from "@/lib/utils";
import { BankPay } from "@/components/bank-pay";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shell } from "@/components/shell";

export const Route = createFileRoute("/wallet")({ component: WalletPage });

function WalletPage() {
  const balanceCents = useBanke((s) => s.balanceCents);
  const transfers = useBanke((s) => s.transfers);
  const [amount, setAmount] = useState("50.00");
  const [showSlip, setShowSlip] = useState(false);

  const parsed = Number(amount);
  const valid = Number.isFinite(parsed) && parsed >= 1 && parsed <= 10000;
  const topups = useMemo(
    () => transfers.filter((row) => row.kind === "topup"),
    [transfers],
  );

  function onStart(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setShowSlip(true);
  }

  return (
    <Shell>
      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
          Wallet
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight">Balance</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          PayPal buys in the moment. Banké tops up this ledger. Once Inbox
          confirms the virement, the balance is ready for a direct purchase.
        </p>

        <div className="mt-8 rounded-xl bg-surface p-6 shadow-[var(--shadow-border)]">
          <p className="text-xs uppercase tracking-[0.14em] text-muted">
            Available
          </p>
          <p className="mt-2 font-display text-4xl tabular-nums">
            {formatMoney(decimalFromCents(balanceCents))}
          </p>
        </div>

        <form
          onSubmit={onStart}
          className="mt-8 space-y-4 rounded-xl bg-surface p-6 shadow-[var(--shadow-border)]"
        >
          <h2 className="font-display text-2xl">Top up by Banké</h2>
          <div className="space-y-1.5">
            <Label htmlFor="topup-amount">Amount</Label>
            <Input
              id="topup-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setShowSlip(false);
              }}
            />
          </div>
          {!showSlip ? (
            <Button type="submit" disabled={!valid} className="h-12 w-full">
              Generate transfer slip
            </Button>
          ) : null}
        </form>

        {showSlip && valid ? (
          <div className="mt-6 rounded-xl bg-surface p-6 shadow-[var(--shadow-border)]">
            <BankPay
              kind="topup"
              amount={parsed.toFixed(2)}
              submitLabel="I’ve sent the transfer"
              onSubmitted={() => setShowSlip(false)}
            />
          </div>
        ) : null}

        <div className="mt-10">
          <h2 className="font-display text-2xl">Movements</h2>
          {topups.length === 0 ? (
            <p className="mt-3 text-sm text-muted">No Banké slips yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {topups.map((row) => (
                <li
                  key={row.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-surface px-4 py-3 shadow-[var(--shadow-border)]"
                >
                  <div className="min-w-0">
                    <p className="font-mono text-sm">{row.reference}</p>
                    <p className="text-sm text-muted">{row.bankName}</p>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums text-sm">
                      {formatMoney(row.amount)}
                    </p>
                    <Badge
                      variant={
                        row.status === "credited"
                          ? "success"
                          : row.status === "rejected"
                            ? "danger"
                            : "sandbox"
                      }
                    >
                      {row.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </Shell>
  );
}
