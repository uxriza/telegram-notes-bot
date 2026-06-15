export function formatItem(item) {
  return `#${item.id} [${item.category}] ${item.text}`;
}

export function formatList(title, items) {
  if (!items.length) {
    return `${title}\n\nBelum ada item.`;
  }

  return `${title}\n\n${items.map(formatItem).join("\n")}`;
}

export function formatSummary(counts) {
  return [
    "Inbox kamu sekarang:",
    `todo: ${counts.todo}`,
    `buy: ${counts.buy}`,
    `places: ${counts.places}`,
    `notes: ${counts.notes}`
  ].join("\n");
}

export function helpMessage() {
  return [
    "Catat apa aja langsung kirim aja sebagai pesan biasa.",
    "",
    "Command yang bisa dipakai:",
    "/list - lihat item aktif terbaru",
    "/todo - lihat kategori todo",
    "/buy - lihat kategori buy",
    "/places - lihat kategori places",
    "/notes - lihat kategori notes",
    "/done 12 - tandai item selesai",
    "/delete 12 - hapus item",
    "/summary - lihat ringkasan aktif",
    "/help - lihat bantuan"
  ].join("\n");
}

export function quickMenu() {
  return {
    keyboard: [
      ["Lihat Semua", "Ringkasan"],
      ["To-do", "Belanja"],
      ["Tempat", "Catatan"]
    ],
    resize_keyboard: true,
    is_persistent: true
  };
}

export function doneKeyboard(items) {
  if (!items.length) {
    return null;
  }

  return {
    inline_keyboard: items.slice(0, 5).map((item) => [
      {
        text: `Selesai #${item.id}`,
        callback_data: `done:${item.id}`
      },
      {
        text: `Hapus #${item.id}`,
        callback_data: `delete:${item.id}`
      }
    ])
  };
}
