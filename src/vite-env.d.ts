import type { ChessWakeAPI } from './domain/types';

declare global { interface Window { chessWake: ChessWakeAPI } }
