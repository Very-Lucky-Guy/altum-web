# ALTUM operations

## Status

The storefront and server adapters are implemented. Live sales still require the correct Stripe account, Apliiq custom store credentials, a dedicated database, approved prices, shipping/return policies, customer support address and tax configuration. No real charge or production order was made during development.

Confirmed Apliiq product: 6202398, black AS Colour 5069. Six size SKUs are in `lib/catalog.js`. Cobalt/Fuchsia have no production SKUs and remain unavailable. Never substitute Original SKUs for different artwork.

## Connect and launch

1. Provision dedicated PostgreSQL for ALTUM. Put the pooled connection URL in `DATABASE_URL`, with TLS per provider instructions. Do not reuse another business's database. Run `npm run db:migrate`. The private `altum` schema has RLS with no public policies. The server role must own the schema or have explicit server privileges.
2. Confirm which merchant account will receive ALTUM payments. The available browser session is CHERRY EXPERT; do not assume it is a separate ALTUM account. Prefer a restricted key with Account read and Checkout Session read/write permissions. Use a separate Stripe sandbox during development.
3. Register `/api/webhooks/stripe` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`. Set its signing secret. Enable customer payment receipts in Stripe Dashboard.
4. Create custom store `ALTUM Web` in Apliiq Account > Stores. Creating persistent credentials through the browser requires action-time confirmation. Store app ID/shared secret securely in Vercel. Set fulfillment URL to `/api/webhooks/apliiq`.
5. Configure `.env.example` values in Vercel. `SITE_URL` is the exact public origin without trailing slash. All prices are integer US cents. Shipping must be explicit; zero intentionally means free. Supply approved EN/ES delivery and returns policies and customer support email.
6. Tax review is a launch gate, not automatic tax calculation. The current code adds no tax. Configure tax collection before launch if the business requires it; do not set `TAX_REVIEW_COMPLETE` without making that determination.
7. Set `SALES_ENABLED=true` in the sandbox, `STRIPE_LIVE_MODE=false`, `FULFILLMENT_ENABLED=false`. Complete a Stripe test checkout and verify the signed webhook records `test_paid`. Test payments never submit Apliiq orders.
8. Apliiq has no sandbox. Verify an approved paid sample separately. To launch, set the live Stripe key, matching webhook secret/account ID, `STRIPE_LIVE_MODE=true`, `FULFILLMENT_ENABLED=true`, and a random 32-byte `CRON_SECRET`. Vercel calls the protected worker every five minutes. Confirm the existing plan supports this schedule; no silent plan upgrades.

## Behavior

- Price and SKU are server controlled. Client amounts are ignored.
- Stripe signs raw request bodies; the session is retrieved again from Stripe and checked for paid status, exact amount, currency, shipping and account mode. Redirects never manufacture orders.
- Checkout uses a request UUID, Stripe idempotency and database uniqueness. Paid webhook processing locks the order in a transaction.
- Production claims each order atomically. Timeouts/ambiguous failures enter `needs_review`, without automatically repeating the factory POST.
- Apliiq HTTP 202 stays `provider_pending`, not production-confirmed.
- Tracking callbacks require a valid HMAC and matching order/line/SKU/quantity. Events are deduplicated.
- Customer status uses random 256-bit URL fragment tokens, not query strings. No customer address/email is exposed by the status endpoint.

## Reconciliation and service limits

Review `needs_review` and `provider_pending` orders daily. Read authenticated `GET https://api.apliiq.com/v1/Order?yearOrlastNoMonth=1` and match `StoreSystemOrderId`/`StoreOrderId` to the ALTUM order number. Reconcile provider ID and status when found. If absent, get Apliiq confirmation of non-receipt before manually requeuing. Never blindly repeat an ambiguous POST. Interrupted `submitting` rows older than five minutes automatically require review.

No inventory feed, merchant order dashboard, refund/exchange workflow or branded shipping email automation has been configured. Stripe receipts require Dashboard setup. Set customer privacy/retention policies and restrict database access before launch. Never log addresses, keys or raw payloads.

## Official references

- https://help.apliiq.com/portal/en/kb/articles/authentication
- https://help.apliiq.com/portal/en/kb/articles/create-order
- https://help.apliiq.com/portal/en/kb/articles/get-order
- https://help.apliiq.com/portal/en/kb/articles/fulfillment-url
- https://docs.stripe.com/checkout/fulfillment?payment-ui=stripe-hosted
- https://docs.stripe.com/keys
- https://vercel.com/docs/functions/runtimes/node-js

Apliiq uses `Authorization: x-apliiq-auth ...`, not a header named x-apliiq-auth. HMAC-SHA256 follows their code example (their prose contains a SHA265 typo).

## Rollback

`backup/pre-origo-store-2026-10-14` preserves the previous repository. Historical documents are in `docs/archive`. Restore through a revert commit, never force-push or erase history.
