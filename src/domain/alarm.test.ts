import { describe, expect, it } from 'vitest';
import { nextOccurrence, isDue, formatCountdown, canEmergencyStop } from './alarm';

describe('daily alarm scheduling', () => {
  it('selects today when the time has not passed', () => {
    const now = new Date(2026, 10, 9, 6, 0, 0);
    expect(nextOccurrence('07:30', now).getTime()).toBe(new Date(2026, 10, 9, 7, 30, 0).getTime());
  });
  it('selects tomorrow when today has passed', () => {
    const now = new Date(2026, 10, 9, 8, 0, 0);
    expect(nextOccurrence('07:30', now).getTime()).toBe(new Date(2026, 10, 10, 7, 30, 0).getTime());
  });
  it('fires only in its matching minute and only once per day', () => {
    const now = new Date(2026, 10, 9, 7, 30, 45);
    expect(isDue('07:30', now, null)).toBe(true);
    expect(isDue('07:30', now, '2026-11-09')).toBe(false);
    expect(isDue('07:31', now, null)).toBe(false);
  });
  it('formats a countdown', () => expect(formatCountdown(3661000)).toBe('01:01:01'));
  it('keeps emergency stop locked until two minutes have elapsed', () => {
    expect(canEmergencyStop('2026-11-09T12:00:00.000Z', Date.parse('2026-11-09T12:01:59.999Z'))).toBe(false);
    expect(canEmergencyStop('2026-11-09T12:00:00.000Z', Date.parse('2026-11-09T12:02:00.000Z'))).toBe(true);
  });
});
