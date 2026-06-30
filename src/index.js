import { detectCategory } from "./categorize.js";
import { doneKeyboard, formatItem, formatList, formatSummary, helpMessage, quickMenu } from "./format.js";
import { extractReminder, formatReminder } from "./reminder.js";
import { Store } from "./store.js";
import { TelegramClient } from "./telegram.js";

const replyMarkup = {
  reply_markup: quickMenu()
};

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

function parseDeleteCommand(text) {
  const match = text.match(/^\/delete\s+(\d+)$/);
  return match ? Number(match[1]) : null;
}

async function handleCommand(message, store, telegram) {
  const chatId = message.chat.id;
  const text = normalizeInput(message.text);

  if (text === "/start" || text === "/help") {
    await telegram.sendMessage(chatId, helpMessage(), replyMarkup);
    return;
  }

  if (text === "/list") {
    const items = await store.listItems({ chatId });
    await telegram.sendMessage(chatId, formatList("Item aktif terbaru", items), buildReplyOptions(items));
    return;
  }

  if (["/todo", "/buy", "/places", "/notes"].includes(text)) {
    const category = text.slice(1);
    const items = await store.listItems({ chatId, category });
    await telegram.sendMessage(chatId, formatList(`Kategori ${category}`, items), buildReplyOptions(items));
    return;
  }

  if (text === "/summary") {
    await telegram.sendMessage(chatId, formatSummary(await store.summary(chatId)), replyMarkup);
    return;
  }

  const doneId = parseDoneCommand(text);
  if (doneId) {
    const item = store.markDone({ chatId, id: doneId });
    const resolvedItem = await item;
    const reply = resolvedItem ? `Selesai: ${formatItem(resolvedItem)}` : `Item #${doneId} ga ketemu.`;
    await telegram.sendMessage(chatId, reply, replyMarkup);
    return;
  }

  const deleteId = parseDeleteCommand(text);
  if (deleteId) {
    const item = await store.deleteItem({ chatId, id: deleteId });
    const reply = item ? `Dihapus: ${formatItem(item)}` : `Item #${deleteId} ga ketemu.`;
    await telegram.sendMessage(chatId, reply, replyMarkup);
    return;
  }

  const reminder = extractReminder(text);
  const category = detectCategory(reminder.cleanText);
  const item = await store.addItem({
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

async function handleCallbackQuery(callbackQuery, store, telegram) {
  const callbackData = callbackQuery.data || "";
  const chatId = callbackQuery.message?.chat?.id;

  if (!chatId) {
    return;
  }

  if (callbackData.startsWith("done:")) {
    const id = Number(callbackData.split(":")[1]);
    const item = await store.markDone({ chatId, id });
    await telegram.answerCallbackQuery(
      callbackQuery.id,
      item ? "Item ditandai selesai" : "Item tidak ditemukan"
    );

    const reply = item ? `Selesai: ${formatItem(item)}` : `Item #${id} ga ketemu.`;
    await telegram.sendMessage(chatId, reply, replyMarkup);
    return;
  }

  if (callbackData.startsWith("delete:")) {
    const id = Number(callbackData.split(":")[1]);
    const item = await store.deleteItem({ chatId, id });
    await telegram.answerCallbackQuery(
      callbackQuery.id,
      item ? "Item dihapus" : "Item tidak ditemukan"
    );

    const reply = item ? `Dihapus: ${formatItem(item)}` : `Item #${id} ga ketemu.`;
    await telegram.sendMessage(chatId, reply, replyMarkup);
    return;
  }

  await telegram.answerCallbackQuery(callbackQuery.id, "Aksi tidak dikenali");
}

async function processReminderQueue(env) {
  const store = new Store(env.DB);
  const telegram = new TelegramClient(env.TELEGRAM_BOT_TOKEN);
  const dueItems = await store.dueReminders(new Date());

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
    await store.markReminderSent(due.item.id, due.type);
  }

  return dueItems.length;
}

function unauthorized() {
  return new Response("Unauthorized", { status: 401 });
}

async function setupWebhook(request, env) {
  if (request.headers.get("x-admin-secret") !== env.ADMIN_SECRET) {
    return unauthorized();
  }

  const url = new URL(request.url);
  const webhookUrl = `${url.origin}/telegram/webhook`;
  const telegram = new TelegramClient(env.TELEGRAM_BOT_TOKEN);
  await telegram.setWebhook(webhookUrl);

  return Response.json({
    ok: true,
    webhookUrl
  });
}

async function handleWebhook(request, env) {
  const update = await request.json();
  const store = new Store(env.DB);
  const telegram = new TelegramClient(env.TELEGRAM_BOT_TOKEN);

  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query, store, telegram);
    return Response.json({ ok: true });
  }

  if (update.message?.text) {
    await handleCommand(update.message, store, telegram);
  }

  return Response.json({ ok: true });
}

async function debugReminders(request, env) {
  if (request.headers.get("x-admin-secret") !== env.ADMIN_SECRET) {
    return unauthorized();
  }

  const store = new Store(env.DB);
  const now = new Date();
  const recent = await store.debugReminderState(10);
  const due = await store.dueReminders(now);

  return Response.json({
    ok: true,
    now: now.toISOString(),
    dueCount: due.length,
    due: due.map((entry) => ({
      type: entry.type,
      item: entry.item
    })),
    recent
  });
}

async function repairReminders(request, env) {
  if (request.headers.get("x-admin-secret") !== env.ADMIN_SECRET) {
    return unauthorized();
  }

  const store = new Store(env.DB);
  const repaired = await store.repairLegacyReminderOffsets();

  return Response.json({
    ok: true,
    repairedCount: repaired.length,
    repaired
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return Response.json({
        ok: true,
        service: "telegram-notes-bot",
        mode: "cloudflare-worker"
      });
    }

    if (request.method === "POST" && url.pathname === "/telegram/webhook") {
      return handleWebhook(request, env);
    }

    if (request.method === "POST" && url.pathname === "/admin/setup-webhook") {
      return setupWebhook(request, env);
    }

    if (request.method === "POST" && url.pathname === "/admin/process-reminders") {
      if (request.headers.get("x-admin-secret") !== env.ADMIN_SECRET) {
        return unauthorized();
      }

      ctx.waitUntil(processReminderQueue(env));
      return Response.json({ ok: true, queued: true });
    }

    if (request.method === "GET" && url.pathname === "/admin/debug-reminders") {
      return debugReminders(request, env);
    }

    if (request.method === "POST" && url.pathname === "/admin/repair-reminders") {
      return repairReminders(request, env);
    }

    return new Response("Not Found", { status: 404 });
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(processReminderQueue(env));
  }
};
