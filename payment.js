(() => {
  const page = document.querySelector('[data-payment-page]');
  if (!page) return;

  const catalog = {
    'mini-vlog': { label: 'MINI VLOG', tiers: { trial: ['TRIAL｜限時體驗價', 499], basic: ['BASIC｜基礎版', 899], plus: ['PLUS｜加強版', 1680], pro: ['PRO｜專業版', 2880] } },
    gaming: { label: '遊戲實況精華', tiers: { basic: ['BASIC｜基礎版', 1680], plus: ['PLUS｜加強版', 2880], pro: ['PRO｜專業版', 4980] } },
    youtube: { label: 'YOUTUBE 影片', tiers: { basic: ['BASIC｜基礎版', 1880], plus: ['PLUS｜加強版', 2980], pro: ['PRO｜專業版', 4980] } },
    brand: { label: '品牌形象', tiers: { basic: ['BASIC｜基礎版', 1980], plus: ['PLUS｜加強版', 2980], pro: ['PRO｜專業版', 4980, true] } },
    program: { label: '節目製作', tiers: { edit: ['EDIT｜節目剪輯', 4980, true], production: ['PRODUCTION｜完整節目製作', 10000, true] } }
  };

  const params = new URLSearchParams(window.location.search);
  const requestedService = params.get('service');
  const service = Object.prototype.hasOwnProperty.call(catalog, requestedService) ? requestedService : null;
  const serviceInfo = service ? catalog[service] : null;
  const requestedTier = (params.get('tier') || '').toLowerCase();
  const tier = serviceInfo && Object.prototype.hasOwnProperty.call(serviceInfo.tiers, requestedTier) ? requestedTier : null;
  const tierInfo = tier ? serviceInfo.tiers[tier] : null;
  const requestedPrice = params.get('price');
  const price = requestedPrice && /^\d{1,8}$/.test(requestedPrice) ? Number(requestedPrice) : tierInfo?.[1];
  const isQuoteBased = params.get('isQuoteBased') === 'true' || params.get('quote') === 'true' || Boolean(tierInfo?.[2]);

  page.querySelector('[data-payment-service]').textContent = serviceInfo?.label || '—';
  page.querySelector('[data-payment-tier]').textContent = tierInfo?.[0] || '—';
  page.querySelector('[data-payment-price]').textContent = price ? `NT$${price.toLocaleString('en-US')}${isQuoteBased ? ' 起' : ''}` : '—';
  page.querySelector('[data-quote-note]').hidden = !isQuoteBased;

  const backParams = new URLSearchParams();
  if (service) backParams.set('service', service);
  if (tier) backParams.set('tier', tier);
  if (price) backParams.set('price', String(price));
  if (isQuoteBased) backParams.set('isQuoteBased', 'true');
  const back = page.querySelector('[data-payment-back]');
  back.href = `checkout.html${backParams.size ? `?${backParams.toString()}` : ''}`;
})();
