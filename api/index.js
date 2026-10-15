import { timingSafeEqual } from 'node:crypto';
import { catalog } from '../lib/catalog.js';
import { db } from '../lib/db.js';
import { stripe, verifyAccount, checkout, acceptPayment } from '../lib/payments.js';
import { runQueue } from '../lib/fulfillment.js';
import { validCallback } from '../lib/apliiq.js';
import { acceptTracking } from '../lib/tracking.js';

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
function authorized(value, secret) {
  if (!value || !secret) return false;
  const a = Buffer.from(value), b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}
async function body(request) {
  let size = 0, chunks = [];
  if (request.body) for await (const chunk of request.body) { size += chunk.length; if (size > 262144) throw Object.assign(new Error('Request too large'), { status: 413 }); chunks.push(Buffer.from(chunk)); }
  return Buffer.concat(chunks).toString('utf8');
}
export default { async fetch(request) {
  const { pathname } = new URL(request.url);
  try {
    if (request.method === 'GET' && pathname === '/api/catalog') return json(catalog());
    if (request.method === 'POST' && pathname === '/api/checkout') {
      if (!process.env.SITE_URL || request.headers.get('origin') !== new URL(process.env.SITE_URL).origin) return json({ error: 'Invalid origin' }, 403);
      if (!request.headers.get('content-type')?.includes('application/json')) return json({ error: 'JSON required' }, 415);
      const input = JSON.parse(await body(request));
      if (!input || typeof input !== 'object') return json({ error: 'Invalid request' }, 400);
      if (!catalog().available) return json({ error: 'Purchases are not open yet.' }, 503);
      await verifyAccount();
      return json(await checkout(db(), input, request.headers.get('x-vercel-forwarded-for') || 'local'));
    }
    if (request.method === 'POST' && pathname === '/api/webhooks/stripe') {
      if (!process.env.STRIPE_WEBHOOK_SECRET) return json({ error: 'Not configured' }, 503);
      let event;
      try { event = stripe().webhooks.constructEvent(await body(request), request.headers.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET); }
      catch { return json({ error: 'Invalid signature' }, 400); }
      if (event.livemode !== (process.env.STRIPE_LIVE_MODE === 'true')) return json({ received: true, ignored: true });
      if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) return json({ received: true });
      if (!/^[0-9a-f-]{36}$/.test(event.data.object.metadata?.altum_order_id || '')) return json({ received: true, ignored: true });
      await verifyAccount();
      const session = await stripe().checkout.sessions.retrieve(event.data.object.id);
      return json(await acceptPayment(db(), event, session));
    }
    if (request.method === 'POST' && pathname === '/api/webhooks/apliiq') {
      const raw = await body(request);
      if (!validCallback(raw, request.headers.get('x-apliiq-hmac'), process.env.APLIIQ_SHARED_SECRET)) return json({ error: 'Invalid signature' }, 401);
      return json(await acceptTracking(db(), raw));
    }
    if (request.method === 'GET' && pathname === '/api/fulfill') {
      if (!authorized(request.headers.get('authorization'), process.env.CRON_SECRET)) return json({ error: 'Unauthorized' }, 401);
      if (process.env.FULFILLMENT_ENABLED !== 'true') return json({ processed: 0 });
      const sql = db();
      const result = await runQueue(sql);
      await sql`DELETE FROM altum.rate_limits WHERE expires_at < now()`;
      return json(result);
    }
    if (request.method === 'POST' && pathname === '/api/order') {
      const { token } = JSON.parse(await body(request));
      if (!/^[a-f0-9]{64}$/.test(token || '')) return json({ error: 'Order not found' }, 404);
      const [order] = await db()`SELECT number, quote, state, tracking FROM altum.orders WHERE token=${token}`;
      if (!order) return json({ error: 'Order not found' }, 404);
      return json({ number: String(order.number), edition: order.quote.edition, size: order.quote.size, state: order.state, tracking: order.tracking });
    }
    return json({ error: 'Not found' }, 404);
  } catch (error) {
    if (error instanceof SyntaxError) return json({ error: 'Invalid JSON' }, 400);
    // Do not log request bodies, credentials, customer addresses or payment data.
    console.error('ALTUM request failed', { path: pathname, type: error.name, status: error.status || 500 });
    return json({ error: error.status ? error.message : 'We could not complete this request. Please try again shortly.' }, error.status || 500);
  }
} };
