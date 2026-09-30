(() => {
  // Set this to a protected public endpoint URL when a server-side email service is ready.
  // Never place SMTP passwords, provider secrets, or private API keys in this static site.
  const endpoint = String(window.OFFCUT_EMAIL_ENDPOINT || '').trim();

  function buildTemplates(order) {
    const base = {
      orderId: order.orderId,
      service: order.service,
      tier: order.tier,
      amount: Number(order.price),
      pricingMode: order.pricingMode,
      paymentMethod: order.paymentMethod,
      customerName: order.customerName,
      email: order.email,
      lineId: order.lineId,
      paymentTime: order.paymentTime,
      paymentReference: order.paymentReference,
      paymentNote: order.paymentNote,
      paymentLastFive: order.paymentLastFive,
      reportedAt: order.paymentReportedAt,
      paymentStatus: order.paymentStatus
    };
    return {
      offcut: { to: 'offcut.studio.2026@gmail.com', subject: `[OFFCUT] 新付款回報｜${order.orderId}`, data: base },
      customer: { to: order.email, subject: `OFFCUT STUDIO 已收到您的付款回報 ${order.orderId}`, data: { orderId: order.orderId, service: order.service, tier: order.tier, amount: Number(order.price), paymentMethod: order.paymentMethod, status: '等待付款確認' } }
    };
  }

  async function sendPaymentReport(order) {
    const templates = buildTemplates(order);
    if (!endpoint) {
      console.warn('[OFFCUT] Email endpoint is not configured. No email was sent.');
      return { sent: false, reason: 'not-configured', templates };
    }
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'payment-report-submitted', templates }),
        keepalive: true
      });
      return { sent: response.ok, reason: response.ok ? '' : 'endpoint-error', templates };
    } catch (_) {
      console.warn('[OFFCUT] Email endpoint request failed. No delivery was confirmed.');
      return { sent: false, reason: 'network-error', templates };
    }
  }

  window.OFFCUT_EMAIL_ADAPTER = Object.freeze({ buildTemplates, sendPaymentReport, configured: Boolean(endpoint) });
})();
