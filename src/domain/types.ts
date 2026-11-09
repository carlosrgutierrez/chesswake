import type { Puzzle } from './puzzles';

export interface Alarm { id: string; label: string; time: string; enabled: boolean; lastFiredDate: string | null }
export interface WakeRecord { id: string; scheduledFor: string; startedAt: string; endedAt: string; outcome: 'solved' | 'emergency'; label: string }
export interface ActiveAlarm { id: string; label: string; scheduledFor: string; startedAt: string; puzzle: Puzzle; stepIndex: number }
export interface Snapshot { alarms: Alarm[]; history: WakeRecord[]; active: ActiveAlarm | null; testAt: string | null; puzzleCount: number; puzzleSyncStatus: 'idle' | 'syncing' | 'unavailable' }
export interface ChessWakeAPI {
  getState(): Promise<Snapshot>;
  saveAlarm(alarm: { id?: string; label: string; time: string; enabled: boolean }): Promise<Snapshot>;
  deleteAlarm(id: string): Promise<Snapshot>;
  testAlarm(): Promise<Snapshot>;
  move(from: string, to: string): Promise<{ result: 'checkmate' | 'progress' | 'wrong' | 'inactive'; state: Snapshot }>;
  syncPuzzles(): Promise<Snapshot>;
  emergencyStop(): Promise<{ stopped: boolean; state: Snapshot }>;
  onState(callback: (state: Snapshot) => void): () => void;
}
