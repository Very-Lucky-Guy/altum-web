import { createHash } from 'node:crypto';
export async function acceptTracking(sql, raw) {
  const data = JSON.parse(raw), fulfillment = data.fulfillment;
  if (!fulfillment?.order_id || fulfillment.status !== 'success') return { received: true, ignored: true };
  const eventId = `apliiq-${createHash('sha256').update(raw).digest('hex')}`;
  return sql.begin(async tx => {
    const [order] = await tx`SELECT * FROM altum.orders WHERE number::text=${String(fulfillment.order_id)} AND live=true FOR UPDATE`;
    if (!order || !['submitting', 'provider_pending', 'production', 'shipped', 'needs_review'].includes(order.state) || !order.customer) return { received: true, ignored: true };
    const matching = fulfillment.line_items?.some(item => String(item.id) === order.id && item.sku === order.quote.sku && item.quantity === 1);
    if (!matching) return { received: true, ignored: true };
    const inserted = await tx`INSERT INTO altum.events (id, provider, order_id) VALUES (${eventId}, 'apliiq', ${order.id}) ON CONFLICT DO NOTHING RETURNING id`;
    if (!inserted.length) return { received: true, duplicate: true };
    const tracking = (fulfillment.tracking_numbers || []).filter(n => typeof n === 'string').map(number => ({ number: number.slice(0, 100), carrier: String(fulfillment.tracking_company || '').slice(0, 80) }));
    await tx`UPDATE altum.orders SET state='shipped', tracking=${tx.json(tracking)}, updated_at=now() WHERE id=${order.id}`;
    return { received: true };
  });
}
