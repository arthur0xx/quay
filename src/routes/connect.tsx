import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  clearPayPalSession,
  getPayPalConfig,
  probePayPalConnection,
  savePayPalSession,
} from "@/lib/paypal/functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  CARD_REJECTION_TRIGGER,
  SANDBOX_BUYER_EMAIL,
  SANDBOX_MERCHANT_EMAIL,
  SANDBOX_TEST_CARDS,
} from "@/lib/paypal/sandbox";
import { Shell } from "@/components/shell";

export const Route = createFileRoute("/connect")({ component: ConnectPage });

type Config = Awaited<ReturnType<typeof getPayPalConfig>>;

function ConnectPage() {
  const [config, setConfig] = useState<Config | null>(null);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [busy, setBusy] = useState(false);
  const [probe, setProbe] = useState<string | null>(null);

  useEffect(() => {
    getPayPalConfig().then((next) => {
      setConfig(next);
      if (next.clientId) setClientId(next.clientId);
    });
  }, []);

  async function onSave(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setProbe(null);
    try {
      const next = await savePayPalSession({
        data: { clientId: clientId.trim(), clientSecret: clientSecret.trim() },
      });
      setConfig(next);
      setClientSecret("");
      const result = await probePayPalConnection();
      setConfig(result.config);
      if (result.ok) {
        setProbe("Sandbox token issued. Orders and invoices will hit PayPal REST.");
        toast.success("Sandbox connected.");
      } else {
        setProbe(result.error);
        toast.error("PayPal rejected the credentials.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  async function onClear() {
    setBusy(true);
    try {
      setConfig(await clearPayPalSession());
      setProbe(null);
      toast("Session credentials cleared. Nothing was written to disk.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted">
          PayPal Business
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight">Connect sandbox</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          Live money is locked. Quay will refuse{" "}
          <span className="font-mono text-xs">PAYPAL_ENVIRONMENT=LIVE</span> until
          you explicitly confirm production.
        </p>

        <div className="mt-8 grid gap-3 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)] sm:grid-cols-2 sm:p-6">
          <Stat label="Environment" value={config?.environment ?? "SANDBOX"} />
          <Stat
            label="Status"
            value={
              config?.connected
                ? "Ready to capture"
                : config?.hasClientId
                  ? "Client ID only"
                  : "Not connected"
            }
          />
          <Stat label="API" value="api-m.sandbox.paypal.com" />
          <Stat
            label="Source"
            value={config?.source === "none" ? "—" : config?.source ?? "—"}
          />
        </div>

        <form
          onSubmit={onSave}
          className="mt-8 space-y-4 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)] sm:p-6"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-2xl">This session</h2>
            {config?.connected ? (
              <Badge variant="success">Ready</Badge>
            ) : config?.hasClientId ? (
              <Badge variant="sandbox">Needs secret</Badge>
            ) : (
              <Badge>Missing</Badge>
            )}
          </div>
          <p className="text-sm text-muted">
            The REST Secret sits next to the Client ID on Apps & Credentials
            — it is not the sandbox email password. Session values stay in
            memory for this preview process.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="client-id">Client ID</Label>
            <Input
              id="client-id"
              required
              autoComplete="off"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder="Sandbox Client ID"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="client-secret">Secret</Label>
            <Input
              id="client-secret"
              type="password"
              required
              autoComplete="off"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder="Sandbox Secret"
            />
          </div>
          {probe ? (
            <p className="text-sm text-muted">{probe}</p>
          ) : null}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" disabled={busy} className="sm:flex-1">
              {busy ? "Checking…" : "Save and probe"}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onClear}
            >
              Clear session
            </Button>
          </div>
        </form>

        <article className="mt-8 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)] sm:p-6">
          <h2 className="font-display text-2xl">Sandbox merchant</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            App <span className="text-fg">Default</span> is the seller. Use this
            login on developer.paypal.com and sandbox.paypal.com — not in the
            PayPal checkout window.
          </p>
          <p className="mt-4 font-mono text-sm text-fg">
            {SANDBOX_MERCHANT_EMAIL}
          </p>
        </article>

        <article className="mt-8 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)] sm:p-6">
          <h2 className="font-display text-2xl">Sandbox buyer</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            When the gold PayPal button opens a window, sign in with this
            personal account. It has a sandbox card and a $5,000 test balance.
            It cannot replace the REST Secret.
          </p>
          <p className="mt-4 font-mono text-sm text-fg">
            {SANDBOX_BUYER_EMAIL}
          </p>
        </article>

        <article className="mt-8 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)] sm:p-6">
          <h2 className="font-display text-2xl">Test cards</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Use these only on sandbox card fields. Future expiry, any 3-digit
            CVV (4 for Amex). To force a card decline, set the name on card to{" "}
            <span className="font-mono text-xs text-fg">
              {CARD_REJECTION_TRIGGER}
            </span>
            .
          </p>
          <ul className="mt-4 space-y-2 text-sm">
            {SANDBOX_TEST_CARDS.map((card) => (
              <li
                key={card.number}
                className="flex flex-wrap justify-between gap-2"
              >
                <span>{card.brand}</span>
                <span className="font-mono text-xs">{card.number}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="mt-8 rounded-xl bg-surface p-5 shadow-[var(--shadow-border)] sm:p-6">
          <h2 className="font-display text-2xl">What Quay skipped</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Complete Payments Platform multiparty (partner fees, seller
            onboarding, DropZone, Venmo) is for marketplaces. Quay is a
            first-party merchant, so those stay off. Live money stays locked.
          </p>
        </article>

        <article className="mt-10 space-y-4">
          <h2 className="font-display text-2xl">Get credentials</h2>
          <ol className="list-decimal space-y-2 pl-5 text-sm leading-relaxed text-muted">
            <li>
              Open{" "}
              <a
                className="text-fg underline decoration-border underline-offset-4"
                href="https://developer.paypal.com/dashboard/applications/sandbox"
                target="_blank"
                rel="noreferrer"
              >
                developer.paypal.com
              </a>{" "}
              and sign in.
            </li>
            <li>Apps & Credentials → Sandbox (not Live).</li>
            <li>Create App, type Merchant. Copy Client ID and Secret.</li>
            <li>Optional: Testing Tools → Sandbox Accounts for a personal buyer.</li>
          </ol>
          <p className="text-sm text-muted">
            Quay fetches an access token itself. If you need one by hand for MCP:
          </p>
          <pre className="overflow-x-auto rounded-lg bg-fg px-4 py-3 font-mono text-xs leading-relaxed text-bg">
{`curl -X POST "https://api-m.sandbox.paypal.com/v1/oauth2/token" \\
  -u "$PAYPAL_CLIENT_ID:$PAYPAL_CLIENT_SECRET" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=client_credentials"`}
          </pre>
        </article>

        <article className="mt-10 space-y-3">
          <h2 className="font-display text-2xl">MCP / agent tools</h2>
          <p className="text-sm text-muted">
            Config lives in <span className="font-mono text-xs">mcp.json</span>.
            Local process:
          </p>
          <pre className="overflow-x-auto rounded-lg bg-fg px-4 py-3 font-mono text-xs leading-relaxed text-bg">
{`npx -y @paypal/mcp --tools=all
PAYPAL_ENVIRONMENT=SANDBOX
PAYPAL_ACCESS_TOKEN=YOUR_PAYPAL_ACCESS_TOKEN`}
          </pre>
          <p className="text-sm text-muted">Remote fallback (sandbox):</p>
          <p className="font-mono text-xs text-fg">
            https://mcp.sandbox.paypal.com/sse
          </p>
          <p className="text-sm text-muted">
            Live MCP stays unused until you confirm production.
          </p>
        </article>
      </section>
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}
