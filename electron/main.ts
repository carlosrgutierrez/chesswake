import { app, BrowserWindow, ipcMain, Menu, Tray, nativeImage, shell } from 'electron';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { advancePuzzle, CHESS_COM_STARTER_PUZZLE, isUsablePuzzle, parseChessComPuzzle, selectPuzzle, type Puzzle } from '../src/domain/puzzles';
import { canEmergencyStop, isDue, localDateKey } from '../src/domain/alarm';
import type { ActiveAlarm, Alarm, Snapshot, WakeRecord } from '../src/domain/types';

type Stored = { alarms: Alarm[]; history: WakeRecord[]; puzzles: Puzzle[] };
let stored: Stored = { alarms: [], history: [], puzzles: [CHESS_COM_STARTER_PUZZLE] };
let active: ActiveAlarm | null = null;
let testAt: Date | null = null;
let window: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
let puzzleSyncStatus: Snapshot['puzzleSyncStatus'] = 'idle';
let syncInProgress = false;
let lastFetchAt = 0;
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');

function dataPath(): string { return path.join(app.getPath('userData'), 'chesswake.json'); }
function load(): void {
  try {
    if (existsSync(dataPath())) {
      const value = JSON.parse(readFileSync(dataPath(), 'utf8')) as Partial<Stored>;
      const cached = Array.isArray(value.puzzles) ? value.puzzles.filter(isUsablePuzzle) : [];
      stored = { alarms: Array.isArray(value.alarms) ? value.alarms : [], history: Array.isArray(value.history) ? value.history : [], puzzles: cached.length ? cached : [CHESS_COM_STARTER_PUZZLE] };
    }
  } catch (error) { console.error('Could not read ChessWake settings:', error); }
}
function persist(): void {
  const temp = `${dataPath()}.tmp`;
  writeFileSync(temp, JSON.stringify(stored, null, 2), 'utf8');
  renameSync(temp, dataPath());
}
function snapshot(): Snapshot {
  return { alarms: stored.alarms, history: stored.history, active, testAt: testAt?.toISOString() ?? null, puzzleCount: stored.puzzles.length, puzzleSyncStatus };
}
function broadcast(): Snapshot {
  const state = snapshot();
  window?.webContents.send('state:changed', state);
  tray?.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open ChessWake', click: showWindow },
    { label: 'Quit ChessWake', enabled: !active, click: () => app.quit() }
  ]));
  return state;
}
function showWindow(): void {
  if (!window) return;
  window.show();
  window.focus();
  app.focus({ steal: true });
}
function startAlarm(label: string, id: string, scheduledFor: string): void {
  if (active) return;
  active = { id, label, scheduledFor, startedAt: new Date().toISOString(), puzzle: selectPuzzle(stored.puzzles, stored.history.length), stepIndex: 0 };
  if (window) {
    window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    window.setAlwaysOnTop(true, 'screen-saver');
    window.setFullScreen(true);
    showWindow();
    window.moveTop();
  }
  broadcast();
}
function finishAlarm(outcome: WakeRecord['outcome']): void {
  if (!active) return;
  stored.history.unshift({ id: randomUUID(), scheduledFor: active.scheduledFor, startedAt: active.startedAt, endedAt: new Date().toISOString(), outcome, label: active.label });
  stored.history = stored.history.slice(0, 100);
  active = null;
  persist();
  window?.setFullScreen(false);
  window?.setAlwaysOnTop(false);
  window?.setVisibleOnAllWorkspaces(false);
  broadcast();
}
function tick(): void {
  const now = new Date();
  if (testAt && now >= testAt) {
    testAt = null;
    startAlarm('Test alarm', `test-${randomUUID()}`, now.toISOString());
  }
  if (active) return;
  for (const alarm of stored.alarms) {
    if (!alarm.enabled || !isDue(alarm.time, now, alarm.lastFiredDate)) continue;
    alarm.lastFiredDate = localDateKey(now);
    persist();
    startAlarm(alarm.label || 'Wake up', alarm.id, now.toISOString());
    break;
  }
}
async function syncPuzzles(): Promise<Snapshot> {
  if (syncInProgress || Date.now() - lastFetchAt < 20000) return snapshot();
  syncInProgress = true;
  lastFetchAt = Date.now();
  puzzleSyncStatus = 'syncing';
  broadcast();
  let reachedApi = false;
  for (const endpoint of ['https://api.chess.com/pub/puzzle', 'https://api.chess.com/pub/puzzle/random']) {
    try {
      const response = await fetch(endpoint, { headers: { 'User-Agent': 'ChessWake/0.2 (personal desktop alarm)' }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) continue;
      reachedApi = true;
      const puzzle = parseChessComPuzzle(await response.json());
      if (puzzle && !stored.puzzles.some(saved => saved.id === puzzle.id)) {
        stored.puzzles.push(puzzle);
        stored.puzzles = stored.puzzles.slice(-30);
        persist();
      }
    } catch (error) { console.warn(`Chess.com puzzle sync failed: ${endpoint}`, error); }
  }
  syncInProgress = false;
  puzzleSyncStatus = reachedApi ? 'idle' : 'unavailable';
  return broadcast();
}
function createWindow(): void {
  window = new BrowserWindow({
    width: 1120, height: 760, minWidth: 760, minHeight: 580,
    title: 'ChessWake', backgroundColor: '#0b101b',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: false }
  });
  const devUrl = process.env.CHESSWAKE_DEV_URL;
  if (devUrl) void window.loadURL(devUrl);
  else void window.loadFile(path.join(__dirname, '..', '..', 'dist', 'index.html'));
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\/www\.chess\.com\/daily\/\d{4}-\d{2}-\d{2}$/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  window.on('close', event => {
    if (quitting) return;
    event.preventDefault();
    if (active) showWindow();
    else window?.hide();
  });
  window.webContents.on('did-finish-load', () => broadcast());
}

