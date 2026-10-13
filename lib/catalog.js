export const skus = Object.freeze({
  S: 'APQ-6202398S6A1', M: 'APQ-6202398S7A1', L: 'APQ-6202398S8A1',
  XL: 'APQ-6202398S1A1', '2XL': 'APQ-6202398S2A1', '3XL': 'APQ-6202398S21A1'
});
export function cents(value, allowZero = false) {
  return /^\d+$/.test(value || '') && Number.isSafeInteger(Number(value)) &&
    Number(value) >= (allowZero ? 0 : 1) && Number(value) <= 1000000 ? Number(value) : null;
}
export function readiness(env = process.env) {
  const missing = ['DATABASE_URL', 'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'STRIPE_ACCOUNT_ID',
    'SITE_URL', 'SUPPORT_EMAIL', 'SHIPPING_POLICY_EN', 'SHIPPING_POLICY_ES', 'RETURNS_POLICY_EN',
    'RETURNS_POLICY_ES'].filter(k => !env[k]);
  if (cents(env.ORIGO_PRICE_CENTS) === null) missing.push('ORIGO_PRICE_CENTS');
  if (cents(env.US_SHIPPING_CENTS, true) === null) missing.push('US_SHIPPING_CENTS');
  if (env.SALES_ENABLED !== 'true') missing.push('SALES_ENABLED');
  if (env.TAX_REVIEW_COMPLETE !== 'true') missing.push('TAX_REVIEW_COMPLETE');
  if (env.STRIPE_LIVE_MODE === 'true') {
    for (const key of ['APLIIQ_APP_ID', 'APLIIQ_SHARED_SECRET', 'CRON_SECRET']) if (!env[key]) missing.push(key);
    if (env.FULFILLMENT_ENABLED !== 'true') missing.push('FULFILLMENT_ENABLED');
  }
  return missing;
}
export function catalog(env = process.env) {
  return {
    currency: 'USD', available: readiness(env).length === 0,
    testMode: env.STRIPE_LIVE_MODE !== 'true',
    editions: { original: { price: cents(env.ORIGO_PRICE_CENTS), sizes: Object.keys(skus) }, cobalt: { price: null, sizes: [] }, fuchsia: { price: null, sizes: [] } },
    shipping: cents(env.US_SHIPPING_CENTS, true), supportEmail: env.SUPPORT_EMAIL || null,
    policies: { en: { shipping: env.SHIPPING_POLICY_EN || null, returns: env.RETURNS_POLICY_EN || null }, es: { shipping: env.SHIPPING_POLICY_ES || null, returns: env.RETURNS_POLICY_ES || null } }
  };
}
export function quote(input, env = process.env) {
  if (readiness(env).length) throw Object.assign(new Error('Purchases are not open yet.'), { status: 503 });
  if (input.edition !== 'original' || !Object.hasOwn(skus, input.size)) throw Object.assign(new Error('Choose an available edition and size.'), { status: 400 });
  return { edition: 'original', size: input.size, sku: skus[input.size], quantity: 1,
    amount: cents(env.ORIGO_PRICE_CENTS), shipping: cents(env.US_SHIPPING_CENTS, true), currency: 'usd' };
}
