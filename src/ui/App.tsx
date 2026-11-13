import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { localDateKey, nextOccurrence } from '../domain/alarm';
import { formatDuration, monthGrid, wakeStats, type Morning } from '../domain/stats';
import type { ActiveAlarm, Snapshot } from '../domain/types';
import { AlarmView, SolvedView, type Attempt, type Solved } from './AlarmView';

const empty: Snapshot = { alarms: [], history: [], active: null, testAt: null, puzzleCount: 0, puzzleSyncStatus: 'idle' };

function useNow(): Date {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const timer = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(timer); }, []);
  return now;
}

function useAlarmSound(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const context = new AudioContext();
    const chime = () => {
      if (context.state === 'suspended') void context.resume();
      for (const [index, pitch] of [784, 988, 1175].entries()) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const at = context.currentTime + index * 0.18;
        oscillator.type = 'sine';
        oscillator.frequency.value = pitch;
        gain.gain.setValueAtTime(0.001, at);
        gain.gain.exponentialRampToValueAtTime(0.24, at + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.001, at + 0.4);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(at);
        oscillator.stop(at + 0.42);
      }
    };
    chime();
    const timer = setInterval(chime, 1800);
    return () => { clearInterval(timer); void context.close(); };
  }, [active]);
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
function formatAlarmTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number);
  return formatTime(new Date(2000, 0, 1, hours, minutes));
}
function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}
function formatUntil(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  return hours ? `${hours}h ${minutes}m` : `${minutes}m`;
}
function seconds(milliseconds: number): string {
  const value = Math.round(Math.abs(milliseconds) / 1000);
  return value >= 60 ? formatDuration(value * 1000) : `${value}s`;
}

function RecentRow({ morning, averageMs }: { morning: Morning; averageMs: number | null }) {
  const delta = averageMs === null ? 0 : morning.solveMs - averageMs;
  const comparison = morning.outcome === 'emergency' ? <em className="slow">Emergency stop</em>
    : Math.abs(delta) < 500 ? <em>Right on your average</em>
    : <em className={delta > 0 ? 'slow' : ''}>{seconds(delta)} {delta > 0 ? 'over' : 'under'} your average</em>;
  return <div><span>{formatDay(morning.endedAt)}</span><strong>{formatDuration(morning.solveMs)}</strong>{comparison}</div>;
}