app.whenReady().then(() => {
  load();
  createWindow();
  // A menu bar entry keeps scheduled alarms running when the main window is closed.
  tray = new Tray(nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlU3fQAAAAASUVORK5CYII='));
  tray.setTitle('♟');
  tray.setToolTip('ChessWake is running');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open ChessWake', click: showWindow },
    { label: 'Quit ChessWake', click: () => app.quit() }
  ]));
  tray.on('click', showWindow);
  ipcMain.handle('state:get', () => snapshot());
  ipcMain.handle('alarm:save', (_event, input: { id?: string; label: string; time: string; enabled: boolean }) => {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.time)) throw new Error('Invalid alarm time');
    const existing = stored.alarms.find(alarm => alarm.id === input.id);
    if (existing) Object.assign(existing, { label: String(input.label).slice(0, 50), time: input.time, enabled: Boolean(input.enabled), lastFiredDate: existing.time === input.time ? existing.lastFiredDate : null });
    else stored.alarms.push({ id: randomUUID(), label: String(input.label).slice(0, 50), time: input.time, enabled: Boolean(input.enabled), lastFiredDate: null });
    persist();
    return broadcast();
  });
  ipcMain.handle('alarm:delete', (_event, id: string) => {
    stored.alarms = stored.alarms.filter(alarm => alarm.id !== id);
    persist();
    return broadcast();
  });
  ipcMain.handle('alarm:test', () => {
    if (!active) testAt = new Date(Date.now() + 10000);
    return broadcast();
  });
  ipcMain.handle('puzzle:sync', () => syncPuzzles());
  ipcMain.handle('alarm:move', (_event, from: string, to: string) => {
    if (!active) return { result: 'inactive', state: snapshot() };
    const advance = advancePuzzle(active.puzzle, active.stepIndex, from as never, to as never);
    const result = advance.result;
    if (result === 'checkmate') finishAlarm('solved');
    else { active.stepIndex = advance.stepIndex; broadcast(); }
    return { result, state: snapshot() };
  });
  ipcMain.handle('alarm:emergency', () => {
    const stopped = !!active && canEmergencyStop(active.startedAt);
    if (stopped) finishAlarm('emergency');
    return { stopped, state: snapshot() };
  });
  setInterval(tick, 1000);
  setInterval(() => { void syncPuzzles(); }, 20 * 60 * 1000);
  void syncPuzzles();
  tick();
});

app.on('activate', () => showWindow());
app.on('before-quit', event => {
  if (active) { event.preventDefault(); showWindow(); }
  else quitting = true;
});
