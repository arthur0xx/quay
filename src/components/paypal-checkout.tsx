import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  capturePayPalOrder,
  createPayPalOrder,
  getPayPalConfig,
} from "@/lib/paypal/functions";
import { SANDBOX_BUYER_EMAIL } from "@/lib/paypal/sandbox";
import { cartQuote, useCart, type Receipt } from "@/lib/cart";
import { Button } from "@/components/ui/button";

type EligibleMethods = {
  isEligible: (method: string) => boolean;
};

type PaymentSession = {
  start: (
    options: { presentationMode: "auto" | "popup" | "modal" | "payment-handler" },
    orderPromise: Promise<{ orderId: string }>,
  ) => Promise<void>;
};

type SessionFactory = (opts: {
  onApprove: (data: { orderId: string }) => Promise<void> | void;
  onCancel?: () => void;
  onError?: (err: unknown) => void;
}) => PaymentSession | Promise<PaymentSession>;

type SdkInstance = {
  findEligibleMethods: (opts?: { currencyCode?: string }) => Promise<EligibleMethods>;
  createPayPalOneTimePaymentSession: SessionFactory;
  createPayLaterOneTimePaymentSession?: SessionFactory;
  createPayPalGuestOneTimePaymentSession?: SessionFactory;
};

type PaypalV6 = {
  createInstance: (opts: {
    clientId: string;
    components: string[];
    pageType?: string;
  }) => Promise<SdkInstance>;
};

declare global {
  interface Window {
    paypal?: PaypalV6;
  }
}

const SDK_SRC = "https://www.sandbox.paypal.com/web-sdk/v6/core";

function loadSdk() {
  const existing = document.querySelector<HTMLScriptElement>(
    "script[data-quay-paypal='sdk-v6']",
  );
  if (existing) {
    if (window.paypal?.createInstance) return Promise.resolve();
    return new Promise<void>((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () =>
        reject(new Error("PayPal SDK v6 failed to load")),
      );
    });
  }
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    script.dataset.quayPaypal = "sdk-v6";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("PayPal SDK v6 failed to load"));
    document.head.appendChild(script);
  });
}

function methodEligible(methods: EligibleMethods, names: string[]) {
  return names.some((name) => {
    try {
      return methods.isEligible(name);
    } catch {
      return false;
    }
  });
}

