import { describe, expect, it } from 'vitest';
import { buildSignageData } from '../normalize';
import { DEFAULT_SIGNAGE_CONFIG } from '../settings';
import {
  SHEET_TEMPLATE_HEADERS,
  mapHeaders,
  parseSheetDate,
  parseSheetRows,
  parseSheetStatus,
  parseSheetTime,
  speciesIcon,
} from './parse-rows';

const TODAY = '2026-11-04';
const H = [...SHEET_TEMPLATE_HEADERS];

/** One template row: วันที่, เลขคิว, ชื่อสัตว์, ชนิด, ชื่อเจ้าของ, เบอร์โทร, แผนก, ห้อง, เวลานัด, สถานะ, ฉุกเฉิน, เวลาเรียก */
function row(overrides: Partial<Record<(typeof SHEET_TEMPLATE_HEADERS)[number], string>> = {}): string[] {
  const base: Record<string, string> = {
    'วันที่': '4/11/2569', 'เลขคิว': 'A001', 'ชื่อสัตว์': 'ถั่วงอก', 'ชนิด': 'สุนัข', 'ชื่อเจ้าของ': 'สมชาย ใจดี',
    'เบอร์โทร': '0812345678', 'แผนก/บริการ': 'ตรวจทั่วไป', 'ห้องตรวจ/สัตวแพทย์': 'ห้อง 1', 'เวลานัด': '10:30',
    'สถานะ': 'รอ', 'ฉุกเฉิน': '', 'เวลาเรียก': '', ...overrides,
  };
  return H.map((h) => base[h]);
}

describe('parseSheetDate', () => {
  it('reads Thai day-first dates in Buddhist and Gregorian years', () => {
    expect(parseSheetDate('4/11/2569')).toBe('2026-11-04');
    expect(parseSheetDate('04/11/2026')).toBe('2026-11-04');
    expect(parseSheetDate('4-11-69')).toBe('2026-11-04');
    expect(parseSheetDate('4.11.26')).toBe('2026-11-04');
    expect(parseSheetDate('2026-11-04')).toBe('2026-11-04');
  });
  it('rejects impossible or unknown dates', () => {
    expect(parseSheetDate('31/02/2026')).toBeNull();
    expect(parseSheetDate('พรุ่งนี้')).toBeNull();
    expect(parseSheetDate('')).toBeNull();
  });
});

describe('parseSheetTime', () => {
  it('accepts the common ways staff type a time', () => {
    expect(parseSheetTime('9:05')).toBe('09:05');
    expect(parseSheetTime('09.05')).toBe('09:05');
    expect(parseSheetTime('09:05:00')).toBe('09:05');
    expect(parseSheetTime('9:05 น.')).toBe('09:05');
    expect(parseSheetTime('1:30 PM')).toBe('13:30');
    expect(parseSheetTime('12:10 AM')).toBe('00:10');
  });
  it('rejects nonsense', () => {
    expect(parseSheetTime('25:00')).toBeNull();
    expect(parseSheetTime('บ่าย')).toBeNull();
  });
});

describe('parseSheetStatus / speciesIcon / mapHeaders', () => {
  it('maps dropdown words, blank = waiting, unknown = null', () => {
    expect(parseSheetStatus('เรียก')).toBe('called');
    expect(parseSheetStatus(' กำลังตรวจ ')).toBe('serving');
    expect(parseSheetStatus('Done')).toBe('completed');
    expect(parseSheetStatus('')).toBe('waiting');
    expect(parseSheetStatus('รอผลแล็บ')).toBeNull();
  });
  it('picks a species emoji', () => {
    expect(speciesIcon('แมวเปอร์เซีย')).toBe('🐱');
    expect(speciesIcon('อิกัวนา')).toBe('🐾');
    expect(speciesIcon('')).toBe('');
  });
  it('matches headers by name, any order, spaces around "/" ignored', () => {
    const col = mapHeaders(['สถานะ', 'Pet', 'แผนก / บริการ', 'อะไรก็ได้']);
    expect(col).toEqual({ status: 0, pet: 1, service: 2 });
  });
});

