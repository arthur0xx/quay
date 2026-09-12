import { create } from "zustand";
import { productBySku } from "@/lib/catalog";
import { centsFromDecimal, decimalFromCents } from "@/lib/utils";

export type CartLine = {
  sku: string;
  quantity: number;
};

export type Receipt = {
  id: string;
  mode: "paypal" | "demo" | "wallet" | "banke";
  status: string;
  total: string;
  currency: "USD";
  items: Array<{ sku: string; name: string; quantity: number; unitAmount: string }>;
  at: string;
  captureId?: string;
  refundId?: string;
  refundStatus?: string;
};

type CartState = {
  lines: CartLine[];
  receipt: Receipt | null;
  add: (sku: string, quantity?: number) => void;
  setQty: (sku: string, quantity: number) => void;
  remove: (sku: string) => void;
  clear: () => void;
  setReceipt: (receipt: Receipt | null) => void;
  capture: (receipt: Receipt) => void;
  markRefunded: (refundId: string, refundStatus: string) => void;
};

export const useCart = create<CartState>()((set, get) => ({
  lines: [],
  receipt: null,
  add: (sku, quantity = 1) => {
    if (!productBySku(sku)) return;
    const lines = [...get().lines];
    const existing = lines.find((line) => line.sku === sku);
    if (existing) existing.quantity = Math.min(99, existing.quantity + quantity);
    else lines.push({ sku, quantity });
    set({ lines });
  },
  setQty: (sku, quantity) => {
    if (quantity <= 0) {
      set({ lines: get().lines.filter((line) => line.sku !== sku) });
      return;
    }
    set({
      lines: get().lines.map((line) =>
        line.sku === sku ? { ...line, quantity: Math.min(99, quantity) } : line,
      ),
    });
  },
  remove: (sku) => set({ lines: get().lines.filter((line) => line.sku !== sku) }),
  clear: () => set({ lines: [] }),
  setReceipt: (receipt) => set({ receipt }),
  capture: (receipt) => set({ receipt, lines: [] }),
  markRefunded: (refundId, refundStatus) => {
    const receipt = get().receipt;
    if (!receipt) return;
    set({
      receipt: {
        ...receipt,
        status: "REFUNDED",
        refundId,
        refundStatus,
      },
    });
  },
}));

export function cartCount(lines: CartLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function cartQuote(lines: CartLine[]) {
  const items = lines
    .map((line) => {
      const product = productBySku(line.sku);
      if (!product) return null;
      return {
        sku: product.sku,
        name: product.name,
        quantity: line.quantity,
        unitAmount: product.price,
        image: product.image,
        alt: product.alt,
        lineTotal: decimalFromCents(
          centsFromDecimal(product.price) * line.quantity,
        ),
      };
    })
    .filter((item) => item !== null);
  const cents = items.reduce(
    (sum, item) => sum + centsFromDecimal(item.unitAmount) * item.quantity,
    0,
  );
  return { items, total: decimalFromCents(cents), currency: "USD" as const };
}
