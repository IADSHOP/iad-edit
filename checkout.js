(() => {
  const page = document.querySelector('[data-checkout]');
  if (!page) return;

  const catalog = {
    'mini-vlog': {
      label: 'MINI VLOG',
      path: 'pricing-mini-vlog.html',
      tiers: {
        trial: { label: 'TRIAL｜限時體驗價', price: 499, source: '3 分鐘內・3GB 內', output: '15 秒–2 分鐘' },
        basic: { label: 'BASIC｜基礎版', price: 899, source: '5 分鐘內・5GB 內', output: '1–5 分鐘' },
        plus: { label: 'PLUS｜加強版', price: 1680, source: '12 分鐘內・12GB 內', output: '2–8 分鐘' },
        pro: { label: 'PRO｜專業版', price: 2880, source: '25 分鐘內・25GB 內', output: '2–12 分鐘' }
      }
    },
    gaming: {
      label: '遊戲實況精華',
      path: 'pricing-gaming.html',
      tiers: {
        basic: { label: 'BASIC｜基礎版', price: 1680, source: '30 分鐘內・30GB 內', output: '3–8 分鐘' },
        plus: { label: 'PLUS｜加強版', price: 2880, source: '60 分鐘內・60GB 內', output: '5–12 分鐘' },
        pro: { label: 'PRO｜專業版', price: 4980, source: '90 分鐘內・90GB 內', output: '8–15 分鐘' }
      }
    },
    youtube: {
      label: 'YOUTUBE 影片',
      path: 'pricing-youtube.html',
      tiers: {
        basic: { label: 'BASIC｜基礎版', price: 1880, source: '15 分鐘內・15GB 內', output: '3–8 分鐘' },
        plus: { label: 'PLUS｜加強版', price: 2980, source: '30 分鐘內・30GB 內', output: '5–12 分鐘' },
        pro: { label: 'PRO｜專業版', price: 4980, source: '60 分鐘內・60GB 內', output: '8–20 分鐘' }
      }
    },
    brand: {
      label: '品牌形象',
      path: 'pricing-brand.html',
      tiers: {
        basic: { label: 'BASIC｜基礎版', price: 1980, output: '15 秒–1 分鐘' },
        plus: { label: 'PLUS｜加強版', price: 2980, output: '30 秒–2 分鐘' },
        pro: { label: 'PRO｜專業版', price: 4980, output: '依製作需求', isQuoteBased: true }
      }
    },
    program: {
      label: '節目製作',
      path: 'pricing-program.html',
      tiers: {
        edit: { label: 'EDIT｜節目剪輯', price: 4980, isQuoteBased: true },
        production: { label: 'PRODUCTION｜完整節目製作', price: 10000, isQuoteBased: true }
      }
    }
  };

  const params = new URLSearchParams(window.location.search);
  const requestedService = params.get('service') || 'mini-vlog';
  const service = Object.prototype.hasOwnProperty.call(catalog, requestedService) ? requestedService : 'mini-vlog';
  const serviceInfo = catalog[service];
  const requestedTier = (params.get('tier') || 'basic').toLowerCase();
  const tier = Object.prototype.hasOwnProperty.call(serviceInfo.tiers, requestedTier) ? requestedTier : Object.keys(serviceInfo.tiers)[0];
  const tierInfo = serviceInfo.tiers[tier];
  const requestedPrice = params.get('price');
  const price = requestedPrice && /^\d{1,8}$/.test(requestedPrice) ? Number(requestedPrice) : tierInfo.price;
  const isQuoteBased = params.get('isQuoteBased') === 'true' || Boolean(tierInfo.isQuoteBased);
  const state = Object.freeze({ service, tier, price, isQuoteBased, customerName: null, email: null, lineId: null, orderId: null });
  window.OFFCUT_CHECKOUT = state;

  const formattedPrice = `NT$${price.toLocaleString('en-US')}${isQuoteBased ? ' 起' : ''}`;
  page.querySelector('[data-summary-service]').textContent = serviceInfo.label;
  page.querySelector('[data-summary-tier]').textContent = tierInfo.label;
  page.querySelector('[data-summary-source]').textContent = tierInfo.source || '依製作需求確認';
  page.querySelector('[data-summary-output]').textContent = tierInfo.output || '依製作需求確認';
  page.querySelector('[data-summary-price]').textContent = formattedPrice;

  const quoteNote = page.querySelector('[data-quote-note]');
  quoteNote.hidden = !isQuoteBased;
  const back = page.querySelector('[data-detail-back]');
  back.href = serviceInfo.path;

  const agreements = [...page.querySelectorAll('[data-agreement]')];
  const continueButton = page.querySelector('[data-continue]');
  const status = page.querySelector('.checkout-status');
  const syncAgreements = () => {
    const complete = agreements.every(input => input.checked);
    continueButton.disabled = !complete;
    status.textContent = complete ? '確認事項已勾選。此原型不會建立訂單或進行付款。' : '請先閱讀並勾選確認事項';
  };
  agreements.forEach(input => input.addEventListener('change', syncAgreements));

  continueButton.addEventListener('click', () => {
    if (!agreements.every(input => input.checked)) return;
    status.textContent = '訂購流程原型尚未接入付款，未建立訂單，也未進行扣款。';
  });
})();
