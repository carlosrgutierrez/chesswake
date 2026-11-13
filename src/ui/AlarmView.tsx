import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { canEmergencyStop, formatCountdown } from '../domain/alarm';
import { positionAt } from '../domain/puzzles';
import { formatDuration, isTestRecord, solveMs } from '../domain/stats';
import type { ActiveAlarm, WakeRecord } from '../domain/types';
import { FinalBoard, PuzzleBoard, type BoardStatus } from './Board';

export interface Attempt { from: Square; to: Square; stepIndex: number }

function clock(milliseconds: number): string {
  return formatDuration(Math.floor(Math.max(0, milliseconds) / 1000) * 1000);
}

export function AlarmView({ alarm, now, onAttempt }: { alarm: ActiveAlarm; now: Date; onAttempt: (attempt: Attempt) => void }) {
  const [status, setStatus] = useState<BoardStatus>({ tone: 'info', text: 'Drag a piece, or click it and then its destination.' });
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0);
  const holdStart = useRef<number | null>(null);
  const elapsed = now.getTime() - new Date(alarm.startedAt).getTime();
  const emergencyReady = canEmergencyStop(alarm.startedAt, now.getTime());
  const side = useMemo(() => (new Chess(alarm.puzzle.fen).turn() === 'w' ? 'White' : 'Black'), [alarm.puzzle.fen]);
  const totalMoves = Math.ceil(alarm.puzzle.solution.length / 2);
  const moveNumber = Math.floor(alarm.stepIndex / 2) + 1;
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
      if (!stopped) setStatus({ tone: 'info', text: 'Emergency stop becomes available after two minutes.' });
    }
  };
  return <main className="ring-screen">
    <header className="ring-top">
      <div className="ring-badge"><span className="ring-dot"/> Ringing <strong>{clock(elapsed)}</strong><span className="ring-label">{alarm.label}</span></div>
      <h1>{side} to move · Mate in {totalMoves}</h1>
      <div className="pips" aria-label={`Move ${moveNumber} of ${totalMoves}`}>
        {Array.from({ length: totalMoves }, (_, index) => <i key={index} className={index < moveNumber - 1 ? 'done' : index === moveNumber - 1 ? 'current' : ''}/>)}
        <span>Move {moveNumber} of {totalMoves}</span>
      </div>
    </header>
    <section className="ring-stage">
      <PuzzleBoard alarm={alarm} onStatus={setStatus} onAttempt={(from, to, stepIndex) => onAttempt({ from, to, stepIndex })}/>
      <p className={`ring-status ${status.tone}`} role="status">{status.text}</p>
    </section>
    <footer className="ring-foot">
      {alarm.puzzle.sourceUrl ? <a href={alarm.puzzle.sourceUrl} target="_blank" rel="noopener noreferrer">{alarm.puzzle.title} · Chess.com ↗</a> : <span>{alarm.puzzle.title}</span>}
      <button type="button" className="emergency-stop" disabled={!emergencyReady}
        onPointerDown={() => { holdStart.current = Date.now(); setHolding(true); }}
        onPointerUp={() => void finishHolding()} onPointerLeave={stopHolding} onPointerCancel={stopHolding}>
        {emergencyReady ? 'Emergency stop: hold 3 seconds' : `Emergency stop in ${clock(120000 - elapsed)}`}
        {holding && <i className="hold-fill" style={{ width: `${holdProgress}%` }}/>}
      </button>
    </footer>
  </main>;
}

function useSolvedChime(): void {
  useEffect(() => {
    const context = new AudioContext();
    for (const [index, pitch] of [523, 659, 784, 1047].entries()) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const at = context.currentTime + 0.05 + index * 0.11;
      oscillator.type = 'triangle';
      oscillator.frequency.value = pitch;
      gain.gain.setValueAtTime(0.001, at);
      gain.gain.exponentialRampToValueAtTime(0.16, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, at + 0.5);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.55);
    }
    const timer = setTimeout(() => void context.close(), 1500);
    return () => { clearTimeout(timer); if (context.state !== 'closed') void context.close(); };
  }, []);
}

export interface Solved { alarm: ActiveAlarm; attempt: Attempt | null; record: WakeRecord }

export function SolvedView({ solved, streak, onDone }: { solved: Solved; streak: number; onDone: () => void }) {
  useSolvedChime();
  const { alarm, attempt, record } = solved;
  const rotated = useMemo(() => new Chess(alarm.puzzle.fen).turn() === 'b', [alarm.puzzle.fen]);
  const game = useMemo(() => {
    if (attempt) {
      try {
        const position = positionAt(alarm.puzzle, attempt.stepIndex);
        position.move({ from: attempt.from, to: attempt.to, promotion: alarm.puzzle.solution[attempt.stepIndex]?.promotion ?? 'q' });
        if (position.isCheckmate()) return position;
      } catch { /* fall through to the published solution */ }
    }
    return positionAt(alarm.puzzle, alarm.puzzle.solution.length);
  }, [alarm, attempt]);
  const test = isTestRecord(record);
  return <main className="solved-screen">
    <div className="solved-layout">
      <FinalBoard game={game} rotated={rotated} lastMove={attempt}/>
      <section className="solved-info">
        <h1>Checkmate.<br/>Good morning.</h1>
        <div className="solved-stats">
          <div><strong>{formatDuration(solveMs(record))}</strong><span>to solve</span></div>
          <div><strong>{new Date(record.endedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</strong><span>alarm off</span></div>
          {!test && <div><strong>{streak}</strong><span>{streak === 1 ? 'morning solved' : 'mornings in a row'}</span></div>}
        </div>
        {test && <p className="muted">Test alarm. It does not count toward your streak.</p>}
        <button type="button" className="primary-button" autoFocus onClick={onDone}>Done</button>
      </section>
    </div>
  </main>;
}
