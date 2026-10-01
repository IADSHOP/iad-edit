const OFFCUT_CONFIG = Object.freeze({
  notificationEmail: 'offcut.studio.2026@gmail.com',
  ordersSheet: 'Orders',
  logSheet: 'Notification Log',
  dailyEmailLimit: 40,
  orderHeaders: [
    'orderId', 'createdAt', 'service', 'tier', 'price', 'pricingMode', 'paymentMethod',
    'customerName', 'email', 'lineId', 'paymentReference', 'paymentTime', 'paymentNote',
    'paymentReportedAt', 'paymentStatus', 'materialMethod', 'materialLink', 'materialNote',
    'materialStatus', 'productionStatus', 'paymentLastFive'
  ],
  logHeaders: ['eventKey', 'event', 'orderId', 'recipient', 'subject', 'status', 'detail', 'attemptedAt']
});

function onOpen() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  if (spreadsheet) PropertiesService.getScriptProperties().setProperty('OFFCUT_SPREADSHEET_ID', spreadsheet.getId());
}

function setupOffcutSheets() {
  const sheets = getSheets_();
  const emailQuota = MailApp.getRemainingDailyQuota();
  return { spreadsheetUrl: sheets.spreadsheet.getUrl(), ordersSheet: sheets.orders.getName(), logSheet: sheets.log.getName(), emailQuota };
}

