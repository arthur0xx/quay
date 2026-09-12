import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(value: string | number, currency = "USD") {
  const amount = typeof value === "number" ? value : Number(value);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(Number.isFinite(amount) ? amount : 0);
}

export function centsFromDecimal(value: string | number) {
  const n = typeof value === "number" ? value : Number(value);
  return Math.round((Number.isFinite(n) ? n : 0) * 100);
}

export function decimalFromCents(cents: number) {
  return (cents / 100).toFixed(2);
}
