import { describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { setAlarm, listAlarms } from './alarm-store.mjs';

function tempFile() { return path.join(mkdtempSync(path.join(tmpdir(), 'chesswake-test-')), 'chesswake.json'); }

describe('alarm command storage', () => {
  it('sets a 4am daily alarm without touching history or cached puzzles', () => {
    const file = tempFile();
    writeFileSync(file, JSON.stringify({ alarms: [], history: [{ id: 'old' }], puzzles: [{ id: 'cached' }] }));
    const alarm = setAlarm(file, { time: '04:00', label: 'Wake up' });
    const saved = JSON.parse(readFileSync(file, 'utf8'));
    expect(alarm).toMatchObject({ time: '04:00', label: 'Wake up', enabled: true });
    expect(saved.alarms).toHaveLength(1);
    expect(saved.history).toEqual([{ id: 'old' }]);
    expect(saved.puzzles).toEqual([{ id: 'cached' }]);
    expect(listAlarms(file)).toEqual(saved.alarms);
  });
  it('updates an existing alarm at the same time instead of duplicating it', () => {
    const file = tempFile();
    const first = setAlarm(file, { time: '04:00', label: 'First' });
    const second = setAlarm(file, { time: '04:00', label: 'Morning' });
    expect(second.id).toBe(first.id);
    expect(second.label).toBe('Morning');
    expect(listAlarms(file)).toHaveLength(1);
  });
  it('rejects invalid times and preserves an unreadable settings file', () => {
    const file = tempFile();
    expect(() => setAlarm(file, { time: '4am', label: 'Wake up' })).toThrow('HH:MM');
    writeFileSync(file, 'not json');
    expect(() => setAlarm(file, { time: '04:00', label: 'Wake up' })).toThrow('Could not read');
    expect(readFileSync(file, 'utf8')).toBe('not json');
  });
  it('accepts the documented command and lists the saved alarm', () => {
    const file = tempFile();
    const env = { ...process.env, CHESSWAKE_SETTINGS_FILE: file };
    const set = spawnSync(process.execPath, ['scripts/alarm-cli.mjs', 'set', '--time', '04:00', '--label', 'Morning'], { cwd: process.cwd(), env, encoding: 'utf8' });
    expect(set.status).toBe(0);
    expect(JSON.parse(readFileSync(file, 'utf8')).alarms[0].time).toBe('04:00');
    const list = spawnSync(process.execPath, ['scripts/alarm-cli.mjs', 'list'], { cwd: process.cwd(), env, encoding: 'utf8' });
    expect(list.status).toBe(0);
    expect(list.stdout).toContain('04:00\tenabled\tMorning');
  });
});
