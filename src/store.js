import fs from "node:fs";

function nowIso() {
  return new Date().toISOString();
}

function ensureDb(filePath) {
  const directory = filePath.split("/").slice(0, -1).join("/");
  fs.mkdirSync(directory, { recursive: true });

  if (!fs.existsSync(filePath)) {
    const initialData = {
      lastId: 0,
      items: []
    };
    fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2));
  }
}

export class Store {
  constructor(filePath) {
    this.filePath = filePath;
    ensureDb(filePath);
  }

  read() {
    return JSON.parse(fs.readFileSync(this.filePath, "utf8"));
  }

  write(data) {
    fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
  }

  addItem({ text, category, userId, chatId, reminderAt = null }) {
    const db = this.read();
    const id = db.lastId + 1;
    const reminder = reminderAt
      ? {
          at: reminderAt,
          sent15MinAt: null,
          sentAtTime: null
        }
      : null;
    const item = {
      id,
      text,
      category,
      status: "active",
      userId,
      chatId,
      reminder,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };

    db.lastId = id;
    db.items.unshift(item);
    this.write(db);
    return item;
  }

  listItems({ chatId, category, status = "active", limit = 10 }) {
    const db = this.read();
    return db.items
      .filter((item) => item.chatId === chatId)
      .filter((item) => (category ? item.category === category : true))
      .filter((item) => (status ? item.status === status : true))
      .slice(0, limit);
  }

  markDone({ chatId, id }) {
    const db = this.read();
    const item = db.items.find((entry) => entry.chatId === chatId && entry.id === id);
    if (!item) {
      return null;
    }

    item.status = "done";
    item.updatedAt = nowIso();
    this.write(db);
    return item;
  }

  dueReminders(now = new Date()) {
    const db = this.read();
    const due = [];

    for (const item of db.items) {
      const reminderAt = item.reminder?.at ?? item.reminderAt ?? null;
      if (item.status !== "active" || !reminderAt) {
        continue;
      }

      const reminderDate = new Date(reminderAt);
      const fifteenMinutesBefore = new Date(reminderDate.getTime() - 15 * 60 * 1000);
      const sent15MinAt = item.reminder?.sent15MinAt ?? null;
      const sentAtTime = item.reminder?.sentAtTime ?? item.remindedAt ?? null;

      if (!sent15MinAt && now >= fifteenMinutesBefore && now < reminderDate) {
        due.push({ item, type: "before" });
      }

      if (!sentAtTime && now >= reminderDate) {
        due.push({ item, type: "exact" });
      }
    }

    return due;
  }

  markReminderSent(id, type) {
    const db = this.read();
    const item = db.items.find((entry) => entry.id === id);
    if (!item) {
      return null;
    }

    if (!item.reminder) {
      item.reminder = {
        at: item.reminderAt ?? null,
        sent15MinAt: null,
        sentAtTime: null
      };
    }

    if (type === "before") {
      item.reminder.sent15MinAt = nowIso();
    }

    if (type === "exact") {
      item.reminder.sentAtTime = nowIso();
    }

    item.updatedAt = nowIso();
    this.write(db);
    return item;
  }

  summary(chatId) {
    const db = this.read();
    const items = db.items.filter((item) => item.chatId === chatId && item.status === "active");
    const counts = {
      todo: 0,
      buy: 0,
      places: 0,
      notes: 0
    };

    for (const item of items) {
      if (counts[item.category] !== undefined) {
        counts[item.category] += 1;
      } else {
        counts.notes += 1;
      }
    }

    return counts;
  }
}
