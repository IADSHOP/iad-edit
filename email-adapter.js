(() => {
  const api = window.OFFCUT_ORDER_API;
  const offcutEmail = 'offcut.studio.2026@gmail.com';

  function buildPaymentNotification(order) {
    return {
      to: offcutEmail,
      subject: `[OFFCUT] 新付款回報｜${order.orderId}`,
      data: {
        orderId: order.orderId,
        service: order.service,
        tier: order.tier,
        amount: Number(order.price),
        pricingMode: order.pricingMode,
        paymentMethod: order.paymentMethod,
        customerName: order.customerName,
        email: order.email,
        lineId: order.lineId,
        paymentLastFive: order.paymentMethod === 'bank' ? order.paymentLastFive : '',
        paymentTime: order.paymentTime,
        paymentReference: order.paymentReference,
        paymentNote: order.paymentNote,
        paymentReportedAt: order.paymentReportedAt,
        paymentStatus: order.paymentStatus
      }
    };
  }

  async function sendPaymentReport(order) {
    if (!api) {
      console.warn('[OFFCUT] Remote order backend not configured. Payment report is saved locally; no email was sent.');
      return { configured: false, dispatched: false, confirmed: false, reason: 'not-configured', notification: buildPaymentNotification(order) };
    }
    const result = await api.sendPaymentReport(order);
    return { ...result, notification: buildPaymentNotification(order) };
  }

  window.OFFCUT_EMAIL_ADAPTER = Object.freeze({
    configured: Boolean(api?.configured),
    buildPaymentNotification,
    sendPaymentReport
  });
})();
