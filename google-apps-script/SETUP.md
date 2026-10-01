# OFFCUT 訂單表與通知設定

## 一次性設定

1. 建立一份新的 Google Sheet，開啟「擴充功能 → Apps Script」。
2. 將 `Code.gs` 全文貼入並儲存。回到試算表重新載入一次，讓綁定腳本記住這份 Sheet。`Orders` 與 `Notification Log` 工作表及欄位會在第一次 API 請求時自動建立。
3. 在 Apps Script 編輯器選取 `setupOffcutSheets` 並按「執行」；依 Google 畫面授權試算表及寄信權限時按「允許」（此設定函式不會寄信）。接著選「部署 → 新增部署 → 網頁應用程式」；執行身分選「我」，存取權選「所有人」。
4. 複製部署完成的 Web App URL（以 `/exec` 結尾）。
5. 在網站的 `site-config.js`，只把 `OFFCUT_ORDER_API_URL` 的空字串換成該 URL；儲存並部署網站。

> Web App 由你的 Google 帳號執行。URL 是公開的網站設定，不要在此放帳密、Token 或 API 私鑰。Apps Script 會將 Email 寄到 `offcut.studio.2026@gmail.com`；通知成功或失敗記錄在 `Notification Log`。為降低公開端點遭濫用的風險，程式每日最多寄 40 封通知。

## Orders 工作表欄位

`orderId`, `createdAt`, `service`, `tier`, `price`, `pricingMode`, `paymentMethod`, `customerName`, `email`, `lineId`, `paymentReference`, `paymentTime`, `paymentNote`, `paymentReportedAt`, `paymentStatus`, `materialMethod`, `materialLink`, `materialNote`, `materialStatus`, `productionStatus`, `paymentLastFive`

`paymentLastFive` 另外保留匯款末五碼，讓通知信可以獨立列出。你可直接在 `Orders` 手動修改 `paymentStatus`、`materialStatus`、`productionStatus`。通知寄送結果記在 `Notification Log`，不會覆蓋人工狀態。

## OFFCUT Google Form

建立好 Google Form 後，在 `site-config.js` 設定 `OFFCUT_GOOGLE_FORM_URL`。若要把訂單編號預填進表單，再把 `OFFCUT_GOOGLE_FORM_ORDER_ENTRY_ID` 設為 Form 的實際 `entry.<數字>` 欄位編號；未設定欄位編號時仍會開啟表單，但不猜測或假造欄位 ID。Form URL 空白時網站會顯示「上傳入口準備中」。
