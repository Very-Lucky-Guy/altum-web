import { submitOrder } from './apliiq.js';

export async function runQueue(sql, env = process.env, submit = submitOrder) {
  if (env.FULFILLMENT_ENABLED !== 'true') return { processed: 0 };
  // An interrupted submission may have reached the factory. It needs reconciliation.
  await sql`UPDATE altum.orders SET state='needs_review', last_error='Interrupted submission; reconcile with Apliiq', updated_at=now()
    WHERE state='submitting' AND updated_at < now() - interval '5 minutes'`;
  let processed = 0;
  for (let i = 0; i < 3; i++) {
    const orders = await sql`UPDATE altum.orders SET state='submitting', updated_at=now()
      WHERE id = (SELECT id FROM altum.orders WHERE state='paid' AND live=true
        ORDER BY created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`;
    if (!orders.length) break;
    const order = orders[0];
    try {
      const result = await submit(order, env);
      await sql`UPDATE altum.orders SET state=${result.state}, provider_id=${result.providerId}, updated_at=now()
        WHERE id=${order.id} AND state='submitting'`;
    } catch (error) {
      await sql`UPDATE altum.orders SET state='needs_review', last_error=${String(error.message).slice(0, 200)}, updated_at=now()
        WHERE id=${order.id} AND state='submitting'`;
    }
    processed++;
  }
  return { processed };
}
