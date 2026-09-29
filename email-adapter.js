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
      paymentLastFive: order.paymentLastFive,
      reportedAt: order.paymentReportedAt,
      paymentStatus: order.paymentStatus
    };
    return {
      offcut: { to: 'OFFCUT_CONFIGURED_IN_BACKEND', subject: `付款回報 ${order.orderId}`, data: base },
      customer: { to: order.email, subject: `OFFCUT STUDIO 已收到您的付款回報 ${order.orderId}`, data: { orderId: order.orderId, service: order.service, tier: order.tier, amount: Number(order.price), paymentMethod: order.paymentMethod, status: '等待付款確認' } }
    };
  }

  async function sendPaymentReport(order) {
    const templates = buildTemplates(order);
    if (!endpoint) return { sent: false, reason: 'not-configured', templates };
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: 'payment-report-submitted', templates })
      });
      return { sent: response.ok, reason: response.ok ? '' : 'endpoint-error', templates };
    } catch (_) {
      return { sent: false, reason: 'network-error', templates };
    }
  }

  window.OFFCUT_EMAIL_ADAPTER = Object.freeze({ buildTemplates, sendPaymentReport, configured: Boolean(endpoint) });
})();
