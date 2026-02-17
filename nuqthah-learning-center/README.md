# Midtrans Snap Token Backend (Nuqthah)

## 1) Install
```bash
cd midtrans-backend
npm install
```

## 2) Configure environment
Copy `.env.example` to `.env` and fill your keys:
```bash
cp .env.example .env
```

> Keep **SERVER KEY** secret. Never put it in frontend.

## 3) Run
```bash
npm run dev
```
Backend will run at `http://localhost:3000`.

## 4) Connect from your website
In your `script.js`, set:
```js
const BACKEND_URL = '/api/midtrans-token'
```

If you host backend on a different domain:
```js
const BACKEND_URL = 'https://api.yourdomain.com/api/midtrans-token'
```

## 5) Frontend setup (Snap.js)
In HTML:
```html
<script src="https://app.sandbox.midtrans.com/snap/snap.js" data-client-key="YOUR_SANDBOX_CLIENT_KEY"></script>
```
For production:
```html
<script src="https://app.midtrans.com/snap/snap.js" data-client-key="YOUR_PROD_CLIENT_KEY"></script>
```

## 6) Webhook (optional but recommended)
Set Midtrans payment notification URL to:
`https://your-backend-domain.com/api/midtrans-webhook`

## Endpoints
- `POST /api/midtrans-token` -> `{ token, order_id }`
- `POST /api/midtrans-webhook` -> receives notifications
- `GET /api/order/:order_id` -> demo status lookup

## Security notes
- Backend **does not trust** price from client: it uses a server-side PRICE_MAP.
- Restrict CORS origins via `ALLOWED_ORIGINS`.
