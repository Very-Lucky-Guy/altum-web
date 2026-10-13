import Stripe from 'stripe';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { quote } from './catalog.js';
let client, accountCheck;
export function stripe() {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('Payments are not configured');
  return client ||= new Stripe(process.env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2 });
}
export async function verifyAccount() {
  accountCheck ||= stripe().accounts.retrieve().then(account => {
    if (account.id !== process.env.STRIPE_ACCOUNT_ID) throw new Error('Stripe account does not match ALTUM configuration');
    if (process.env.STRIPE_LIVE_MODE === 'true' && !account.charges_enabled) throw new Error('Stripe account cannot accept live payments');
    return account;
  }).catch(error => { accountCheck = null; throw error; });
  return accountCheck;
}
export async function checkout(sql, input, ip, env = process.env, payments = stripe()) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.requestKey || ''))
    throw Object.assign(new Error('Invalid checkout request.'), { status: 400 });
  const snapshot = quote(input, env), live = env.STRIPE_LIVE_MODE === 'true';
  const key = createHash('sha256').update(`${ip}:${Math.floor(Date.now() / 3600000)}`).digest('hex');
  const [limit] = await sql`INSERT INTO altum.rate_limits (key, expires_at) VALUES (${key}, now() + interval '2 hours')
    ON CONFLICT (key) DO UPDATE SET hits=altum.rate_limits.hits+1 RETURNING hits`;
  if (limit.hits > 20) throw Object.assign(new Error('Please try again later.'), { status: 429 });
  const id = randomUUID(), token = randomBytes(32).toString('hex');
  await sql`INSERT INTO altum.orders (id, request_key, token, quote, language, live)
    VALUES (${id}, ${input.requestKey}, ${token}, ${sql.json(snapshot)}, ${input.language === 'es' ? 'es' : 'en'}, ${live})
    ON CONFLICT (request_key) DO NOTHING`;
  const [order] = await sql`SELECT * FROM altum.orders WHERE request_key=${input.requestKey}`;
  if (order.quote.sku !== snapshot.sku || order.quote.amount !== snapshot.amount || order.quote.shipping !== snapshot.shipping || order.live !== live)
    throw Object.assign(new Error('Selection changed. Please start a new checkout.'), { status: 409 });
  if (order.session_id) {
    const session = await payments.checkout.sessions.retrieve(order.session_id);
    if (session.status !== 'open') throw Object.assign(new Error('This checkout is closed. Please start again.'), { status: 409 });
    return { url: session.url };
  }
  if (Date.now() - new Date(order.created_at).getTime() > 23 * 3600000) throw Object.assign(new Error('Checkout expired. Please start again.'), { status: 409 });
  const session = await payments.checkout.sessions.create({
    mode: 'payment', client_reference_id: order.id,
    integration_identifier: 'altum_origo_qxnmvbra',
    locale: order.language,
    line_items: [{ price_data: { currency: 'usd', unit_amount: snapshot.amount, product_data: {
      name: `ORIGO — Original / ${snapshot.size}`, description: 'ALTUM / Drop 001 / Black oversized tee',
      metadata: { sku: snapshot.sku }, images: [`${env.SITE_URL}/assets/back-dark.webp`]
    } }, quantity: 1 }],
    shipping_address_collection: { allowed_countries: ['US'] },
    shipping_options: [{ shipping_rate_data: { display_name: 'Standard US delivery', type: 'fixed_amount', fixed_amount: { amount: snapshot.shipping, currency: 'usd' } } }],
    metadata: { altum_order_id: order.id },
    payment_intent_data: { metadata: { altum_order_id: order.id } },
    success_url: `${env.SITE_URL}/order.html#${order.token}`,
    cancel_url: `${env.SITE_URL}/?checkout=cancelled#works`,
    custom_text: { submit: { message: order.language === 'es' ? 'Tu pieza se produce bajo pedido. Consulta los plazos y condiciones en la ficha de la obra.' : 'Your piece is made to order. Please review delivery and return details on the product page.' } }
  }, { idempotencyKey: `altum-checkout-${order.id}` });
  if (session.livemode !== live) {
    await payments.checkout.sessions.expire(session.id);
    throw new Error('Stripe mode does not match store configuration');
  }
  await sql`UPDATE altum.orders SET session_id=${session.id}, updated_at=now() WHERE id=${order.id}`;
  return { url: session.url };
}
export function paymentMatches(order, session) {
  const shipping = session.collected_information?.shipping_details;
  return session.mode === 'payment' && session.payment_status === 'paid' &&
    session.livemode === order.live && session.currency === 'usd' &&
    session.client_reference_id === order.id && session.metadata?.altum_order_id === order.id &&
    (!order.session_id || session.id === order.session_id) &&
    session.amount_total === order.quote.amount + order.quote.shipping &&
    session.amount_subtotal === order.quote.amount && session.total_details?.amount_shipping === order.quote.shipping &&
    shipping?.name && shipping.address?.country === 'US' && shipping.address.line1 && shipping.address.city && shipping.address.postal_code && shipping.address.state;
}
export async function acceptPayment(sql, event, session) {
  if (session.payment_status !== 'paid') return { received: true, pending: true };
  return sql.begin(async tx => {
    const [order] = await tx`SELECT * FROM altum.orders WHERE id=${session.metadata?.altum_order_id} FOR UPDATE`;
    if (!order) return { received: true, ignored: true };
    const eventRows = await tx`INSERT INTO altum.events (id, provider, order_id) VALUES (${event.id}, 'stripe', ${order.id}) ON CONFLICT DO NOTHING RETURNING id`;
    if (!eventRows.length) return { received: true, duplicate: true };
    if (order.state !== 'checkout_pending') return { received: true };
    if (!paymentMatches(order, session)) {
      await tx`UPDATE altum.orders SET state='needs_review', last_error='Payment verification mismatch', updated_at=now() WHERE id=${order.id}`;
      return { received: true, review: true };
    }
    const details = session.collected_information.shipping_details;
    const customer = { name: details.name, address: details.address, email: session.customer_details?.email, phone: session.customer_details?.phone };
    await tx`UPDATE altum.orders SET state=${order.live ? 'paid' : 'test_paid'}, session_id=${session.id}, customer=${tx.json(customer)}, updated_at=now() WHERE id=${order.id}`;
    return { received: true };
  });
}
