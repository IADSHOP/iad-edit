(() => {
  const page = document.querySelector('[data-materials-page]');
  const model = window.OFFCUT_ORDER_MODEL;
  const api = window.OFFCUT_ORDER_API;
  if (!page || !model) return;
  const params = new URLSearchParams(window.location.search);
  let order = model.get(params.get('orderId') || params.get('order') || '');
  const error = page.querySelector('[data-materials-error]');
  const panel = page.querySelector('[data-materials-panel]');
  const actionMessage = page.querySelector('[data-material-action-message]');
  const showMessage = (message, isError = false) => {
    actionMessage.textContent = message;
    actionMessage.classList.toggle('is-error', isError);
    actionMessage.hidden = !message;
  };

  if (!order || !model.isLookupAuthorized(order)) {
    error.textContent = '請先從「訂單資訊」以訂單編號與 Email 查詢，再進入素材提交。';
    error.hidden = false;
    return;
  }

  const services = { 'mini-vlog': 'MINI VLOG', gaming: '遊戲實況精華', youtube: 'YOUTUBE 影片', brand: '品牌形象', program: '節目製作' };
  const tiers = { trial: 'TRIAL｜限時體驗價', basic: 'BASIC｜基礎版', plus: 'PLUS｜加強版', pro: 'PRO｜專業版', edit: 'EDIT｜節目剪輯', production: 'PRODUCTION｜完整節目製作' };
  const paymentLabels = { 'PENDING PAYMENT': '待付款', 'PAYMENT REVIEW': '等待付款確認', 'PAID / CONFIRMED': '已確認付款' };
  const materialLabels = { 'NOT SUBMITTED': '尚未提交', SUBMITTED: '已提交', 'NEEDS MORE': '需補交素材', 'AWAITING DELIVERY': '等待 USB 寄送' };
  const back = page.querySelector('[data-materials-back]');
  back.href = model.withOrder('order.html', order);
  const renderOrder = () => {
    page.querySelector('[data-order-id]').textContent = order.orderId;
    page.querySelector('[data-order-service]').textContent = services[order.service] || order.service;
    page.querySelector('[data-order-tier]').textContent = tiers[order.tier] || order.tier;
    page.querySelector('[data-order-payment-status]').textContent = paymentLabels[order.paymentStatus] || order.paymentStatus;
    page.querySelector('[data-order-payment-en]').textContent = order.paymentStatus;
    page.querySelector('[data-order-material-status]').textContent = materialLabels[order.materialStatus] || order.materialStatus;
    page.querySelector('[data-order-material-en]').textContent = order.materialStatus;
    page.querySelector('[data-folder-example]').textContent = `${order.orderId}_${order.customerName || '姓名'}`;
    const showPaymentReport = (params.get('paymentReport') === 'sent' || order.paymentReportSubmitted) && order.paymentStatus === 'PAYMENT REVIEW';
    page.querySelector('[data-materials-report-state]').hidden = !showPaymentReport;
    page.querySelector('[data-material-payment-status]').textContent = '等待 OFFCUT 確認付款 · PAYMENT REVIEW';
  };
  renderOrder();

  page.querySelector('[data-copy-order]').addEventListener('click', async () => {
    let copied = false;
    try { await navigator.clipboard.writeText(order.orderId); copied = true; } catch (_) {
      const field = document.createElement('textarea'); field.value = order.orderId; field.readOnly = true;
      field.style.position = 'fixed'; field.style.opacity = '0'; document.body.append(field); field.select(); copied = document.execCommand('copy'); field.remove();
    }
    page.querySelector('[data-order-copy-feedback]').textContent = copied ? '已複製' : '複製失敗';
  });

  const form = page.querySelector('[data-material-link-form]');
  page.querySelector('[data-show-link-form]').addEventListener('click', event => {
    form.hidden = !form.hidden;
    event.currentTarget.textContent = form.hidden ? '提交雲端連結 →' : '收起連結表單 ↑';
    if (!form.hidden) form.elements.materialLink.focus();
  });

  const backendNote = page.querySelector('[data-material-backend-note]');
  backendNote.textContent = api?.configured
    ? '遠端訂單服務已設定。若瀏覽器無法確認回應，OFFCUT 可在 Notification Log 檢查同步與通知結果。'
    : '此瀏覽器尚未連接 OFFCUT 訂單表；本機測試資料只保存在此裝置。';

  form.addEventListener('submit', async event => {
    event.preventDefault();
    showMessage('');
    const link = form.elements.materialLink.value.trim();
    if (!/^https?:\/\//i.test(link)) {
      form.elements.materialLink.setCustomValidity('請輸入以 http:// 或 https:// 開頭的素材連結。');
      form.elements.materialLink.reportValidity();
      form.elements.materialLink.setCustomValidity('');
      return;
    }
    if (!form.reportValidity()) return;
    const submit = page.querySelector('[data-material-link-submit]');
    submit.disabled = true;
    const updated = model.update(order.orderId, {
      materialMethod: 'EXTERNAL LINK',
      materialLink: link,
      materialNote: form.elements.materialNote.value.trim(),
      materialStatus: 'SUBMITTED',
      materialReportedAt: new Date().toISOString(),
      materialNotificationStatus: api?.configured ? 'PENDING' : 'NOT CONFIGURED'
    });
    if (!updated) {
      submit.disabled = false;
      showMessage('無法在此裝置保存素材連結，請稍後重試。', true);
      return;
    }
    order = updated;
    renderOrder();
    if (!api?.configured) {
      console.warn('[OFFCUT] Remote order backend not configured. Material link is saved on this device only.');
      order = model.update(order.orderId, { materialNotificationStatus: 'NOT CONFIGURED' }) || order;
      showMessage('素材連結已在此裝置保存。遠端訂單表與 Email 通知尚未設定；請聯繫 OFFCUT 確認收件。');
      submit.disabled = false;
      return;
    }
    const result = await Promise.race([
      api.submitMaterialLink(order),
      new Promise(resolve => window.setTimeout(() => resolve({ dispatched: false, reason: 'timeout' }), 3500))
    ]);
    const status = result.dispatched ? 'DISPATCHED · UNCONFIRMED' : 'FAILED';
    order = model.update(order.orderId, { materialNotificationStatus: status }) || order;
    if (!result.dispatched) console.warn('[OFFCUT] Material submission is saved locally; remote synchronization/notification did not dispatch.', result.reason);
    showMessage(result.dispatched
      ? '素材連結已保存並已送出同步請求。瀏覽器無法讀取 Apps Script 的回覆；若訂單狀態尚未更新，請聯繫 OFFCUT。'
      : '素材連結已在此裝置保存，但同步請求未送出。請聯繫 OFFCUT 確認收件。');
    submit.disabled = false;
  });

  const formUrl = api?.buildGoogleFormUrl(order) || '';
  const formLink = page.querySelector('[data-google-form-link]');
  const formDisabled = page.querySelector('[data-google-form-disabled]');
  if (formUrl) {
    formLink.href = formUrl;
    formLink.hidden = false;
    formDisabled.hidden = true;
  }

  page.querySelector('[data-usb-action]').addEventListener('click', () => {
    order = model.update(order.orderId, {
      materialMethod: 'USB',
      materialLink: '',
      materialStatus: 'AWAITING DELIVERY',
      materialReportedAt: new Date().toISOString(),
      materialNotificationStatus: api?.configured ? 'PENDING' : 'NOT CONFIGURED'
    }) || order;
    renderOrder();
    showMessage('已記錄 USB 寄送方式；素材尚未收到。請透過 LINE 先取得寄送資訊。');
    if (api?.configured) {
      api.selectUsb(order).then(result => {
        const status = result.dispatched ? 'DISPATCHED · UNCONFIRMED' : 'FAILED';
        order = model.update(order.orderId, { materialNotificationStatus: status }) || order;
        if (!result.dispatched) console.warn('[OFFCUT] USB selection was saved locally; remote notification did not dispatch.', result.reason);
      });
    } else {
      console.warn('[OFFCUT] Remote order backend not configured. USB selection is saved on this device only.');
    }
  });

  panel.hidden = false;
})();
