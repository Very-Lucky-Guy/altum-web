# ALTUM — ORIGO / Drop 001

Dark bilingual flagship with three design editions, garment previews and an optional natural blink. Original is mapped to six confirmed Apliiq size SKUs.

## Run locally

```
npm ci
cp .env.example .env
npm run dev
```

Open http://localhost:8793. The visual experience works without credentials. Checkout remains closed until the required account and commercial configuration is complete.

## Stack

Static HTML/CSS/JavaScript, Vercel Node functions, Stripe hosted Checkout, Apliiq order/tracking API and durable PostgreSQL orders. No secrets in frontend assets. One piece per checkout at launch.

## Validation

`npm test` runs configuration, payment validation, Apliiq signatures and HTTP authorization tests. Set `TEST_DATABASE_URL` to a disposable database named `altum_test` for concurrent webhook, checkout idempotency and fulfillment tests. GitHub Actions runs the full suite with a disposable PostgreSQL service.

## Deployment

See [operations and outstanding setup](docs/OPERATIONS.md). Deployment alone does not enable live sales. Credentials belong in Vercel, never GitHub.

The historical blueprint in `docs/archive` is retained for reference. This implementation replaces its earlier FLOREBO/Shopify direction.
