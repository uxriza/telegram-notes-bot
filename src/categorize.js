const categoryRules = [
  {
    category: "buy",
    keywords: ["beli", "buy", "pesan", "checkout", "order", "barang", "wishlist"]
  },
  {
    category: "places",
    keywords: ["visit", "pergi", "ke ", "tempat", "cafe", "coffee", "resto", "museum", "pantai"]
  },
  {
    category: "todo",
    keywords: [
      "kirim",
      "email",
      "update",
      "follow up",
      "todo",
      "kerjain",
      "submit",
      "revise",
      "porto",
      "interview",
      "meeting",
      "call",
      "bayar"
    ]
  }
];

export function detectCategory(text) {
  const normalized = text.toLowerCase();

  for (const rule of categoryRules) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return rule.category;
    }
  }

  return "notes";
}
