import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { Chess, type Square } from 'chess.js';
import { positionAt } from '../domain/puzzles';
import type { ActiveAlarm } from '../domain/types';
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
const FILES = 'abcdefgh';

function squareAt(index: number, rotated: boolean): Square {
  const row = Math.floor(index / 8);
  const col = index % 8;
  return `${FILES[rotated ? 7 - col : col]}${rotated ? row + 1 : 8 - row}` as Square;
}
function cellOf(square: Square, rotated: boolean): { col: number; row: number } {
  const file = FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  return { col: rotated ? 7 - file : file, row: rotated ? rank - 1 : 8 - rank };
}

interface GridProps {
  game: Chess;
  rotated: boolean;
  className?: string;
  squareClass?: (square: Square) => string;
  pieceClass?: (square: Square) => string;
  pieceStyle?: (square: Square) => CSSProperties | undefined;
  onKeyboardSelect?: (square: Square) => void;
  boardRef?: React.Ref<HTMLDivElement>;
  handlers?: React.HTMLAttributes<HTMLDivElement>;
}

function BoardGrid({ game, rotated, className = '', squareClass, pieceClass, pieceStyle, onKeyboardSelect, boardRef, handlers }: GridProps) {
  const interactive = !!onKeyboardSelect;
  return <div className={`board ${className}`} ref={boardRef} role={interactive ? 'grid' : 'img'} aria-label={interactive ? 'Chess puzzle board' : 'Final position'} {...handlers}>
    {Array.from({ length: 64 }, (_, index) => {
      const square = squareAt(index, rotated);
      const piece = game.get(square);
      const dark = ((FILES.indexOf(square[0]) + Number(square[1])) % 2) !== 0;
      const content = <>
        {piece && <img className={`piece ${pieceClass?.(square) ?? ''}`} style={pieceStyle?.(square)} src={pieces[`${piece.color}${piece.type}`]} alt="" draggable={false}/>}
        {index % 8 === 0 && <small className="rank-label">{square[1]}</small>}
        {index >= 56 && <small className="file-label">{square[0]}</small>}
      </>;
      const classes = `square ${dark ? 'dark-square' : 'light-square'} ${squareClass?.(square) ?? ''}`;
      if (!interactive) return <div key={square} className={classes}>{content}</div>;
      // Pointer input is handled on the board; this click only serves keyboard users (detail 0).
      return <button key={square} type="button" role="gridcell" className={classes}
        aria-label={`${square}${piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${piece.type}` : ''}`}
        onClick={event => { if (event.detail === 0) onKeyboardSelect(square); }}>{content}</button>;
    })}
  </div>;
}

/** The position after the mating move, with the move and the mated king marked. */
export function FinalBoard({ game, rotated, lastMove }: { game: Chess; rotated: boolean; lastMove: { from: Square; to: Square } | null }) {
  const matedKing = useMemo(() => {
    if (!game.isCheckmate()) return null;
    for (const row of game.board()) for (const cell of row) if (cell && cell.type === 'k' && cell.color === game.turn()) return cell.square;
    return null;
  }, [game]);
  return <BoardGrid game={game} rotated={rotated}
    squareClass={square => `${lastMove && (square === lastMove.from || square === lastMove.to) ? 'last' : ''} ${square === matedKing ? 'mated' : ''}`}/>;
}

interface Drag { square: Square; startX: number; startY: number; x: number; y: number; moved: boolean; wasSelected: boolean }
interface Phase { step: number; bad: Square | null }
interface Slide { step: number; to: Square; dx: number; dy: number }
export type BoardStatus = { tone: 'info' | 'good' | 'bad'; text: string };

export function PuzzleBoard({ alarm, onAttempt, onStatus }: {
  alarm: ActiveAlarm;
  onAttempt: (from: Square, to: Square, stepIndex: number) => void;
  onStatus: (status: BoardStatus) => void;
}) {
  const puzzle = alarm.puzzle;
  const side = useMemo(() => new Chess(puzzle.fen).turn(), [puzzle.fen]);
  const rotated = side === 'b';
  const [selected, setSelected] = useState<Square | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  // While a phase is set the board shows that step and ignores input: waiting for the
  // main process, flashing a wrong move, or pausing before the opponent's reply.
  const [phase, setPhase] = useState<Phase | null>(null);
  const [slide, setSlide] = useState<Slide | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  useEffect(() => { setSelected(null); setDrag(null); setPhase(null); setSlide(null); }, [alarm.id]);

  const step = phase?.step ?? alarm.stepIndex;
  const game = positionAt(puzzle, step);
  const canMove = !phase && game.turn() === side;
  const legal = canMove && selected ? game.moves({ square: selected, verbose: true }).map(move => move.to) : [];
  const last = step > 0 ? puzzle.solution[step - 1] : null;
  const opponent = side === 'w' ? 'Black' : 'White';

  const attempt = async (from: Square, to: Square) => {
    const fromStep = alarm.stepIndex;
    setSelected(null);
    setDrag(null);
    setSlide(null);
    onAttempt(from, to, fromStep);
    setPhase({ step: fromStep, bad: null });
    const { result } = await window.chessWake.move(from, to);
    if (result === 'wrong') {
      onStatus({ tone: 'bad', text: fromStep > 0 ? 'Not that one. Back to move 1.' : 'Not that one. Try again.' });
      setPhase({ step: fromStep, bad: to });
      timer.current = window.setTimeout(() => setPhase(null), 800);
    } else if (result === 'progress') {
      const reply = puzzle.solution[fromStep + 1];
      const replySan = positionAt(puzzle, fromStep + 1).move(reply).san;
      setPhase({ step: fromStep + 1, bad: null });
      timer.current = window.setTimeout(() => {
        const a = cellOf(reply.from, rotated);
        const b = cellOf(reply.to, rotated);
        setSlide({ step: fromStep + 2, to: reply.to, dx: a.col - b.col, dy: a.row - b.row });
        setPhase(null);
        onStatus({ tone: 'good', text: `Good move. ${opponent} played ${replySan}. Find the next one.` });
      }, 450);
    } else setPhase(null);
  };

  const select = (square: Square) => {
    if (!canMove) return;
    const piece = game.get(square);
    if (piece?.color === side) setSelected(selected === square ? null : square);
    else if (selected && legal.includes(square)) void attempt(selected, square);
    else setSelected(null);
  };

  const squareFromPoint = (x: number, y: number): Square | null => {
    const rect = boardRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const col = Math.floor(((x - rect.left) / rect.width) * 8);
    const row = Math.floor(((y - rect.top) / rect.height) * 8);
    return col < 0 || col > 7 || row < 0 || row > 7 ? null : squareAt(row * 8 + col, rotated);
  };
  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!canMove || event.button !== 0) return;
    const square = squareFromPoint(event.clientX, event.clientY);
    if (!square) return;
    if (game.get(square)?.color === side) {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDrag({ square, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, moved: false, wasSelected: selected === square });
      setSelected(square);
    } else if (selected && legal.includes(square)) void attempt(selected, square);
    else setSelected(null);
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    setDrag({ ...drag, x: event.clientX, y: event.clientY, moved: drag.moved || Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5 });
  };
  const pointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const target = squareFromPoint(event.clientX, event.clientY);
    setDrag(null);
    if (target && target !== drag.square && legal.includes(target)) void attempt(drag.square, target);
    else if (target === drag.square && drag.wasSelected && !drag.moved) setSelected(null);
  };

  const sliding = slide && slide.step === step ? slide : null;
  return <BoardGrid game={game} rotated={rotated} boardRef={boardRef} onKeyboardSelect={select}
    className={`${phase?.bad ? 'shake' : ''} ${canMove ? 'can-move' : ''}`}
    handlers={{ onPointerDown: pointerDown, onPointerMove: pointerMove, onPointerUp: pointerUp, onPointerCancel: () => setDrag(null) }}
    squareClass={square => [
      last && (square === last.from || square === last.to) ? 'last' : '',
      selected === square ? 'selected' : '',
      legal.includes(square) ? 'legal' : '',
      phase?.bad === square ? 'bad' : '',
      game.get(square)?.color === side ? 'own' : ''
    ].join(' ')}
    pieceClass={square => (drag?.moved && drag.square === square ? 'dragging' : sliding?.to === square ? 'slide' : '')}
    pieceStyle={square => {
      if (drag?.moved && drag.square === square) return { transform: `translate(${drag.x - drag.startX}px, ${drag.y - drag.startY}px) scale(1.14)` };
      if (sliding?.to === square) return { '--dx': sliding.dx, '--dy': sliding.dy } as CSSProperties;
      return undefined;
    }}/>;
}
