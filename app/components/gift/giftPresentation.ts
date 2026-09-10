/**
 * The words and tokens the Digital Gift is made of.
 *
 * One module so the purchase preview, the recipient's page and the
 * confirmation cannot drift apart. The occasion copy mirrors
 * utils/gifts/giftOccasions.js on the server, which is the authority — the
 * server sends the stored key, and this turns that key into the words.
 *
 * NOTHING HERE DECIDES ANYTHING BUT PRESENTATION. No price, no duration
 * arithmetic, no entitlement. An occasion changes a headline and a supporting
 * line; that is the whole contract.
 */

export type GiftOccasion =
  | "neutral"
  | "new_home"
  | "congratulations"
  | "birthday"
  | "thank_you"
  | "just_because";

export type OccasionCopy = {
  key: GiftOccasion;
  /** How the purchaser picks it. */
  label: string;
  /** The large line on the card. */
  title: string;
  /** One quiet line above it. Never repeats the title. */
  kicker: string;
};

export const OCCASIONS: Record<GiftOccasion, OccasionCopy> = {
  neutral: {
    key: "neutral",
    label: "A gift for you",
    title: "A Gift for You",
    kicker: "Someone was thinking of you",
  },
  new_home: {
    key: "new_home",
    label: "New home",
    title: "A Gift for Your New Home",
    kicker: "Welcome home",
  },
  congratulations: {
    key: "congratulations",
    label: "Congratulations",
    title: "Congratulations",
    kicker: "Something to make the next part easier",
  },
  birthday: {
    key: "birthday",
    label: "Birthday",
    title: "Happy Birthday",
    kicker: "Something useful, just for you",
  },
  thank_you: {
    key: "thank_you",
    label: "Thank you",
    title: "Thank You",
    kicker: "A little something to make life easier",
  },
  just_because: {
    key: "just_because",
    label: "Just because",
    title: "Just Because",
    kicker: "No occasion needed",
  },
};

export const OCCASION_ORDER: GiftOccasion[] = [
  "neutral",
  "new_home",
  "congratulations",
  "birthday",
  "thank_you",
  "just_because",
];

/** Unknown values become the neutral greeting, never an error. */
export function occasionCopy(value: string | null | undefined): OccasionCopy {
  const key = String(value || "").trim().toLowerCase() as GiftOccasion;
  return OCCASIONS[key] || OCCASIONS.neutral;
}

/** Matches MESSAGE_MAX_LENGTH in utils/gifts/giftOccasions.js on the server. */
export const MESSAGE_MAX_LENGTH = 200;

export function planLabel(plan: string): string {
  const value = String(plan || "").trim();
  return value ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase() : "Membership";
}

export function monthsLabel(months: number): string {
  const value = Number(months);
  if (!Number.isFinite(value) || value <= 0) return "";
  return value === 1 ? "1 Month" : `${value} Months`;
}

/**
 * A recipient's name for the card, from whatever parts we hold.
 *
 * The purchaser types these, so both can be empty. "there" rather than an
 * empty line, because "To:" followed by nothing looks like a bug on something
 * meant to feel considered.
 */
export function recipientDisplayName(first?: string | null, last?: string | null): string {
  const name = [first, last].map((part) => String(part || "").trim()).filter(Boolean).join(" ");
  return name || "there";
}

/**
 * What a member actually gets, in the recipient's language.
 *
 * Only claims the product genuinely makes: these mirror the plan copy already
 * on the membership pages. Nothing here promises anything plan-specific,
 * because the row is shown for every plan.
 */
export const GIFT_BENEFITS = [
  { title: "Trusted professionals", detail: "Vetted, background-checked technicians" },
  { title: "Licensed and insured", detail: "Every visit, every time" },
  { title: "Easy scheduling", detail: "Book online when it suits you" },
  { title: "No estimates", detail: "Your plan covers the visit" },
] as const;
