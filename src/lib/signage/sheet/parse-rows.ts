/**
 * Google Sheet → signage rows (pure, no I/O).
 *
 * The sheet is read by header name, never by position, so the shop may add,
 * remove or reorder columns. The phone column is never read: whatever is in
 * it can never reach the public display feed.
 */
import type { SignageBookingRow } from '../normalize';
import type { SignageResource } from '../types';

/** Columns the parser understands. */
export type SheetField =
  | 'date'
  | 'queue'
  | 'pet'
  | 'species'
  | 'owner'
  | 'service'
  | 'room'
  | 'time'
  | 'status'
  | 'emergency'
  | 'called_at';

/** Accepted header texts per field, compared after `normalizeHeader`. First entry = template header. */
export const SHEET_HEADER_ALIASES: Record<SheetField, string[]> = {
  date: ['วันที่', 'วันนัด', 'date'],
  queue: ['เลขคิว', 'คิว', 'queue', 'queue_number', 'queue no', 'no'],
  pet: ['ชื่อสัตว์', 'ชื่อสัตว์เลี้ยง', 'สัตว์เลี้ยง', 'pet', 'pet name', 'pet_name'],
  species: ['ชนิด', 'ชนิดสัตว์', 'ประเภทสัตว์', 'species'],
  owner: ['ชื่อเจ้าของ', 'เจ้าของ', 'ชื่อลูกค้า', 'owner', 'customer'],
  service: ['แผนก/บริการ', 'แผนก', 'บริการ', 'service', 'department'],
  room: ['ห้องตรวจ/สัตวแพทย์', 'ห้องตรวจ', 'ห้อง', 'สัตวแพทย์', 'หมอ', 'room', 'doctor'],
  time: ['เวลานัด', 'เวลา', 'time', 'start_time'],
  status: ['สถานะ', 'status'],
  emergency: ['ฉุกเฉิน', 'emergency', 'urgent'],
  called_at: ['เวลาเรียก', 'called_at', 'called'],
};

/** Header row of the downloadable template, in order. */
export const SHEET_TEMPLATE_HEADERS = [
  'วันที่', 'เลขคิว', 'ชื่อสัตว์', 'ชนิด', 'ชื่อเจ้าของ', 'เบอร์โทร',
  'แผนก/บริการ', 'ห้องตรวจ/สัตวแพทย์', 'เวลานัด', 'สถานะ', 'ฉุกเฉิน', 'เวลาเรียก',
] as const;

export type SheetStatus = 'waiting' | 'called' | 'serving' | 'completed' | 'cancelled';

/** Status words the staff pick from the sheet dropdown. First entry per status = template value. */
export const SHEET_STATUS_ALIASES: Record<SheetStatus, string[]> = {
  waiting: ['รอ', 'รอตรวจ', 'รอเรียก', 'มาแล้ว', 'waiting', 'wait'],
  called: ['เรียก', 'เรียกคิว', 'กำลังเรียก', 'called', 'call'],
  serving: ['กำลังตรวจ', 'ตรวจ', 'กำลังรักษา', 'กำลังให้บริการ', 'serving', 'in service'],
  completed: ['เสร็จ', 'เสร็จแล้ว', 'ตรวจเสร็จ', 'done', 'completed'],
  cancelled: ['ยกเลิก', 'ไม่มา', 'cancelled', 'canceled', 'no show'],
};

const TRUTHY = new Set(['true', 'yes', 'y', '1', 'x', '✓', '✔', '✅', 'ใช่', 'ฉุกเฉิน', 'ด่วน']);

const SPECIES_ICONS: Array<[string[], string]> = [
  [['สุนัข', 'หมา', 'dog'], '🐶'],
  [['แมว', 'cat'], '🐱'],
  [['กระต่าย', 'rabbit'], '🐰'],
  [['นก', 'bird'], '🐦'],
  [['แฮมสเตอร์', 'hamster'], '🐹'],
  [['ปลา', 'fish'], '🐟'],
  [['เต่า', 'turtle'], '🐢'],
];

