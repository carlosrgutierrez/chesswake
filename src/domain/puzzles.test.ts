import { describe, expect, it } from 'vitest';
import { PUZZLES, CHESS_COM_STARTER_PUZZLE, advancePuzzle, parseChessComPuzzle, positionAt, selectPuzzle, isUsablePuzzle } from './puzzles';

const mateInTwo = {
  title: 'Mate in 2',
  url: 'https://www.chess.com/daily/2013-02-27',
  fen: 'rnbk1b2/pppp1p1p/7n/3NNqr1/2BP4/6B1/PPPQ2PP/4R1KR w - - 0 1',
  pgn: '[Date "????.??.??"]\n[Result "*"]\n[FEN "rnbk1b2/pppp1p1p/7n/3NNqr1/2BP4/6B1/PPPQ2PP/4R1KR w - - 0 1"]\n\n1. Nxf7+ Qxf7 2. Bxc7#\n*'
};

describe('offline puzzles', () => {
  it('contains valid mate-in-one positions', () => {
    for (const puzzle of PUZZLES) {
      const move = puzzle.solution[0];
      expect(advancePuzzle(puzzle, 0, move.from, move.to).result).toBe('checkmate');
    }
  });
  it('resets after a legal wrong move', () => {
    expect(advancePuzzle(PUZZLES[0], 0, 'g6', 'g5')).toMatchObject({ result: 'wrong', stepIndex: 0 });
  });
  it('resets after an illegal move', () => {
    expect(advancePuzzle(PUZZLES[0], 0, 'f6', 'f8')).toMatchObject({ result: 'wrong', stepIndex: 0 });
  });
});

describe('Chess.com daily puzzle import', () => {
  it('parses a published mate-in-two and advances through the automatic reply', () => {
    const puzzle = parseChessComPuzzle(mateInTwo);
    expect(puzzle).not.toBeNull();
    expect(puzzle?.sourceUrl).toBe(mateInTwo.url);
    const first = advancePuzzle(puzzle!, 0, 'e5', 'f7');
    expect(first).toMatchObject({ result: 'progress', stepIndex: 2 });
    expect(positionAt(puzzle!, 2).get('f7')?.color).toBe('b');
    expect(advancePuzzle(puzzle!, 2, 'g3', 'c7').result).toBe('checkmate');
  });
  it('resets progress after a wrong second move', () => {
    const puzzle = parseChessComPuzzle(mateInTwo)!;
    expect(advancePuzzle(puzzle, 2, 'd2', 'd3')).toMatchObject({ result: 'wrong', stepIndex: 0 });
  });
  it('rejects puzzles that do not finish in checkmate', () => {
    expect(parseChessComPuzzle({ ...mateInTwo, pgn: mateInTwo.pgn.replace('2. Bxc7#', '2. Bd3') })).toBeNull();
  });
  it('rejects untrusted attribution URLs', () => {
    expect(parseChessComPuzzle({ ...mateInTwo, url: 'https://example.com/not-chess' })).toBeNull();
  });
  it('rejects a line where the opponent delivers mate', () => {
    const opponentMates = {
      ...mateInTwo,
      fen: '8/8/8/8/6q1/5k2/P7/7K w - - 0 1',
      pgn: '[FEN "8/8/8/8/6q1/5k2/P7/7K w - - 0 1"]\n\n1. a3 Qg2# *'
    };
    expect(parseChessComPuzzle(opponentMates)).toBeNull();
    const cached = { ...CHESS_COM_STARTER_PUZZLE, fen: opponentMates.fen, solution: [{ from: 'a2' as const, to: 'a3' as const }, { from: 'g4' as const, to: 'g2' as const }] };
    expect(isUsablePuzzle(cached)).toBe(false);
  });
  it('uses the local cache first and falls back to bundled puzzles', () => {
    const imported = parseChessComPuzzle(mateInTwo)!;
    expect(selectPuzzle([imported], 0).id).toBe(imported.id);
    expect(selectPuzzle([], 0).id).toBe(PUZZLES[0].id);
  });
  it('does not load a corrupt cached puzzle as an alarm', () => {
    const imported = parseChessComPuzzle(mateInTwo)!;
    expect(isUsablePuzzle(imported)).toBe(true);
    expect(isUsablePuzzle({ ...imported, solution: imported.solution.slice(0, 1) })).toBe(false);
  });
  it('ships one credited Chess.com puzzle for offline use before the first sync', () => {
    expect(isUsablePuzzle(CHESS_COM_STARTER_PUZZLE)).toBe(true);
    expect(CHESS_COM_STARTER_PUZZLE.sourceUrl).toContain('chess.com/daily/');
  });
});
