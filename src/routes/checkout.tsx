import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useBanke } from "@/lib/banke";
import { cartQuote, useCart, type Receipt } from "@/lib/cart";
import { refundPayPalCapture } from "@/lib/paypal/functions";
import { cn, decimalFromCents, formatMoney } from "@/lib/utils";
import { BankPay } from "@/components/bank-pay";
import { Button } from "@/components/ui/button";
import { PayPalCheckout } from "@/components/paypal-checkout";
import { Shell } from "@/components/shell";

export const Route = createFileRoute("/checkout")({ component: Checkout });

type Rail = "wallet" | "paypal" | "banke";

function Checkout() {
  const lines = useCart((s) => s.lines);
  const receipt = useCart((s) => s.receipt);
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const setReceipt = useCart((s) => s.setReceipt);
  const markRefunded = useCart((s) => s.markRefunded);
  const capture = useCart((s) => s.capture);
  const quote = cartQuote(lines);
  const balanceCents = useBanke((s) => s.balanceCents);
  const spend = useBanke((s) => s.spend);
  const [refunding, setRefunding] = useState(false);
  const [rail, setRail] = useState<Rail>("paypal");

  const canWallet = balanceCents >= Math.round(Number(quote.total) * 100);

  async function onRefund() {
    if (!receipt?.captureId) {
      toast.error("This receipt has no PayPal capture to refund.");
      return;
    }
    setRefunding(true);
    try {
      const result = await refundPayPalCapture({
        data: {
          captureId: receipt.captureId,
          amount: receipt.total,
          currency: receipt.currency,
        },
      });
      markRefunded(result.refundId, result.status);
      toast.success("Sandbox refund submitted.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Refund failed");
    } finally {
      setRefunding(false);
    }
  }

  function payWithWallet() {
    if (!spend(quote.total)) {
      toast.error("Not enough balance.");
      return;
    }
    const next: Receipt = {
      id: `WALLET-${Date.now().toString(36).toUpperCase()}`,
      mode: "wallet",
      status: "COMPLETED",
      total: quote.total,
      currency: "USD",
      items: quote.items.map((item) => ({
        sku: item.sku,
        name: item.name,
        quantity: item.quantity,
        unitAmount: item.unitAmount,
      })),
      at: new Date().toISOString(),
    };
    capture(next);
    toast.success("Paid from balance.");
  }

  const modeLabel =
    receipt?.mode === "paypal"
      ? "PayPal sandbox"
      : receipt?.mode === "wallet"
        ? "Balance"
        : receipt?.mode === "banke"
          ? "Banké"
          : "Rehearsal";

  return (
    <Shell>
      <section
        className={cn(
          "mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6",
          !receipt && quote.items.length > 0
            ? "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]"
            : "max-w-3xl",
        )}
      >
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
            Checkout
          </p>
          <h1 className="mt-3 font-display text-4xl tracking-tight">The dock</h1>
          <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
            PayPal is instant. Banké is a virement: name, RIB, reference, then
            your payer card and a screenshot.
          </p>

          {receipt ? (
            <div className="mt-8 rounded-xl bg-surface p-6 shadow-[var(--shadow-border)]">
              <p className="text-xs uppercase tracking-[0.16em] text-success">
                {modeLabel} · {receipt.status}
              </p>
              <h2 className="mt-2 font-display text-2xl">
                {receipt.refundId ? "Refunded" : "Captured"}
              </h2>
              <p className="mt-1 font-mono text-xs text-muted">{receipt.id}</p>
              {receipt.captureId ? (
                <p className="mt-1 font-mono text-xs text-muted">
                  Capture {receipt.captureId}
                </p>
              ) : null}
              {receipt.refundId ? (
                <p className="mt-1 font-mono text-xs text-muted">
                  Refund {receipt.refundId}
                </p>
              ) : null}
              <ul className="mt-5 space-y-2 text-sm">
                {receipt.items.map((item) => (
                  <li key={item.sku} className="flex justify-between gap-4">
                    <span>
                      {item.name} × {item.quantity}
                    </span>
                    <span className="tabular-nums">
                      {formatMoney(Number(item.unitAmount) * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex justify-between border-t border-border pt-4 font-medium">
                <span>Total</span>
                <span className="tabular-nums">{formatMoney(receipt.total)}</span>
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button asChild>
                  <Link to="/">Back to shop</Link>
                </Button>
                {receipt.captureId && !receipt.refundId ? (
                  <Button
                    variant="outline"
                    disabled={refunding}
                    onClick={onRefund}
                  >
                    {refunding ? "Refunding…" : "Refund in sandbox"}
                  </Button>
                ) : null}
                <Button variant="outline" onClick={() => setReceipt(null)}>
                  Dismiss
                </Button>
              </div>
            </div>
          ) : quote.items.length === 0 ? (
            <div className="mt-8 rounded-xl bg-surface p-6 shadow-[var(--shadow-border)]">
              <h2 className="font-display text-2xl">Cart is empty</h2>
              <p className="mt-2 text-sm text-muted">
                Add a piece from the shop, then pay with PayPal, Banké, or
                balance.
              </p>
              <Button className="mt-5" asChild>
                <Link to="/">Browse the catalog</Link>
              </Button>
            </div>
          ) : (
            <ul className="mt-8 space-y-3">
              {quote.items.map((item) => (
                <li
                  key={item.sku}
                  className="flex gap-4 rounded-xl bg-surface p-3 shadow-[var(--shadow-border)]"
                >
                  <img
                    src={item.image}
                    alt={item.alt}
                    className="size-20 rounded-md object-cover sm:size-24"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm tabular-nums text-muted">
                          {formatMoney(item.unitAmount)}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-sm text-muted hover:text-fg"
                        onClick={() => remove(item.sku)}
                      >
                        Remove
                      </button>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        className="inline-flex size-11 items-center justify-center rounded-md shadow-[var(--shadow-border)]"
                        onClick={() => setQty(item.sku, item.quantity - 1)}
                        aria-label={`Decrease ${item.name}`}
                      >
                        −
                      </button>
                      <span className="w-8 text-center tabular-nums text-sm">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        className="inline-flex size-11 items-center justify-center rounded-md shadow-[var(--shadow-border)]"
                        onClick={() => setQty(item.sku, item.quantity + 1)}
                        aria-label={`Increase ${item.name}`}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {!receipt && quote.items.length > 0 ? (
          <aside className="h-fit rounded-xl bg-surface p-6 shadow-[var(--shadow-border)]">
            <h2 className="font-display text-2xl">Pay</h2>
            <p className="mt-4 flex justify-between text-sm">
              <span className="text-muted">Items</span>
              <span className="tabular-nums">{quote.items.length}</span>
            </p>
            <p className="mt-2 flex justify-between font-medium">
              <span>Total</span>
              <span className="tabular-nums">{formatMoney(quote.total)}</span>
            </p>
            <p className="mt-2 flex justify-between text-sm text-muted">
              <span>Balance</span>
              <span className="tabular-nums">
                {formatMoney(decimalFromCents(balanceCents))}
              </span>
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {(
                [
                  ["paypal", "PayPal"],
                  ["banke", "Banké"],
                  ["wallet", "Balance"],
                ] as const
              ).map(([id, label]) => (
                <Button
                  key={id}
                  type="button"
                  size="sm"
                  variant={rail === id ? "default" : "outline"}
                  onClick={() => setRail(id)}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="mt-6">
              {rail === "paypal" ? (
                <PayPalCheckout />
              ) : rail === "wallet" ? (
                <div className="space-y-3">
                  <p className="text-sm text-muted">
                    Instant debit from the credited Banké balance.
                  </p>
                  <Button
                    className="h-12 w-full"
                    disabled={!canWallet}
                    onClick={payWithWallet}
                  >
                    {canWallet
                      ? `Pay ${formatMoney(quote.total)} from balance`
                      : "Top up the wallet first"}
                  </Button>
                </div>
              ) : (
                <BankPay
                  kind="order"
                  amount={quote.total}
                  items={quote.items.map((item) => ({
                    sku: item.sku,
                    name: item.name,
                    quantity: item.quantity,
                    unitAmount: item.unitAmount,
                  }))}
                  submitLabel="I’ve sent the transfer"
                  onSubmitted={() => {
                    useCart.getState().clear();
                    toast("Waiting on Inbox confirmation.");
                  }}
                />
              )}
            </div>
          </aside>
        ) : null}
      </section>
    </Shell>
  );
}
