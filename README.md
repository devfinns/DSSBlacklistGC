# Dahua DSS to Google Chat Middleware

Node.js middleware yang mengintegrasikan Dahua DSS V8.7 Face Recognition Blacklist dengan notifikasi Google Chat.

## Cara Kerja

1. Middleware login ke Dahua DSS via HTTP Digest authentication, dan menjaga token tetap aktif dengan keep-alive berkala serta refresh otomatis.
2. Middleware subscribe ke alarm push Dahua DSS, memberikan URL callback middleware sendiri.
3. Saat kamera mendeteksi wajah dalam blacklist group, Dahua DSS mengirim alarm (XML) ke endpoint callback middleware.
4. Middleware mem-parsing alarm, mengambil detail pengenalan wajah dari API Dahua, memformat pesan, dan mengirimkannya ke Google Chat via Incoming Webhook.

## Struktur Proyek

```
src/
  config.js        # Load & validasi environment variables
  auth.js          # Login digest Dahua, keep-alive, dan auto-refresh token
  dahuaClient.js    # Axios instance khusus Dahua (skip verifikasi SSL self-signed)
  dahua.js         # Panggilan API Dahua: subscribe alarm, get face recognition info, add person
  alarmParser.js   # Parsing payload alarm XML dari Dahua
  gchat.js         # Format pesan & kirim ke Google Chat webhook
  logger.js        # Menambahkan timestamp (GMT+8) ke semua console log
  server.js        # Express server, endpoint callback, orkestrasi startup
```

## Instalasi

```bash
npm install
cp .env.example .env
```

Isi `.env` dengan nilai sesuai lingkungan Anda:

| Variable | Keterangan |
|---|---|
| `DAHUA_BASE_URL` | URL dasar Dahua DSS, contoh `https://10.62.21.254:443` |
| `DAHUA_USERNAME` | Username login Dahua DSS |
| `DAHUA_PASSWORD` | Password login Dahua DSS |
| `GOOGLE_CHAT_WEBHOOK_URL` | Incoming Webhook URL dari space Google Chat tujuan |
| `MIDDLEWARE_PORT` | Port middleware berjalan (default `3000`) |
| `MIDDLEWARE_WEBHOOK_URL` | URL callback middleware yang bisa diakses balik oleh Dahua DSS |
| `DAHUA_SUBSCRIBE_SIGNATURE` | String bebas untuk validasi signature saat subscribe alarm |

## Menjalankan

```bash
npm start
```

Untuk auto-restart saat development:

```bash
npm run dev
```

Untuk produksi, jalankan sebagai service dengan PM2:

```bash
pm2 start src/server.js --name dahua-blacklist-gchat
pm2 save
```

Endpoint kesehatan tersedia di `GET /health`.

## Catatan Jaringan

- Dahua DSS harus bisa diakses dari server middleware (arah keluar).
- Dahua DSS harus bisa mengakses balik `MIDDLEWARE_WEBHOOK_URL` (arah masuk) — pastikan firewall (ufw/security group) mengizinkan port middleware dari subnet Dahua DSS.
- Jika Dahua DSS menggunakan sertifikat self-signed, `dahuaClient.js` sudah dikonfigurasi untuk menerima itu (`rejectUnauthorized: false`) khusus untuk koneksi ke Dahua — koneksi ke Google Chat tetap diverifikasi normal.

## Diagnostik Umum

- **Error `code: 7000, "Auth failed"`** — token Dahua expired. Pastikan `auth.js` menjalankan keep-alive dan auto-refresh token (sudah diimplementasikan).
- **Gambar di Google Chat tidak bisa dibuka** — URL gambar dari Dahua DSS memerlukan parameter `?token={credential}`, yang otomatis ditambahkan oleh `gchat.js`.
- **Alarm tidak sampai ke middleware** — periksa firewall di server middleware, dan pastikan `subscribeAlarm()` berhasil dijalankan saat startup (lihat log `Successfully subscribed to alarm notifications`).
