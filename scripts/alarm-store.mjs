import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

export function defaultSettingsFile() {
  if (process.env.CHESSWAKE_SETTINGS_FILE) return path.resolve(process.env.CHESSWAKE_SETTINGS_FILE);
  return path.join(homedir(), 'Library', 'Application Support', 'chesswake', 'chesswake.json');
}

function readSettings(file) {
  if (!existsSync(file)) return { alarms: [], history: [] };
  try {
    const value = JSON.parse(readFileSync(file, 'utf8'));
    if (!value || typeof value !== 'object' || !Array.isArray(value.alarms)) throw new Error('Invalid format');
    return value;
  } catch (error) {
    throw new Error(`Could not read ChessWake settings at ${file}: ${error.message}`);
  }
}

export function listAlarms(file = defaultSettingsFile()) {
  return readSettings(file).alarms;
}

export function setAlarm(file, { time, label = 'Wake up' }) {
  if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error('Time must be local 24-hour HH:MM, for example 04:00.');
  const cleanLabel = String(label).trim().slice(0, 50) || 'Wake up';
  const settings = readSettings(file);
  let alarm = settings.alarms.find(item => item.time === time);
  if (alarm) {
    alarm.label = cleanLabel;
    alarm.enabled = true;
  } else {
    alarm = { id: randomUUID(), label: cleanLabel, time, enabled: true, lastFiredDate: null };
    settings.alarms.push(alarm);
  }
  mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${process.pid}.tmp`;
  writeFileSync(temp, JSON.stringify(settings, null, 2), { encoding: 'utf8', mode: 0o600 });
  renameSync(temp, file);
  return alarm;
}
