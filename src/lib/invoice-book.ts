import { create } from "zustand";
import { persist } from "zustand/middleware";

export type LocalInvoice = {
  id: string;
  paypalId?: string;
  href?: string;
  status: "DRAFT" | "SENT" | "DEMO_SENT" | "FAILED";
  recipientEmail: string;
  recipientName: string;
  description: string;
  amount: string;
  currency: "USD";
  note?: string;
  createdAt: string;
  mode: "paypal" | "demo";
};

type BookState = {
  invoices: LocalInvoice[];
  add: (invoice: LocalInvoice) => void;
  patch: (id: string, patch: Partial<LocalInvoice>) => void;
};

export const useInvoiceBook = create<BookState>()(
  persist(
    (set, get) => ({
      invoices: [],
      add: (invoice) => set({ invoices: [invoice, ...get().invoices].slice(0, 50) }),
      patch: (id, patch) =>
        set({
          invoices: get().invoices.map((row) =>
            row.id === id ? { ...row, ...patch } : row,
          ),
        }),
    }),
    { name: "quay-invoices", skipHydration: true },
  ),
);
