import { Chess, type Square } from 'chess.js';

export interface Puzzle {
  id: string;
  title: string;
  fen: string;
  solution: { from: Square; to: Square; promotion?: string }[];
  sourceUrl?: string;
}

export const PUZZLES: Puzzle[] = [
  { id: 'corner-h8', title: 'Corner mate', fen: '7k/8/5KQ1/8/8/8/8/8 w - - 0 1', solution: [{ from: 'g6', to: 'g7' }] },
  { id: 'corner-a8', title: 'Corner mate', fen: 'k7/8/1QK5/8/8/8/8/8 w - - 0 1', solution: [{ from: 'b6', to: 'b7' }] },
  { id: 'corner-h1', title: 'Corner mate', fen: '8/8/8/8/8/5KQ1/8/7k w - - 0 1', solution: [{ from: 'g3', to: 'g2' }] }
];

// One published daily puzzle is bundled so the Chess.com mode works before the first sync.
export const CHESS_COM_STARTER_PUZZLE: Puzzle = {
  id: 'chesscom:/daily/2013-02-27',
  title: 'Mate in 2',
  fen: 'rnbk1b2/pppp1p1p/7n/3NNqr1/2BP4/6B1/PPPQ2PP/4R1KR w - - 0 1',
  solution: [{ from: 'e5', to: 'f7' }, { from: 'f5', to: 'f7' }, { from: 'g3', to: 'c7' }],
  sourceUrl: 'https://www.chess.com/daily/2013-02-27'
};

export function positionAt(puzzle: Puzzle, stepIndex: number): Chess {
  const game = new Chess(puzzle.fen);
  for (const move of puzzle.solution.slice(0, stepIndex)) game.move(move);
  return game;
}

export function advancePuzzle(puzzle: Puzzle, stepIndex: number, from: Square, to: Square): { result: 'checkmate' | 'progress' | 'wrong'; stepIndex: number } {
  try {
    const game = positionAt(puzzle, stepIndex);
    const expected = puzzle.solution[stepIndex];
    const played = game.move({ from, to, promotion: expected?.promotion ?? 'q' });
    if (game.isCheckmate()) return { result: 'checkmate', stepIndex };
    if (!expected || played.from !== expected.from || played.to !== expected.to || (expected.promotion && played.promotion !== expected.promotion)) return { result: 'wrong', stepIndex: 0 };
    const reply = puzzle.solution[stepIndex + 1];
    if (!reply) return { result: 'wrong', stepIndex: 0 };
    game.move(reply);
    return { result: 'progress', stepIndex: stepIndex + 2 };
  } catch {
    return { result: 'wrong', stepIndex: 0 };
  }
}

export function parseChessComPuzzle(value: unknown): Puzzle | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  if (typeof input.fen !== 'string' || typeof input.pgn !== 'string' || typeof input.title !== 'string' || typeof input.url !== 'string') return null;
  if (input.fen.length > 120 || input.pgn.length > 6000) return null;
  let url: URL;
  try { url = new URL(input.url); } catch { return null; }
  if (url.protocol !== 'https:' || url.hostname !== 'www.chess.com' || !/^\/daily\/\d{4}-\d{2}-\d{2}$/.test(url.pathname)) return null;
  try {
    const parsed = new Chess();
    parsed.loadPgn(input.pgn);
    const moves = parsed.history({ verbose: true }).map(move => ({ from: move.from, to: move.to, ...(move.promotion ? { promotion: move.promotion } : {}) }));
    if (moves.length < 1 || moves.length > 5 || moves.length % 2 === 0 || moves.some(move => move.promotion && move.promotion !== 'q')) return null;
    const replay = new Chess(input.fen);
    for (const move of moves) replay.move(move);
    if (!replay.isCheckmate()) return null;
    return { id: `chesscom:${url.pathname}`, title: input.title.slice(0, 80), fen: input.fen, solution: moves, sourceUrl: url.toString() };
  } catch { return null; }
}

export function isUsablePuzzle(value: unknown): value is Puzzle {
  if (!value || typeof value !== 'object') return false;
  const puzzle = value as Puzzle;
  if (typeof puzzle.id !== 'string' || typeof puzzle.title !== 'string' || typeof puzzle.fen !== 'string' || !Array.isArray(puzzle.solution) || puzzle.solution.length < 1 || puzzle.solution.length > 5 || puzzle.solution.length % 2 === 0) return false;
  if (!puzzle.sourceUrl || !/^https:\/\/www\.chess\.com\/daily\/\d{4}-\d{2}-\d{2}$/.test(puzzle.sourceUrl)) return false;
  try { return positionAt(puzzle, puzzle.solution.length).isCheckmate(); }
  catch { return false; }
}

export function selectPuzzle(cached: Puzzle[], completedCount: number): Puzzle {
  return cached.length ? cached[completedCount % cached.length] : PUZZLES[completedCount % PUZZLES.length];
}
