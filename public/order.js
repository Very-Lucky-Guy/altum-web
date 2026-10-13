(() => {
  let language = 'en', order = null, attempts = 0, support = null;
  const token = location.hash.slice(1);
  const states = {
    en: { checkout_pending: 'We are waiting for payment confirmation. This page updates automatically.', paid: 'Payment confirmed. Your piece is awaiting production.', submitting: 'Payment confirmed. We are arranging production.', provider_pending: 'Payment confirmed. Your order is awaiting confirmation from our production partner.', production: 'Your piece is in production.', shipped: 'Your piece has shipped.', test_paid: 'Test payment confirmed. No garment will be produced.', needs_review: 'Your order needs attention from our team. Please contact us with your order number.' },
    es: { checkout_pending: 'Estamos esperando la confirmación del pago. Esta página se actualiza automáticamente.', paid: 'Pago confirmado. Tu pieza está a la espera de producción.', submitting: 'Pago confirmado. Estamos coordinando la producción.', provider_pending: 'Pago confirmado. Estamos esperando la confirmación de nuestro proveedor.', production: 'Tu pieza está en producción.', shipped: 'Tu pieza ha sido enviada.', test_paid: 'Pago de prueba confirmado. No se producirá una prenda.', needs_review: 'Nuestro equipo debe revisar tu pedido. Contáctanos indicando su número.' }
  };
  function render() {
    document.documentElement.lang = language;
    document.querySelector('#order-language').textContent = language === 'en' ? 'ES' : 'EN';
    document.querySelector('#order-title').textContent = language === 'en' ? 'Your piece.' : 'Tu pieza.';
    document.querySelector('#return-link').textContent = language === 'en' ? 'RETURN TO ALTUM' : 'VOLVER A ALTUM';
    document.querySelector('#order-message').textContent = order ? (states[language][order.state] || states[language].needs_review) : language === 'en' ? 'We could not retrieve this order. Please use the link provided at checkout.' : 'No pudimos consultar este pedido. Utiliza el enlace que recibiste al pagar.';
    document.querySelector('#order-reference').textContent = order ? `ALTUM-${order.number} / ORIGO Original / ${order.size}` : '';
    document.querySelector('#tracking').replaceChildren(...(order?.tracking || []).map(item => { const p = document.createElement('p'); p.textContent = `${item.carrier}: ${item.number}`; return p; }));
    const node = document.querySelector('#order-support'); node.replaceChildren();
    if (support) { const a = document.createElement('a'); a.href = `mailto:${support}`; a.textContent = support; node.append(a); }
  }
  async function refresh() {
    try { const r = await fetch('/api/order', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token }) }); if (!r.ok) throw new Error(); order = await r.json(); }
    catch { order = null; }
    render();
    if (order && attempts++ < 30 && ['checkout_pending', 'paid', 'submitting'].includes(order.state)) setTimeout(refresh, 10000);
  }
  document.querySelector('#order-language').addEventListener('click', () => { language = language === 'en' ? 'es' : 'en'; render(); });
  fetch('/api/catalog').then(r => r.json()).then(data => { support = data.supportEmail; render(); }).catch(() => {});
  refresh();
})();
