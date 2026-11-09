import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Chess, type Square } from 'chess.js';
import { canEmergencyStop, formatCountdown, nextOccurrence } from '../domain/alarm';
import { positionAt } from '../domain/puzzles';
import type { ActiveAlarm, Snapshot } from '../domain/types';
import wK from '../assets/pieces/wK.svg';
import wQ from '../assets/pieces/wQ.svg';
import wR from '../assets/pieces/wR.svg';
import wB from '../assets/pieces/wB.svg';
import wN from '../assets/pieces/wN.svg';
import wP from '../assets/pieces/wP.svg';
import bK from '../assets/pieces/bK.svg';
import bQ from '../assets/pieces/bQ.svg';
import bR from '../assets/pieces/bR.svg';
import bB from '../assets/pieces/bB.svg';
import bN from '../assets/pieces/bN.svg';
import bP from '../assets/pieces/bP.svg';

const pieces: Record<string, string> = { wk: wK, wq: wQ, wr: wR, wb: wB, wn: wN, wp: wP, bk: bK, bq: bQ, br: bR, bb: bB, bn: bN, bp: bP };
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

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function Board({ alarm, onStatus }: { alarm: ActiveAlarm; onStatus: (message: string) => void }) {
  const [selected, setSelected] = useState<Square | null>(null);
  const game = positionAt(alarm.puzzle, alarm.stepIndex);
  const side = game.turn();
  const rotated = side === 'b';
  const legal = selected ? game.moves({ square: selected, verbose: true }).map(move => move.to) : [];
  const click = async (square: Square) => {
    const piece = game.get(square);
    if (!selected) { if (piece?.color === side) setSelected(square); return; }
    if (square === selected) { setSelected(null); return; }
    if (piece?.color === side) { setSelected(square); return; }
    setSelected(null);
    const { result } = await window.chessWake.move(selected, square);
    if (result === 'wrong') onStatus('Wrong move. Start this puzzle again.');
    if (result === 'progress') onStatus('Good move. Your opponent replied. Find the next move.');
    if (result === 'checkmate') onStatus('Checkmate. Good morning.');
  };
  return <div className="board" role="grid" aria-label="Chess puzzle board">
    {Array.from({ length: 64 }, (_, index) => {
      const row = Math.floor(index / 8);
      const rank = rotated ? row + 1 : 8 - row;
      const file = (rotated ? 'hgfedcba' : 'abcdefgh')[index % 8];
      const square = `${file}${rank}` as Square;
      const piece = game.get(square);
      const dark = ((file.charCodeAt(0) - 97 + rank) % 2) !== 0;
      return <button key={square} type="button" role="gridcell"
        aria-label={`${square}${piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${piece.type}` : ''}`}
        className={`square ${dark ? 'dark-square' : 'light-square'} ${selected === square ? 'selected' : ''} ${legal.includes(square) ? 'legal' : ''}`}
        onClick={() => void click(square)}>
        {piece && <img className="piece" src={pieces[`${piece.color}${piece.type}`]} alt="" draggable={false}/>}
        {index % 8 === 0 && <small className="rank-label">{rank}</small>}
        {row === 7 && <small className="file-label">{file}</small>}
      </button>;
    })}
  </div>;
}

function AlarmView({ alarm, now }: { alarm: ActiveAlarm; now: Date }) {
  const [message, setMessage] = useState('Select a piece, then click where it should move.');
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdStart = useRef<number | null>(null);
  const elapsed = now.getTime() - new Date(alarm.startedAt).getTime();
  const emergencyReady = canEmergencyStop(alarm.startedAt, now.getTime());
  const side = new Chess(alarm.puzzle.fen).turn() === 'w' ? 'White' : 'Black';
  const moveNumber = Math.floor(alarm.stepIndex / 2) + 1;
  const totalMoves = Math.ceil(alarm.puzzle.solution.length / 2);
  useEffect(() => {
    if (!holding) return;
    const timer = setInterval(() => setHoldProgress(Math.min(100, ((Date.now() - (holdStart.current ?? Date.now())) / 3000) * 100)), 50);
    return () => clearInterval(timer);
  }, [holding]);
  const stopHolding = () => { holdStart.current = null; setHolding(false); setHoldProgress(0); };
  const finishHolding = async () => {
    const completed = holdStart.current !== null && Date.now() - holdStart.current >= 3000;
    stopHolding();
    if (completed) {
      const { stopped } = await window.chessWake.emergencyStop();
      if (!stopped) setMessage('Emergency stop becomes available after two minutes.');
    }
  };
  return <main className="ring-screen">
    <div className="ring-layout">
      <section className="ring-info">
        <div className="ring-badge"><span className="ring-dot"/> Alarm ringing</div>
        <h1>Solve to stop<br/>the alarm.</h1>
        <p className="ring-label">{alarm.label}</p>
        <div className="ring-timer"><span>Time ringing</span><strong>{formatCountdown(elapsed)}</strong></div>
        <p className="ring-instruction">{side} to move · Mate in {totalMoves}</p>
        <p className="move-message" role="status">{message}</p>
        <div className="emergency">
          <span>Emergency stop {emergencyReady ? 'available' : `in ${formatCountdown(120000 - elapsed)}`}</span>
          <button type="button" disabled={!emergencyReady}
            onPointerDown={() => { holdStart.current = Date.now(); setHolding(true); }}
            onPointerUp={() => void finishHolding()} onPointerLeave={stopHolding} onPointerCancel={stopHolding}>
            Hold for 3 seconds to stop
            {holding && <i className="hold-fill" style={{ width: `${holdProgress}%` }}/>}
          </button>
        </div>
      </section>
      <section className="puzzle-area">
        <div className="puzzle-topline"><div><strong>{alarm.puzzle.title}</strong><span>Move {moveNumber} of {totalMoves}</span></div><span>{side} to move</span></div>
        <Board alarm={alarm} onStatus={setMessage}/>
        <div className="puzzle-bottomline"><span>Click a piece, then its destination.</span>{alarm.puzzle.sourceUrl && <a href={alarm.puzzle.sourceUrl} target="_blank" rel="noopener noreferrer">Puzzle from Chess.com ↗</a>}</div>
      </section>
    </div>
  </main>;
}

export function App() {
  const [state, setState] = useState<Snapshot>(empty);
  const [label, setLabel] = useState('Wake up');
  const [time, setTime] = useState('07:00');
  const [error, setError] = useState('');
  const now = useNow();
  useAlarmSound(!!state.active);
  useEffect(() => {
    void window.chessWake.getState().then(setState);
    return window.chessWake.onState(setState);
  }, []);
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
  if (state.active) return <AlarmView alarm={state.active} now={now}/>;
  return <main className="dashboard">
    <header className="app-header">
      <div className="brand"><span className="brand-icon">♞</span><span>ChessWake</span></div>
      <div className="header-clock"><strong>{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</strong><span>{now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</span></div>
    </header>
    <div className="page-heading"><h1>Alarms</h1><p>Solve a chess puzzle to turn one off.</p></div>
    <div className="dashboard-grid">
      <section className="panel next-panel"><div className="panel-title">Next alarm</div>
        {next ? <><div className="countdown">{formatCountdown(next.date.getTime() - now.getTime())}</div><p>{next.label} at {formatTime(next.date.toISOString())}</p></>
          : <><div className="countdown placeholder">— : — —</div><p>No active alarms. Add one to get started.</p></>}
        <button className="primary-button test-button" onClick={() => void window.chessWake.testAlarm().then(setState)} disabled={!!state.testAt}>{state.testAt ? 'Test alarm scheduled' : 'Test alarm in 10 seconds'}</button>
      </section>
      <section className="panel alarms-panel"><div className="panel-title">Daily alarms <span>{state.alarms.length}</span></div>
        <form onSubmit={event => void addAlarm(event)} className="alarm-form"><label>Time<input type="time" value={time} onChange={event => setTime(event.target.value)} required/></label><label>Name<input value={label} onChange={event => setLabel(event.target.value)} maxLength={50} placeholder="Wake up"/></label><button type="submit" className="primary-button">Add alarm</button></form>
        {error && <p className="error">{error}</p>}
        <div className="alarms-list">{state.alarms.length === 0 && <p className="muted">No daily alarms yet.</p>}{state.alarms.map(alarm => <div className="alarm-row" key={alarm.id}><div><strong>{alarm.time}</strong><span>{alarm.label}</span></div><div className="row-actions"><button className={`toggle ${alarm.enabled ? 'on' : ''}`} type="button" aria-label={`${alarm.enabled ? 'Disable' : 'Enable'} ${alarm.label}`} aria-pressed={alarm.enabled} onClick={() => void window.chessWake.saveAlarm({ ...alarm, enabled: !alarm.enabled }).then(setState)}><i/></button><button className="delete" type="button" aria-label={`Delete ${alarm.label}`} onClick={() => void window.chessWake.deleteAlarm(alarm.id).then(setState)}>×</button></div></div>)}</div>
      </section>
    </div>
    <section className="panel library-panel"><div><div className="panel-title">Puzzle library</div><p>{state.puzzleCount} Chess.com {state.puzzleCount === 1 ? 'puzzle' : 'puzzles'} saved on this Mac. Alarms work offline.</p>{state.puzzleSyncStatus === 'unavailable' && <small>Chess.com could not be reached. Saved puzzles are ready.</small>}</div><button className="secondary-button" disabled={state.puzzleSyncStatus === 'syncing'} onClick={() => void window.chessWake.syncPuzzles().then(setState)}>{state.puzzleSyncStatus === 'syncing' ? 'Checking…' : 'Check for puzzles'}</button></section>
    <section className="panel history-panel"><div className="panel-title">Wake-up history</div>{state.history.length === 0 ? <p className="muted">Completed alarms will appear here.</p> : <div className="history-list">{state.history.slice(0, 8).map(record => <div key={record.id}><span>{new Date(record.endedAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span><strong>{formatTime(record.endedAt)}</strong><span>{record.label}</span><b className={record.outcome}>{record.outcome === 'solved' ? 'Solved' : 'Emergency stop'}</b></div>)}</div>}</section>
    <footer>Keep ChessWake running for alarms to ring. Alarms may not fire on time if your Mac sleeps or its lid is closed. ChessWake is not affiliated with Chess.com.</footer>
  </main>;
}
