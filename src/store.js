function nowIso() {
  return new Date().toISOString();
}

const TIMEZONE_FIX_CUTOFF = "2026-06-22T08:31:00.000Z";

function mapItem(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    text: row.text,
    category: row.category,
    status: row.status,
    userId: row.user_id,
    chatId: row.chat_id,
    reminder: row.reminder_at
      ? {
          at: row.reminder_at,
          sent15MinAt: row.reminder_15_sent_at,
          sentAtTime: row.reminder_sent_at
        }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export class Store {
  constructor(db) {
    this.db = db;
  }

  async addItem({ text, category, userId, chatId, reminderAt = null }) {
    const timestamp = nowIso();
    const result = await this.db
      .prepare(
        `INSERT INTO items (
          text, category, status, user_id, chat_id, reminder_at,
          reminder_15_sent_at, reminder_sent_at, created_at, updated_at
        ) VALUES (?, ?, 'active', ?, ?, ?, NULL, NULL, ?, ?)`
      )
      .bind(text, category, userId ? String(userId) : null, String(chatId), reminderAt, timestamp, timestamp)
      .run();

    const row = await this.db
      .prepare("SELECT * FROM items WHERE id = ?")
      .bind(result.meta.last_row_id)
      .first();

    return mapItem(row);
  }

  async listItems({ chatId, category, status = "active", limit = 10 }) {
    let query = "SELECT * FROM items WHERE chat_id = ? AND status = ?";
    const bindings = [String(chatId), status];

    if (category) {
      query += " AND category = ?";
      bindings.push(category);
    }

    query += " ORDER BY id DESC LIMIT ?";
    bindings.push(limit);

    const { results } = await this.db.prepare(query).bind(...bindings).all();
    return results.map(mapItem);
  }

  async markDone({ chatId, id }) {
    const timestamp = nowIso();
    await this.db
      .prepare(
        "UPDATE items SET status = 'done', updated_at = ? WHERE id = ? AND chat_id = ?"
      )
      .bind(timestamp, id, String(chatId))
      .run();

    const row = await this.db
      .prepare("SELECT * FROM items WHERE id = ? AND chat_id = ?")
      .bind(id, String(chatId))
      .first();

    return mapItem(row);
  }

  async deleteItem({ chatId, id }) {
    const row = await this.db
      .prepare("SELECT * FROM items WHERE id = ? AND chat_id = ?")
      .bind(id, String(chatId))
      .first();

    if (!row) {
      return null;
    }

    await this.db
      .prepare("DELETE FROM items WHERE id = ? AND chat_id = ?")
      .bind(id, String(chatId))
      .run();

    return mapItem(row);
  }

  async dueReminders(now = new Date()) {
    const nowIsoValue = now.toISOString();
    const upperBound = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
    const { results } = await this.db
      .prepare(
        `SELECT * FROM items
         WHERE status = 'active'
           AND reminder_at IS NOT NULL
           AND (
             reminder_sent_at IS NULL
             OR reminder_15_sent_at IS NULL
           )
           AND reminder_at <= ?`
      )
      .bind(upperBound)
      .all();

    const due = [];

    for (const row of results) {
      const item = mapItem(row);
      const reminderDate = new Date(item.reminder.at);
      const fifteenMinutesBefore = new Date(reminderDate.getTime() - 15 * 60 * 1000);

      if (!item.reminder.sent15MinAt && now >= fifteenMinutesBefore && now < reminderDate) {
        due.push({ item, type: "before" });
      }

      if (!item.reminder.sentAtTime && now >= reminderDate) {
        due.push({ item, type: "exact" });
      }
    }

    return due;
  }

  async markReminderSent(id, type) {
    const field = type === "before" ? "reminder_15_sent_at" : "reminder_sent_at";
    const timestamp = nowIso();
    await this.db
      .prepare(`UPDATE items SET ${field} = ?, updated_at = ? WHERE id = ?`)
      .bind(timestamp, timestamp, id)
      .run();
  }

  async summary(chatId) {
    const { results } = await this.db
      .prepare(
        `SELECT category, COUNT(*) as count
         FROM items
         WHERE chat_id = ? AND status = 'active'
         GROUP BY category`
      )
      .bind(String(chatId))
      .all();

    const counts = {
      todo: 0,
      buy: 0,
      places: 0,
      notes: 0
    };

    for (const row of results) {
      if (counts[row.category] !== undefined) {
        counts[row.category] = Number(row.count);
      }
    }

    return counts;
  }

  async debugReminderState(limit = 10) {
    const { results } = await this.db
      .prepare(
        `SELECT id, text, category, status, chat_id, reminder_at, reminder_15_sent_at, reminder_sent_at, created_at, updated_at
         FROM items
         ORDER BY id DESC
         LIMIT ?`
      )
      .bind(limit)
      .all();

    return results.map(mapItem);
  }

  async repairLegacyReminderOffsets() {
    const { results } = await this.db
      .prepare(
        `SELECT *
         FROM items
         WHERE status = 'active'
           AND reminder_at IS NOT NULL
           AND reminder_sent_at IS NULL
           AND reminder_15_sent_at IS NULL
           AND created_at < ?`
      )
      .bind(TIMEZONE_FIX_CUTOFF)
      .all();

    const repaired = [];
    const timestamp = nowIso();

    for (const row of results) {
      const item = mapItem(row);
      const repairedAt = new Date(new Date(item.reminder.at).getTime() - 7 * 60 * 60 * 1000).toISOString();

      await this.db
        .prepare(
          `UPDATE items
           SET reminder_at = ?, updated_at = ?
           WHERE id = ?`
        )
        .bind(repairedAt, timestamp, item.id)
        .run();

      repaired.push({
        id: item.id,
        text: item.text,
        oldReminderAt: item.reminder.at,
        newReminderAt: repairedAt
      });
    }

    return repaired;
  }
}
