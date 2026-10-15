import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID, createHmac } from 'node:crypto';
import postgres from 'postgres';
import { quote, catalog, skus } from '../lib/catalog.js';
import { authorization, validCallback, orderPayload, submitOrder } from '../lib/apliiq.js';
import { acceptPayment, checkout, paymentMatches } from '../lib/payments.js';
import { runQueue } from '../lib/fulfillment.js';
import { acceptTracking } from '../lib/tracking.js';
import api from '../api/index.js';

const env = { SALES_ENABLED: 'true', STRIPE_LIVE_MODE: 'true', FULFILLMENT_ENABLED: 'true', DATABASE_URL: 'test', STRIPE_SECRET_KEY: 'test', STRIPE_WEBHOOK_SECRET: 'test', STRIPE_ACCOUNT_ID: 'acct_test', SITE_URL: 'https://altum.example', SUPPORT_EMAIL: 'test@example.com', SHIPPING_POLICY_EN: 'Test', SHIPPING_POLICY_ES: 'Test', RETURNS_POLICY_EN: 'Test', RETURNS_POLICY_ES: 'Test', TAX_REVIEW_COMPLETE: 'true', APLIIQ_APP_ID: 'test-app', APLIIQ_SHARED_SECRET: 'test-secret', CRON_SECRET: 'test-cron', ORIGO_PRICE_CENTS: '10000', US_SHIPPING_CENTS: '900' };
const customer = { name: 'Test Buyer', address: { country: 'US', line1: '1 Test Road', line2: null, city: 'New York', postal_code: '10001', state: 'NY' } };
function paid(order) { return { id: `cs_${order.id}`, mode: 'payment', payment_status: 'paid', livemode: order.live, currency: 'usd', client_reference_id: order.id, metadata: { altum_order_id: order.id }, amount_total: 10900, amount_subtotal: 10000, total_details: { amount_shipping: 900 }, collected_information: { shipping_details: customer }, customer_details: { email: 'test@example.com' } }; }
test('Server owns prices and rejects unmapped designs, invalid sizes and unconfigured sales', () => {
  assert.equal(quote({ edition: 'original', size: 'M', amount: 1 }, env).amount, 10000);
  for (const input of [{ edition: 'cobalt', size: 'M' }, { edition: 'original', size: '__proto__' }]) assert.throws(() => quote(input, env));
  assert.equal(catalog({}).available, false);
  assert.equal(catalog({ ...env, FULFILLMENT_ENABLED: 'false' }).available, false);
});
test('Apliiq signs exact bytes and rejects altered callbacks', () => {
  const body = '{"id":"10001"}';
  const sig = createHmac('sha256', 'secret').update(`app123nonce${Buffer.from(body).toString('base64')}`).digest('base64');
  assert.equal(authorization(body, 'app', 'secret', 123, 'nonce'), `x-apliiq-auth 123:${sig}:app:nonce`);
  const callback = createHmac('sha256', 'secret').update(Buffer.from(body).toString('base64')).digest('base64');
  assert(validCallback(body, callback, 'secret'));
  assert(!validCallback(body + ' ', callback, 'secret'));
  assert(!validCallback(body, '', 'secret'));
});
test('Payment matching requires paid status, exact amounts, account mode and US shipping', () => {
  const order = { id: randomUUID(), quote: { amount: 10000, shipping: 900 }, live: true };
  const session = paid(order);
  assert(paymentMatches(order, session));
  for (const patch of [{ payment_status: 'unpaid' }, { amount_total: 1 }, { livemode: false }, { currency: 'eur' }, { collected_information: null }, { client_reference_id: 'another-order' }]) assert(!paymentMatches(order, { ...session, ...patch }));
});
test('Apliiq 202 stays pending, test payments never submit and failure never retries', async () => {
  const order = { id: randomUUID(), number: 10001, live: true, quote: { amount: 10000, size: 'M', sku: skus.M }, customer };
  assert.equal(orderPayload(order).shipping_address.first_name, 'Test');
  let calls = 0;
  const fetcher = async () => { calls++; return new Response('{}', { status: 202 }); };
  assert.equal((await submitOrder(order, env, fetcher)).state, 'provider_pending');
  await assert.rejects(submitOrder({ ...order, live: false }, env, fetcher));
  assert.equal(calls, 1);
  await assert.rejects(submitOrder(order, env, async () => { calls++; throw new Error('timeout'); }));
  assert.equal(calls, 2);
});
test('HTTP rejects unauthenticated fulfillment and unsigned factory callbacks', async () => {
  assert.equal((await api.fetch(new Request('http://localhost/api/fulfill'))).status, 401);
  assert.equal((await api.fetch(new Request('http://localhost/api/webhooks/apliiq', { method: 'POST', body: '{}' }))).status, 401);
  assert.equal((await api.fetch(new Request('http://localhost/api/checkout', { method: 'POST', body: '{}' }))).status, 403);
});
test('Authorized scheduled worker stays idle while factory fulfillment is disabled and database is not installed', async () => {
  const previous = Object.fromEntries(['CRON_SECRET', 'FULFILLMENT_ENABLED', 'DATABASE_URL'].map(key => [key, process.env[key]]));
  try {
    process.env.CRON_SECRET = 'test-worker-secret';
    process.env.FULFILLMENT_ENABLED = 'false';
    delete process.env.DATABASE_URL;
    const response = await api.fetch(new Request('http://localhost/api/fulfill', { headers: { authorization: 'Bearer test-worker-secret' } }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { processed: 0 });
    assert.equal((await api.fetch(new Request('http://localhost/api/fulfill'))).status, 401);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
});
test('PostgreSQL: concurrent callbacks and workers manufacture each paid piece at most once', { skip: !process.env.TEST_DATABASE_URL }, async t => {
  const sql = postgres(process.env.TEST_DATABASE_URL, { max: 8 });
  try {
    // This suite must run only against the isolated, disposable test database.
    const [database] = await sql`SELECT current_database() AS name`;
    assert.equal(database.name, 'altum_test');
    await sql.unsafe(await readFile(new URL('../db/schema.sql', import.meta.url), 'utf8'));
    await sql`TRUNCATE altum.events, altum.orders, altum.rate_limits CASCADE`;
    async function makeOrder(live = true) {
      const [order] = await sql`INSERT INTO altum.orders (id, request_key, token, quote, language, live)
        VALUES (${randomUUID()}, ${randomUUID()}, ${randomUUID()}, ${sql.json({ amount: 10000, shipping: 900, sku: skus.M, size: 'M', edition: 'original' })}, 'en', ${live}) RETURNING *`;
      return order;
    }
    const order = await makeOrder();
    const session = paid(order);
    await acceptPayment(sql, { id: 'evt_unpaid' }, { ...session, payment_status: 'unpaid' });
    assert.equal((await sql`SELECT state FROM altum.orders WHERE id=${order.id}`)[0].state, 'checkout_pending');
    await Promise.all(Array.from({ length: 8 }, () => acceptPayment(sql, { id: 'evt_paid' }, session)));
    await acceptPayment(sql, { id: 'evt_async_paid' }, session);
    let submissions = 0;
    const submit = async () => { submissions++; await new Promise(r => setTimeout(r, 30)); return { state: 'production', providerId: 'factory-123' }; };
    await Promise.all(Array.from({ length: 6 }, () => runQueue(sql, env, submit)));
    assert.equal(submissions, 1);
    assert.equal((await sql`SELECT state FROM altum.orders WHERE id=${order.id}`)[0].state, 'production');
    const callback = JSON.stringify({ fulfillment: { order_id: String(order.number), status: 'success', line_items: [{ id: order.id, sku: skus.M, quantity: 1 }], tracking_company: 'USPS', tracking_numbers: ['TEST123'] } });
    await Promise.all([acceptTracking(sql, callback), acceptTracking(sql, callback)]);
    assert.equal((await sql`SELECT state FROM altum.orders WHERE id=${order.id}`)[0].state, 'shipped');
    const failed = await makeOrder(); await acceptPayment(sql, { id: 'evt_failed' }, paid(failed));
    let failureCalls = 0;
    const fails = async () => { failureCalls++; throw new Error('Timeout after sending order'); };
    await runQueue(sql, env, fails); await runQueue(sql, env, fails);
    assert.equal(failureCalls, 1);
    assert.equal((await sql`SELECT state FROM altum.orders WHERE id=${failed.id}`)[0].state, 'needs_review');
    const sandbox = await makeOrder(false); await acceptPayment(sql, { id: 'evt_sandbox' }, paid(sandbox));
    await runQueue(sql, env, fails); assert.equal(failureCalls, 1);
    assert.equal((await sql`SELECT state FROM altum.orders WHERE id=${sandbox.id}`)[0].state, 'test_paid');
    const mismatch = await makeOrder(); await acceptPayment(sql, { id: 'evt_mismatch' }, { ...paid(mismatch), amount_total: 1 });
    assert.equal((await sql`SELECT state FROM altum.orders WHERE id=${mismatch.id}`)[0].state, 'needs_review');
    const requestKey = randomUUID(); const sessions = new Map();
    const payments = { checkout: { sessions: { create: async (params, options) => { if (!sessions.has(options.idempotencyKey)) sessions.set(options.idempotencyKey, { id: 'cs_idempotent', url: 'https://checkout.stripe.com/test', livemode: true }); return sessions.get(options.idempotencyKey); }, retrieve: async () => ({ status: 'open', url: 'https://checkout.stripe.com/test' }) } } };
    await Promise.all(Array.from({ length: 4 }, () => checkout(sql, { requestKey, edition: 'original', size: 'M' }, 'test-ip', env, payments)));
    assert.equal(sessions.size, 1);
    assert.equal((await sql`SELECT count(*)::int AS n FROM altum.orders WHERE request_key=${requestKey}`)[0].n, 1);
  } finally { await sql.end(); }
});
