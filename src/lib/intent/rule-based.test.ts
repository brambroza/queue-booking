import { describe, expect, it } from 'vitest';
import { parseIntent } from './rule-based';

describe('parseIntent — cancel vs book precedence', () => {
  it('reads "ยกเลิกการจอง" as a cancel, not a new booking', () => {
    expect(parseIntent('ยกเลิกการจอง').intent).toBe('cancel_booking');
    expect(parseIntent('ยกเลิกคิว').intent).toBe('cancel_booking');
  });

  it('still books when there is no cancel word', () => {
    expect(parseIntent('จองคิว').intent).toBe('book_queue');
  });
});
