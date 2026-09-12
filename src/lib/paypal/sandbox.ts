/** First-party sandbox identities. Never store passwords here. */

export const SANDBOX_MERCHANT_EMAIL =
  "sb-tb6dl52887315@business.example.com";
export const SANDBOX_BUYER_EMAIL = "sb-mrfbc52886729@personal.example.com";

export const SANDBOX_TEST_CARDS = [
  { brand: "Visa", number: "4012 8888 8888 1881" },
  { brand: "Mastercard", number: "2223 0000 4840 0011" },
  { brand: "American Express", number: "3714 496353 98431" },
] as const;

export const CARD_REJECTION_TRIGGER = "CCREJECT-REFUSED";
