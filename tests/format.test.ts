import { describe, it, expect } from 'vitest';
import { parseIntOption } from '../src/format';

describe('parseIntOption', () => {
  it('parses integers', () => {
    expect(parseIntOption('42')).toBe(42);
  });

  it('rejects non-integers', () => {
    expect(() => parseIntOption('abc')).toThrow('must be an integer');
  });
});
