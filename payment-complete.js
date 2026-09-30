(() => {
  const page = document.querySelector('[data-payment-complete]');
  const model = window.OFFCUT_ORDER_MODEL;
  if (!page || !model) return;

  const methods = { bank: '匯款', linepay: 'LINE PAY', card: '信用卡' };
  const serviceLabels = { 'mini-vlog': 'MINI VLOG', gaming: '遊戲實況精華', youtube: 'YOUTUBE 影片', brand: '品牌形象', program: '節目製作' };
  const tierLabels = { trial: 'TRIAL｜限時體驗價', basic: 'BASIC｜基礎版', plus: 'PLUS｜加強版', pro: 'PRO｜專業版', edit: 'EDIT｜節目剪輯', production: 'PRODUCTION｜完整節目製作' };
  const orderId = new URLSearchParams(window.location.search).get('orderId') || '';
  let order = model.get(orderId);
  const summary = page.querySelector('[data-flow-order-summary]');
  const form = page.querySelector('[data-report-form]');
  const success = page.querySelector('[data-report-success]');
  const error = page.querySelector('[data-flow-error]');
  const formError = page.querySelector('[data-form-error]');

  function showError(message) {
    error.textContent = message;
    error.hidden = false;
    form.hidden = true;
    summary.hidden = true;
  }

  function copy(button, feedback, value) {
    button.addEventListener('click', async () => {
      let copied = false;
      try { if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); copied = true; } } catch (_) { /* fallback below */ }
      if (!copied) {
        const input = document.createElement('textarea'); input.value = value; input.readOnly = true;
        input.style.position = 'fixed'; input.style.opacity = '0'; document.body.append(input); input.select();
        copied = document.execCommand('copy'); input.remove();
      }
      feedback.textContent = copied ? '已複製' : '複製失敗';
      window.setTimeout(() => { feedback.textContent = ''; }, 1600);
    });
  }

  function openMaterials(currentOrder) {
    model.rememberLookup(currentOrder);
    const target = new URL(model.withOrder('materials.html', currentOrder), window.location.href);
    target.searchParams.set('paymentReport', 'sent');
    window.location.replace(target.toString());
  }

  if (!order) {
    showError('此裝置找不到這筆訂單的本機資料。請回到建立訂單時使用的瀏覽器與裝置。');
    return;
  }
  if (order.paymentStatus === 'PENDING PAYMENT') {
    showError('請先在付款頁按下「我已完成付款」，再填寫付款辨識資料。');
    return;
  }
  if (order.paymentStatus !== 'PAYMENT REVIEW') {
    showError('這筆訂單目前不需要付款回報。');
    return;
  }

  page.querySelector('[data-order-id]').textContent = order.orderId;
  page.querySelector('[data-order-service]').textContent = serviceLabels[order.service] || order.service;
  page.querySelector('[data-order-tier]').textContent = tierLabels[order.tier] || order.tier;
  page.querySelector('[data-order-price]').textContent = `NT$${Number(order.price).toLocaleString('en-US')}${order.pricingMode === 'quote' ? ' 起' : ''}`;
  page.querySelector('[data-order-method]').textContent = methods[order.paymentMethod] || order.paymentMethod;
  page.querySelector('[data-report-method]').textContent = methods[order.paymentMethod] || order.paymentMethod;
  copy(page.querySelector('[data-copy-order]'), page.querySelector('[data-order-copy-feedback]'), order.orderId);

  page.querySelector('[data-bank-last-five-row]').hidden = order.paymentMethod !== 'bank';
  page.querySelector('[data-payment-time-row]').hidden = order.paymentMethod === 'bank';
  page.querySelector('[data-payment-reference-row]').hidden = order.paymentMethod === 'bank';
  page.querySelector('[data-payment-screenshot-row]').hidden = order.paymentMethod !== 'linepay';
  const lastFiveInput = form.elements.paymentLastFive;
  lastFiveInput.required = order.paymentMethod === 'bank';

  if (order.paymentReportSubmitted) {
    openMaterials(order);
    return;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    formError.hidden = true;
    if (!form.reportValidity()) return;
    const customerName = form.elements.customerName.value.trim();
    const email = form.elements.email.value.trim();
    const lineId = form.elements.lineId.value.trim();
    const paymentLastFive = form.elements.paymentLastFive.value.trim();
    if (order.paymentMethod === 'bank' && !/^\d{5}$/.test(paymentLastFive)) {
      formError.textContent = '請輸入 5 位數的匯款帳號末五碼。';
      formError.hidden = false;
      form.elements.paymentLastFive.focus();
      return;
    }
    const updated = model.update(order.orderId, {
      customerName,
      email,
      lineId,
      paymentLastFive: order.paymentMethod === 'bank' ? paymentLastFive : '',
      paymentTime: order.paymentMethod === 'bank' ? '' : form.elements.paymentTime.value,
      paymentReference: order.paymentMethod === 'bank' ? '' : form.elements.paymentReference.value.trim(),
      paymentNote: order.paymentMethod === 'bank' ? '' : form.elements.paymentReference.value.trim(),
      paymentReportedAt: new Date().toISOString(),
      paymentReportSubmitted: true,
      paymentStatus: 'PAYMENT REVIEW'
    });
    if (!updated) {
      formError.textContent = '無法在此裝置儲存付款回報，請稍後再試。';
      formError.hidden = false;
      return;
    }
    order = updated;
    model.rememberLookup(order);
    const submitButton = form.querySelector('[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = '已保存，正在前往素材頁…';
    if (window.OFFCUT_EMAIL_ADAPTER) {
      const notification = await Promise.race([
        window.OFFCUT_EMAIL_ADAPTER.sendPaymentReport(order),
        new Promise(resolve => window.setTimeout(() => resolve({ sent: false, reason: 'timeout' }), 3500))
      ]);
      if (!notification.sent) console.warn('[OFFCUT] Email notification was not delivered; payment report is saved and the customer will continue to materials.', notification.reason);
    } else {
      console.warn('[OFFCUT] Email adapter is unavailable; payment report is saved and the customer will continue to materials.');
    }
    openMaterials(order);
  });
})();
