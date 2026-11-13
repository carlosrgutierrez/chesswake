import { localDateKey } from './alarm';
import type { WakeRecord } from './types';

export type DayMark = 'solved' | 'emergency';
export interface Morning { id: string; endedAt: string; label: string; outcome: WakeRecord['outcome']; solveMs: number; mateIn?: number }
export interface WakeStats {
  streak: number;
  bestStreak: number;
  averageMs: number | null;
  weekDeltaMs: number | null;
  fastest: Morning | null;
  recent: Morning[];
  days: Record<string, DayMark>;
}

const DAY = 24 * 60 * 60 * 1000;

// Records saved before the `test` flag existed are recognised by the label the app gave them.
export function isTestRecord(record: WakeRecord): boolean {
  return record.test ?? record.label === 'Test alarm';
}

export function solveMs(record: WakeRecord): number {
  return Math.max(0, new Date(record.endedAt).getTime() - new Date(record.startedAt).getTime());
}

function average(values: number[]): number | null {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

/** Scoreboard numbers from real alarms only. Test alarms never count. */
export function wakeStats(history: WakeRecord[], now = new Date()): WakeStats {
  const real = history.filter(record => !isTestRecord(record))
    .sort((a, b) => new Date(b.endedAt).getTime() - new Date(a.endedAt).getTime());
  const mornings: Morning[] = real.map(record => ({ id: record.id, endedAt: record.endedAt, label: record.label, outcome: record.outcome, solveMs: solveMs(record), mateIn: record.mateIn }));

  let streak = 0;
  while (streak < real.length && real[streak].outcome === 'solved') streak++;
  let bestStreak = 0;
  let run = 0;
  for (const record of real) {
    run = record.outcome === 'solved' ? run + 1 : 0;
    bestStreak = Math.max(bestStreak, run);
  }

  const solved = mornings.filter(morning => morning.outcome === 'solved');
  const age = (morning: Morning) => now.getTime() - new Date(morning.endedAt).getTime();
  const thisWeek = average(solved.filter(morning => age(morning) < 7 * DAY).map(morning => morning.solveMs));
  const lastWeek = average(solved.filter(morning => age(morning) >= 7 * DAY && age(morning) < 14 * DAY).map(morning => morning.solveMs));

  // Oldest first, so the latest alarm of a day decides that day's colour.
  const days: Record<string, DayMark> = {};
  for (const record of [...real].reverse()) days[localDateKey(new Date(record.endedAt))] = record.outcome;

  return {
    streak,
    bestStreak,
    averageMs: average(solved.map(morning => morning.solveMs)),
    weekDeltaMs: thisWeek !== null && lastWeek !== null ? thisWeek - lastWeek : null,
    fastest: solved.reduce<Morning | null>((best, morning) => (!best || morning.solveMs < best.solveMs ? morning : best), null),
    recent: mornings.slice(0, 5),
    days
  };
}

export function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** Calendar cells for a month, Monday first. `null` cells pad the first week. */
export function monthGrid(year: number, month: number): (number | null)[] {
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const length = new Date(year, month + 1, 0).getDate();
  return [...Array<null>(lead).fill(null), ...Array.from({ length }, (_, index) => index + 1)];
}
