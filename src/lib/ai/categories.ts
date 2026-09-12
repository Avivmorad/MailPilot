export const CATEGORY_VALUES = [
  "finance",
  "security",
  "career",
  "education",
  "projects_development",
  "travel_transport",
  "shopping_orders",
  "official_legal",
  "accounts_subscriptions",
  "personal_health",
  "social_feeds",
  "gaming_entertainment",
  "newsletters_promotions",
  "other",
] as const;

export type Category = (typeof CATEGORY_VALUES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  finance: "Finance",
  security: "Security",
  career: "Career",
  education: "Education",
  projects_development: "Projects & Development",
  travel_transport: "Travel & Transport",
  shopping_orders: "Shopping & Orders",
  official_legal: "Official, Legal & Insurance",
  accounts_subscriptions: "Accounts & Subscriptions",
  personal_health: "Personal & Health",
  social_feeds: "Social & Feeds",
  gaming_entertainment: "Gaming & Entertainment",
  newsletters_promotions: "Newsletters & Promotions",
  other: "Other",
};

export const CATEGORY_HINTS: Record<Category, string> = {
  finance: "banking, charges, receipts, invoices, billed subscriptions, investments, tax",
  security: "logins, authentication, passwords, OAuth, account access",
  career: "jobs, recruiters, applications, interviews",
  education: "courses, exams, school or university enrollment",
  projects_development: "code, deployments, developer tooling",
  travel_transport: "flights, hotels, transport, travel insurance",
  shopping_orders: "orders, deliveries, returns of goods",
  official_legal: "government, contracts, insurance, pension",
  accounts_subscriptions:
    "service-account notices, plan changes, product updates, non-security subscriptions",
  personal_health: "personal messages, appointments, medical, personal services",
  social_feeds: "social networks, groups, social notifications",
  gaming_entertainment: "games and entertainment content",
  newsletters_promotions: "promotions, ads, and newsletters with no operational content",
  other: "only when none of the above fit",
};

const CATEGORY_SET = new Set<string>(CATEGORY_VALUES);

const LEGACY_CATEGORY_MAP: Record<string, Category> = {
  work: "other",
  school: "education",
  account: "security",
  shopping: "shopping_orders",
  travel: "travel_transport",
  social: "social_feeds",
  newsletter: "newsletters_promotions",
  promotion: "newsletters_promotions",
  notification: "other",
  payments: "finance",
  general: "other",
};

export function isCategory(value: string | null | undefined): value is Category {
  return typeof value === "string" && CATEGORY_SET.has(value);
}

/**
 * Map stored or model-adjacent category strings onto the current taxonomy.
 * Unknown values become `other`.
 */
export function normalizeCategory(value: string | null | undefined): Category {
  if (!value) {
    return "other";
  }
  const key = value.trim().toLowerCase();
  if (isCategory(key)) {
    return key;
  }
  return LEGACY_CATEGORY_MAP[key] ?? "other";
}

export function categoryPromptLines(): string {
  return CATEGORY_VALUES.map((id) => `- ${id}: ${CATEGORY_HINTS[id]}`).join("\n");
}
