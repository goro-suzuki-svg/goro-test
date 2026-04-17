export const BOARD_WIDTH = 6;
export const BOARD_HEIGHT = 13; // row 0 is hidden spawn row

export const EMPTY = 0;
export const COLORS = [1, 2, 3, 4, 5]; // 5 colors

export const ROTATION_OFFSETS = [
  { dx: 0, dy: -1 }, // 0: Sub is UP
  { dx: 1, dy: 0 },  // 1: Sub is RIGHT
  { dx: 0, dy: 1 },  // 2: Sub is DOWN
  { dx: -1, dy: 0 }, // 3: Sub is LEFT
];

// 獲得スコアの計算式（連鎖ボーナスなど）用定数簡易版
export const CHAIN_BONUS = [0, 8, 16, 32, 64, 96, 128, 160, 192, 224, 256, 288, 320, 352, 384, 416, 448, 480, 512, 544, 576, 608];
