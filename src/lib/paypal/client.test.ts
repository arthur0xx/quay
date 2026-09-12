import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  PayPalApiError,
  PayPalConfigError,
  createPayPalClient,
  redactValue,
} from "./client.server.ts";

type FetchCall = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
};

function headerMap(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k, String(v)]),
  );
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  // nothing module-global to reset in factory tests
});

describe("redactValue", () => {
  it("never returns the original secret", () => {
    const secret = "super-secret-value";
    const redacted = redactValue(secret);
    assert.notEqual(redacted, secret);
    assert.ok(!redacted.includes("secret-value"));
  });
});

describe("createPayPalClient", () => {
  it("success path: OAuth then createOrder on sandbox", async () => {
    const calls: FetchCall[] = [];
    const logs: Array<{ event: string; fields: Record<string, unknown> }> = [];

    const client = createPayPalClient({
      getEnv: (key) =>
        ({
          PAYPAL_CLIENT_ID: "test-client-id-aaaa",
          PAYPAL_CLIENT_SECRET: "test-client-secret-bbbb",
          PAYPAL_ENVIRONMENT: "SANDBOX",
        })[key],
      log: (event, fields = {}) => logs.push({ event, fields }),
      fetch: async (input, init) => {
        const url = String(input);
        calls.push({
          url,
          method: init?.method,
          headers: headerMap(init?.headers),
          body: typeof init?.body === "string" ? init.body : undefined,
        });
        if (url.endsWith("/v1/oauth2/token")) {
          assert.equal(init?.method, "POST");
          assert.match(
            headerMap(init?.headers).authorization ??
              headerMap(init?.headers).Authorization ??
              "",
            /^Basic /i,
          );
          assert.equal(init?.body, "grant_type=client_credentials");
          return jsonResponse(200, {
            access_token: "ACCESS-TOKEN-SHOULD-NOT-LEAK",
            expires_in: 3600,
            token_type: "Bearer",
          });
        }
        if (url.endsWith("/v2/checkout/orders")) {
          const parsed = JSON.parse(String(init?.body ?? "{}")) as {
            intent: string;
            purchase_units: Array<{ amount: { value: string } }>;
          };
          assert.equal(parsed.intent, "CAPTURE");
          assert.equal(parsed.purchase_units[0]?.amount.value, "38.00");
          return jsonResponse(201, {
            id: "5O190127TN364715T",
            status: "CREATED",
          });
        }
        return jsonResponse(404, { name: "NOT_FOUND", message: url });
      },
    });

    assert.equal(client.baseUrl(), "https://api-m.sandbox.paypal.com");
    const order = await client.createOrder({
      currency: "USD",
      value: "38.00",
      description: "Cold-Press Argan",
    });
    assert.equal(order.orderId, "5O190127TN364715T");
    assert.equal(order.status, "CREATED");
    assert.equal(calls.length, 2);
    assert.ok(calls[0]?.url.includes("api-m.sandbox.paypal.com"));

    const dumped = JSON.stringify(logs);
    assert.ok(!dumped.includes("ACCESS-TOKEN-SHOULD-NOT-LEAK"));
    assert.ok(!dumped.includes("test-client-secret-bbbb"));
    assert.ok(!dumped.includes("Bearer ACCESS"));
  });

  it("failure path: invalid client credentials", async () => {
    const logs: Array<{ event: string; fields: Record<string, unknown> }> = [];
    const client = createPayPalClient({
      getEnv: (key) =>
        ({
          PAYPAL_CLIENT_ID: "bad-client-id-xxxx",
          PAYPAL_CLIENT_SECRET: "bad-client-secret-yyyy",
          PAYPAL_ENVIRONMENT: "SANDBOX",
        })[key],
      log: (event, fields = {}) => logs.push({ event, fields }),
      fetch: async (input) => {
        const url = String(input);
        if (url.endsWith("/v1/oauth2/token")) {
          return jsonResponse(401, {
            error: "invalid_client",
            error_description: "Client Authentication failed",
          });
        }
        return jsonResponse(500, { name: "UNEXPECTED" });
      },
    });

    await assert.rejects(
      () => client.getAccessToken(),
      (err: unknown) => {
        assert.ok(err instanceof PayPalApiError);
        assert.equal(err.status, 401);
        assert.match(err.message, /Client Authentication failed/i);
        return true;
      },
    );

    const dumped = JSON.stringify(logs);
    assert.ok(!dumped.includes("bad-client-secret-yyyy"));
    assert.equal(
      logs.some((row) => row.event === "token.failure"),
      true,
    );
  });

  it("refuses live money until PRODUCTION is confirmed", async () => {
    const client = createPayPalClient({
      getEnv: (key) =>
        ({
          PAYPAL_CLIENT_ID: "test-client-id-aaaa",
          PAYPAL_CLIENT_SECRET: "test-client-secret-bbbb",
          PAYPAL_ENVIRONMENT: "LIVE",
        })[key],
      fetch: async () => {
        throw new Error("network should not be called");
      },
    });

    await assert.rejects(() => client.getAccessToken(), PayPalConfigError);
    assert.throws(() => client.baseUrl(), PayPalConfigError);
  });

  it("fails closed when credentials are missing", async () => {
    const client = createPayPalClient({
      getEnv: () => undefined,
      fetch: async () => {
        throw new Error("network should not be called");
      },
    });
    await assert.rejects(() => client.getAccessToken(), PayPalConfigError);
  });

  it("success path: refund a capture", async () => {
    const calls: FetchCall[] = [];
    const client = createPayPalClient({
      getEnv: (key) =>
        ({
          PAYPAL_CLIENT_ID: "test-client-id-aaaa",
          PAYPAL_CLIENT_SECRET: "test-client-secret-bbbb",
          PAYPAL_ENVIRONMENT: "SANDBOX",
        })[key],
      fetch: async (input, init) => {
        const url = String(input);
        calls.push({
          url,
          method: init?.method,
          headers: headerMap(init?.headers),
          body: typeof init?.body === "string" ? init.body : undefined,
        });
        if (url.endsWith("/v1/oauth2/token")) {
          return jsonResponse(200, {
            access_token: "ACCESS-TOKEN-SHOULD-NOT-LEAK",
            expires_in: 3600,
          });
        }
        if (url.includes("/v2/payments/captures/") && url.endsWith("/refund")) {
          assert.equal(init?.method, "POST");
          return jsonResponse(201, {
            id: "REFUND-1",
            status: "COMPLETED",
            amount: { currency_code: "USD", value: "12.00" },
          });
        }
        return jsonResponse(404, { name: "NOT_FOUND", message: url });
      },
    });

    const refund = await client.refundCapture({
      captureId: "CAPTURE-1",
      amount: "12.00",
      currency: "USD",
    });
    assert.equal(refund.refundId, "REFUND-1");
    assert.equal(refund.status, "COMPLETED");
    assert.equal(calls.some((c) => c.url.includes("/refund")), true);
  });

  it("failure path: mock decline header is sent on capture", async () => {
    const calls: FetchCall[] = [];
    const client = createPayPalClient({
      getEnv: (key) =>
        ({
          PAYPAL_CLIENT_ID: "test-client-id-aaaa",
          PAYPAL_CLIENT_SECRET: "test-client-secret-bbbb",
          PAYPAL_ENVIRONMENT: "SANDBOX",
        })[key],
      fetch: async (input, init) => {
        const url = String(input);
        calls.push({
          url,
          method: init?.method,
          headers: headerMap(init?.headers),
        });
        if (url.endsWith("/v1/oauth2/token")) {
          return jsonResponse(200, {
            access_token: "ACCESS-TOKEN-SHOULD-NOT-LEAK",
            expires_in: 3600,
          });
        }
        if (url.endsWith("/capture")) {
          const headers = headerMap(init?.headers);
          const mock =
            headers["PayPal-Mock-Response"] ?? headers["paypal-mock-response"];
          assert.match(mock ?? "", /INSTRUMENT_DECLINED/);
          return jsonResponse(422, {
            name: "UNPROCESSABLE_ENTITY",
            message: "The requested action could not be completed.",
            details: [{ issue: "INSTRUMENT_DECLINED" }],
          });
        }
        return jsonResponse(404, { name: "NOT_FOUND" });
      },
    });

    await assert.rejects(
      () =>
        client.captureOrder({
          orderId: "ORDER-1",
          mockApplicationCode: "INSTRUMENT_DECLINED",
        }),
      PayPalApiError,
    );
  });
});
