const monthMap = {
  januari: 0,
  februari: 1,
  maret: 2,
  april: 3,
  mei: 4,
  juni: 5,
  juli: 6,
  agustus: 7,
  september: 8,
  oktober: 9,
  november: 10,
  desember: 11
};

const weekdayMap = {
  minggu: 0,
  senin: 1,
  selasa: 2,
  rabu: 3,
  kamis: 4,
  jumat: 5,
  sabtu: 6
};

const JAKARTA_OFFSET_MS = 7 * 60 * 60 * 1000;
const TIME_ZONE = "Asia/Jakarta";

function toJakartaTime(date) {
  return new Date(date.getTime() + JAKARTA_OFFSET_MS);
}

function fromJakartaTime(date) {
  return new Date(date.getTime() - JAKARTA_OFFSET_MS);
}

function startOfMinute(date) {
  const copy = toJakartaTime(date);
  copy.setUTCSeconds(0, 0);
  return copy;
}

function parseHourMinute(match) {
  const hour = Number(match[1]);
  const minute = match[2] ? Number(match[2]) : 0;
  const period = match[3]?.toLowerCase();
  const normalizedPeriod = period === "malem" ? "malam" : period;

  let normalizedHour = hour;
  if (normalizedPeriod === "siang" && normalizedHour < 11) {
    normalizedHour += 12;
  }

  if ((normalizedPeriod === "sore" || normalizedPeriod === "malam") && normalizedHour < 12) {
    normalizedHour += 12;
  }

  if (normalizedPeriod === "pagi" && normalizedHour === 12) {
    normalizedHour = 0;
  }

  if (normalizedHour > 23 || minute > 59) {
    return null;
  }

  return { hour: normalizedHour, minute };
}

function applyTime(baseDate, time) {
  const reminderAt = new Date(baseDate);
  reminderAt.setUTCHours(time.hour, time.minute, 0, 0);
  return reminderAt;
}

function cleanupText(text, matchedText) {
  return text.replace(matchedText, "").replace(/\s+/g, " ").trim();
}

function cleanupParts(text, parts) {
  return parts
    .reduce((result, part) => result.replace(part, " "), text)
    .replace(/\s+/g, " ")
    .trim();
}

function resolveBaseDate(dayHint, now) {
  const baseDate = startOfMinute(now);

  if (!dayHint) {
    return baseDate;
  }

  const normalized = dayHint.toLowerCase();

  if (normalized === "besok") {
    baseDate.setUTCDate(baseDate.getUTCDate() + 1);
    return baseDate;
  }

  if (normalized === "nanti") {
    return baseDate;
  }

  if (normalized === "siang" || normalized === "sore" || normalized === "malam" || normalized === "malem") {
    return baseDate;
  }

  const targetWeekday = weekdayMap[normalized];
  if (targetWeekday !== undefined) {
    const currentWeekday = baseDate.getUTCDay();
    let diff = targetWeekday - currentWeekday;
    if (diff < 0) {
      diff += 7;
    }
    baseDate.setUTCDate(baseDate.getUTCDate() + diff);
  }

  return baseDate;
}

function finalizeRelativeReminder({ normalized, now, dayHint, timeMatch, cleanupTargets }) {
  const [, rawHour, rawMinute, rawPeriod] = timeMatch;
  const inferredPeriod = rawPeriod || (dayHint === "malem" ? "malem" : dayHint);
  const time = parseHourMinute([null, rawHour, rawMinute, inferredPeriod]);
  if (!time) {
    return { cleanText: normalized, reminderAt: null };
  }

  const localNow = toJakartaTime(now);
  const baseDate = resolveBaseDate(dayHint, now);
  let reminderAt = applyTime(baseDate, time);

  if (!dayHint && reminderAt <= localNow) {
    reminderAt.setUTCDate(reminderAt.getUTCDate() + 1);
  }

  if (dayHint === "nanti" && reminderAt <= localNow) {
    reminderAt.setUTCDate(reminderAt.getUTCDate() + 1);
  }

  const cleanText = cleanupParts(normalized, cleanupTargets) || normalized;
  return {
    cleanText,
    reminderAt: fromJakartaTime(reminderAt).toISOString()
  };
}

export function extractReminder(text, now = new Date()) {
  const normalized = text.trim();
  const lower = normalized.toLowerCase();

  const relativeDayMatch = lower.match(/\b(nanti|besok)\b/);
  const explicitPeriodTimeMatch = lower.match(
    /\bjam\s+(\d{1,2})(?:[.:](\d{2}))?\s+(pagi|siang|sore|malam|malem)\b/
  );
  const plainTimeMatch = lower.match(/\bjam\s+(\d{1,2})(?:[.:](\d{2}))?\b/);
  const timeMatch = explicitPeriodTimeMatch ?? plainTimeMatch;

  if (relativeDayMatch && timeMatch) {
    return finalizeRelativeReminder({
      normalized,
      now,
      dayHint: relativeDayMatch[1],
      timeMatch,
      cleanupTargets: [relativeDayMatch[0], timeMatch[0]]
    });
  }

  const dayHintMatch = lower.match(/\b(senin|selasa|rabu|kamis|jumat|sabtu|minggu|siang|sore|malam|malem)\b/);
  if (dayHintMatch && timeMatch) {
    return finalizeRelativeReminder({
      normalized,
      now,
      dayHint: dayHintMatch[1],
      timeMatch,
      cleanupTargets: [dayHintMatch[0], timeMatch[0]]
    });
  }

  if (timeMatch) {
    return finalizeRelativeReminder({
      normalized,
      now,
      dayHint: null,
      timeMatch,
      cleanupTargets: [timeMatch[0]]
    });
  }

  const absoluteMatch = lower.match(
    /\b(\d{1,2})\s+(januari|februari|maret|april|mei|juni|juli|agustus|september|oktober|november|desember)\s+jam\s+(\d{1,2})(?:[.:](\d{2}))?(?:\s+(pagi|siang|sore|malam|malem))?\b/
  );

  if (absoluteMatch) {
    const [, rawDate, rawMonth, rawHour, rawMinute, rawPeriod] = absoluteMatch;
    const time = parseHourMinute([null, rawHour, rawMinute, rawPeriod]);
    if (!time) {
      return { cleanText: normalized, reminderAt: null };
    }

    const localNow = toJakartaTime(now);
    const reminderAt = startOfMinute(now);
    reminderAt.setUTCMonth(monthMap[rawMonth], Number(rawDate));
    reminderAt.setFullYear(
      reminderAt < localNow && monthMap[rawMonth] < localNow.getUTCMonth()
        ? localNow.getUTCFullYear() + 1
        : localNow.getUTCFullYear()
    );
    reminderAt.setUTCHours(time.hour, time.minute, 0, 0);

    if (reminderAt <= localNow) {
      reminderAt.setUTCFullYear(reminderAt.getUTCFullYear() + 1);
    }

    return {
      cleanText: cleanupText(normalized, absoluteMatch[0]) || normalized,
      reminderAt: fromJakartaTime(reminderAt).toISOString()
    };
  }

  return {
    cleanText: normalized,
    reminderAt: null
  };
}

export function formatReminder(reminderAt) {
  if (!reminderAt) {
    return null;
  }

  const date = new Date(reminderAt);
  const formatter = new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TIME_ZONE
  });

  return formatter.format(date);
}
