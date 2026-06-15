const TELEGRAM_API = "https://api.telegram.org";

export class TelegramClient {
  constructor(token) {
    this.baseUrl = `${TELEGRAM_API}/bot${token}`;
  }

  async request(method, payload = {}) {
    const response = await fetch(`${this.baseUrl}/${method}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.ok) {
      throw new Error(`Telegram API failed: ${data.description}`);
    }

    return data.result;
  }

  getUpdates(offset) {
    return this.request("getUpdates", {
      offset,
      timeout: 30
    });
  }

  sendMessage(chatId, text, extra = {}) {
    return this.request("sendMessage", {
      chat_id: chatId,
      text,
      ...extra
    });
  }

  answerCallbackQuery(callbackQueryId, text = "OK") {
    return this.request("answerCallbackQuery", {
      callback_query_id: callbackQueryId,
      text
    });
  }
}
