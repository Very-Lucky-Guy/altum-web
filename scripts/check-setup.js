import { readiness } from '../lib/catalog.js';
import { db } from '../lib/db.js';
import { verifyAccount } from '../lib/payments.js';

// Operator-only: reports configuration names, never credential values or customer data.
const missing = readiness();
let failed = false;
const report = (name, state) => console.log(`${name}: ${state}`);
report('Live sales', process.env.SALES_ENABLED === 'true' && process.env.STRIPE_LIVE_MODE === 'true' ? 'enabled' : 'closed');
report('Factory orders', process.env.FULFILLMENT_ENABLED === 'true' ? 'enabled' : 'disabled');
report('Checkout configuration', missing.length ? `pending (${missing.join(', ')})` : 'complete');

if (process.env.SITE_URL) {
  try {
    const origin = new URL(process.env.SITE_URL);
    if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.search || origin.hash || origin.pathname !== '/') throw new Error();
    const response = await fetch(new URL('/api/catalog', origin), { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error();
    const catalog = await response.json();
    if (catalog.currency !== 'USD' || !catalog.editions?.original) throw new Error();
    report('Published catalog', `reachable; purchases ${catalog.available ? 'open' : 'closed'}`);
    report('Stripe callback URL', `${origin.origin}/api/webhooks/stripe`);
    report('Apliiq callback URL', `${origin.origin}/api/webhooks/apliiq`);
  } catch { report('Published catalog', 'failed; check SITE_URL and deployment'); failed = true; }
} else report('Published catalog', 'pending SITE_URL');

if (process.env.DATABASE_URL) {
  const sql = db();
  try {
    const rows = await sql`SELECT c.relname, c.relrowsecurity FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE n.nspname='altum' AND c.relname IN ('orders', 'events', 'rate_limits') AND c.relkind='r'`;
    if (rows.length !== 3 || rows.some(row => !row.relrowsecurity)) throw new Error();
    report('Order database', 'connected; all three tables have RLS enabled');
  } catch { report('Order database', 'failed; check connection and run npm run db:migrate'); failed = true; }
  finally { await sql.end(); }
} else report('Order database', 'pending DATABASE_URL');

if (process.env.STRIPE_SECRET_KEY && process.env.STRIPE_ACCOUNT_ID) {
  try { await verifyAccount(); report('Stripe account', 'verified against configured account'); }
  catch { report('Stripe account', 'failed; check account, key permissions and sandbox claim'); failed = true; }
} else report('Stripe account', 'pending account and server key');
report('Stripe webhook', process.env.STRIPE_WEBHOOK_SECRET ? 'signing secret configured; delivery still requires an end-to-end test' : 'pending signing secret');
report('Apliiq', process.env.APLIIQ_APP_ID && process.env.APLIIQ_SHARED_SECRET ? 'credentials configured; provider authentication not tested by this command' : 'pending custom-store credentials');
if (missing.length || failed) process.exitCode = 1;
