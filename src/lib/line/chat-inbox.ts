/**
 * Pure helpers for the portal LINE chat inbox (`/portal/chat-inbox`):
 * conversation-list previews, LINE-style timestamps and day separators.
 * Every date is read in Asia/Bangkok, never the browser's zone.
 */

const BANGKOK_TZ = 'Asia/Bangkok';
const THAI_MONTHS_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const THAI_WEEKDAYS_SHORT = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];

export type ChatPreviewSource = {
  direction: string;
  message_type: string;
  message_text: string | null;
};

/**
 * Bangkok calendar day of an ISO timestamp as `YYYY-MM-DD`.
 *
 * @param iso Timestamp from the DB (`created_at`).
 * @returns Day key, or an empty string when the input is not a date.
 */
export function bangkokDayKey(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: BANGKOK_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/**
 * Bangkok wall-clock time of an ISO timestamp as `HH.MM น.` (the LINE OA Manager style).
 *
 * @param iso Timestamp from the DB.
 * @returns Time label, or an empty string when the input is not a date.
 */
export function formatChatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hm = new Intl.DateTimeFormat('en-GB', { timeZone: BANGKOK_TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
  return `${hm.replace(':', '.')} น.`;
}

/** Whole days between two `YYYY-MM-DD` keys (b − a). */
function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/**
 * Short timestamp for a conversation row: time today, "เมื่อวาน", day + month
 * within the same year, otherwise day/month/short Buddhist year.
 *
 * @param iso Last message time.
 * @param now Reference instant (injectable for tests).
 * @returns Label, or an empty string when there is no valid time.
 */
export function formatChatListTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return '';
  const key = bangkokDayKey(iso);
  if (!key) return '';
  const todayKey = bangkokDayKey(now.toISOString());
  const diff = dayDiff(key, todayKey);
  if (diff === 0) return formatChatTime(iso).replace(' น.', '');
  if (diff === 1) return 'เมื่อวาน';
  const [y, m, d] = key.split('-').map(Number);
  if (key.slice(0, 4) === todayKey.slice(0, 4)) return `${d} ${THAI_MONTHS_SHORT[m - 1]}`;
  return `${d}/${m}/${String(y + 543).slice(-2)}`;
}

/**
 * Day separator label inside a thread, e.g. `วันนี้`, `เมื่อวาน`, `15 ก.ค. (พ.)`,
 * adding the Buddhist year when the day is not in the current year.
 *
 * @param dayKey `YYYY-MM-DD` from {@link bangkokDayKey}.
 * @param now Reference instant (injectable for tests).
 * @returns Label for the separator chip.
 */
export function formatChatDayLabel(dayKey: string, now: Date = new Date()): string {
  const todayKey = bangkokDayKey(now.toISOString());
  const diff = dayDiff(dayKey, todayKey);
  if (diff === 0) return 'วันนี้';
  if (diff === 1) return 'เมื่อวาน';
  const [y, m, d] = dayKey.split('-').map(Number);
  const weekday = THAI_WEEKDAYS_SHORT[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const year = dayKey.slice(0, 4) === todayKey.slice(0, 4) ? '' : ` ${y + 543}`;
  return `${d} ${THAI_MONTHS_SHORT[m - 1]}${year} (${weekday})`;
}

/**
 * One-line preview of a message for the conversation list. Outbound messages
 * are prefixed "คุณ: " like LINE.
 *
 * @param msg Latest message of the conversation, or null when there is none.
 * @returns Preview text (may be empty).
 */
export function messagePreview(msg: ChatPreviewSource | null | undefined): string {
  if (!msg) return '';
  const body = (() => {
    switch (msg.message_type) {
      case 'text':
        return (msg.message_text ?? '').replace(/\s+/g, ' ').trim();
      case 'sticker':
        return 'ส่งสติกเกอร์';
      case 'image':
        return 'ส่งรูปภาพ';
      case 'video':
        return 'ส่งวิดีโอ';
      case 'file':
        return 'ส่งไฟล์';
      default:
        return (msg.message_text ?? '').replace(/\s+/g, ' ').trim() || 'ส่งข้อความ';
    }
  })();
  return msg.direction === 'outbound' ? `คุณ: ${body}` : body;
}

/**
 * Group thread messages (already in ascending time order) into Bangkok days.
 *
 * @param messages Messages with `created_at`.
 * @returns Day buckets in the same order as the input.
 */
export function groupMessagesByDay<T extends { created_at: string }>(messages: T[]): { day: string; items: T[] }[] {
  const groups: { day: string; items: T[] }[] = [];
  for (const m of messages) {
    const day = bangkokDayKey(m.created_at);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.items.push(m);
    else groups.push({ day, items: [m] });
  }
  return groups;
}

/**
 * Client-side match of a conversation against the search box (name or nickname,
 * case-insensitive). Used to filter instantly while the server search loads.
 *
 * @param user Conversation row.
 * @param query Raw search text.
 * @returns True when the row should stay visible.
 */
export function conversationMatches(user: { display_name: string | null; nickname?: string | null }, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [user.display_name, user.nickname].some((v) => (v ?? '').toLowerCase().includes(q));
}
