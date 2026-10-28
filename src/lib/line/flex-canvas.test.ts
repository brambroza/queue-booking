import { describe, expect, it } from 'vitest';
import { flexBubbleWidth, flexSpace, flexTextSize } from './flex-canvas';

describe('flexTextSize', () => {
  it('maps LINE keywords and px', () => {
    expect(flexTextSize('xs')).toBe(13);
    expect(flexTextSize('xl')).toBe(22);
    expect(flexTextSize('18px')).toBe(18);
    expect(flexTextSize(undefined)).toBe(16);
    expect(flexTextSize('huge')).toBe(16);
  });
});

describe('flexSpace', () => {
  it('maps keywords, px and fallback', () => {
    expect(flexSpace('sm')).toBe(4);
    expect(flexSpace('lg')).toBe(12);
    expect(flexSpace('16px')).toBe(16);
    expect(flexSpace(undefined, 20)).toBe(20);
  });
});

describe('flexBubbleWidth', () => {
  it('uses the bubble size, mega by default', () => {
    expect(flexBubbleWidth({ size: 'kilo' })).toBe(260);
    expect(flexBubbleWidth({})).toBe(300);
  });
});