describe('parseSheetRows', () => {
  it('keeps only today, drops cancelled, never exposes the phone', () => {
    const parsed = parseSheetRows(
      [H, row(), row({ 'วันที่': '3/11/2569', 'เลขคิว': 'A000' }), row({ 'เลขคิว': 'A002', 'สถานะ': 'ยกเลิก' })],
      TODAY,
    );
    expect(parsed.error).toBeNull();
    expect(parsed.rows.map((r) => r.queue_number)).toEqual(['A001']);
    expect(JSON.stringify(parsed.rows)).not.toContain('0812345678');
    expect(parsed.rows[0]).toMatchObject({
      id: 'sheet-2',
      status: 'waiting',
      start_time: '10:30',
      resource_name: 'ห้อง 1',
      customers: { full_name: 'สมชาย ใจดี', nickname: '🐶 ถั่วงอก' },
      services: { service_name: 'ตรวจทั่วไป' },
      priority: null,
    });
    expect(parsed.resources).toEqual([{ id: 'sheet-room-ห้อง 1', name: 'ห้อง 1' }]);
  });

  it('reports rows it cannot read with the sheet row number', () => {
    const parsed = parseSheetRows(
      [H, row({ 'วันที่': '' }), row({ 'สถานะ': 'รอผลแล็บ' }), row({ 'เวลานัด': 'บ่าย' })],
      TODAY,
    );
    expect(parsed.skipped).toEqual([
      { row: 2, reason: 'ไม่มีวันที่' },
      { row: 3, reason: 'ไม่รู้จักสถานะ "รอผลแล็บ"' },
      { row: 4, reason: 'อ่านเวลานัด "บ่าย" ไม่ได้ (แสดงคิวโดยไม่มีเวลา)' },
    ]);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].start_time).toBeNull();
  });

  it('without a date column every row counts and blank queue numbers are generated', () => {
    const parsed = parseSheetRows([['ชื่อสัตว์', 'สถานะ'], ['มะลิ', 'รอ'], ['', ''], ['โกโก้', '']], TODAY);
    expect(parsed.rows.map((r) => r.queue_number)).toEqual(['001', '002']);
  });

  it('stamps called_at from the เวลาเรียก column only for calling rows', () => {
    const parsed = parseSheetRows(
      [H, row({ 'สถานะ': 'เรียก', 'เวลาเรียก': '10:41' }), row({ 'เลขคิว': 'A002', 'เวลาเรียก': '10:00' })],
      TODAY,
    );
    expect(parsed.rows[0].called_at).toBe('2026-11-04T10:41:00+07:00');
    expect(parsed.rows[1].called_at).toBeNull();
  });

  it('fails on a sheet without a status column or header row', () => {
    expect(parseSheetRows([['ชื่อสัตว์'], ['มะลิ']], TODAY).error).toBe('ไม่พบคอลัมน์ "สถานะ"');
    expect(parseSheetRows([], TODAY).error).toContain('หัวตาราง');
    expect(parseSheetRows([['สถานะ', 'หมายเหตุ']], TODAY).error).toContain('อย่างน้อยหนึ่งคอลัมน์');
  });

  it('puts emergencies at the front of the waiting line on the signage', () => {
    const parsed = parseSheetRows(
      [
        H,
        row({ 'เลขคิว': 'A001', 'เวลานัด': '09:00' }),
        row({ 'เลขคิว': 'A002', 'เวลานัด': '09:30' }),
        row({ 'เลขคิว': 'A003', 'เวลานัด': '11:00', 'ฉุกเฉิน': 'TRUE', 'ชนิด': 'แมว' }),
      ],
      TODAY,
    );
    const signage = buildSignageData({
      rows: parsed.rows,
      config: DEFAULT_SIGNAGE_CONFIG,
      date: TODAY,
      shop: { name: 'รพ.สัตว์' },
      branch: null,
      resources: parsed.resources,
    });
    expect(signage.next_queue.map((p) => p.queue_number)).toEqual(['A003', 'A001', 'A002']);
    expect(signage.next_queue[0].customer_name).toBe('🚨 ถั่วงอก');
  });
});
