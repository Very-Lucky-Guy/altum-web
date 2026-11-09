// Store variant IDs must come from the black products published from these
// specific Airventory templates. Never substitute a template ID for a variant.
export const sizes = Object.freeze(['XS','S','M','L','XL','2XL']);
export const templates = Object.freeze({ original: '4347', cobalt: '6255', fuchsia: '6256' });
export const shop = 'aikiij-wf.myshopify.com';

function wooOrigin(env) {
  try {
    const url = new URL(env.ORIGO_WOO_ORIGIN);
    if (url.protocol === 'https:' && !url.username && !url.password &&
        url.pathname === '/' && !url.search && !url.hash) return url.origin;
  } catch { /* The store is not configured yet. */ }
  return null;
}

function mappings(env) {
  const woo = env.ORIGO_WOO_LIVE === 'true';
  if (woo ? !wooOrigin(env) : env.ORIGO_SHOPIFY_LIVE !== 'true') return null;
  let map;
  try { map = JSON.parse(woo ? env.ORIGO_WOO_MAP : env.ORIGO_SHOPIFY_MAP); } catch { return null; }
  const seen = new Set();
  for (const [edition, template] of Object.entries(templates)) {
    const row = map?.[edition];
    if (row?.template !== template || row.color !== 'Black') return null;
    for (const size of sizes) {
      const id = row.variants?.[size];
      if (typeof id !== 'string' || !/^[1-9][0-9]{0,19}$/.test(id) || seen.has(id)) return null;
      seen.add(id);
    }
  }
  return map;
}

export function origoCatalog(env = process.env) {
  return {
    available: !!mappings(env), checkoutHost: env.ORIGO_WOO_LIVE === 'true' && wooOrigin(env) ? new URL(wooOrigin(env)).host : shop, currency: null,
    editions: Object.fromEntries(Object.entries(templates).map(([edition, template]) =>
      [edition, { name: 'ORIGO ' + edition[0].toUpperCase() + edition.slice(1), template, color: 'Black', sizes, price: null }])),
    supportEmail: env.SUPPORT_EMAIL || null,
    policies: Object.fromEntries(['en','es'].map(lang => [lang, {
      shipping: env['SHIPPING_POLICY_' + lang.toUpperCase()] || null,
      returns: env['RETURNS_POLICY_' + lang.toUpperCase()] || null
    }]))
  };
}

export function origoCheckout(input, env = process.env) {
  const map = mappings(env);
  if (!map) throw Object.assign(new Error('Purchases are not open yet.'), {status:503});
  if (typeof input?.edition !== 'string' || !Object.hasOwn(templates, input.edition) || !sizes.includes(input.size))
    throw Object.assign(new Error('Choose an available edition and size.'), {status:400});
  if (env.ORIGO_WOO_LIVE === 'true') {
    const url = new URL('/checkout-link/', wooOrigin(env));
    url.searchParams.set('products', map[input.edition].variants[input.size] + ':1');
    return {url: url.href};
  }
  const url = new URL('/cart/' + map[input.edition].variants[input.size] + ':1', 'https://' + shop);
  url.searchParams.set('locale', input.language === 'es' ? 'es' : 'en');
  return {url:url.href};
}
