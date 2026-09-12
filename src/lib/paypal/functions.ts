import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CATALOG, productBySku } from "@/lib/catalog";
import { centsFromDecimal, decimalFromCents } from "@/lib/utils";

const lineSchema = z.object({
  sku: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(99),
});

function quoteLines(lines: Array<{ sku: string; quantity: number }>) {
  let cents = 0;
  const items = lines.map((line) => {
    const product = productBySku(line.sku);
    if (!product) throw new Error(`Unknown item: ${line.sku}`);
    const unitCents = centsFromDecimal(product.price);
    cents += unitCents * line.quantity;
    return {
      sku: product.sku,
      name: product.name,
      quantity: String(line.quantity),
      unitAmount: product.price,
    };
  });
  return {
    currency: "USD" as const,
    value: decimalFromCents(cents),
    items,
    description: items.map((item) => item.name).join(", ").slice(0, 127),
  };
}

export const getPayPalConfig = createServerFn({ method: "GET" }).handler(
  async () => {
    const { getPayPalPublicStatus } = await import("./client.server");
    return getPayPalPublicStatus();
  },
);

export const savePayPalSession = createServerFn({ method: "POST" })
  .validator(
    z.object({
      clientId: z.string().min(8).max(200),
      clientSecret: z.string().min(8).max(200),
    }),
  )
  .handler(async ({ data }) => {
    const paypal = await import("./client.server");
    paypal.setSessionCredentials({
      clientId: data.clientId,
      clientSecret: data.clientSecret,
    });
    return paypal.getPayPalPublicStatus();
  });

export const clearPayPalSession = createServerFn({ method: "POST" }).handler(
  async () => {
    const paypal = await import("./client.server");
    paypal.clearSessionCredentials();
    return paypal.getPayPalPublicStatus();
  },
);

export const probePayPalConnection = createServerFn({ method: "POST" }).handler(
  async () => {
    const paypal = await import("./client.server");
    try {
      await paypal.getAccessToken();
      return { ok: true as const, config: paypal.getPayPalPublicStatus() };
    } catch (error) {
      return {
        ok: false as const,
        config: paypal.getPayPalPublicStatus(),
        error: error instanceof Error ? error.message : "Connection failed",
      };
    }
  },
);

export const createPayPalOrder = createServerFn({ method: "POST" })
  .validator(z.object({ lines: z.array(lineSchema).min(1).max(20) }))
  .handler(async ({ data }) => {
    const quote = quoteLines(data.lines);
    const paypal = await import("./client.server");
    return paypal.createOrder({
      currency: quote.currency,
      value: quote.value,
      description: quote.description,
      customId: `quay-${Date.now()}`,
      items: quote.items,
      requestId: crypto.randomUUID(),
    });
  });

export const capturePayPalOrder = createServerFn({ method: "POST" })
  .validator(
    z.object({
      orderId: z.string().min(1).max(64),
      mockDecline: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const paypal = await import("./client.server");
    return paypal.captureOrder({
      orderId: data.orderId,
      requestId: crypto.randomUUID(),
      mockApplicationCode: data.mockDecline
        ? "INSTRUMENT_DECLINED"
        : undefined,
    });
  });

export const refundPayPalCapture = createServerFn({ method: "POST" })
  .validator(
    z.object({
      captureId: z.string().min(1).max(64),
      amount: z
        .string()
        .regex(/^\d+(\.\d{1,2})?$/)
        .optional(),
      currency: z.string().length(3).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const paypal = await import("./client.server");
    return paypal.refundCapture({
      captureId: data.captureId,
      amount: data.amount,
      currency: data.currency,
      requestId: crypto.randomUUID(),
    });
  });

export const createPayPalInvoice = createServerFn({ method: "POST" })
  .validator(
    z.object({
      recipientEmail: z.string().email().max(200),
      recipientName: z.string().min(1).max(80),
      description: z.string().min(1).max(200),
      amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
      note: z.string().max(400).optional(),
    }),
  )
  .handler(async ({ data }) => {
    const amountNum = Number(data.amount);
    if (amountNum <= 0 || amountNum > 10000) {
      throw new Error("Amount must be between 0.01 and 10000.00");
    }
    const names = data.recipientName.trim().split(/\s+/);
    const given = names[0] ?? "Customer";
    const surname = names.slice(1).join(" ") || "Account";
    const paypal = await import("./client.server");
    return paypal.createInvoice({
      currency: "USD",
      note: data.note,
      invoiceNumber: `QUAY-${Date.now().toString(36).toUpperCase()}`,
      recipientEmail: data.recipientEmail.trim(),
      recipientGivenName: given,
      recipientSurname: surname,
      items: [
        {
          name: data.description,
          quantity: "1",
          unitAmount: amountNum.toFixed(2),
        },
      ],
      requestId: crypto.randomUUID(),
    });
  });

export const sendPayPalInvoice = createServerFn({ method: "POST" })
  .validator(z.object({ invoiceId: z.string().min(1).max(64) }))
  .handler(async ({ data }) => {
    const paypal = await import("./client.server");
    return paypal.sendInvoice({
      invoiceId: data.invoiceId,
      requestId: crypto.randomUUID(),
    });
  });

export const catalogSnapshot = createServerFn({ method: "GET" }).handler(
  async () => CATALOG,
);
