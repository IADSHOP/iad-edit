(() => {
  const main = document.querySelector('.pricing-detail-main[data-service]');
  if (!main) return;

  const triggers = [...document.querySelectorAll('.info-trigger')];
  const hoverEnabled = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  triggers.forEach((trigger, index) => {
    const tip = trigger.nextElementSibling;
    if (tip?.matches('.detail-tooltip')) {
      if (!tip.id) tip.id = `pricing-tip-${index + 1}`;
      trigger.setAttribute('aria-describedby', tip.id);
    }
  });

  function closeTooltip(trigger) {
    const tip = trigger.nextElementSibling;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.classList.remove('is-open', 'is-pinned');
    if (tip?.matches('.detail-tooltip')) {
      tip.hidden = true;
      tip.classList.remove('is-align-right');
    }
  }

  function openTooltip(trigger, pinned = false) {
    const tip = trigger.nextElementSibling;
    if (!tip?.matches('.detail-tooltip')) return;
    triggers.forEach(other => { if (other !== trigger) closeTooltip(other); });
    tip.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    trigger.classList.add('is-open');
    trigger.classList.toggle('is-pinned', pinned);
    tip.classList.remove('is-align-right');
    if (tip.getBoundingClientRect().right > window.innerWidth - 12) tip.classList.add('is-align-right');
  }

  triggers.forEach(trigger => {
    trigger.addEventListener('click', event => {
      event.stopPropagation();
      if (trigger.getAttribute('aria-expanded') === 'true' && trigger.classList.contains('is-pinned')) closeTooltip(trigger);
      else openTooltip(trigger, true);
    });
    const host = trigger.parentElement;
    host.addEventListener('pointerenter', () => {
      if (hoverEnabled() && !trigger.classList.contains('is-pinned')) openTooltip(trigger);
    });
    host.addEventListener('pointerleave', () => {
      if (hoverEnabled() && !trigger.classList.contains('is-pinned') && document.activeElement !== trigger) closeTooltip(trigger);
    });
    trigger.addEventListener('focus', () => openTooltip(trigger));
    trigger.addEventListener('blur', () => {
      if (!trigger.classList.contains('is-pinned')) closeTooltip(trigger);
    });
  });

  document.addEventListener('click', event => {
    if (!event.target.closest('.info-trigger, .detail-tooltip')) triggers.forEach(closeTooltip);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') triggers.forEach(closeTooltip);
  });

  const tiers = [...main.querySelectorAll('.detail-tier')];
  const cta = main.querySelector('[data-order-cta]');
  const status = main.querySelector('.detail-cta-status');
  tiers.forEach(tier => {
    const button = tier.querySelector('[data-select-tier]');
    if (!button) return;
    button.addEventListener('click', () => {
      tiers.forEach(other => {
        other.classList.toggle('is-selected', other === tier);
        other.querySelector('[data-select-tier]')?.setAttribute('aria-pressed', String(other === tier));
      });
      if (!cta) return;
      cta.dataset.service = main.dataset.service;
      cta.dataset.tier = tier.dataset.tier;
      cta.dataset.price = tier.dataset.price;
      if (tier.dataset.priceFrom === 'true') cta.dataset.priceFrom = 'true';
      else delete cta.dataset.priceFrom;
      cta.dataset.isQuoteBased = String(tier.dataset.isQuoteBased === 'true');
      const label = `${tier.dataset.tier.toUpperCase()}｜${button.textContent.trim()}`;
      cta.setAttribute('aria-label', `馬上製作，已選擇 ${label}`);
      if (status) status.textContent = `已選擇 ${label}。`;
    });
  });

  cta?.addEventListener('click', () => {
    if (!cta.dataset.tier) {
      if (status) status.textContent = '請先選擇方案版本';
      main.querySelector('[data-select-tier]')?.focus({ preventScroll: true });
      main.querySelector('.detail-tiers')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    const query = new URLSearchParams({
      service: cta.dataset.service,
      tier: cta.dataset.tier,
      price: cta.dataset.price
    });
    if (cta.dataset.isQuoteBased === 'true') query.set('isQuoteBased', 'true');
    window.location.href = `checkout.html?${query.toString()}`;
  });
})();
