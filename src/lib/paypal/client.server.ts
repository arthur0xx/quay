/**
 * PayPal REST helper (server-only).
 *
 * Official endpoints only:
 * - OAuth: POST /v1/oauth2/token
 * - Orders v2: POST /v2/checkout/orders
 *              POST /v2/checkout/orders/{id}/capture
 * - Invoicing v2: POST /v2/invoicing/invoices
 *                 POST /v2/invoicing/invoices/{id}/send
 *
 * Base URLs (PayPal REST):
 * - Sandbox: https://api-m.sandbox.paypal.com
 * - Live:    https://api-m.paypal.com
 *
 * Live money stays locked until the operator confirms PRODUCTION.
 */

const SANDBOX_API = "https://api-m.sandbox.paypal.com";
const LIVE_API = "https://api-m.paypal.com";

export type PayPalEnvironment = "SANDBOX" | "LIVE";

export type PayPalDeps = {
  fetch: typeof fetch;
  getEnv: (key: string) => string | undefined;
  now?: () => number;
  log?: (event: string, fields?: Record<string, unknown>) => void;
};

export class PayPalConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PayPalConfigError";
  }
}

export class PayPalApiError extends Error {
  readonly status: number;
  readonly paypalName?: string;
  readonly debugId?: string;

  constructor(
    message: string,
    opts: { status: number; paypalName?: string; debugId?: string },
  ) {
    super(message);
    this.name = "PayPalApiError";
    this.status = opts.status;
    this.paypalName = opts.paypalName;
    this.debugId = opts.debugId;
  }
}

const SECRET_KEY = /secret|token|authorization|password|access_token|client_secret|bearer/i;

export function redactValue(value: string): string {
  if (!value) return "";
  if (value.length <= 8) return "[redacted]";
  return `${value.slice(0, 4)}…${value.slice(-2)}`;
}

export function paypalLog(event: string, fields: Record<string, unknown> = {}) {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SECRET_KEY.test(key)) {
      safe[key] = typeof value === "string" ? redactValue(value) : "[redacted]";
      continue;
    }
    if (typeof value === "string" && SECRET_KEY.test(value)) {
      safe[key] = "[redacted]";
      continue;
    }
    safe[key] = value;
  }
  console.info("[paypal]", event, safe);
}

type SessionCreds = {
  clientId: string;
  clientSecret: string;
};

let sessionCreds: SessionCreds | null = null;
let credsEpoch = 0;

export function setSessionCredentials(creds: SessionCreds) {
  sessionCreds = {
    clientId: creds.clientId.trim(),
    clientSecret: creds.clientSecret.trim(),
  };
  credsEpoch += 1;
}

export function clearSessionCredentials() {
  sessionCreds = null;
  credsEpoch += 1;
}

export function getSessionCredentials(): SessionCreds | null {
  return sessionCreds;
}

export type OrderItemInput = {
  name: string;
  quantity: string;
  unitAmount: string;
  sku?: string;
};

export type CreateOrderInput = {
  currency: string;
  value: string;
  description?: string;
  customId?: string;
  items?: OrderItemInput[];
  requestId?: string;
};

export type CaptureOrderInput = {
  orderId: string;
  requestId?: string;
  mockApplicationCode?: string;
};

export type RefundCaptureInput = {
  captureId: string;
  amount?: string;
  currency?: string;
  note?: string;
  requestId?: string;
  mockApplicationCode?: string;
};

export type CreateInvoiceInput = {
  currency: string;
  note?: string;
  invoiceNumber?: string;
  invoicerGivenName?: string;
  invoicerSurname?: string;
  recipientEmail: string;
  recipientGivenName?: string;
  recipientSurname?: string;
  items: Array<{
    name: string;
    quantity: string;
    unitAmount: string;
  }>;
  requestId?: string;
};

export type SendInvoiceInput = {
  invoiceId: string;
  subject?: string;
  note?: string;
  requestId?: string;
};

type TokenCache = {
  token: string;
  expiresAt: number;
  key: string;
};

