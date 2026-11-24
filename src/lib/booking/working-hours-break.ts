import { endTimeMinutes, timeToMinutes } from '@/lib/booking/multi-slot';

/** Which break field a problem belongs to, so the API can put the issue on it. */
export type BreakTimeIssue = { field: 'break_start' | 'break_end'; message: string };

type BreakTimeInput = {
  open_time: string;
  close_time: string;
  break_start?: string | null;
  break_end?: string | null;
};

/**
 * Checks the optional break of a working-hours row. Shared by the portal form
 * and the API schema so both give the same Thai message.
 *
 * The slot SQL (`get_slot_availability`) only skips a break when BOTH ends are
 * set and compares them as plain times, so a half-filled or reversed break was
 * saved, shown to the owner as a break, and silently ignored for customers.
 *
 * Rules: both ends or neither; end after start (no midnight wrap, the SQL has
 * none for breaks); the break lies inside open–close. Open/close themselves
 * are validated elsewhere, so an unreadable open/close skips the range rule.
 *
 * @param input - Open, close and break times as `HH:MM[:SS]`; '' / null = unset.
 * @returns The first problem found, or null when the break is fine or absent.
 */
export function breakTimeIssue(input: BreakTimeInput): BreakTimeIssue | null {
  const hasStart = Boolean(input.break_start);
  const hasEnd = Boolean(input.break_end);
  if (!hasStart && !hasEnd) return null;
  if (!hasEnd) return { field: 'break_end', message: 'ใส่เวลาพักสิ้นสุดด้วย หรือล้างเวลาพักเริ่มถ้าไม่มีเวลาพัก' };
  if (!hasStart) return { field: 'break_start', message: 'ใส่เวลาพักเริ่มด้วย หรือล้างเวลาพักสิ้นสุดถ้าไม่มีเวลาพัก' };

  const start = timeToMinutes(input.break_start);
  const end = timeToMinutes(input.break_end);
  if (start === null) return { field: 'break_start', message: 'รูปแบบเวลาพักเริ่มไม่ถูกต้อง' };
  if (end === null) return { field: 'break_end', message: 'รูปแบบเวลาพักสิ้นสุดไม่ถูกต้อง' };
  if (end <= start) return { field: 'break_end', message: 'เวลาพักสิ้นสุดต้องหลังเวลาพักเริ่ม' };

  const open = timeToMinutes(input.open_time);
  const close = open === null ? null : endTimeMinutes(input.close_time, open);
  if (open === null || close === null) return null;
  if (start < open) return { field: 'break_start', message: 'เวลาพักต้องอยู่ในช่วงเวลาเปิด-ปิดของร้าน' };
  if (end > close) return { field: 'break_end', message: 'เวลาพักต้องอยู่ในช่วงเวลาเปิด-ปิดของร้าน' };
  return null;
}
