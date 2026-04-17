import React from 'react';
import styles from '../app/game.module.css';
import { BOARD_WIDTH, BOARD_HEIGHT, EMPTY, ROTATION_OFFSETS } from '../lib/constants';
import { ActivePiece } from '../hooks/useGameEngine';

interface GameBoardProps {
  board: number[][];
  activePiece: ActivePiece | null;
  clearingPuyos: {x: number, y: number}[];
}

export const GameBoard: React.FC<GameBoardProps> = ({ board, activePiece, clearingPuyos }) => {
  const isClearing = (x: number, y: number) => {
    return clearingPuyos.some(p => p.x === x && p.y === y);
  };

  return (
    <div className={styles.board}>
      {/* Background grid cells */}
      {Array.from({ length: BOARD_HEIGHT * BOARD_WIDTH }).map((_, i) => (
        <div key={`cell-${i}`} className={styles.cell} />
      ))}

      {/* Settled Puyos */}
      {board.map((row, y) =>
        row.map((color, x) => {
          if (color === EMPTY) return null;
          // Hide row 0 visually if we wanted, but let's just let it be drawn normally but maybe clip it. The board has overflow:hidden.
          return (
            <div
              key={`puyo-${x}-${y}`}
              className={`${styles.puyoContainer} ${isClearing(x, y) ? styles.clearing : ''}`}
              style={{ top: y * 40, left: x * 40 }}
            >
              <div className={`${styles.puyo} ${styles[`color${color}`]}`} />
            </div>
          );
        })
      )}

      {/* Active Piece */}
      {activePiece && (
        <>
          <div
            className={styles.puyoContainer}
            style={{ top: activePiece.y * 40, left: activePiece.x * 40, zIndex: 20 }}
          >
            <div className={`${styles.puyo} ${styles[`color${activePiece.mainColor}`]}`} />
          </div>
          <div
            className={`${styles.puyoContainer} ${styles.activePieceSub}`}
            style={{
              top: (activePiece.y + ROTATION_OFFSETS[activePiece.rotation].dy) * 40,
              left: (activePiece.x + ROTATION_OFFSETS[activePiece.rotation].dx) * 40,
              zIndex: 20
            }}
          >
            <div className={`${styles.puyo} ${styles[`color${activePiece.subColor}`]}`} />
          </div>
        </>
      )}
    </div>
  );
};
