import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

export function authorization(body, appId, secret, timestamp = Math.floor(Date.now() / 1000), nonce = randomUUID().replaceAll('-', '')) {
  const encoded = Buffer.from(body).toString('base64');
  const signature = createHmac('sha256', secret).update(`${appId}${timestamp}${nonce}${encoded}`).digest('base64');
  return `x-apliiq-auth ${timestamp}:${signature}:${appId}:${nonce}`;
}
export function validCallback(raw, supplied, secret) {
  if (!supplied || !secret) return false;
  const expected = createHmac('sha256', secret).update(Buffer.from(raw).toString('base64')).digest('base64');
  const a = Buffer.from(expected), b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function orderPayload(order) {
  const { name, address, phone } = order.customer;
  if (address.country !== 'US') throw new Error('Unsupported shipping country');
  const parts = name.trim().split(/\s+/);
  return {
    id: String(order.number), number: String(order.number), name: `ALTUM-${order.number}`, order_number: Number(order.number),
    line_items: [{ id: order.id, title: 'ALTUM ORIGO — Original', quantity: 1,
      price: (order.quote.amount / 100).toFixed(2), grams: 0, sku: order.quote.sku,
      name: `ORIGO / Original / ${order.quote.size} / Black` }],
    shipping_address: { first_name: parts.shift(), last_name: parts.join(' ') || '', name,
      address1: address.line1, address2: address.line2 || '', city: address.city,
      zip: address.postal_code, province: address.state, province_code: address.state,
      country: 'United States', country_code: 'US', phone: phone || '' },
    shipping_lines: [{ code: 'standard' }]
  };
}
export async function submitOrder(order, env = process.env, fetcher = fetch) {
  if (!order.live || env.FULFILLMENT_ENABLED !== 'true' || !env.APLIIQ_APP_ID || !env.APLIIQ_SHARED_SECRET) throw new Error('Live fulfillment is not enabled');
  const body = JSON.stringify(orderPayload(order));
  // Never automatically retry this POST: Apliiq has no documented idempotency key.
  const response = await fetcher('https://api.apliiq.com/v1/Order', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: authorization(body, env.APLIIQ_APP_ID, env.APLIIQ_SHARED_SECRET) },
    body, signal: AbortSignal.timeout(20000)
  });
  if (response.status === 202) return { state: 'provider_pending', providerId: null };
  if (response.status !== 200) throw new Error(`Apliiq HTTP ${response.status}; reconcile before retrying`);
  const data = await response.json();
  if (!data.id) throw new Error('Apliiq response missing order ID; reconcile before retrying');
  return { state: 'production', providerId: String(data.id) };
}
