import { getConfig } from "./config.js";
import { detectCategory } from "./categorize.js";
import { doneKeyboard, formatItem, formatList, formatSummary, helpMessage, quickMenu } from "./format.js";
import { extractReminder, formatReminder } from "./reminder.js";
import { Store } from "./store.js";
import { TelegramClient } from "./telegram.js";

const config = getConfig();
const store = new Store(config.dbFile);
const telegram = new TelegramClient(config.token);
const replyMarkup = {
  reply_markup: quickMenu()
};

console.log(`Bot started. Data file: ${config.dbFile}`);

function normalizeInput(text) {
  const normalized = (text || "").trim();
  const input = normalized.toLowerCase();

  if (input === "lihat semua") {
    return "/list";
  }

  if (input === "ringkasan") {
    return "/summary";
  }

  if (input === "to-do") {
    return "/todo";
  }

  if (input === "belanja") {
    return "/buy";
  }

  if (input === "tempat") {
    return "/places";
  }

  if (input === "catatan") {
    return "/notes";
  }

  return normalized;
}

function buildReplyOptions(items) {
  return {
    reply_markup: doneKeyboard(items) ?? quickMenu()
  };
}

function parseDoneCommand(text) {
  const match = text.match(/^\/done\s+(\d+)$/);
  return match ? Number(match[1]) : null;
}

async function handleCommand(message) {
  const chatId = message.chat.id;
  const text = normalizeInput(message.text);

  if (text === "/start" || text === "/help") {
    await telegram.sendMessage(chatId, helpMessage(), replyMarkup);
    return;
  }

  if (text === "/list") {
    const items = store.listItems({ chatId });
    await telegram.sendMessage(chatId, formatList("Item aktif terbaru", items), buildReplyOptions(items));
    return;
  }

  if (["/todo", "/buy", "/places", "/notes"].includes(text)) {
    const category = text.slice(1);
    const items = store.listItems({ chatId, category });
    await telegram.sendMessage(chatId, formatList(`Kategori ${category}`, items), buildReplyOptions(items));
    return;
  }

  if (text === "/summary") {
    await telegram.sendMessage(chatId, formatSummary(store.summary(chatId)), replyMarkup);
    return;
  }

  const doneId = parseDoneCommand(text);
  if (doneId) {
    const item = store.markDone({ chatId, id: doneId });
    const reply = item ? `Selesai: ${formatItem(item)}` : `Item #${doneId} ga ketemu.`;
    await telegram.sendMessage(chatId, reply, replyMarkup);
    return;
  }

  const reminder = extractReminder(text);
  const category = detectCategory(reminder.cleanText);
  const item = store.addItem({
    text: reminder.cleanText,
    category,
    userId: message.from?.id ?? null,
    chatId,
    reminderAt: reminder.reminderAt
  });

  const reminderText = reminder.reminderAt
    ? `\nReminder: ${formatReminder(reminder.reminderAt)}\nNotifikasi: 15 menit sebelum dan pas waktunya`
    : "";
  await telegram.sendMessage(chatId, `Tersimpan: ${formatItem(item)}${reminderText}`, buildReplyOptions([item]));
}

async function handleCallbackQuery(callbackQuery) {
  const callbackData = callbackQuery.data || "";
  const chatId = callbackQuery.message?.chat?.id;

  if (!chatId) {
    return;
  }

  if (callbackData.startsWith("done:")) {
    const id = Number(callbackData.split(":")[1]);
    const item = store.markDone({ chatId, id });
    await telegram.answerCallbackQuery(
      callbackQuery.id,
      item ? "Item ditandai selesai" : "Item tidak ditemukan"
    );

    const reply = item ? `Selesai: ${formatItem(item)}` : `Item #${id} ga ketemu.`;
    await telegram.sendMessage(chatId, reply, replyMarkup);
    return;
  }

  await telegram.answerCallbackQuery(callbackQuery.id, "Aksi tidak dikenali");
}

async function poll() {
  let offset = 0;

  while (true) {
    try {
      const updates = await telegram.getUpdates(offset);
      for (const update of updates) {
        offset = update.update_id + 1;
        if (update.callback_query) {
          await handleCallbackQuery(update.callback_query);
          continue;
        }

        if (!update.message?.text) {
          continue;
        }

        await handleCommand(update.message);
      }

      const dueItems = store.dueReminders(new Date());
      for (const due of dueItems) {
        const prefix =
          due.type === "before"
            ? "Reminder 15 menit lagi:"
            : "Reminder sekarang:";
        await telegram.sendMessage(
          due.item.chatId,
          `${prefix} ${formatItem(due.item)}`,
          replyMarkup
        );
        store.markReminderSent(due.item.id, due.type);
      }
    } catch (error) {
      console.error(error.message);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }
}

poll().catch((error) => {
  console.error(error);
  process.exit(1);
});
