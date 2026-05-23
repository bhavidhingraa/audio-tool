import { describe, it, expect } from 'vitest';
import { timestampToSeconds } from '../lib/audioProcessor';

describe('timestampToSeconds', () => {
  it('parses HH:MM:SS:mmm format with milliseconds', () => {
    expect(timestampToSeconds('02:04:03:250')).toBe(7443.25);
  });

  it('parses full format with zero milliseconds', () => {
    expect(timestampToSeconds('01:30:00:000')).toBe(5400);
  });

  it('parses full format with max milliseconds', () => {
    expect(timestampToSeconds('00:00:10:999')).toBe(10.999);
  });

  it('parses MM:SS fallback format', () => {
    expect(timestampToSeconds('2:30')).toBe(150);
  });

  it('parses HH:MM:SS fallback format', () => {
    expect(timestampToSeconds('1:30:45')).toBe(5445);
  });

  it('returns 0 for invalid input', () => {
    expect(timestampToSeconds('invalid')).toBe(0);
    expect(timestampToSeconds('')).toBe(0);
  });

  it('handles zero values', () => {
    expect(timestampToSeconds('00:00:00:000')).toBe(0);
  });
});