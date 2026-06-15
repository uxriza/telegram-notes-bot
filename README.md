# Telegram Notes Bot

Bot ini buat ngubah kebiasaan nyatet manual di Telegram jadi inbox yang lebih rapi, tapi tetap lewat chat.
Versi ini sekarang disiapkan untuk `Cloudflare Workers + D1`, jadi lebih masuk akal buat project personal yang pengen murah atau gratis.

## Yang udah bisa

- Kirim pesan biasa untuk bikin item baru
- Auto-kategori ke `todo`, `buy`, `places`, atau `notes`
- Lihat daftar item aktif
- Tandai item selesai tanpa hapus manual
- Reminder `15 menit sebelum` dan `pas waktunya`
- Simpan data di `Cloudflare D1`

## Command

- `/list`
- `/todo`
- `/buy`
- `/places`
- `/notes`
- `/done 12`
- `/summary`
- `/help`

## Cara pakai

Contoh pesan biasa:

- `beli keyboard mechanical`
- `update porto behance`
- `visit coffee shop di blok m`
- `ide konten buat personal branding`
- `interview nanti jam 8 malem`
- `jam 10 test reminder notes`
- `sore jam 14.30 interview HR cek email`

## Deploy ke Cloudflare

1. Install dependency:

```bash
npm install
```

2. Login ke Cloudflare:

```bash
npx wrangler login
```

3. Buat database D1:

```bash
npx wrangler d1 create telegram-notes-bot
```

Copy `database_id` hasilnya, lalu tempel ke [wrangler.jsonc](/Users/fajarriza/Documents/Codex/2026-06-14/jadi-sekarang-aku-tu-kalo-nyatet/wrangler.jsonc:1) pada field `database_id`.

4. Jalankan schema:

```bash
npx wrangler d1 execute telegram-notes-bot --file=schema.sql
```

5. Set secret:

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put ADMIN_SECRET
```

6. Deploy:

```bash
npm run deploy
```

7. Set webhook ke Telegram.

Setelah deploy, ambil URL Worker kamu lalu panggil:

```bash
curl -X POST https://YOUR-WORKER.workers.dev/admin/setup-webhook \
  -H "x-admin-secret: YOUR_ADMIN_SECRET"
```

Kalau sukses, endpoint webhook Telegram akan diarahkan ke:
`https://YOUR-WORKER.workers.dev/telegram/webhook`

## Catatan penting

- Project ini sudah tidak mengandalkan process polling yang nyala terus.
- Reminder diproses oleh cron Worker setiap 5 menit.
- Karena cron jalan per 5 menit, reminder tidak selalu detik-presisi. Untuk project personal ini masih masuk akal.
- Kalau nanti kamu mau reminder lebih presisi, next step-nya pakai Durable Objects atau queue.
