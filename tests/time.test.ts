import { describe, it, expect } from 'vitest';
import { parseTimeValue, resolveTimeRange } from '../src/time';

describe('parseTimeValue', () => {
  it('returns reference time for "now"', () => {
    const reference = new Date('2026-02-28T12:00:00.000Z');
    expect(parseTimeValue('now', reference).toISOString()).toBe(reference.toISOString());
  });

  it('parses relative times', () => {
    const reference = new Date('2026-02-28T12:00:00.000Z');
    const result = parseTimeValue('2h', reference);
    expect(result.toISOString()).toBe('2026-02-28T10:00:00.000Z');
  });

  it('rejects empty input', () => {
    expect(() => parseTimeValue('')).toThrow('Time value cannot be empty');
  });

  it('rejects invalid relative input', () => {
    expect(() => parseTimeValue('0h')).toThrow('Invalid relative time');
    expect(() => parseTimeValue('5x')).toThrow('Invalid time value');
  });
});

describe('resolveTimeRange', () => {
  it('uses default since when none provided', () => {
    const range = resolveTimeRange(undefined, undefined, '24h');
    expect(new Date(range.start).getTime()).toBeLessThanOrEqual(new Date(range.end).getTime());
    expect(Number.isNaN(new Date(range.start).getTime())).toBe(false);
    expect(Number.isNaN(new Date(range.end).getTime())).toBe(false);
  });

  it('rejects since later than until', () => {
    expect(() => resolveTimeRange('1h', '2h', '24h')).toThrow('`since` must be earlier than `until`');
  });
});
