import { create } from "zustand";
import { persist } from "zustand/middleware";
import { centsFromDecimal, decimalFromCents } from "@/lib/utils";

export type BankAccount = {
  id: string;
  holderName: string;
  bankName: string;
  rib: string;
  createdAt: string;
};

export type TransferKind = "topup" | "order";
export type TransferStatus = "sent" | "credited" | "rejected";

export type TransferItem = {
  sku: string;
  name: string;
  quantity: number;
  unitAmount: string;
};

export type BankTransfer = {
  id: string;
  reference: string;
  kind: TransferKind;
  status: TransferStatus;
  amount: string;
  currency: "USD";
  bankId: string;
  holderName: string;
  bankName: string;
  rib: string;
  payerName: string;
  payerRib: string;
  proofImage?: string;
  items?: TransferItem[];
  createdAt: string;
  creditedAt?: string;
};

type BankeState = {
  banks: BankAccount[];
  transfers: BankTransfer[];
  balanceCents: number;
  payerName: string;
  payerRib: string;
  addBank: (input: {
    holderName: string;
    bankName: string;
    rib: string;
  }) => BankAccount;
  removeBank: (id: string) => void;
  setPayer: (input: { payerName: string; payerRib: string }) => void;
  submitTransfer: (input: {
    kind: TransferKind;
    amount: string;
    bank: BankAccount;
    reference: string;
    payerName: string;
    payerRib: string;
    proofImage?: string;
    items?: TransferItem[];
  }) => BankTransfer;
  credit: (id: string) => BankTransfer | null;
  reject: (id: string) => void;
  spend: (amount: string) => boolean;
};

export function newReference() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  let body = "";
  for (const byte of bytes) body += alphabet[byte % alphabet.length];
  return `QY-${body}`;
}

function seedBanks(): BankAccount[] {
  return [
    {
      id: "bank-quay-1",
      holderName: "Quay Atelier",
      bankName: "Attijariwafa Bank",
      rib: "007780000123456789012345",
      createdAt: new Date().toISOString(),
    },
  ];
}

export const useBanke = create<BankeState>()(
  persist(
    (set, get) => ({
      banks: seedBanks(),
      transfers: [],
      balanceCents: 0,
      payerName: "",
      payerRib: "",
      addBank: (input) => {
        const bank: BankAccount = {
          id: crypto.randomUUID(),
          holderName: input.holderName.trim(),
          bankName: input.bankName.trim(),
          rib: input.rib.replace(/\s+/g, ""),
          createdAt: new Date().toISOString(),
        };
        set({ banks: [bank, ...get().banks] });
        return bank;
      },
      removeBank: (id) =>
        set({ banks: get().banks.filter((bank) => bank.id !== id) }),
      setPayer: (input) =>
        set({
          payerName: input.payerName.trim(),
          payerRib: input.payerRib.replace(/\s+/g, ""),
        }),
      submitTransfer: (input) => {
        const transfer: BankTransfer = {
          id: crypto.randomUUID(),
          reference: input.reference,
          kind: input.kind,
          status: "sent",
          amount: Number(input.amount).toFixed(2),
          currency: "USD",
          bankId: input.bank.id,
          holderName: input.bank.holderName,
          bankName: input.bank.bankName,
          rib: input.bank.rib,
          payerName: input.payerName.trim(),
          payerRib: input.payerRib.replace(/\s+/g, ""),
          proofImage: input.proofImage,
          items: input.items,
          createdAt: new Date().toISOString(),
        };
        set({
          transfers: [transfer, ...get().transfers].slice(0, 40),
          payerName: transfer.payerName,
          payerRib: transfer.payerRib,
        });
        return transfer;
      },
      credit: (id) => {
        const row = get().transfers.find((item) => item.id === id);
        if (!row || row.status !== "sent") return null;
        const next: BankTransfer = {
          ...row,
          status: "credited",
          creditedAt: new Date().toISOString(),
        };
        let balanceCents = get().balanceCents;
        if (row.kind === "topup") {
          balanceCents += centsFromDecimal(row.amount);
        }
        set({
          transfers: get().transfers.map((item) =>
            item.id === id ? next : item,
          ),
          balanceCents,
        });
        return next;
      },
      reject: (id) => {
        set({
          transfers: get().transfers.map((item) =>
            item.id === id && item.status === "sent"
              ? { ...item, status: "rejected" }
              : item,
          ),
        });
      },
      spend: (amount) => {
        const cents = centsFromDecimal(amount);
        if (cents <= 0 || get().balanceCents < cents) return false;
        set({ balanceCents: get().balanceCents - cents });
        return true;
      },
    }),
    { name: "quay-banke", skipHydration: true },
  ),
);

export function formatRib(rib: string) {
  return rib.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();
}

export function walletBalance() {
  return decimalFromCents(useBanke.getState().balanceCents);
}

export const SAME_BANK_ETA = "10–20 minutes";
export const OTHER_BANK_ETA = "about 24 hours";
