(() => {
  const endpointValue = String(window.OFFCUT_ORDER_API_URL || '').trim();
  const endpoint = /^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/i.test(endpointValue) ? endpointValue : '';
  const lineUrl = 'https://lin.ee/vr8g6ui';

  function logUnconfigured() {
    console.warn('[OFFCUT] Remote order backend not configured. This action is saved on this device only.');
  }

  function send(event, order) {
    if (!endpoint) {
      logUnconfigured();
      return Promise.resolve({ configured: false, dispatched: false, confirmed: false, reason: 'not-configured' });
    }
    const payload = JSON.stringify({ event, order, sentAt: new Date().toISOString() });
    // text/plain is a CORS-simple request. GAS receives it; browsers may hide the
    // cross-origin response, so never claim that the Sheet or email was confirmed.
    return fetch(endpoint, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      body: payload,
      keepalive: true
    }).then(() => ({ configured: true, dispatched: true, confirmed: false, reason: 'response-unavailable' }))
      .catch(error => {
        console.warn('[OFFCUT] Remote order backend request failed.', error);
        return { configured: true, dispatched: false, confirmed: false, reason: 'network-error' };
      });
  }

  function jsonp(params, timeoutMs = 12000) {
    if (!endpoint) {
      logUnconfigured();
      return Promise.resolve({ configured: false, ok: false, reason: 'not-configured' });
    }
    return new Promise(resolve => {
      const callback = `offcutJsonp${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
      const script = document.createElement('script');
      const url = new URL(endpoint);
      url.searchParams.set('action', 'lookup');
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, String(value || '')));
      url.searchParams.set('callback', callback);
      let settled = false;
      const finish = result => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        delete window[callback];
        script.remove();
        resolve(result);
      };
      const timer = window.setTimeout(() => finish({ configured: true, ok: false, reason: 'timeout' }), timeoutMs);
      window[callback] = value => finish({ configured: true, ok: value?.ok === true, order: value?.order || null, reason: value?.reason || '' });
      script.onerror = () => finish({ configured: true, ok: false, reason: 'network-error' });
      script.src = url.toString();
      document.head.append(script);
    });
  }

  function buildGoogleFormUrl(order) {
    const raw = String(window.OFFCUT_GOOGLE_FORM_URL || '').trim();
    if (!/^https:\/\/docs\.google\.com\/forms\//i.test(raw)) return '';
    const url = new URL(raw);
    const fieldId = String(window.OFFCUT_GOOGLE_FORM_ORDER_ENTRY_ID || '').trim();
    if (/^\d+$/.test(fieldId)) url.searchParams.set(`entry.${fieldId}`, order.orderId);
    return url.toString();
  }

  window.OFFCUT_ORDER_API = Object.freeze({
    configured: Boolean(endpoint),
    sendPaymentReport: order => send('payment-report-submitted', order),
    submitMaterialLink: order => send('material-link-submitted', order),
    selectUsb: order => send('usb-delivery-selected', order),
    lookup: (orderId, email) => jsonp({ orderId: orderId.trim().toUpperCase(), email: email.trim().toLowerCase() }),
    buildGoogleFormUrl,
    lineUrl
  });
})();
