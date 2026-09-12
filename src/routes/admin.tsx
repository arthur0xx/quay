import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { useBanke, formatRib } from "@/lib/banke";
import { useCart, type Receipt } from "@/lib/cart";
import { formatMoney } from "@/lib/utils";
import { CustomerCard } from "@/components/customer-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shell } from "@/components/shell";

export const Route = createFileRoute("/admin")({ component: AdminPage });

function AdminPage() {
  const banks = useBanke((s) => s.banks);
  const transfers = useBanke((s) => s.transfers);
  const addBank = useBanke((s) => s.addBank);
  const removeBank = useBanke((s) => s.removeBank);
  const credit = useBanke((s) => s.credit);
  const reject = useBanke((s) => s.reject);
  const capture = useCart((s) => s.capture);
  const [tab, setTab] = useState<"inbox" | "banks">("inbox");
  const [form, setForm] = useState({
    holderName: "",
    bankName: "",
    rib: "",
  });

  const pending = useMemo(
    () => transfers.filter((row) => row.status === "sent"),
    [transfers],
  );

  function onAdd(event: FormEvent) {
    event.preventDefault();
    const rib = form.rib.replace(/\s+/g, "");
    if (rib.length < 10) {
      toast.error("RIB looks too short.");
      return;
    }
    addBank({
      holderName: form.holderName,
      bankName: form.bankName,
      rib,
    });
    setForm({ holderName: "", bankName: "", rib: "" });
    toast.success("Bank saved. New transfers will mint a fresh reference.");
  }

  function onCredit(id: string) {
    const next = credit(id);
    if (!next) return;
    if (next.kind === "order" && next.items?.length) {
      const receipt: Receipt = {
        id: next.reference,
        mode: "banke",
        status: "COMPLETED",
        total: next.amount,
        currency: "USD",
        items: next.items,
        at: new Date().toISOString(),
      };
      capture(receipt);
    }
    toast.success(
      next.kind === "topup"
        ? "Balance credited."
        : "Order marked paid from Banké.",
    );
  }

  return (
    <Shell>
      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
          Desk
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight">Admin</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Add the RIB buyers should pay. Inbox is the same slip they see —
          confirm after you find the virement on your statement.
        </p>

        <div className="mt-8 flex gap-2">
          <Button
            type="button"
            variant={tab === "inbox" ? "default" : "outline"}
            onClick={() => setTab("inbox")}
          >
            Inbox{pending.length ? ` (${pending.length})` : ""}
          </Button>
          <Button
            type="button"
            variant={tab === "banks" ? "default" : "outline"}
            onClick={() => setTab("banks")}
          >
            Banks
          </Button>
        </div>

        {tab === "inbox" ? (
          <div className="mt-8 space-y-3">
            {transfers.length === 0 ? (
              <p className="text-sm text-muted">
                No slips yet. A checkout or wallet top-up will land here.
              </p>
            ) : (
              transfers.map((row) => (
                <article
                  key={row.id}
                  className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm">{row.reference}</p>
                      <p className="mt-1 text-sm text-muted">
                        {row.kind === "topup" ? "Wallet top-up" : "Direct order"}{" "}
                        · {row.bankName}
                      </p>
                    </div>
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
                  <p className="mt-4 font-medium tabular-nums">
                    {formatMoney(row.amount)}
                  </p>
                  <p className="mt-3 text-xs uppercase tracking-[0.14em] text-muted">
                    Pay to
                  </p>
                  <p className="mt-1 text-sm">{row.holderName}</p>
                  <p className="font-mono text-xs text-muted">
                    {formatRib(row.rib)}
                  </p>
                  <div className="mt-4">
                    <p className="mb-2 text-xs uppercase tracking-[0.14em] text-muted">
                      Payer
                    </p>
                    <CustomerCard
                      fullName={row.payerName ?? ""}
                      rib={row.payerRib ?? ""}
                    />
                  </div>
                  {row.proofImage ? (
                    <img
                      src={row.proofImage}
                      alt={`Screenshot for ${row.reference}`}
                      className="mt-4 max-h-56 w-full rounded-md object-cover"
                    />
                  ) : null}
                  {row.items?.length ? (
                    <ul className="mt-3 space-y-1 text-sm text-muted">
                      {row.items.map((item) => (
                        <li key={item.sku}>
                          {item.name} × {item.quantity}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {row.status === "sent" ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Button type="button" onClick={() => onCredit(row.id)}>
                        Confirm in my account
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          reject(row.id);
                          toast("Marked rejected.");
                        }}
                      >
                        Reject
                      </Button>
                    </div>
                  ) : null}
                </article>
              ))
            )}
          </div>
        ) : (
          <div className="mt-8 space-y-6">
            <form
              onSubmit={onAdd}
              className="space-y-4 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]"
            >
              <h2 className="font-display text-2xl">New bank</h2>
              <p className="text-sm text-muted">
                Choosing this bank at checkout mints a fresh reference at that
                moment. Put your legal name and RIB exactly as they appear on
                the statement.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="holder">Full name</Label>
                <Input
                  id="holder"
                  required
                  value={form.holderName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, holderName: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bank-name">Bank</Label>
                <Input
                  id="bank-name"
                  required
                  placeholder="Attijariwafa, CIH, BMCE…"
                  value={form.bankName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, bankName: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rib">RIB</Label>
                <Input
                  id="rib"
                  required
                  className="font-mono"
                  value={form.rib}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, rib: e.target.value }))
                  }
                />
              </div>
              <Button type="submit" className="h-12 w-full">
                Save bank
              </Button>
            </form>

            <ul className="space-y-2">
              {banks.map((bank) => (
                <li
                  key={bank.id}
                  className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]"
                >
                  <p className="font-medium">{bank.holderName}</p>
                  <p className="text-sm text-muted">{bank.bankName}</p>
                  <p className="mt-2 font-mono text-sm">{formatRib(bank.rib)}</p>
                  <Button
                    type="button"
                    variant="ghost"
                    className="mt-3"
                    onClick={() => removeBank(bank.id)}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </Shell>
  );
}
