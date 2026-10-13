(() => {
  let catalog = null, busy = false, requestKey = null, selection = { edition: 'original', size: null, language: 'en' };
  const button = document.querySelector('#purchase');
  const note = document.querySelector('#purchase-note');
  const copy = {
    en: { soon: 'COMING SOON', choose: 'SELECT YOUR SIZE', buy: 'PURCHASE THIS PIECE', opening: 'OPENING CHECKOUT', notOpen: 'This edition is not yet available for purchase.', unavailable: 'The boutique is temporarily unavailable. Please return shortly.', shipping: 'US delivery', included: 'US delivery included', test: 'Preview checkout — no real payment.', policies: 'Delivery and return details will be published when this edition opens.', error: 'Checkout could not be opened. Please try again.', cancelled: 'Your checkout was cancelled. No new order has been confirmed.' },
    es: { soon: 'PRÓXIMAMENTE', choose: 'ELIGE TU TALLA', buy: 'ADQUIRIR ESTA PIEZA', opening: 'ABRIENDO PAGO', notOpen: 'Esta edición aún no está disponible para comprar.', unavailable: 'La boutique no está disponible temporalmente. Vuelve en unos momentos.', shipping: 'Envío a USA', included: 'Envío a USA incluido', test: 'Pago de prueba — sin cobro real.', policies: 'Los detalles de envío y devolución se publicarán al abrir esta edición.', error: 'No pudimos abrir el pago. Inténtalo nuevamente.', cancelled: 'Cancelaste el pago. No se ha confirmado un nuevo pedido.' }
  };
  const money = n => new Intl.NumberFormat(selection.language === 'es' ? 'es-US' : 'en-US', { style: 'currency', currency: 'USD' }).format(n / 100);
  function render() {
    const text = copy[selection.language], item = catalog?.editions[selection.edition];
    const ready = catalog?.available && item?.sizes.length > 0;
    button.disabled = !ready || !item.sizes.includes(selection.size) || busy;
    button.textContent = busy ? text.opening : !ready ? text.soon : !selection.size ? text.choose : text.buy;
    document.querySelector('#piece-price').textContent = item?.price ? `${money(item.price)} USD` : '';
    note.textContent = !catalog ? text.unavailable : !ready ? text.notOpen : catalog.testMode ? text.test : catalog.shipping === 0 ? text.included : `${text.shipping}: ${money(catalog.shipping)}`;
    document.querySelector('#shipping-policy').textContent = catalog?.policies[selection.language].shipping || text.policies;
    document.querySelector('#returns-policy').textContent = catalog?.policies[selection.language].returns || '';
    const service = document.querySelector('#customer-service'); service.replaceChildren();
    if (catalog?.supportEmail) { const a = document.createElement('a'); a.href = `mailto:${catalog.supportEmail}`; a.textContent = catalog.supportEmail; service.append(a); }
  }
  document.addEventListener('selectionchange', event => { if (selection.edition !== event.detail.edition || selection.size !== event.detail.size) requestKey = null; selection = event.detail; render(); });
  button.addEventListener('click', async () => {
    if (button.disabled || busy) return;
    busy = true; requestKey ||= crypto.randomUUID(); render();
    try {
      const response = await fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...selection, requestKey }) });
      const data = await response.json();
      if (!response.ok) { if (response.status === 409) requestKey = null; throw new Error('Checkout failed'); }
      const url = new URL(data.url);
      if (url.protocol !== 'https:' || url.hostname !== 'checkout.stripe.com') throw new Error('Invalid checkout');
      window.location.assign(url.href);
    } catch { busy = false; render(); note.textContent = copy[selection.language].error; }
  });
  fetch('/api/catalog').then(r => { if (!r.ok) throw new Error(); return r.json(); }).then(data => { catalog = data; render(); }).catch(render);
  render();
  if (new URLSearchParams(location.search).get('checkout') === 'cancelled') {
    openWork('original'); note.textContent = copy.en.cancelled;
    history.replaceState(null, '', '/#works');
  }
})();
