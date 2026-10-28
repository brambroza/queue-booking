/**
 * Heuristics for spotting scripted shop signups.
 *
 * Each signal adds to a score instead of rejecting outright: a hard 400 with a
 * reason teaches a bot what to change, and any single signal can hit a real
 * person. The route blocks at `SIGNUP_RISK_BLOCK` and only tags lower scores.
 */

export const SIGNUP_RISK_BLOCK = 3;

/** Throwaway inbox providers seen in bot signups. Small on purpose — not a blocklist service. */
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'sharklasers.com',
  '10minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'yopmail.com',
  'trashmail.com',
  'getnada.com',
  'dispostable.com',
  'maildrop.cc',
  'mohmal.com',
]);

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);

export type SignupRiskInput = {
  email: string;
  owner_name: string;
  shop_name: string;
  company_name: string;
};

export type SignupRisk = { score: number; reasons: string[] };

/**
 * Lowercase an email and fold Gmail aliases (dots, `+tag`) so one inbox maps to one key.
 *
 * @param email - Raw email from the form.
 */
export function normalizeEmailForDedup(email: string): string {
  const [rawLocal = '', rawDomain = ''] = email.trim().toLowerCase().split('@');
  let local = rawLocal.split('+')[0] ?? '';
  let domain = rawDomain;
  if (GMAIL_DOMAINS.has(domain)) {
    local = local.replace(/\./g, '');
    domain = 'gmail.com';
  }
  return `${local}@${domain}`;
}

/**
 * Random-looking Latin token, e.g. "xKjdhGqwePlm": long, letters only, case flips mid-word at least twice.
 * Thai names never match.
 */
export function looksRandomLatin(value: string): boolean {
  const v = value.trim();
  return /^[A-Za-z]{10,}$/.test(v) && /[a-z][A-Z].*[a-z][A-Z]/.test(v);
}

/**
 * Score a signup payload.
 *
 * @param input - Names and email from the register form.
 * @returns Total score and the signals that fired (for logs / admin email).
 */
export function scoreSignup(input: SignupRiskInput): SignupRisk {
  const reasons: string[] = [];
  let score = 0;
  const add = (points: number, reason: string) => {
    score += points;
    reasons.push(reason);
  };

  const [local = '', domain = ''] = input.email.trim().toLowerCase().split('@');
  if (GMAIL_DOMAINS.has(domain) && (local.split('+')[0]?.match(/\./g) ?? []).length > 2) add(2, 'gmail_dots');
  if (DISPOSABLE_DOMAINS.has(domain)) add(3, 'disposable_email');

  const names = [
    ['owner', input.owner_name],
    ['shop', input.shop_name],
    ['company', input.company_name],
  ] as const;
  for (const [field, value] of names) {
    if (looksRandomLatin(value)) add(2, `random_${field}`);
  }

  const trimmed = names.map(([, v]) => v.trim().toLowerCase());
  if (trimmed[0] && trimmed.every((v) => v === trimmed[0])) add(1, 'same_names');

  const shop = input.shop_name.trim();
  if (shop.length >= 12 && !/[฀-๿\s]/.test(shop)) add(1, 'shop_no_thai_no_space');

  return { score, reasons };
}
