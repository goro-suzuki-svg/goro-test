// ─── Constants ───────────────────────────────────────────────────────────────

export const COLS = 6;
export const VISIBLE_ROWS = 12;
export const HIDDEN_ROWS = 1; // hidden spawn row at top
export const TOTAL_ROWS = VISIBLE_ROWS + HIDDEN_ROWS; // 13

// ─── Types ───────────────────────────────────────────────────────────────────

export type PuyoColor = 'red' | 'green' | 'blue' | 'yellow';
export type Cell = PuyoColor | null;
export type Board = Cell[][];

/** A falling pair of puyos. pivot is the anchor; satellite orbits around it. */
export interface Piece {
  pivotRow: number;
  pivotCol: number;
  /** 0 = satellite above, 1 = right, 2 = below, 3 = left */
  rotation: 0 | 1 | 2 | 3;
  pivotColor: PuyoColor;
  satelliteColor: PuyoColor;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COLORS: PuyoColor[] = ['red', 'green', 'blue', 'yellow'];

const ROT_OFFSETS: { dr: number; dc: number }[] = [
  { dr: -1, dc: 0 }, // 0: above
  { dr: 0, dc: 1 },  // 1: right
  { dr: 1, dc: 0 },  // 2: below
  { dr: 0, dc: -1 }, // 3: left
];

export function randomColor(): PuyoColor {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}

export function createEmptyBoard(): Board {
  return Array.from({ length: TOTAL_ROWS }, () => Array<Cell>(COLS).fill(null));
}

/** Spawn position: pivot on row 1 (first visible), satellite on row 0 (hidden). */
export function createPiece(): Piece {
  return {
    pivotRow: HIDDEN_ROWS,
    pivotCol: 2,
    rotation: 0,
    pivotColor: randomColor(),
    satelliteColor: randomColor(),
  };
}

export function getSatellitePos(piece: Piece): { row: number; col: number } {
  const { dr, dc } = ROT_OFFSETS[piece.rotation];
  return { row: piece.pivotRow + dr, col: piece.pivotCol + dc };
}

// ─── Movement / Placement ────────────────────────────────────────────────────

export function isValidPosition(board: Board, piece: Piece): boolean {
  const sat = getSatellitePos(piece);
  for (const { row, col } of [{ row: piece.pivotRow, col: piece.pivotCol }, sat]) {
    if (col < 0 || col >= COLS || row >= TOTAL_ROWS) return false;
    if (row >= 0 && board[row][col] !== null) return false;
  }
  return true;
}

export function tryMove(
  board: Board,
  piece: Piece,
  dr: number,
  dc: number,
): Piece | null {
  const moved = { ...piece, pivotRow: piece.pivotRow + dr, pivotCol: piece.pivotCol + dc };
  return isValidPosition(board, moved) ? moved : null;
}

export function tryRotate(board: Board, piece: Piece, dir: 1 | -1): Piece {
  const newRot = ((piece.rotation + dir + 4) % 4) as 0 | 1 | 2 | 3;
  const rotated = { ...piece, rotation: newRot };
  if (isValidPosition(board, rotated)) return rotated;

  // Wall / floor kicks
  for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const kicked = { ...rotated, pivotRow: rotated.pivotRow + dr, pivotCol: rotated.pivotCol + dc };
    if (isValidPosition(board, kicked)) return kicked;
  }
  return piece; // Can't rotate
}

export function placePiece(board: Board, piece: Piece): Board {
  const b = board.map((r) => [...r]);
  const sat = getSatellitePos(piece);
  if (piece.pivotRow >= 0) b[piece.pivotRow][piece.pivotCol] = piece.pivotColor;
  if (sat.row >= 0) b[sat.row][sat.col] = piece.satelliteColor;
  return b;
}

/** Drop all floating puyos to the lowest available position. */
export function applyGravity(board: Board): Board {
  const b = createEmptyBoard();
  for (let col = 0; col < COLS; col++) {
    const cells: Cell[] = [];
    for (let row = 0; row < TOTAL_ROWS; row++) {
      if (board[row][col] !== null) cells.push(board[row][col]);
    }
    cells.forEach((cell, i) => {
      b[TOTAL_ROWS - cells.length + i][col] = cell;
    });
  }
  return b;
}

// ─── Chain Logic ─────────────────────────────────────────────────────────────

export type Group = Array<{ row: number; col: number }>;

export function findMatchingGroups(board: Board): Group[] {
  const visited = new Set<string>();
  const groups: Group[] = [];

  for (let row = 0; row < TOTAL_ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const color = board[row][col];
      if (!color || visited.has(`${row},${col}`)) continue;

      const group: Group = [];
      const stack = [{ row, col }];

      while (stack.length > 0) {
        const curr = stack.pop()!;
        const key = `${curr.row},${curr.col}`;
        if (visited.has(key)) continue;
        if (curr.row < 0 || curr.row >= TOTAL_ROWS || curr.col < 0 || curr.col >= COLS) continue;
        if (board[curr.row][curr.col] !== color) continue;

        visited.add(key);
        group.push(curr);
        stack.push(
          { row: curr.row - 1, col: curr.col },
          { row: curr.row + 1, col: curr.col },
          { row: curr.row, col: curr.col - 1 },
          { row: curr.row, col: curr.col + 1 },
        );
      }

      if (group.length >= 4) groups.push(group);
    }
  }

  return groups;
}

export function clearGroups(board: Board, groups: Group[]): Board {
  const b = board.map((r) => [...r]);
  for (const group of groups) {
    for (const { row, col } of group) b[row][col] = null;
  }
  return b;
}

// Official Puyo Puyo scoring
const CHAIN_POWERS = [0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512];
const COLOR_BONUSES = [0, 0, 3, 6, 12, 24];
const GROUP_BONUSES = [0, 0, 0, 0, 0, 2, 3, 4, 5, 6];

export function calculateScore(groups: Group[], board: Board, chainNum: number): number {
  const puyosCleared = groups.reduce((sum, g) => sum + g.length, 0);
  const colors = new Set(groups.flatMap((g) => g.map(({ row, col }) => board[row][col])));

  const chainPower = CHAIN_POWERS[Math.min(chainNum - 1, CHAIN_POWERS.length - 1)];
  const colorBonus = COLOR_BONUSES[Math.min(colors.size, 5)];
  const groupBonus = groups.reduce(
    (sum, g) => sum + GROUP_BONUSES[Math.min(g.length, GROUP_BONUSES.length - 1)],
    0,
  );

  return puyosCleared * 10 * Math.max(1, chainPower + colorBonus + groupBonus);
}

/** Resolve one chain step: find matches → clear → gravity → return result. */
export function resolveOneChain(
  board: Board,
  chainNum: number,
): {
  clearedBoard: Board;
  clearingCells: Array<{ row: number; col: number; color: PuyoColor }>;
  score: number;
  newChainNum: number;
} | null {
  const groups = findMatchingGroups(board);
  if (groups.length === 0) return null;

  const clearingCells = groups.flatMap((g) =>
    g.map(({ row, col }) => ({ row, col, color: board[row][col] as PuyoColor })),
  );
  const score = calculateScore(groups, board, chainNum);
  const clearedBoard = applyGravity(clearGroups(board, groups));

  return { clearedBoard, clearingCells, score, newChainNum: chainNum + 1 };
}