export function App() {
  const [state, setState] = useState<Snapshot>(empty);
  const [label, setLabel] = useState('Wake up');
  const [time, setTime] = useState('07:00');
  const [error, setError] = useState('');
  const [managing, setManaging] = useState(false);
  const [solved, setSolved] = useState<Solved | null>(null);
  const lastActive = useRef<ActiveAlarm | null>(null);
  const lastAttempt = useRef<Attempt | null>(null);
  const now = useNow();
  useAlarmSound(!!state.active);
  useEffect(() => {
    void window.chessWake.getState().then(setState);
    return window.chessWake.onState(setState);
  }, []);
  // When a ringing alarm disappears and its history record says "solved", show the finish screen.
  useEffect(() => {
    const previous = lastActive.current;
    if (state.active) {
      if (previous?.id !== state.active.id || previous.startedAt !== state.active.startedAt) lastAttempt.current = null;
      lastActive.current = state.active;
      setSolved(null);
      return;
    }
    if (!previous) return;
    lastActive.current = null;
    const record = state.history.find(item => item.startedAt === previous.startedAt);
    if (record?.outcome === 'solved') setSolved({ alarm: previous, attempt: lastAttempt.current, record });
  }, [state.active, state.history]);

  const stats = useMemo(() => wakeStats(state.history, now), [state.history, localDateKey(now)]);
  const upcoming = state.alarms.filter(alarm => alarm.enabled)
    .map(alarm => ({ alarm, date: nextOccurrence(alarm.time, now) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())[0];
  const next = state.testAt && new Date(state.testAt).getTime() > now.getTime()
    ? { label: 'Test alarm', date: new Date(state.testAt) }
    : upcoming ? { label: upcoming.alarm.label, date: upcoming.date } : null;
  const addAlarm = async (event: FormEvent) => {
    event.preventDefault();
    try { setState(await window.chessWake.saveAlarm({ label: label.trim() || 'Wake up', time, enabled: true })); setError(''); }
    catch { setError('Could not save the alarm. Check the time.'); }
  };

  if (state.active) return <AlarmView alarm={state.active} now={now} onAttempt={attempt => { lastAttempt.current = attempt; }}/>;
  if (solved) return <SolvedView solved={solved} streak={stats.streak} onDone={() => setSolved(null)}/>;

  const showAlarms = managing || state.alarms.length === 0;
  const today = localDateKey(now);
  const monthKey = today.slice(0, 8);
  return <main className="dashboard">
    <header className="app-header">
      <div className="brand"><span className="brand-icon">♞</span><span>ChessWake</span></div>
      <div className="header-clock"><strong>{formatTime(now)}</strong><span>{now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</span></div>
    </header>

    <div className="hero">
      <section className="panel"><div className="panel-label">Current streak</div>
        <div className="streak"><strong>{stats.streak}</strong><span>{stats.streak === 1 ? 'morning solved' : 'mornings solved in a row'}</span></div>
        <p className="panel-note">{stats.bestStreak > 0 ? `Best so far: ${stats.bestStreak}` : 'Your first solved morning starts the streak.'}</p>
      </section>
      <section className="panel"><div className="panel-label">Average solve time</div>
        <div className="figure">{stats.averageMs === null ? '–:––' : formatDuration(stats.averageMs)}</div>
        <p className={`panel-note ${stats.weekDeltaMs !== null && stats.weekDeltaMs < 0 ? 'good' : ''}`}>{stats.weekDeltaMs === null ? 'Solved mornings only.' : Math.abs(stats.weekDeltaMs) < 500 ? 'Same as last week' : `${seconds(stats.weekDeltaMs)} ${stats.weekDeltaMs < 0 ? 'faster' : 'slower'} than last week`}</p>
      </section>
      <section className="panel"><div className="panel-label">Fastest solve</div>
        <div className="figure">{stats.fastest ? formatDuration(stats.fastest.solveMs) : '–:––'}</div>
        <p className="panel-note">{stats.fastest ? `${formatDay(stats.fastest.endedAt)}${stats.fastest.mateIn ? ` · Mate in ${stats.fastest.mateIn}` : ''}` : 'No solved mornings yet.'}</p>
      </section>
    </div>

    <div className="scoreboard">
      <section className="panel"><div className="panel-label">{now.toLocaleDateString([], { month: 'long', year: 'numeric' })}</div>
        <div className="calendar">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => <span key={index}>{day}</span>)}
          {monthGrid(now.getFullYear(), now.getMonth()).map((day, index) => {
            if (day === null) return <i key={index} className="blank"/>;
            const key = `${monthKey}${String(day).padStart(2, '0')}`;
            return <i key={index} className={`${stats.days[key] ?? ''} ${key === today ? 'today' : ''}`}>{day}</i>;
          })}
        </div>
        <div className="legend"><span><b className="solved"/>Solved</span><span><b className="emergency"/>Emergency stop</span><span><b/>No alarm</span></div>
      </section>
      <section className="panel recent"><div className="panel-label">Recent mornings</div>
        {stats.recent.length === 0 ? <p className="muted">Mornings appear here after a real alarm rings. Test alarms are not counted.</p>
          : stats.recent.map(morning => <RecentRow key={morning.id} morning={morning} averageMs={stats.averageMs}/>)}
      </section>
    </div>

    <section className="panel next-line">
      <div>{next ? <><span>Next alarm</span><strong>{formatTime(next.date)}</strong><span>{next.label} · rings in {formatUntil(next.date.getTime() - now.getTime())}</span></>
        : <span>No active alarms. Add one below.</span>}</div>
      <div className="next-actions">
        <button className="secondary-button" onClick={() => void window.chessWake.testAlarm().then(setState)} disabled={!!state.testAt}>{state.testAt ? 'Test alarm scheduled' : 'Test alarm in 10 seconds'}</button>
        {state.alarms.length > 0 && <button className="link-button" aria-expanded={showAlarms} onClick={() => setManaging(!managing)}>{managing ? 'Hide alarms' : 'Manage alarms ›'}</button>}
      </div>
    </section>

    {showAlarms && <>
      <section className="panel alarms-panel"><div className="panel-title">Daily alarms <span>{state.alarms.length}</span></div>
        <form onSubmit={event => void addAlarm(event)} className="alarm-form"><label>Time<input type="time" value={time} onChange={event => setTime(event.target.value)} required/></label><label>Name<input value={label} onChange={event => setLabel(event.target.value)} maxLength={50} placeholder="Wake up"/></label><button type="submit" className="primary-button">Add alarm</button></form>
        {error && <p className="error">{error}</p>}
        <div className="alarms-list">{state.alarms.length === 0 && <p className="muted">No daily alarms yet.</p>}{state.alarms.map(alarm => <div className="alarm-row" key={alarm.id}><div><strong>{formatAlarmTime(alarm.time)}</strong><span>{alarm.label}</span></div><div className="row-actions"><button className={`toggle ${alarm.enabled ? 'on' : ''}`} type="button" aria-label={`${alarm.enabled ? 'Disable' : 'Enable'} ${alarm.label}`} aria-pressed={alarm.enabled} onClick={() => void window.chessWake.saveAlarm({ ...alarm, enabled: !alarm.enabled }).then(setState)}><i/></button><button className="delete" type="button" aria-label={`Delete ${alarm.label}`} onClick={() => void window.chessWake.deleteAlarm(alarm.id).then(setState)}>×</button></div></div>)}</div>
      </section>
      <section className="panel library-panel"><div><div className="panel-title">Puzzle library</div><p>{state.puzzleCount} Chess.com {state.puzzleCount === 1 ? 'puzzle' : 'puzzles'} saved on this Mac. Alarms work offline.</p>{state.puzzleSyncStatus === 'unavailable' && <small>Chess.com could not be reached. Saved puzzles are ready.</small>}</div><button className="secondary-button" disabled={state.puzzleSyncStatus === 'syncing'} onClick={() => void window.chessWake.syncPuzzles().then(setState)}>{state.puzzleSyncStatus === 'syncing' ? 'Checking…' : 'Check for puzzles'}</button></section>
    </>}
    <footer>Keep ChessWake running for alarms to ring. Alarms may not fire on time if your Mac sleeps or its lid is closed. ChessWake is not affiliated with Chess.com.</footer>
  </main>;
}
