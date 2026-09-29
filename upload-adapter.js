(() => {
  // Configure only a public upload handoff URL. Signing keys and credentials belong on a server.
  const config = window.OFFCUT_UPLOAD_CONFIG || { uploadProvider: '', uploadUrl: '' };
  window.OFFCUT_UPLOAD_ADAPTER = Object.freeze({
    config: Object.freeze({ uploadProvider: String(config.uploadProvider || ''), uploadUrl: String(config.uploadUrl || '') }),
    isConfigured() { return /^https:\/\//i.test(String(config.uploadUrl || '')); },
    open(order) {
      if (!this.isConfigured()) return false;
      const url = new URL(config.uploadUrl);
      url.searchParams.set('orderId', order.orderId);
      window.location.href = url.toString();
      return true;
    }
  });
})();