export function PayPalCheckout() {
  const lines = useCart((s) => s.lines);
  const capture = useCart((s) => s.capture);
  const quote = cartQuote(lines);
  const hostRef = useRef<HTMLDivElement>(null);
  const mockDeclineRef = useRef(false);
  const [hasClientId, setHasClientId] = useState(false);
  const [connected, setConnected] = useState(false);
  const [clientId, setClientId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sdkError, setSdkError] = useState<string | null>(null);
  const [eligible, setEligible] = useState<string[]>([]);
  const [mockDecline, setMockDecline] = useState(false);

  useEffect(() => {
    mockDeclineRef.current = mockDecline;
  }, [mockDecline]);

  useEffect(() => {
    let cancelled = false;
    getPayPalConfig().then((config) => {
      if (cancelled) return;
      setConnected(config.connected);
      setHasClientId(config.hasClientId);
      setClientId(config.clientId);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!clientId || lines.length === 0) return;
    const host = hostRef.current;
    if (!host) return;
    let alive = true;
    const snapshot = cartQuote(lines);

    async function onApprove(data: { orderId: string }) {
      const captured = await capturePayPalOrder({
        data: {
          orderId: data.orderId,
          mockDecline: mockDeclineRef.current,
        },
      });
      if (
        mockDeclineRef.current ||
        captured.captureStatus === "DECLINED" ||
        captured.status === "DECLINED"
      ) {
        toast.error("Sandbox declined the capture.");
        return;
      }
      const receipt: Receipt = {
        id: captured.orderId,
        mode: "paypal",
        status: captured.status,
        total: snapshot.total,
        currency: "USD",
        items: snapshot.items.map((item) => ({
          sku: item.sku,
          name: item.name,
          quantity: item.quantity,
          unitAmount: item.unitAmount,
        })),
        at: new Date().toISOString(),
        captureId: captured.captureId,
      };
      capture(receipt);
      toast.success("Payment captured in sandbox.");
    }

    function startSession(session: PaymentSession) {
      const createOrderPromise = createPayPalOrder({
        data: {
          lines: snapshot.items.map((item) => ({
            sku: item.sku,
            quantity: item.quantity,
          })),
        },
      }).then((order) => ({ orderId: order.orderId }));
      return session.start({ presentationMode: "auto" }, createOrderPromise);
    }

    function styleButton(el: HTMLElement) {
      el.style.width = "100%";
      el.style.maxWidth = "22rem";
      el.style.display = "block";
      el.style.setProperty("--paypal-button-border-radius", "6px");
    }

    loadSdk()
      .then(async () => {
        if (!alive || !window.paypal?.createInstance) {
          throw new Error("PayPal SDK v6 did not initialize");
        }
        const instance = await window.paypal.createInstance({
          clientId,
          components: ["paypal-payments", "paypal-guest-payments"],
          pageType: "checkout",
        });
        const methods = await instance.findEligibleMethods({
          currencyCode: "USD",
        });
        if (!alive) return;

        const found: string[] = [];
        host.replaceChildren();
        const callbacks = {
          onApprove,
          onCancel: () => toast("Checkout cancelled."),
          onError: () => toast.error("PayPal checkout failed."),
        };

        if (methodEligible(methods, ["paypal"])) {
          found.push("PayPal");
          const button = document.createElement("paypal-button");
          button.setAttribute("type", "pay");
          button.className = "paypal-gold";
          styleButton(button);
          host.appendChild(button);
          const session = await instance.createPayPalOneTimePaymentSession(
            callbacks,
          );
          button.addEventListener("click", async () => {
            try {
              await startSession(session);
            } catch (err) {
              toast.error(
                err instanceof Error ? err.message : "Could not start PayPal",
              );
            }
          });
        }

        if (
          methodEligible(methods, ["paylater", "pay-later", "pay_later"]) &&
          instance.createPayLaterOneTimePaymentSession
        ) {
          found.push("Pay Later");
          const button = document.createElement("paypal-pay-later-button");
          styleButton(button);
          host.appendChild(button);
          const session = await instance.createPayLaterOneTimePaymentSession(
            callbacks,
          );
          button.addEventListener("click", async () => {
            try {
              await startSession(session);
            } catch (err) {
              toast.error(
                err instanceof Error ? err.message : "Could not start Pay Later",
              );
            }
          });
        }

        if (
          methodEligible(methods, [
            "card",
            "paypal-guest",
            "guest",
            "debit-credit-card",
          ]) &&
          instance.createPayPalGuestOneTimePaymentSession
        ) {
          found.push("Card");
          const tag = customElements.get("paypal-guest-button")
            ? "paypal-guest-button"
            : "paypal-button";
          const button = document.createElement(tag);
          if (tag === "paypal-button") button.setAttribute("type", "pay");
          styleButton(button);
          host.appendChild(button);
          const session =
            await instance.createPayPalGuestOneTimePaymentSession(callbacks);
          button.addEventListener("click", async () => {
            try {
              await startSession(session);
            } catch (err) {
              toast.error(
                err instanceof Error ? err.message : "Could not start card checkout",
              );
            }
          });
        }

        if (found.length === 0) {
          setSdkError("No PayPal payment methods are eligible in this session.");
        }
        setEligible(found);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setSdkError(err instanceof Error ? err.message : "SDK failed");
      });

    return () => {
      alive = false;
      host.replaceChildren();
    };
  }, [clientId, lines, capture]);

  function finishDemo(ok: boolean) {
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      if (!ok) {
        toast.error("Sandbox rehearsal declined the payment.");
        return;
      }
      const receipt: Receipt = {
        id: `DEMO-${Date.now().toString(36).toUpperCase()}`,
        mode: "demo",
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
      capture(receipt);
      toast.success("Sandbox rehearsal captured the order.");
    }, 450);
  }

  if (quote.items.length === 0) return null;

  return (
    <div className="space-y-4">
      {hasClientId && clientId ? (
        <>
          <p className="text-sm text-muted">
            First-party PayPal Checkout on sandbox (JS SDK v6). Partner fees and
            marketplace onboarding are not used — Quay is the seller.
          </p>
          {connected ? (
            <p className="text-sm text-muted">
              PayPal window: sign in as {SANDBOX_BUYER_EMAIL}. Card fields take a
              sandbox test card from Connect.
            </p>
          ) : (
            <p className="text-sm text-muted">
              Client ID is loaded. Add the REST Secret on Connect so orders can
              be created.
            </p>
          )}
          {eligible.length > 0 ? (
            <p className="text-xs uppercase tracking-[0.14em] text-muted">
              Eligible · {eligible.join(" · ")}
            </p>
          ) : null}
          <div ref={hostRef} className="space-y-2" />
          {connected ? (
            <label className="flex min-h-11 items-center gap-2 text-sm text-muted">
              <input
                type="checkbox"
                className="size-4 accent-fg"
                checked={mockDecline}
                onChange={(e) => setMockDecline(e.target.checked)}
              />
              Mock the next capture as declined
            </label>
          ) : null}
          {sdkError ? (
            <p className="text-sm text-danger">{sdkError}</p>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-muted">
          PayPal Client ID is not connected yet. Use a sandbox rehearsal, or add
          credentials on Connect.
        </p>
      )}
      {!connected ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            className="h-12 flex-1"
            disabled={busy}
            onClick={() => finishDemo(true)}
          >
            {busy ? "Capturing…" : "Rehearse successful capture"}
          </Button>
          <Button
            variant="outline"
            className="h-12 flex-1"
            disabled={busy}
            onClick={() => finishDemo(false)}
          >
            Rehearse a decline
          </Button>
        </div>
      ) : null}
    </div>
  );
}
