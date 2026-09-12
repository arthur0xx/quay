import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  createPayPalInvoice,
  getPayPalConfig,
  sendPayPalInvoice,
} from "@/lib/paypal/functions";
import { useInvoiceBook, type LocalInvoice } from "@/lib/invoice-book";
import { formatMoney } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Shell } from "@/components/shell";

export const Route = createFileRoute("/invoices")({ component: InvoicesPage });

function InvoicesPage() {
  const invoices = useInvoiceBook((s) => s.invoices);
  const add = useInvoiceBook((s) => s.add);
  const patch = useInvoiceBook((s) => s.patch);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    recipientName: "",
    recipientEmail: "",
    description: "",
    amount: "150.00",
    note: "Net 15. Thank you.",
  });

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const config = await getPayPalConfig();
      const local: LocalInvoice = {
        id: crypto.randomUUID(),
        status: "DRAFT",
        recipientEmail: form.recipientEmail.trim(),
        recipientName: form.recipientName.trim(),
        description: form.description.trim(),
        amount: Number(form.amount).toFixed(2),
        currency: "USD",
        note: form.note.trim() || undefined,
        createdAt: new Date().toISOString(),
        mode: config.connected ? "paypal" : "demo",
      };

      if (config.connected) {
        const created = await createPayPalInvoice({
          data: {
            recipientEmail: local.recipientEmail,
            recipientName: local.recipientName,
            description: local.description,
            amount: local.amount,
            note: local.note,
          },
        });
        local.paypalId = created.invoiceId;
        local.href = created.href;
        local.status = "DRAFT";
        add(local);
        toast.success("Draft invoice created in PayPal sandbox.");
      } else {
        add(local);
        toast("Draft stored locally. Connect PayPal to send a real sandbox invoice.");
      }
      setForm((prev) => ({ ...prev, description: "", amount: "150.00" }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create invoice");
    } finally {
      setBusy(false);
    }
  }

  async function onSend(invoice: LocalInvoice) {
    setBusy(true);
    try {
      if (invoice.mode === "paypal" && invoice.paypalId) {
        await sendPayPalInvoice({ data: { invoiceId: invoice.paypalId } });
        patch(invoice.id, { status: "SENT" });
        toast.success("Invoice sent through PayPal sandbox.");
      } else {
        patch(invoice.id, { status: "DEMO_SENT" });
        toast("Rehearsal send. Connect credentials to email a sandbox customer.");
      }
    } catch (error) {
      patch(invoice.id, { status: "FAILED" });
      toast.error(error instanceof Error ? error.message : "Send failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <section className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
            Invoicing API v2
          </p>
          <h1 className="mt-3 font-display text-4xl tracking-tight">
            Send the bill
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Drafts call{" "}
            <span className="font-mono text-xs">POST /v2/invoicing/invoices</span>
            . Send calls{" "}
            <span className="font-mono text-xs">/invoices/{"{id}"}/send</span>.
            Without credentials, the desk keeps a local rehearsal copy.
          </p>

          <form
            onSubmit={onCreate}
            className="mt-8 space-y-4 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)] sm:p-6"
          >
            <div className="space-y-1.5">
              <Label htmlFor="name">Client name</Label>
              <Input
                id="name"
                required
                value={form.recipientName}
                onChange={(e) => set("recipientName", e.target.value)}
                placeholder="Amira Benali"
                autoComplete="name"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email">Client email</Label>
              <Input
                id="email"
                type="email"
                required
                value={form.recipientEmail}
                onChange={(e) => set("recipientEmail", e.target.value)}
                placeholder="amira@studio.example"
                autoComplete="email"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="desc">Work</Label>
              <Input
                id="desc"
                required
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="Brand system, two weeks"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amount">Amount (USD)</Label>
              <Input
                id="amount"
                inputMode="decimal"
                required
                value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note">Note</Label>
              <Textarea
                id="note"
                value={form.note}
                onChange={(e) => set("note", e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Saving…" : "Create draft"}
            </Button>
          </form>
        </div>

        <div>
          <h2 className="font-display text-2xl">Ledger</h2>
          {invoices.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              No invoices yet. Draft one for a client — sandbox first.
            </p>
          ) : (
            <ul className="mt-5 space-y-3">
              {invoices.map((invoice) => (
                <li
                  key={invoice.id}
                  className="rounded-xl bg-surface p-5 shadow-[var(--shadow-border)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{invoice.recipientName}</p>
                      <p className="text-sm text-muted">{invoice.recipientEmail}</p>
                    </div>
                    <StatusBadge status={invoice.status} />
                  </div>
                  <p className="mt-3 text-sm">{invoice.description}</p>
                  <p className="mt-1 font-display text-xl tabular-nums">
                    {formatMoney(invoice.amount)}
                  </p>
                  {invoice.paypalId ? (
                    <p className="mt-1 font-mono text-xs text-muted">
                      {invoice.paypalId}
                    </p>
                  ) : null}
                  {invoice.status === "DRAFT" ? (
                    <Button
                      size="sm"
                      className="mt-4"
                      disabled={busy}
                      onClick={() => onSend(invoice)}
                    >
                      Send
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </Shell>
  );
}

function StatusBadge({ status }: { status: LocalInvoice["status"] }) {
  if (status === "SENT") return <Badge variant="success">Sent</Badge>;
  if (status === "DEMO_SENT") return <Badge variant="muted">Rehearsal sent</Badge>;
  if (status === "FAILED") return <Badge variant="danger">Failed</Badge>;
  return <Badge variant="muted">Draft</Badge>;
}