function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const callback = String(params.callback || '');
  const jsonp = /^[A-Za-z_$][A-Za-z0-9_$]{0,80}$/.test(callback);
  let result;
  try {
    if (params.action !== 'lookup') result = { ok: true, service: 'OFFCUT order backend' };
    else result = lookupOrder_(params.orderId, params.email);
  } catch (error) {
    result = { ok: false, reason: 'backend-error' };
    console.error(error);
  }
  if (jsonp) {
    return ContentService.createTextOutput(`${callback}(${JSON.stringify(result)});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return jsonOutput_(result);
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return jsonOutput_({ ok: false, reason: 'busy' });
  try {
    const raw = e && e.postData && e.postData.contents ? e.postData.contents : '';
    if (!raw || raw.length > 100000) return jsonOutput_({ ok: false, reason: 'invalid-payload' });
    const payload = JSON.parse(raw);
    const event = String(payload.event || '');
    const order = normalizeOrder_(payload.order, event);
    const sheets = getSheets_();
    const savedOrder = saveOrder_(sheets.orders, order, event);
    const notification = notify_(sheets.log, savedOrder, event);
    return jsonOutput_({ ok: true, saved: true, notification: notification.status });
  } catch (error) {
    console.error(error);
    return jsonOutput_({ ok: false, reason: String(error && error.message || 'backend-error').slice(0, 200) });
  } finally {
    lock.releaseLock();
  }
}

function getSheets_() {
  const properties = PropertiesService.getScriptProperties();
  let id = properties.getProperty('OFFCUT_SPREADSHEET_ID');
  let spreadsheet = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.getActiveSpreadsheet();
  if (!spreadsheet) throw new Error('Bind this Apps Script to the OFFCUT Google Sheet and reload that Sheet once.');
  if (!id) properties.setProperty('OFFCUT_SPREADSHEET_ID', spreadsheet.getId());
  const orders = ensureSheet_(spreadsheet, OFFCUT_CONFIG.ordersSheet, OFFCUT_CONFIG.orderHeaders);
  const log = ensureSheet_(spreadsheet, OFFCUT_CONFIG.logSheet, OFFCUT_CONFIG.logHeaders);
  return { spreadsheet, orders, log };
}

function ensureSheet_(spreadsheet, name, requiredHeaders) {
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  const lastColumn = sheet.getLastColumn();
  const headers = sheet.getLastRow() ? sheet.getRange(1, 1, 1, Math.max(lastColumn, 1)).getValues()[0].map(String) : [];
  if (!headers.some(Boolean)) {
    sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
    sheet.setFrozenRows(1);
    return sheet;
  }
  const missing = requiredHeaders.filter(header => !headers.includes(header));
  if (missing.length) sheet.getRange(1, lastColumn + 1, 1, missing.length).setValues([missing]);
  return sheet;
}

function normalizeOrder_(input, event) {
  if (!input || typeof input !== 'object') throw new Error('Order data is missing.');
  const order = {};
  OFFCUT_CONFIG.orderHeaders.forEach(key => { order[key] = clean_(input[key], key === 'materialLink' || key === 'materialNote' || key === 'paymentNote' ? 2000 : 500); });
  order.orderId = String(input.orderId || '').trim().toUpperCase();
  if (!/^OFF-\d{6}-[A-HJ-NP-Z2-9]{4}$/.test(order.orderId)) throw new Error('Order ID is invalid.');
  if (order.email && !/^\S+@\S+\.\S+$/.test(order.email)) throw new Error('Customer email is invalid.');
  if (order.productionStatus && !['NOT STARTED', 'IN PRODUCTION', 'REVIEW', 'COMPLETED'].includes(order.productionStatus)) throw new Error('Production status is invalid.');

  if (event === 'payment-report-submitted') {
    if (!order.service || !order.tier || !Number.isFinite(Number(input.price)) || Number(input.price) < 0) throw new Error('Order summary is incomplete.');
    if (!['bank', 'linepay', 'card'].includes(String(input.paymentMethod || ''))) throw new Error('Payment method is invalid.');
    if (!order.customerName || !/^\S+@\S+\.\S+$/.test(order.email) || !order.lineId) throw new Error('Customer contact details are incomplete.');
    if (input.paymentMethod === 'bank' && !/^\d{5}$/.test(String(input.paymentLastFive || ''))) throw new Error('Bank transfer last five digits are required.');
    order.price = Number(input.price);
    order.paymentStatus = 'PAYMENT REVIEW';
    order.paymentReportedAt = order.paymentReportedAt || new Date().toISOString();
  } else if (event === 'material-link-submitted') {
    if (!order.email || !order.service || !order.tier) throw new Error('Order details are incomplete.');
    if (!/^https?:\/\//i.test(order.materialLink)) throw new Error('Material URL must start with http:// or https://.');
    order.materialMethod = 'EXTERNAL LINK';
    order.materialStatus = 'SUBMITTED';
    order.materialReportedAt = order.materialReportedAt || new Date().toISOString();
  } else if (event === 'usb-delivery-selected') {
    if (!order.email || !order.service || !order.tier) throw new Error('Order details are incomplete.');
    order.materialMethod = 'USB';
    order.materialLink = '';
    order.materialStatus = 'AWAITING DELIVERY';
    order.materialReportedAt = order.materialReportedAt || new Date().toISOString();
  } else {
    throw new Error('Unsupported event.');
  }
  order.createdAt = order.createdAt || new Date().toISOString();
  return order;
}

function saveOrder_(sheet, incoming, event) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const idColumn = headers.indexOf('orderId') + 1;
  if (idColumn < 1) throw new Error('Orders sheet is missing the orderId column.');
  const lastRow = sheet.getLastRow();
  const ids = lastRow > 1 ? sheet.getRange(2, idColumn, lastRow - 1, 1).getDisplayValues().flat() : [];
  const found = ids.indexOf(incoming.orderId);
  const rowNumber = found < 0 ? Math.max(2, lastRow + 1) : found + 2;
  const existing = found < 0 ? {} : rowToObject_(headers, sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0]);
  if (event !== 'payment-report-submitted' && found < 0) throw new Error('Order was not found. Submit a payment report before sending materials.');
  if (existing.email && String(existing.email).trim().toLowerCase() !== String(incoming.email || '').trim().toLowerCase()) throw new Error('Order ID and customer email do not match.');
  if (event !== 'payment-report-submitted' && !['PAYMENT REVIEW', 'PAID / CONFIRMED'].includes(existing.paymentStatus)) throw new Error('Payment report is not on file for this order.');
  const merged = Object.assign({}, existing, incoming);
  if (found >= 0) merged.createdAt = existing.createdAt || incoming.createdAt;

  if (event === 'payment-report-submitted') {
    merged.paymentStatus = existing.paymentStatus === 'PAID / CONFIRMED' ? existing.paymentStatus : 'PAYMENT REVIEW';
    ['materialMethod', 'materialLink', 'materialNote', 'materialStatus', 'productionStatus'].forEach(key => { merged[key] = existing[key] || incoming[key]; });
  } else {
    ['customerName', 'email', 'lineId', 'paymentReference', 'paymentTime', 'paymentNote', 'paymentLastFive', 'paymentReportedAt'].forEach(key => {
      if (!incoming[key]) merged[key] = existing[key] || '';
    });
    merged.paymentStatus = existing.paymentStatus || incoming.paymentStatus || 'PENDING PAYMENT';
    merged.productionStatus = existing.productionStatus || incoming.productionStatus || 'NOT STARTED';
  }

  const values = headers.map(header => safeCell_(merged[header] === undefined ? '' : merged[header]));
  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([values]);
  return merged;
}

function notify_(logSheet, order, event) {
  const payment = event === 'payment-report-submitted';
  const usb = event === 'usb-delivery-selected';
  const eventKey = `${event}:${order.orderId}:${order[payment ? 'paymentReportedAt' : 'materialReportedAt']}`;
  const old = findEvent_(logSheet, eventKey);
  if (old && old.status === 'SENT') return { status: 'ALREADY SENT' };
  const subject = payment
    ? `[OFFCUT] 新付款回報｜${order.orderId}`
    : `[OFFCUT] 客戶已提交素材｜${order.orderId}`;
  const body = payment ? paymentEmail_(order) : materialEmail_(order, usb);
  let status = 'SENT';
  let detail = '';
  try {
    if (!consumeDailyEmailQuota_()) throw new Error(`OFFCUT safety limit of ${OFFCUT_CONFIG.dailyEmailLimit} notification emails per day reached.`);
    if (MailApp.getRemainingDailyQuota() < 1) throw new Error('Google MailApp daily recipient quota is exhausted.');
    const message = {
      to: OFFCUT_CONFIG.notificationEmail,
      subject,
      body,
      name: 'OFFCUT STUDIO Orders'
    };
    if (order.email) message.replyTo = order.email;
    MailApp.sendEmail(message);
  } catch (error) {
    status = 'FAILED';
    detail = String(error && error.message || error).slice(0, 500);
    console.error(`Notification failed for ${eventKey}: ${detail}`);
  }
  appendLog_(logSheet, [eventKey, event, order.orderId, OFFCUT_CONFIG.notificationEmail, subject, status, detail, new Date().toISOString()]);
  return { status };
}

function paymentEmail_(order) {
  const method = { bank: 'BANK TRANSFER / 匯款', linepay: 'LINE PAY', card: 'CREDIT CARD / 信用卡' }[order.paymentMethod] || order.paymentMethod;
  return [
    'OFFCUT STUDIO', 'NEW PAYMENT REPORT', '',
    `ORDER ID\n${order.orderId}`, '',
    `SERVICE\n${order.service}`, '',
    `TIER\n${order.tier}`, '',
    `AMOUNT\nNT$${Number(order.price).toLocaleString('en-US')}${order.pricingMode === 'quote' ? ' 起' : ''}`, '',
    `PAYMENT METHOD\n${method}`, '',
    `CUSTOMER\n${order.customerName}`, '',
    `EMAIL\n${order.email}`, '',
    `LINE\n${order.lineId}`, '',
    `BANK LAST FIVE\n${order.paymentMethod === 'bank' ? order.paymentLastFive : 'N/A'}`, '',
    `PAYMENT TIME\n${order.paymentTime || '未提供'}`, '',
    `PAYMENT REFERENCE\n${order.paymentReference || '未提供'}`, '',
    `CUSTOMER NOTE\n${order.paymentNote || '無'}`, '',
    `REPORTED AT\n${order.paymentReportedAt}`, '',
    'STATUS\nPAYMENT REVIEW'
  ].join('\n');
}

function materialEmail_(order, usb) {
  return [
    'OFFCUT STUDIO', 'MATERIAL SUBMISSION', '',
    `ORDER ID\n${order.orderId}`, '',
    `CUSTOMER\n${order.customerName || '未提供'}`, '',
    `EMAIL\n${order.email || '未提供'}`, '',
    `SERVICE\n${order.service}`, '',
    `TIER\n${order.tier}`, '',
    `MATERIAL METHOD\n${usb ? 'USB DELIVERY SELECTED' : 'EXTERNAL LINK'}`, '',
    `MATERIAL LINK\n${order.materialLink || 'USB 寄送；請聯繫客戶提供寄送資訊。'}`, '',
    `MATERIAL NOTE\n${order.materialNote || '無'}`, '',
    `MATERIAL STATUS\n${usb ? 'AWAITING DELIVERY' : 'SUBMITTED'}`
  ].join('\n');
}

function lookupOrder_(orderId, email) {
  const id = String(orderId || '').trim().toUpperCase();
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!/^OFF-\d{6}-[A-HJ-NP-Z2-9]{4}$/.test(id) || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) return { ok: false, reason: 'not-found' };
  const sheet = getSheets_().orders;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { ok: false, reason: 'not-found' };
  const rows = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();
  const idIndex = headers.indexOf('orderId');
  const emailIndex = headers.indexOf('email');
  const row = rows.find(item => String(item[idIndex] || '').toUpperCase() === id && String(item[emailIndex] || '').trim().toLowerCase() === normalizedEmail);
  if (!row) return { ok: false, reason: 'not-found' };
  const order = rowToObject_(headers, row);
  return {
    ok: true,
    order: {
      orderId: id,
      createdAt: serializable_(order.createdAt),
      service: order.service,
      tier: order.tier,
      price: Number(order.price),
      pricingMode: order.pricingMode,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      paymentReportSubmitted: Boolean(order.paymentReportedAt),
      paymentReportedAt: serializable_(order.paymentReportedAt),
      materialMethod: order.materialMethod,
      materialLink: order.materialLink,
      materialNote: order.materialNote,
      materialStatus: order.materialStatus,
      productionStatus: order.productionStatus
    }
  };
}

function findEvent_(sheet, eventKey) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  const values = sheet.getRange(2, 1, lastRow - 1, OFFCUT_CONFIG.logHeaders.length).getValues();
  const row = values.reverse().find(item => item[0] === eventKey);
  return row ? { status: row[5] } : null;
}

function consumeDailyEmailQuota_() {
  const properties = PropertiesService.getScriptProperties();
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  const key = `OFFCUT_EMAIL_COUNT_${today}`;
  const current = Number(properties.getProperty(key) || 0);
  if (current >= OFFCUT_CONFIG.dailyEmailLimit) return false;
  properties.setProperty(key, String(current + 1));
  return true;
}

function appendLog_(sheet, values) {
  sheet.appendRow(values.map(safeCell_));
}

function rowToObject_(headers, row) {
  return headers.reduce((result, header, index) => { result[header] = row[index]; return result; }, {});
}

function clean_(value, limit) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number') return value;
  return String(value).trim().slice(0, limit || 500);
}

function safeCell_(value) {
  if (typeof value === 'string' && /^=/.test(value)) return `'${value}`;
  return value;
}

function serializable_(value) {
  return value instanceof Date ? value.toISOString() : value || '';
}

function jsonOutput_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