/** Lowercase, trim, collapse spaces and drop spaces around "/" so "แผนก / บริการ" = "แผนก/บริการ". */
export function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ');
}

/** Map each known field to its column index; unknown headers are ignored. First match wins. */
export function mapHeaders(headerRow: readonly string[]): Partial<Record<SheetField, number>> {
  const index: Partial<Record<SheetField, number>> = {};
  const normalized = headerRow.map((h) => normalizeHeader(String(h ?? '')));
  for (const field of Object.keys(SHEET_HEADER_ALIASES) as SheetField[]) {
    const aliases = SHEET_HEADER_ALIASES[field].map(normalizeHeader);
    const at = normalized.findIndex((h) => h !== '' && aliases.includes(h));
    if (at >= 0) index[field] = at;
  }
  return index;
}

/**
 * Parse a sheet date to YYYY-MM-DD. Accepts ISO, and day-first D/M/Y with
 * "/", "-" or "." (Thai order). Buddhist years (> 2400) and 2-digit years are
 * converted; 2-digit ≥ 50 is read as a Buddhist year (69 = 2569 = 2026).
 */
export function parseSheetDate(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text);
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(text);
  let y: number;
  let m: number;
  let d: number;
  if (iso) {
    [y, m, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (dmy) {
    [d, m, y] = [Number(dmy[1]), Number(dmy[2]), Number(dmy[3])];
    if (dmy[3].length === 2) y = y >= 50 ? 2500 + y - 543 : 2000 + y;
  } else {
    return null;
  }
  if (y > 2400) y -= 543;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Parse "9:05", "09.05", "09:05:00", "9:05 น." or "9:05 PM" to "HH:MM"; null when unreadable. */
export function parseSheetTime(value: string): string | null {
  const text = value.trim().toLowerCase().replace(/\s*น\.?$/, '');
  const match = /^(\d{1,2})[:.](\d{2})(?::\d{2})?\s*(am|pm)?$/.exec(text);
  if (!match) return null;
  let h = Number(match[1]);
  const min = Number(match[2]);
  if (match[3] === 'pm' && h < 12) h += 12;
  if (match[3] === 'am' && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Status word → status the signage understands; empty = waiting; null = unknown word. */
export function parseSheetStatus(value: string): SheetStatus | null {
  const text = normalizeHeader(value);
  if (!text) return 'waiting';
  for (const [status, words] of Object.entries(SHEET_STATUS_ALIASES) as Array<[SheetStatus, string[]]>) {
    if (words.some((w) => normalizeHeader(w) === text)) return status;
  }
  return null;
}

/** Checkbox / "ใช่" / "x" style cell → boolean. */
export function isTruthyCell(value: string): boolean {
  return TRUTHY.has(value.trim().toLowerCase());
}

/** Emoji for a species cell; 🐾 for anything else that is filled in, '' when blank. */
export function speciesIcon(value: string): string {
  const text = value.trim().toLowerCase();
  if (!text) return '';
  for (const [words, icon] of SPECIES_ICONS) if (words.some((w) => text.includes(w))) return icon;
  return '🐾';
}

export type SheetSkip = { row: number; reason: string };

export type ParsedSheet = {
  /** Rows of `today`, in the shape `buildSignageData` takes. Cancelled rows are left out. */
  rows: SignageBookingRow[];
  /** Distinct room / vet names, for the scene templates. */
  resources: SignageResource[];
  /** Fields whose header was found. */
  found: SheetField[];
  /** Blocking problem (no header row, no status column); rows are empty when set. */
  error: string | null;
  /** Rows that could not be read (or read only in part), with the sheet row number (header = 1). */
  skipped: SheetSkip[];
};

const CALLING = new Set<SheetStatus>(['called', 'serving']);

/**
 * Turn the raw values of a sheet (first row = headers) into signage rows of `today`.
 *
 * With a date column only rows dated `today` are kept (a blank date is skipped and
 * reported); without one every row counts, for shops that clear the sheet each day.
 *
 * @param values - `values` of the Sheets API response (ragged rows allowed).
 * @param today - Bangkok date, YYYY-MM-DD.
 */
export function parseSheetRows(values: readonly (readonly unknown[])[], today: string): ParsedSheet {
  const empty: ParsedSheet = { rows: [], resources: [], found: [], error: null, skipped: [] };
  const header = (values[0] ?? []).map((v) => String(v ?? ''));
  if (header.every((h) => !h.trim())) return { ...empty, error: 'ไม่พบแถวหัวตาราง (แถวที่ 1 ต้องเป็นชื่อคอลัมน์)' };
  const col = mapHeaders(header);
  const found = Object.keys(col) as SheetField[];
  if (col.status === undefined) return { ...empty, found, error: 'ไม่พบคอลัมน์ "สถานะ"' };
  if (col.queue === undefined && col.pet === undefined && col.owner === undefined) {
    return { ...empty, found, error: 'ต้องมีอย่างน้อยหนึ่งคอลัมน์: "เลขคิว", "ชื่อสัตว์" หรือ "ชื่อเจ้าของ"' };
  }

  const cell = (row: readonly unknown[], field: SheetField): string => {
    const at = col[field];
    return at === undefined ? '' : String(row[at] ?? '').trim();
  };

  const rows: SignageBookingRow[] = [];
  const skipped: SheetSkip[] = [];
  const rooms = new Set<string>();

  values.slice(1).forEach((row, i) => {
    const rowNumber = i + 2;
    if (row.every((v) => String(v ?? '').trim() === '')) return;

    if (col.date !== undefined) {
      const rawDate = cell(row, 'date');
      const date = parseSheetDate(rawDate);
      if (!date) {
        skipped.push({ row: rowNumber, reason: rawDate ? `อ่านวันที่ "${rawDate}" ไม่ได้` : 'ไม่มีวันที่' });
        return;
      }
      if (date !== today) return;
    }

    const rawStatus = cell(row, 'status');
    const status = parseSheetStatus(rawStatus);
    if (!status) {
      skipped.push({ row: rowNumber, reason: `ไม่รู้จักสถานะ "${rawStatus}"` });
      return;
    }
    if (status === 'cancelled') return;

    const rawTime = cell(row, 'time');
    const time = rawTime ? parseSheetTime(rawTime) : null;
    if (rawTime && !time) skipped.push({ row: rowNumber, reason: `อ่านเวลานัด "${rawTime}" ไม่ได้ (แสดงคิวโดยไม่มีเวลา)` });

    const emergency = isTruthyCell(cell(row, 'emergency'));
    const pet = cell(row, 'pet');
    const icon = emergency ? '🚨' : speciesIcon(cell(row, 'species'));
    const service = cell(row, 'service');
    const room = cell(row, 'room');
    if (room) rooms.add(room);

    const calledTime = parseSheetTime(cell(row, 'called_at'));
    rows.push({
      id: `sheet-${rowNumber}`,
      queue_number: cell(row, 'queue') || String(rows.length + 1).padStart(3, '0'),
      status,
      start_time: time,
      end_time: null,
      called_at: CALLING.has(status) && calledTime ? `${today}T${calledTime}:00+07:00` : null,
      resource_name: room || null,
      branch_id: null,
      // The pet name is what the hospital calls out, so it rides the nickname slot
      // (shown in full unless the shop hides names); the owner name stays masked.
      customers: { full_name: cell(row, 'owner') || null, nickname: pet ? [icon, pet].filter(Boolean).join(' ') : null },
      line_users: null,
      services: { service_name: emergency ? ['ฉุกเฉิน', service].filter(Boolean).join(' · ') : service || null },
      priority: emergency ? 'emergency' : null,
    });
  });

  const resources = Array.from(rooms)
    .sort((a, b) => a.localeCompare(b, 'th', { numeric: true }))
    .map((name) => ({ id: `sheet-room-${name}`, name }));

  return { rows, resources, found, error: null, skipped };
}
