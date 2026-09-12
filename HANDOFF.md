# Quay PayPal handoff

First-party merchant desk. Sandbox locked. Live money off.

## Done

- Shop, cart, checkout, invoices, Connect
- PayPal JS SDK v6 (`paypal-payments` + `paypal-guest-payments`)
- REST: OAuth, Orders v2 create/capture, Invoicing v2, Payments v2 refund
- `PayPal-Mock-Response` on capture (`INSTRUMENT_DECLINED`)
- Credentials in process env + `.env` (do not print secrets)
- Buyer: `sb-mrfbc52886729@personal.example.com`
- Merchant: `sb-tb6dl52887315@business.example.com`
- Tests: `src/lib/paypal/client.test.ts`

## Intentionally skipped

- Multiparty / partner fees / seller onboarding (first-party seller)
- Venmo (US-only)
- DropZone, NVP/SOAP, bulk sandbox upload
- Production / live endpoints

## Verify next

1. Open `/` → add to cart → `/checkout`
2. Gold PayPal button (and Pay Later / Card if eligible)
3. PayPal window: personal buyer, not business
4. Receipt → Refund in sandbox
5. Connect: status Ready, test cards listed
6. Invoices: create + send against sandbox
7. Optional: check “Mock the next capture as declined”

## Commands

```
npm test
npm run typecheck
npm run build && npm run preview
```

Preview must stay on `0.0.0.0:8080` via `startup.sh`.
