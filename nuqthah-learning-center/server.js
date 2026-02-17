import "dotenv/config";
import express from "express";
import cors from "cors";
import midtransClient from "midtrans-client";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const app = express();

// ===== ENV =====
const PORT = Number(process.env.PORT || 4000);
const IS_PRODUCTION = String(process.env.MIDTRANS_IS_PRODUCTION || "false") === "true";
const SERVER_KEY = process.env.MIDTRANS_SERVER_KEY;
const CLIENT_KEY = process.env.MIDTRANS_CLIENT_KEY;

if (!SERVER_KEY) console.warn("⚠️ MIDTRANS_SERVER_KEY is missing. Set it in your .env");
if (!CLIENT_KEY) console.warn("⚠️ MIDTRANS_CLIENT_KEY is missing. Set it in your .env");

// ===== PRICE MAP (MUST MATCH index.html data-package EXACTLY) =====
// Matched from index.html buttons:
// - Free Trial (0)
// - Muqarrar Termin 1 (90000)
// - Bundle Termin 1–2 (150000)
const PRICE_MAP = {
  "Free Trial": 0,
  "Muqarrar Termin 1": 90000,
  "Bundle Termin 1–2": 150000,
};

// ===== Middleware =====
app.use(express.json());

// If frontend+backend are served from same origin, you DON'T need CORS.
// If you deploy frontend separately, set CORS_ORIGIN="https://a.com,https://b.com".
if (process.env.CORS_ORIGIN) {
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN.split(",").map((s) => s.trim()),
      methods: ["GET", "POST"],
    })
  );
}

// ===== Midtrans Snap Client (Server Side) =====
const snap = new midtransClient.Snap({
  isProduction: IS_PRODUCTION,
  serverKey: SERVER_KEY,
  clientKey: CLIENT_KEY,
});

// ===== Serve Static Frontend (index.html, script.js, styles.css, assets/) =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(__dirname));

// Demo-only in-memory order store. For production, use a DB.
const orders = new Map();

// Health check
app.get("/health", (req, res) => res.json({ ok: true, production: IS_PRODUCTION }));

/**
 * POST /api/midtrans-token
 * body: { nama, wa, paket }
 * return: { token, order_id }
 */
app.post("/api/midtrans-token", async (req, res) => {
  try {
    if (!SERVER_KEY) {
      return res.status(500).json({ error: "MIDTRANS_SERVER_KEY belum di-set di .env" });
    }

    const { nama, wa, paket } = req.body || {};
    if (!nama || !wa || !paket) {
      return res.status(400).json({ error: "Field wajib: nama, wa, paket" });
    }

    if (!(paket in PRICE_MAP)) {
      return res.status(400).json({ error: "Paket tidak valid atau belum terdaftar" });
    }

    const amount = Number(PRICE_MAP[paket]);
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(500).json({ error: "Konfigurasi harga server tidak valid" });
    }

    // Paket gratis tidak perlu Midtrans
    if (amount === 0) {
      return res.status(400).json({ error: "Paket gratis (Free Trial) tidak memerlukan pembayaran" });
    }

    const order_id = `ORDER-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;

    const parameter = {
      transaction_details: {
        order_id,
        gross_amount: amount,
      },
      customer_details: {
        first_name: nama,
        phone: wa,
      },
      item_details: [
        {
          id: paket,
          price: amount,
          quantity: 1,
          name: paket,
        },
      ],
    };

    const token = await snap.createTransactionToken(parameter);

    orders.set(order_id, {
      nama,
      wa,
      paket,
      amount,
      status: "CREATED",
      updatedAt: new Date().toISOString(),
    });

    return res.json({ token, order_id });
  } catch (err) {
    console.error("Midtrans token error:", err?.message || err);
    return res.status(500).json({
      error: "Gagal membuat token Midtrans",
      detail: err?.message || String(err),
    });
  }
});

/**
 * POST /api/midtrans-webhook
 * Payment notification handler
 */
app.post("/api/midtrans-webhook", async (req, res) => {
  try {
    if (!SERVER_KEY) return res.status(500).json({ error: "Server key belum siap" });

    const n = req.body || {};
    const { order_id, status_code, gross_amount, signature_key } = n;

    if (!order_id || !status_code || !gross_amount || !signature_key) {
      return res.status(400).json({ error: "Payload webhook tidak lengkap" });
    }

    // Verify signature: sha512(order_id + status_code + gross_amount + serverKey)
    const expected = crypto
      .createHash("sha512")
      .update(String(order_id) + String(status_code) + String(gross_amount) + String(SERVER_KEY))
      .digest("hex");

    if (expected !== signature_key) {
      return res.status(401).json({ error: "Invalid signature" });
    }

    const t = n.transaction_status;
    const f = n.fraud_status;
    let mapped = "UNKNOWN";

    if (t === "settlement" || t === "capture") mapped = f === "challenge" ? "CHALLENGE" : "PAID";
    else if (t === "pending") mapped = "PENDING";
    else if (t === "deny") mapped = "DENIED";
    else if (t === "expire") mapped = "EXPIRED";
    else if (t === "cancel") mapped = "CANCELED";

    const existing = orders.get(order_id) || {};
    orders.set(order_id, {
      ...existing,
      status: mapped,
      updatedAt: new Date().toISOString(),
      midtrans: n,
    });

    // TODO (production): grant akses / kirim WA / update DB
    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("Webhook error:", err?.message || err);
    return res.status(500).json({ error: "Webhook error", detail: err?.message || String(err) });
  }
});

// Simple order status endpoint (demo)
app.get("/api/order/:order_id", (req, res) => {
  const order = orders.get(req.params.order_id);
  if (!order) return res.status(404).json({ error: "Order tidak ditemukan" });
  return res.json({ order_id: req.params.order_id, ...order });
});

// Fallback route to index.html (biar kalau refresh tetap aman)
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`✅ Backend running on http://localhost:${PORT} (production=${IS_PRODUCTION})`);
});