function defaultGetEnv(key: string): string | undefined {
  const fromEnv = process.env[key]?.trim();
  if (fromEnv) return fromEnv;
  if (key === "PAYPAL_CLIENT_ID") return sessionCreds?.clientId;
  if (key === "PAYPAL_CLIENT_SECRET") return sessionCreds?.clientSecret;
  return undefined;
}

export function createPayPalClient(deps: Partial<PayPalDeps> = {}) {
  const fetchFn = deps.fetch ?? fetch;
  const getEnv = deps.getEnv ?? defaultGetEnv;
  const now = deps.now ?? Date.now;
  const log = deps.log ?? paypalLog;
  let cache: TokenCache | null = null;

  function environment(): PayPalEnvironment {
    const raw = (getEnv("PAYPAL_ENVIRONMENT") ?? "SANDBOX").trim().toUpperCase();
    if (raw === "LIVE" || raw === "PRODUCTION") return "LIVE";
    return "SANDBOX";
  }

  function baseUrl(): string {
    const env = environment();
    if (env === "LIVE") {
      throw new PayPalConfigError(
        "Live PayPal is locked. Stay on SANDBOX until you confirm PRODUCTION.",
      );
    }
    return SANDBOX_API;
  }

  function credentials() {
    return {
      clientId: getEnv("PAYPAL_CLIENT_ID"),
      clientSecret: getEnv("PAYPAL_CLIENT_SECRET"),
      accessToken: getEnv("PAYPAL_ACCESS_TOKEN"),
    };
  }

  function publicStatus() {
    const creds = credentials();
    const source: "env" | "session" | "none" = getEnv("PAYPAL_CLIENT_ID")
      ? process.env.PAYPAL_CLIENT_ID?.trim()
        ? "env"
        : sessionCreds
          ? "session"
          : "env"
      : "none";
    return {
      environment: environment(),
      liveLocked: true,
      apiBase: environment() === "LIVE" ? LIVE_API : SANDBOX_API,
      connected: Boolean(
        creds.accessToken || (creds.clientId && creds.clientSecret),
      ),
      hasClientId: Boolean(creds.clientId),
      hasSecret: Boolean(creds.clientSecret),
      hasAccessToken: Boolean(creds.accessToken),
      clientId: creds.clientId ?? null,
      source: creds.clientId ? source : "none",
    };
  }

  async function readError(res: Response): Promise<PayPalApiError> {
    let paypalName: string | undefined;
    let debugId: string | undefined;
    let message = `PayPal request failed (${res.status})`;
    try {
      const body = (await res.json()) as {
        error?: string;
        error_description?: string;
        name?: string;
        message?: string;
        debug_id?: string;
      };
      paypalName = body.name ?? body.error;
      debugId = body.debug_id;
      if (body.error_description) message = body.error_description;
      else if (body.message) message = body.message;
      else if (body.error) message = body.error;
    } catch {
      // non-JSON body
    }
    return new PayPalApiError(message, {
      status: res.status,
      paypalName,
      debugId,
    });
  }

  async function getAccessToken(): Promise<string> {
    const env = environment();
    const url = `${baseUrl()}/v1/oauth2/token`;
    const creds = credentials();
    const cacheKey = `${env}:${creds.clientId ?? "token"}:${credsEpoch}`;

    if (cache && cache.key === cacheKey && cache.expiresAt > now() + 30_000) {
      log("token.cache_hit", { environment: env });
      return cache.token;
    }

    if (creds.accessToken && !creds.clientSecret) {
      log("token.static", { environment: env });
      return creds.accessToken;
    }

    if (!creds.clientId || !creds.clientSecret) {
      throw new PayPalConfigError(
        "Missing PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET (or PAYPAL_ACCESS_TOKEN).",
      );
    }

    const basic = Buffer.from(`${creds.clientId}:${creds.clientSecret}`).toString(
      "base64",
    );

    log("token.request", {
      environment: env,
      url: "/v1/oauth2/token",
      clientId: redactValue(creds.clientId),
    });

    const res = await fetchFn(url, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: "grant_type=client_credentials",
    });

    if (!res.ok) {
      const err = await readError(res);
      log("token.failure", {
        status: err.status,
        paypalName: err.paypalName,
        debugId: err.debugId,
      });
      throw err;
    }

    const body = (await res.json()) as {
      access_token: string;
      expires_in?: number;
      token_type?: string;
    };
    if (!body.access_token) {
      throw new PayPalApiError("PayPal token response missing access_token", {
        status: res.status,
      });
    }

    const expiresIn = Number(body.expires_in ?? 300) * 1000;
    cache = {
      token: body.access_token,
      expiresAt: now() + expiresIn,
      key: cacheKey,
    };
    log("token.success", {
      environment: env,
      expiresInSec: Math.round(expiresIn / 1000),
    });
    return body.access_token;
  }

  async function paypalFetch<T>(
    path: string,
    init: {
      method: string;
      body?: unknown;
      requestId?: string;
      mockApplicationCode?: string;
    },
  ): Promise<{ status: number; data: T }> {
    const token = await getAccessToken();
    const url = `${baseUrl()}${path}`;
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (init.requestId) headers["PayPal-Request-Id"] = init.requestId;
    if (init.mockApplicationCode) {
      headers["PayPal-Mock-Response"] = JSON.stringify({
        mock_application_codes: init.mockApplicationCode,
      });
    }

    log("api.request", { method: init.method, path });

    const res = await fetchFn(url, {
      method: init.method,
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });

    if (!res.ok) {
      const err = await readError(res);
      log("api.failure", {
        method: init.method,
        path,
        status: err.status,
        paypalName: err.paypalName,
        debugId: err.debugId,
      });
      throw err;
    }

    const text = await res.text();
    const data = (text ? JSON.parse(text) : {}) as T;
    log("api.success", { method: init.method, path, status: res.status });
    return { status: res.status, data };
  }

  async function createOrder(input: CreateOrderInput) {
    const currency = input.currency.toUpperCase();
    const purchaseUnit: Record<string, unknown> = {
      amount: {
        currency_code: currency,
        value: input.value,
      },
    };
    if (input.description) purchaseUnit.description = input.description;
    if (input.customId) purchaseUnit.custom_id = input.customId;
    if (input.items?.length) {
      const itemTotal = input.items.reduce((sum, item) => {
        const qty = Number(item.quantity);
        const unit = Number(item.unitAmount);
        return sum + Math.round(qty * unit * 100);
      }, 0);
      purchaseUnit.amount = {
        currency_code: currency,
        value: input.value,
        breakdown: {
          item_total: {
            currency_code: currency,
            value: (itemTotal / 100).toFixed(2),
          },
        },
      };
      purchaseUnit.items = input.items.map((item) => ({
        name: item.name.slice(0, 127),
        quantity: item.quantity,
        sku: item.sku?.slice(0, 127),
        unit_amount: {
          currency_code: currency,
          value: item.unitAmount,
        },
      }));
    }

    const { data } = await paypalFetch<{ id: string; status: string }>(
      "/v2/checkout/orders",
      {
        method: "POST",
        requestId: input.requestId,
        body: {
          intent: "CAPTURE",
          purchase_units: [purchaseUnit],
        },
      },
    );

    if (!data.id) {
      throw new PayPalApiError("PayPal create order did not return an id", {
        status: 502,
      });
    }
    return { orderId: data.id, status: data.status };
  }

  async function captureOrder(input: CaptureOrderInput) {
    const { data } = await paypalFetch<{
      id: string;
      status: string;
      purchase_units?: Array<{
        payments?: {
          captures?: Array<{
            id: string;
            status: string;
            amount?: { currency_code: string; value: string };
          }>;
        };
      }>;
    }>(`/v2/checkout/orders/${encodeURIComponent(input.orderId)}/capture`, {
      method: "POST",
      requestId: input.requestId,
      mockApplicationCode: input.mockApplicationCode,
      body: {},
    });

    const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
    return {
      orderId: data.id,
      status: data.status,
      captureId: capture?.id,
      captureStatus: capture?.status,
      amount: capture?.amount,
    };
  }

  async function createInvoice(input: CreateInvoiceInput) {
    const currency = input.currency.toUpperCase();
    const body = {
      detail: {
        currency_code: currency,
        note: input.note ?? "Thank you for your business.",
        invoice_number: input.invoiceNumber,
      },
      invoicer: {
        name: {
          given_name: input.invoicerGivenName ?? "Quay",
          surname: input.invoicerSurname ?? "Merchant",
        },
      },
      primary_recipients: [
        {
          billing_info: {
            email_address: input.recipientEmail,
            name: {
              given_name: input.recipientGivenName ?? "Customer",
              surname: input.recipientSurname ?? "Account",
            },
          },
        },
      ],
      items: input.items.map((item) => ({
        name: item.name.slice(0, 200),
        quantity: item.quantity,
        unit_amount: {
          currency_code: currency,
          value: item.unitAmount,
        },
      })),
    };

    const { data, status } = await paypalFetch<{
      id?: string;
      href?: string;
      status?: string;
    }>("/v2/invoicing/invoices", {
      method: "POST",
      requestId: input.requestId,
      body,
    });

    const invoiceId =
      data.id ??
      (typeof data.href === "string"
        ? data.href.split("/").filter(Boolean).pop()
        : undefined);

    if (!invoiceId) {
      throw new PayPalApiError("PayPal create invoice did not return an id", {
        status,
      });
    }

    return {
      invoiceId,
      status: data.status ?? "DRAFT",
      href: data.href,
    };
  }

  async function sendInvoice(input: SendInvoiceInput) {
    const { data, status } = await paypalFetch<{ href?: string; rel?: string }>(
      `/v2/invoicing/invoices/${encodeURIComponent(input.invoiceId)}/send`,
      {
        method: "POST",
        requestId: input.requestId,
        body: {
          subject: input.subject,
          note: input.note,
          send_to_recipient: true,
          send_to_invoicer: false,
        },
      },
    );
    return {
      invoiceId: input.invoiceId,
      href: data.href,
      httpStatus: status,
    };
  }

  async function refundCapture(input: RefundCaptureInput) {
    const body: Record<string, unknown> = {};
    if (input.amount && input.currency) {
      body.amount = {
        value: input.amount,
        currency_code: input.currency.toUpperCase(),
      };
    }
    if (input.note) body.note_to_payer = input.note.slice(0, 255);

    const { data } = await paypalFetch<{
      id: string;
      status: string;
      amount?: { currency_code: string; value: string };
    }>(`/v2/payments/captures/${encodeURIComponent(input.captureId)}/refund`, {
      method: "POST",
      requestId: input.requestId,
      mockApplicationCode: input.mockApplicationCode,
      body,
    });

    if (!data.id) {
      throw new PayPalApiError("PayPal refund did not return an id", {
        status: 502,
      });
    }
    return {
      refundId: data.id,
      status: data.status,
      amount: data.amount,
    };
  }

  return {
    environment,
    baseUrl,
    publicStatus,
    getAccessToken,
    createOrder,
    captureOrder,
    refundCapture,
    createInvoice,
    sendInvoice,
  };
}

const defaultClient = createPayPalClient();

export function getAccessToken() {
  return defaultClient.getAccessToken();
}

export function createOrder(input: CreateOrderInput) {
  return defaultClient.createOrder(input);
}

export function captureOrder(input: CaptureOrderInput) {
  return defaultClient.captureOrder(input);
}

export function refundCapture(input: RefundCaptureInput) {
  return defaultClient.refundCapture(input);
}

export function createInvoice(input: CreateInvoiceInput) {
  return defaultClient.createInvoice(input);
}

export function sendInvoice(input: SendInvoiceInput) {
  return defaultClient.sendInvoice(input);
}

export function getPayPalPublicStatus() {
  return defaultClient.publicStatus();
}

export { SANDBOX_API, LIVE_API };
