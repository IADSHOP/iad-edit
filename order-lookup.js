(() => {
  const page = document.querySelector('[data-order-lookup]');
  const model = window.OFFCUT_ORDER_MODEL;
  if (!page || !model) return;
  const form = page.querySelector('[data-lookup-form]');
  const error = page.querySelector('[data-lookup-error]');
  form.addEventListener('submit', event => {
    event.preventDefault();
    error.hidden = true;
    const order = model.findByCredentials(form.elements.orderId.value, form.elements.email.value);
    if (!order) {
      error.textContent = '找不到符合的本機訂單。請確認訂單編號與 Email，並使用建立訂單時的瀏覽器與裝置。';
      error.hidden = false;
      return;
    }
    model.rememberLookup(order);
    window.location.href = model.withOrder('order.html', order);
  });
})();
