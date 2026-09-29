(() => {
  const page = document.querySelector('[data-order-page]');
  const model = window.OFFCUT_ORDER_MODEL;
  if (!page || !model) return;
  const params = new URLSearchParams(window.location.search);
  const order = model.get(params.get('orderId') || params.get('order') || '');
  const error = page.querySelector('[data-order-access-error]');
  const detail = page.querySelector('[data-order-detail]');
  if (!order || !model.isLookupAuthorized(order)) {
    error.textContent = order ? '請先以訂單編號與 Email 查詢訂單。' : '此裝置找不到這筆訂單。請使用建立訂單時的瀏覽器與裝置查詢。';
    error.hidden = false;
    return;
  }
  const services = { 'mini-vlog': 'MINI VLOG', gaming: '遊戲實況精華', youtube: 'YOUTUBE 影片', brand: '品牌形象', program: '節目製作' };
  const tiers = { trial: 'TRIAL｜限時體驗價', basic: 'BASIC｜基礎版', plus: 'PLUS｜加強版', pro: 'PRO｜專業版', edit: 'EDIT｜節目剪輯', production: 'PRODUCTION｜完整節目製作' };
  const methods = { bank: '匯款', linepay: 'LINE PAY', card: '信用卡' };
  const payment = { 'PENDING PAYMENT': '待付款', 'PAYMENT REVIEW': '等待付款確認', 'PAID / CONFIRMED': '已確認付款' };
  const materials = { 'NOT SUBMITTED': '尚未提交', SUBMITTED: '素材已收到', 'NEEDS MORE': '需補件' };
  const production = { 'NOT STARTED': '尚未開始', 'IN PRODUCTION': '製作中', REVIEW: '待確認', COMPLETED: '已完成' };
  const set = (selector, value) => { const node = page.querySelector(selector); if (node) node.textContent = value; };
  set('[data-order-id]', order.orderId);
  set('[data-order-service]', services[order.service] || order.service);
  set('[data-order-tier]', tiers[order.tier] || order.tier);
  set('[data-order-price]', `NT$${Number(order.price).toLocaleString('en-US')}${order.pricingMode === 'quote' ? ' 起' : ''}`);
  set('[data-order-method]', methods[order.paymentMethod] || order.paymentMethod);
  set('[data-payment-status]', payment[order.paymentStatus] || order.paymentStatus);
  set('[data-payment-status-en]', order.paymentStatus);
  set('[data-material-status]', materials[order.materialStatus] || order.materialStatus);
  set('[data-material-status-en]', order.materialStatus);
  set('[data-production-status]', production[order.productionStatus] || order.productionStatus);
  set('[data-production-status-en]', order.productionStatus);
  detail.hidden = false;
  const copyButton = page.querySelector('[data-copy-order]');
  const feedback = page.querySelector('[data-order-copy-feedback]');
  copyButton.addEventListener('click', async () => {
    let copied = false;
    try { await navigator.clipboard.writeText(order.orderId); copied = true; } catch (_) {
      const input = document.createElement('textarea'); input.value = order.orderId; input.readOnly = true;
      input.style.position = 'fixed'; input.style.opacity = '0'; document.body.append(input); input.select();
      copied = document.execCommand('copy'); input.remove();
    }
    feedback.textContent = copied ? '已複製' : '複製失敗';
    window.setTimeout(() => { feedback.textContent = ''; }, 1600);
  });
  const next = page.querySelector('[data-order-next-step]');
  if (order.paymentStatus === 'PENDING PAYMENT') {
    const link = document.createElement('a'); link.className = 'flow-primary'; link.href = model.withOrder(`payment-${order.paymentMethod === 'linepay' ? 'linepay' : order.paymentMethod === 'card' ? 'card' : 'bank'}.html`, order); link.textContent = '繼續付款 →'; next.append(link);
  } else if (order.paymentStatus === 'PAYMENT REVIEW') {
    const message = document.createElement('p'); message.className = 'order-waiting'; message.textContent = order.paymentReportSubmitted ? '已收到您的付款回報，等待 OFFCUT 確認付款。' : '請完成付款回報資料，等待 OFFCUT 確認付款。'; next.append(message);
    if (!order.paymentReportSubmitted) { const link = document.createElement('a'); link.className = 'flow-text-link'; link.href = model.withOrder('payment-complete.html', order); link.textContent = '繼續付款回報 →'; next.append(link); }
  } else if (order.paymentStatus === 'PAID / CONFIRMED' && order.materialStatus !== 'SUBMITTED') {
    const link = document.createElement('a'); link.className = 'flow-primary'; link.href = model.withOrder('materials.html', order); link.textContent = order.materialStatus === 'NEEDS MORE' ? '補交素材 →' : '提交素材 →'; next.append(link);
  } else if (order.materialStatus === 'SUBMITTED') {
    const message = document.createElement('p'); message.className = 'order-waiting'; message.textContent = '素材已收到'; next.append(message);
  }
})();
