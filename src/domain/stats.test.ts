import { describe, expect, it } from 'vitest';
import { formatDuration, isTestRecord, monthGrid, wakeStats } from './stats';
import type { WakeRecord } from './types';

const now = new Date(2026, 10, 12, 22, 0, 0);
function record(daysAgo: number, seconds: number, outcome: WakeRecord['outcome'] = 'solved', extra: Partial<WakeRecord> = {}): WakeRecord {
  const started = new Date(2026, 10, 12 - daysAgo, 6, 30, 0);
  return { id: `r${daysAgo}-${seconds}`, scheduledFor: started.toISOString(), startedAt: started.toISOString(), endedAt: new Date(started.getTime() + seconds * 1000).toISOString(), outcome, label: 'Wake up', ...extra };
}

describe('wake-up scoreboard', () => {
  it('counts the current run of solved mornings and stops at an emergency stop', () => {
    const stats = wakeStats([record(0, 90), record(1, 40), record(2, 200, 'emergency'), record(3, 60)], now);
    expect(stats.streak).toBe(2);
    expect(stats.bestStreak).toBe(2);
  });
  it('keeps the best streak when the current one is broken', () => {
    const stats = wakeStats([record(0, 150, 'emergency'), record(1, 40), record(2, 50), record(3, 60)], now);
    expect(stats.streak).toBe(0);
    expect(stats.bestStreak).toBe(3);
  });
  it('ignores test alarms, including ones saved before the test flag existed', () => {
    const stats = wakeStats([record(0, 2, 'solved', { label: 'Test alarm' }), record(0, 3, 'solved', { test: true, label: 'Anything' }), record(1, 80)], now);
    expect(stats.streak).toBe(1);
    expect(stats.averageMs).toBe(80000);
    expect(stats.recent).toHaveLength(1);
    expect(isTestRecord(record(0, 1, 'solved', { label: 'Test alarm', test: false }))).toBe(false);
  });
  it('averages solved mornings only and finds the fastest', () => {
    const stats = wakeStats([record(0, 90), record(1, 30, 'solved', { mateIn: 2 }), record(2, 300, 'emergency')], now);
    expect(stats.averageMs).toBe(60000);
    expect(stats.fastest?.solveMs).toBe(30000);
    expect(stats.fastest?.mateIn).toBe(2);
  });
  it('compares this week with last week only when both have solves', () => {
    expect(wakeStats([record(0, 60), record(1, 80)], now).weekDeltaMs).toBeNull();
    expect(wakeStats([record(1, 60), record(9, 100)], now).weekDeltaMs).toBe(-40000);
  });
  it('marks each day by its latest alarm and works with unsorted history', () => {
    const stats = wakeStats([record(2, 200, 'emergency'), record(0, 90), record(1, 40)], now);
    expect(stats.days).toEqual({ '2026-11-12': 'solved', '2026-11-11': 'solved', '2026-11-10': 'emergency' });
    expect(stats.recent.map(morning => morning.solveMs)).toEqual([90000, 40000, 200000]);
  });
  it('returns an empty scoreboard with no real alarms', () => {
    const stats = wakeStats([], now);
    expect(stats).toMatchObject({ streak: 0, bestStreak: 0, averageMs: null, weekDeltaMs: null, fastest: null, recent: [] });
  });
});

describe('formatting helpers', () => {
  it('formats solve times as minutes and seconds', () => {
    expect(formatDuration(92142)).toBe('1:32');
    expect(formatDuration(5000)).toBe('0:05');
  });
  it('lays out a month with Monday first', () => {
    const november = monthGrid(2026, 10);
    expect(november.slice(0, 7)).toEqual([null, null, null, null, null, null, 1]);
    expect(november).toHaveLength(36);
  });
});
