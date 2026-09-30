(() => {
  const page = document.querySelector('[data-materials-page]');
  const model = window.OFFCUT_ORDER_MODEL;
  const upload = window.OFFCUT_UPLOAD_ADAPTER;
  if (!page || !model) return;
  const params = new URLSearchParams(window.location.search);
  const order = model.get(params.get('orderId') || '');
  const error = page.querySelector('[data-materials-error]');
  const panel = page.querySelector('[data-materials-panel]');
  if (!order || !model.isLookupAuthorized(order)) {
    error.textContent = '請先從「訂單資訊」以訂單編號與 Email 查詢，再進入素材提交。';
    error.hidden = false;
    return;
  }
  const services = { 'mini-vlog': 'MINI VLOG', gaming: '遊戲實況精華', youtube: 'YOUTUBE 影片', brand: '品牌形象', program: '節目製作' };
  const tiers = { trial: 'TRIAL｜限時體驗價', basic: 'BASIC｜基礎版', plus: 'PLUS｜加強版', pro: 'PRO｜專業版', edit: 'EDIT｜節目剪輯', production: 'PRODUCTION｜完整節目製作' };
  const back = page.querySelector('[data-materials-back]');
  back.href = model.withOrder('order.html', order);
  page.querySelector('[data-order-id]').textContent = order.orderId;
  page.querySelector('[data-order-service]').textContent = services[order.service] || order.service;
  page.querySelector('[data-order-tier]').textContent = tiers[order.tier] || order.tier;
  const paymentLabels = { 'PENDING PAYMENT': '待付款', 'PAYMENT REVIEW': '等待付款確認', 'PAID / CONFIRMED': '已確認付款' };
  const materialLabels = { 'NOT SUBMITTED': '尚未提交', SUBMITTED: '素材已收到', 'NEEDS MORE': '需補件' };
  page.querySelector('[data-order-payment-status]').textContent = paymentLabels[order.paymentStatus] || order.paymentStatus;
  page.querySelector('[data-order-payment-en]').textContent = order.paymentStatus;
  page.querySelector('[data-order-material-status]').textContent = materialLabels[order.materialStatus] || order.materialStatus;
  page.querySelector('[data-order-material-en]').textContent = order.materialStatus;
  if ((params.get('paymentReport') === 'sent' || order.paymentReportSubmitted) && order.paymentStatus === 'PAYMENT REVIEW') {
    page.querySelector('[data-materials-report-state]').hidden = false;
    page.querySelector('[data-material-payment-status]').textContent = '等待付款確認 · PAYMENT REVIEW';
  }
  page.querySelector('[data-folder-example]').textContent = `${order.orderId}_${order.customerName || '姓名'}`;
  page.querySelector('[data-copy-order]').addEventListener('click', async event => {
    let copied = false;
    try { await navigator.clipboard.writeText(order.orderId); copied = true; } catch (_) {
      const field = document.createElement('textarea'); field.value = order.orderId; field.readOnly = true;
      field.style.position = 'fixed'; field.style.opacity = '0'; document.body.append(field); field.select(); copied = document.execCommand('copy'); field.remove();
    }
    page.querySelector('[data-order-copy-feedback]').textContent = copied ? '已複製' : '複製失敗';
  });
  const button = page.querySelector('[data-upload-button]');
  const message = page.querySelector('[data-upload-message]');
  if (order.materialStatus === 'SUBMITTED') {
    message.textContent = '素材已收到。如需補充，請聯繫 OFFCUT。';
  } else if (upload?.isConfigured()) {
    button.disabled = false;
    message.textContent = `使用 ${upload.config.uploadProvider || '外部上傳服務'} 提交素材。大型影片將直接傳至上傳服務，不會放進網站或 GitHub。`;
    button.addEventListener('click', () => upload.open(order));
  } else {
    message.textContent = '可先依訂單編號整理素材。正式上傳服務尚未串接；此原型不會上傳或保存檔案。';
  }
  panel.hidden = false;
})();
