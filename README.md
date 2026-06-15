# Telegram Notes Bot

Bot ini buat ngubah kebiasaan nyatet manual di Telegram jadi inbox yang lebih rapi, tapi tetap lewat chat.

## Yang udah bisa

- Kirim pesan biasa untuk bikin item baru
- Auto-kategori ke `todo`, `buy`, `places`, atau `notes`
- Lihat daftar item aktif
- Tandai item selesai tanpa hapus manual
- Simpan data lokal di file JSON

## Setup

1. Buat bot baru lewat `@BotFather` di Telegram.
2. Copy token bot.
3. Duplicate `.env.example` jadi `.env`.
4. Isi `TELEGRAM_BOT_TOKEN`.
5. Jalankan bot:

```bash
npm start
```

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

## Catatan

- Data disimpan di `data/notes.json`
- Versi ini pakai polling, jadi cukup jalanin lokal tanpa deploy server
- Kalau nanti kamu mau, versi berikutnya bisa ditambah:
  - deadline
  - reminder
  - tag custom
  - export ke Notion atau Google Sheet

## Deploy

Kalau kamu mau bot tetap hidup walau laptop mati atau sleep, deploy sebagai background worker.

### Opsi 1: Render

Project ini sudah disiapkan dengan [render.yaml](/Users/fajarriza/Documents/Codex/2026-06-14/jadi-sekarang-aku-tu-kalo-nyatet/render.yaml:1) dan [Dockerfile](/Users/fajarriza/Documents/Codex/2026-06-14/jadi-sekarang-aku-tu-kalo-nyatet/Dockerfile:1).

Langkah singkat:

1. Push project ini ke GitHub.
2. Di Render, buat service baru dari repo ini.
3. Pastikan type-nya `Background Worker`.
4. Isi env var `TELEGRAM_BOT_TOKEN`.
5. Render akan mount persistent disk ke `/data`, jadi catatan tetap aman saat redeploy.

### Opsi 2: Railway

Project ini juga siap dipakai di Railway dengan [railway.json](/Users/fajarriza/Documents/Codex/2026-06-14/jadi-sekarang-aku-tu-kalo-nyatet/railway.json:1).

Langkah singkat:

1. Push project ini ke GitHub.
2. Buat project baru di Railway dari repo ini.
3. Isi env var `TELEGRAM_BOT_TOKEN`.
4. Tambahkan volume lalu mount ke `/data`.
5. Tambahkan env var `DATA_DIR=/data`.

### Penting

- Kalau deploy tanpa persistent disk atau volume, file JSON bisa hilang saat redeploy.
- Bot ini tidak butuh web port karena dia jalan sebagai polling worker.
- Log startup akan nunjukin file data yang dipakai.
