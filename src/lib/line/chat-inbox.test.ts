import { describe, expect, it } from 'vitest';
import {
  bangkokDayKey,
  conversationMatches,
  formatChatDayLabel,
  formatChatListTime,
  formatChatTime,
  groupMessagesByDay,
  messagePreview,
} from './chat-inbox';

// 2026-10-15 10:00 Bangkok
const NOW = new Date('2026-10-15T03:00:00Z');

describe('bangkokDayKey', () => {
  it('uses Bangkok day, not UTC', () => {
    expect(bangkokDayKey('2026-10-14T18:30:00Z')).toBe('2026-10-15');
  });
  it('returns empty for garbage', () => {
    expect(bangkokDayKey('nope')).toBe('');
  });
});

describe('formatChatTime', () => {
  it('formats Bangkok time with น.', () => {
    expect(formatChatTime('2026-10-15T07:53:00Z')).toBe('14.53 น.');
  });
});

describe('formatChatListTime', () => {
  it('shows time for today', () => {
    expect(formatChatListTime('2026-10-15T02:05:00Z', NOW)).toBe('09.05');
  });
  it('shows เมื่อวาน for yesterday', () => {
    expect(formatChatListTime('2026-10-14T02:05:00Z', NOW)).toBe('เมื่อวาน');
  });
  it('shows day + month in the same year', () => {
    expect(formatChatListTime('2026-09-08T02:05:00Z', NOW)).toBe('8 ก.ย.');
  });
  it('shows Buddhist short year for older years', () => {
    expect(formatChatListTime('2025-05-25T02:05:00Z', NOW)).toBe('25/5/68');
  });
  it('empty when missing', () => {
    expect(formatChatListTime(null, NOW)).toBe('');
  });
});

describe('formatChatDayLabel', () => {
  it('today / yesterday', () => {
    expect(formatChatDayLabel('2026-10-15', NOW)).toBe('วันนี้');
    expect(formatChatDayLabel('2026-10-14', NOW)).toBe('เมื่อวาน');
  });
  it('day, month and weekday', () => {
    expect(formatChatDayLabel('2026-07-15', NOW)).toBe('15 ก.ค. (พ.)');
  });
  it('adds year when not current', () => {
    expect(formatChatDayLabel('2025-07-15', NOW)).toBe('15 ก.ค. 2568 (อ.)');
  });
});

describe('messagePreview', () => {
  it('text collapses whitespace', () => {
    expect(messagePreview({ direction: 'inbound', message_type: 'text', message_text: 'สวัสดี\n  ครับ' })).toBe('สวัสดี ครับ');
  });
  it('prefixes outbound', () => {
    expect(messagePreview({ direction: 'outbound', message_type: 'image', message_text: null })).toBe('คุณ: ส่งรูปภาพ');
  });
  it('sticker and unknown types', () => {
    expect(messagePreview({ direction: 'inbound', message_type: 'sticker', message_text: null })).toBe('ส่งสติกเกอร์');
    expect(messagePreview({ direction: 'inbound', message_type: 'postback', message_text: null })).toBe('ส่งข้อความ');
  });
  it('empty for no message', () => {
    expect(messagePreview(null)).toBe('');
  });
});

describe('groupMessagesByDay', () => {
  it('splits on Bangkok day', () => {
    const groups = groupMessagesByDay([
      { id: 1, created_at: '2026-10-14T10:00:00Z' },
      { id: 2, created_at: '2026-10-14T18:00:00Z' },
      { id: 3, created_at: '2026-10-15T01:00:00Z' },
    ]);
    expect(groups.map((g) => [g.day, g.items.length])).toEqual([
      ['2026-10-14', 1],
      ['2026-10-15', 2],
    ]);
  });
});

describe('conversationMatches', () => {
  it('matches name or nickname case-insensitively', () => {
    expect(conversationMatches({ display_name: 'Noh AK', nickname: null }, 'noh')).toBe(true);
    expect(conversationMatches({ display_name: 'Lookjeab', nickname: 'แจ๋ว' }, 'แจ๋ว')).toBe(true);
    expect(conversationMatches({ display_name: 'Lookjeab', nickname: null }, 'xyz')).toBe(false);
    expect(conversationMatches({ display_name: null }, '  ')).toBe(true);
  });
});
