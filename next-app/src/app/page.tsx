'use client';

import React from 'react';
import styles from './game.module.css';
import { useGameEngine } from '../hooks/useGameEngine';
import { useKeyboard } from '../hooks/useKeyboard';
import { GameBoard } from '../components/GameBoard';

export default function Game() {
  const {
    board,
    activePiece,
    nextPiece,
    gameState,
    score,
    chain,
    clearingPuyos,
    startGame,
    moveLeft,
    moveRight,
    moveDown,
    rotate
  } = useGameEngine();

  useKeyboard({ moveLeft, moveRight, moveDown, rotate });

  return (
    <main className={styles.container}>
      {/* Title */}
      <h1 style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '2rem', textShadow: '0 0 20px #00e5ff', letterSpacing: '4px' }}>
        NEO PUYO
      </h1>

      <div className={styles.gameWrapper}>
        {/* Left Panel: Score and Status */}
        <div className={styles.sidePanel}>
          <div className={styles.panelBox}>
            <div className={styles.panelTitle}>Score</div>
            <div className={styles.scoreValue}>{score.toLocaleString()}</div>
          </div>
          
          <div className={styles.panelBox} style={{ minHeight: '100px' }}>
            <div className={styles.panelTitle}>Chain</div>
            {chain > 0 ? (
              <div className={styles.chainValue}>{chain} RENSA!</div>
            ) : (
              <div style={{ color: 'rgba(255,255,255,0.2)' }}>-</div>
            )}
          </div>

          <div className={styles.panelBox}>
            <div className={styles.panelTitle}>Controls</div>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.6)', lineHeight: '1.6' }}>
              &larr; &rarr; : Move<br/>
              &darr; : Drop<br/>
              &uarr; / Space : Rotate
            </div>
          </div>
        </div>

        {/* Center: Game Board */}
        <div style={{ position: 'relative' }}>
          <GameBoard board={board} activePiece={activePiece} clearingPuyos={clearingPuyos} />
          
          {gameState === 'START' && (
            <div className={styles.overlay}>
              <button className={styles.startButton} onClick={startGame}>START GAME</button>
            </div>
          )}

          {gameState === 'GAMEOVER' && (
            <div className={styles.overlay}>
              <div className={styles.gameOverText}>GAME OVER</div>
              <button className={styles.startButton} onClick={startGame}>PLAY AGAIN</button>
            </div>
          )}
        </div>

        {/* Right Panel: Next Piece */}
        <div className={styles.sidePanel}>
          <div className={styles.panelBox}>
            <div className={styles.panelTitle}>NEXT</div>
            <div className={styles.nextPreview}>
              {gameState !== 'START' && (
                <>
                  <div className={`${styles.puyo} ${styles[`color${nextPiece.subColor}`]}`} />
                  <div className={`${styles.puyo} ${styles[`color${nextPiece.mainColor}`]}`} />
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
