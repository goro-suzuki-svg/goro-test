'use client';

import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useAudio } from '@/hooks/useAudio';
import { useParticles } from '@/hooks/useParticles';
import {
  Board,
  Piece,
  PuyoColor,
  COLS,
  VISIBLE_ROWS,
  HIDDEN_ROWS,
  createEmptyBoard,
  createPiece,
  getSatellitePos,
  tryMove,
  tryRotate,
  placePiece,
  applyGravity,
  isValidPosition,
  resolveOneChain,
} from '@/lib/puyoLogic';

// ─── Config ──────────────────────────────────────────────────────────────────

const CLEAR_DURATION = 380; // ms for pop animation before cells disappear

function dropInterval(level: number) {
  return Math.max(100, 900 - (level - 1) * 70);
}

// ─── State / Reducer ─────────────────────────────────────────────────────────

type Phase = 'idle' | 'playing' | 'clearing' | 'gameover';

interface ClearingCell {
  row: number;
  col: number;
  color: PuyoColor;
}

interface State {
  board: Board;
  currentPiece: Piece | null;
  nextPiece: Piece;
  score: number;
  chainCount: number; // highest chain in the current resolution
  maxChain: number;
  phase: Phase;
  /** Cells being animated out this step */
  clearingCells: ClearingCell[];
  /** Board state after this clear step (ready for next chain check) */
  pendingBoard: Board | null;
  /** Which chain number we're on during resolution (1-indexed) */
  chainNum: number;
  level: number;
  piecesDropped: number;
  /** Incremented each time a new clear sequence starts, forces effect re-run */
  clearKey: number;
}

type Action =
  | { type: 'START' | 'RESTART' }
  | { type: 'TICK' }
  | { type: 'MOVE'; dr: number; dc: number }
  | { type: 'ROTATE'; dir: 1 | -1 }
  | { type: 'HARD_DROP' }
  | { type: 'AFTER_CLEAR' };

function initialState(): State {
  return {
    board: createEmptyBoard(),
    currentPiece: null,
    nextPiece: createPiece(),
    score: 0,
    chainCount: 0,
    maxChain: 0,
    phase: 'idle',
    clearingCells: [],
    pendingBoard: null,
    chainNum: 1,
    level: 1,
    piecesDropped: 0,
    clearKey: 0,
  };
}

/** Land the current piece, handle chains or spawn next piece. */
function landPiece(state: State, piece: Piece): State {
  const newBoard = applyGravity(placePiece(state.board, piece));
  const piecesDropped = state.piecesDropped + 1;
  const level = Math.floor(piecesDropped / 10) + 1;

  const resolution = resolveOneChain(newBoard, 1);
  if (resolution) {
    return {
      ...state,
      board: newBoard, // show piece placed while animating
      currentPiece: null,
      phase: 'clearing',
      clearingCells: resolution.clearingCells,
      pendingBoard: resolution.clearedBoard,
      chainNum: resolution.newChainNum,
      score: state.score + resolution.score,
      chainCount: 1,
      maxChain: Math.max(state.maxChain, 1),
      piecesDropped,
      level,
      clearKey: state.clearKey + 1,
    };
  }

  // No matches — spawn next piece
  const newPiece = state.nextPiece;
  const nextPiece = createPiece();

  if (!isValidPosition(newBoard, newPiece)) {
    return { ...state, board: newBoard, currentPiece: null, phase: 'gameover' };
  }

  return {
    ...state,
    board: newBoard,
    currentPiece: newPiece,
    nextPiece,
    phase: 'playing',
    clearingCells: [],
    pendingBoard: null,
    chainNum: 1,
    chainCount: 0,
    piecesDropped,
    level,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'START':
    case 'RESTART': {
      const nextPiece = createPiece();
      return {
        ...initialState(),
        currentPiece: createPiece(),
        nextPiece,
        phase: 'playing',
      };
    }

    case 'TICK': {
      if (state.phase !== 'playing' || !state.currentPiece) return state;
      const moved = tryMove(state.board, state.currentPiece, 1, 0);
      if (moved) return { ...state, currentPiece: moved };
      return landPiece(state, state.currentPiece);
    }

    case 'MOVE': {
      if (state.phase !== 'playing' || !state.currentPiece) return state;
      const moved = tryMove(state.board, state.currentPiece, action.dr, action.dc);
      return moved ? { ...state, currentPiece: moved } : state;
    }

    case 'ROTATE': {
      if (state.phase !== 'playing' || !state.currentPiece) return state;
      const rotated = tryRotate(state.board, state.currentPiece, action.dir);
      return { ...state, currentPiece: rotated };
    }

    case 'HARD_DROP': {
      if (state.phase !== 'playing' || !state.currentPiece) return state;
      let piece = state.currentPiece;
      for (;;) {
        const dropped = tryMove(state.board, piece, 1, 0);
        if (!dropped) break;
        piece = dropped;
      }
      return landPiece(state, piece);
    }

    case 'AFTER_CLEAR': {
      if (state.phase !== 'clearing' || !state.pendingBoard) return state;

      const resolution = resolveOneChain(state.pendingBoard, state.chainNum);
      if (resolution) {
        const chain = state.chainNum;
        return {
          ...state,
          board: state.pendingBoard,
          phase: 'clearing',
          clearingCells: resolution.clearingCells,
          pendingBoard: resolution.clearedBoard,
          chainNum: resolution.newChainNum,
          score: state.score + resolution.score,
          chainCount: chain,
          maxChain: Math.max(state.maxChain, chain),
          clearKey: state.clearKey + 1,
        };
      }

      // Chains exhausted — spawn next piece
      const finalChain = state.chainNum - 1;
      const newPiece = state.nextPiece;
      const nextPiece = createPiece();

      if (!isValidPosition(state.pendingBoard, newPiece)) {
        return {
          ...state,
          board: state.pendingBoard,
          currentPiece: null,
          phase: 'gameover',
          chainCount: finalChain,
          maxChain: Math.max(state.maxChain, finalChain),
        };
      }

      return {
        ...state,
        board: state.pendingBoard,
        currentPiece: newPiece,
        nextPiece,
        phase: 'playing',
        clearingCells: [],
        pendingBoard: null,
        chainNum: 1,
        chainCount: finalChain,
        maxChain: Math.max(state.maxChain, finalChain),
      };
    }

    default:
      return state;
  }
}

// ─── Color Maps ──────────────────────────────────────────────────────────────

const PUYO_COLORS: Record<PuyoColor, { base: string; light: string; glow: string }> = {
  red:    { base: '#FF4757', light: '#FF8A94', glow: 'rgba(255,71,87,0.7)' },
  green:  { base: '#2ED573', light: '#7EFFC0', glow: 'rgba(46,213,115,0.7)' },
  blue:   { base: '#3D9FFF', light: '#90C8FF', glow: 'rgba(61,159,255,0.7)' },
  yellow: { base: '#FFD32A', light: '#FFE980', glow: 'rgba(255,211,42,0.7)' },
};

// ─── Sub-components ──────────────────────────────────────────────────────────

function getClearClass(chainNum: number): string {
  if (chainNum >= 4) return 'puyo-clearing-epic';
  if (chainNum >= 2) return 'puyo-clearing-big';
  return 'puyo-clearing';
}

function PuyoCircle({
  color,
  size = 40,
  opacity = 1,
  clearClass,
  isLanding = false,
  isGhost = false,
}: {
  color: PuyoColor;
  size?: number;
  opacity?: number;
  clearClass?: string;
  isLanding?: boolean;
  isGhost?: boolean;
}) {
  const { base, light, glow } = PUYO_COLORS[color];

  if (isGhost) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: `2px solid ${base}`,
          opacity: 0.3,
          boxSizing: 'border-box',
        }}
      />
    );
  }

  return (
    <div
      className={clearClass ?? (isLanding ? 'puyo-landing' : '')}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `
          radial-gradient(circle at 35% 30%, ${light} 0%, ${base} 55%, color-mix(in srgb, ${base} 60%, black) 100%)
        `,
        boxShadow: `0 0 ${size * 0.3}px ${glow}, inset 0 -2px 4px rgba(0,0,0,0.3)`,
        opacity,
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* Eyes */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          gap: size * 0.15,
        }}
      >
        <div
          style={{
            width: size * 0.15,
            height: size * 0.18,
            borderRadius: '50%',
            background: '#1a0a00',
            boxShadow: `0 0 0 ${size * 0.04}px rgba(255,255,255,0.8)`,
          }}
        />
        <div
          style={{
            width: size * 0.15,
            height: size * 0.18,
            borderRadius: '50%',
            background: '#1a0a00',
            boxShadow: `0 0 0 ${size * 0.04}px rgba(255,255,255,0.8)`,
          }}
        />
      </div>
    </div>
  );
}

function NextPiecePanel({ piece }: { piece: Piece }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
      }}
    >
      <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase' }}>
        Next
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <PuyoCircle color={piece.satelliteColor} size={32} />
        <PuyoCircle color={piece.pivotColor} size={32} />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PuyoGame() {
  const [state, dispatch] = useReducer(reducer, undefined, initialState);
  const softDropRef = useRef(false);

  const { playSound, muted, toggleMute, startBGM } = useAudio();
  const { particles, spawnBurst } = useParticles();
  const [shaking, setShaking] = useState(false);
  const [landingCells, setLandingCells] = useState<Set<string>>(new Set());
  const prevPieceRef = useRef<Piece | null>(null);
  const prevPhaseRef = useRef<Phase>('idle');

  // ── Game tick ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (state.phase !== 'playing') return;
    const interval = softDropRef.current ? 80 : dropInterval(state.level);
    const id = setInterval(() => dispatch({ type: 'TICK' }), interval);
    return () => clearInterval(id);
  }, [state.phase, state.level]);

  // ── Clear animation timer ──────────────────────────────────────────────────
  useEffect(() => {
    if (state.phase !== 'clearing') return;
    const id = setTimeout(() => dispatch({ type: 'AFTER_CLEAR' }), CLEAR_DURATION);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.clearKey]);

  // ── Clearing sound + particles + screen shake ──────────────────────────────
  useEffect(() => {
    if (state.phase !== 'clearing') return;
    const chain = state.chainNum - 1;
    playSound({ type: 'chain', chainNum: chain });
    playSound({ type: 'clear', cells: state.clearingCells.length, chainNum: chain });
    spawnBurst(state.clearingCells, CELL, chain, HIDDEN_ROWS);
    if (chain >= 4) {
      setShaking(true);
      setTimeout(() => setShaking(false), 380);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.clearKey]);

  // ── Landing sound + flash ──────────────────────────────────────────────────
  useEffect(() => {
    const prev = prevPieceRef.current;
    prevPieceRef.current = state.currentPiece;
    if (prev && !state.currentPiece && state.phase !== 'gameover') {
      playSound({ type: 'land' });
      const sat = getSatellitePos(prev);
      const cells = new Set<string>();
      if (prev.pivotRow >= HIDDEN_ROWS) cells.add(`${prev.pivotRow},${prev.pivotCol}`);
      if (sat.row >= HIDDEN_ROWS) cells.add(`${sat.row},${sat.col}`);
      setLandingCells(cells);
      setTimeout(() => setLandingCells(new Set()), 200);
    }
  }, [state.currentPiece, state.phase, playSound]);

  // ── BGM on game start ──────────────────────────────────────────────────────
  useEffect(() => {
    if (state.phase === 'playing' && prevPhaseRef.current !== 'playing') {
      startBGM();
    }
    prevPhaseRef.current = state.phase;
  }, [state.phase, startBGM]);

  // ── Keyboard controls ──────────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (state.phase === 'idle' || state.phase === 'gameover') {
        if (e.code === 'Space' || e.code === 'Enter') {
          e.preventDefault();
          dispatch({ type: state.phase === 'idle' ? 'START' : 'RESTART' });
        }
        return;
      }
      if (state.phase !== 'playing') return;

      switch (e.code) {
        case 'ArrowLeft':
          e.preventDefault();
          dispatch({ type: 'MOVE', dr: 0, dc: -1 });
          break;
        case 'ArrowRight':
          e.preventDefault();
          dispatch({ type: 'MOVE', dr: 0, dc: 1 });
          break;
        case 'ArrowDown':
          e.preventDefault();
          softDropRef.current = true;
          dispatch({ type: 'TICK' });
          break;
        case 'ArrowUp':
        case 'KeyX':
          e.preventDefault();
          dispatch({ type: 'ROTATE', dir: 1 });
          break;
        case 'KeyZ':
          e.preventDefault();
          dispatch({ type: 'ROTATE', dir: -1 });
          break;
        case 'Space':
          e.preventDefault();
          dispatch({ type: 'HARD_DROP' });
          break;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'ArrowDown') softDropRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [state.phase]);

  // ── Build display board ────────────────────────────────────────────────────
  const { displayCells, ghostCells } = useMemo(() => {
    const clearingSet = new Set(state.clearingCells.map((c) => `${c.row},${c.col}`));

    // Ghost piece: map position -> color
    const ghost = new Map<string, PuyoColor>();
    if (state.currentPiece && state.phase === 'playing') {
      let g = state.currentPiece;
      for (;;) {
        const dropped = tryMove(state.board, g, 1, 0);
        if (!dropped) break;
        g = dropped;
      }
      const sat = getSatellitePos(g);
      if (g.pivotRow >= HIDDEN_ROWS) ghost.set(`${g.pivotRow},${g.pivotCol}`, g.pivotColor);
      if (sat.row >= HIDDEN_ROWS) ghost.set(`${sat.row},${sat.col}`, g.satelliteColor);
    }

    // Piece cells
    const pieceMap = new Map<string, PuyoColor>();
    if (state.currentPiece) {
      const sat = getSatellitePos(state.currentPiece);
      if (state.currentPiece.pivotRow >= HIDDEN_ROWS)
        pieceMap.set(`${state.currentPiece.pivotRow},${state.currentPiece.pivotCol}`, state.currentPiece.pivotColor);
      if (sat.row >= HIDDEN_ROWS)
        pieceMap.set(`${sat.row},${sat.col}`, state.currentPiece.satelliteColor);
    }

    return { displayCells: { clearingSet, pieceMap }, ghostCells: ghost };
  }, [state.board, state.currentPiece, state.clearingCells, state.phase]);

  // ── Cell size ──────────────────────────────────────────────────────────────
  const CELL = 44;
  const BOARD_W = COLS * CELL;
  const BOARD_H = VISIBLE_ROWS * CELL;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0f0c29 0%, #1a1040 40%, #0d0d1a 100%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 16px',
        fontFamily: "'Geist', 'Inter', sans-serif",
      }}
    >
      {/* Title */}
      <h1
        style={{
          fontSize: 32,
          fontWeight: 800,
          letterSpacing: -1,
          marginBottom: 24,
          background: 'linear-gradient(90deg, #FF4757 0%, #FFD32A 33%, #2ED573 66%, #3D9FFF 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}
      >
        ぷよぷよ
      </h1>

      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
        {/* ── Board ─────────────────────────────────────────────────────────── */}
        <div className={shaking ? 'screen-shaking' : ''} style={{ position: 'relative' }}>
          <div
            style={{
              width: BOARD_W,
              height: BOARD_H,
              display: 'grid',
              gridTemplateColumns: `repeat(${COLS}, ${CELL}px)`,
              gridTemplateRows: `repeat(${VISIBLE_ROWS}, ${CELL}px)`,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 12,
              overflow: 'hidden',
              boxShadow: '0 0 40px rgba(0,0,0,0.6), inset 0 0 20px rgba(0,0,0,0.3)',
            }}
          >
            {/* Particle overlay */}
            <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible', zIndex: 10 }}>
              {particles.map((p) => (
                <div
                  key={p.id}
                  className="puyo-particle"
                  style={{
                    left: p.x,
                    top: p.y,
                    width: p.size,
                    height: p.size,
                    background: p.color,
                    '--px': p.dx,
                    '--py': p.dy,
                  } as React.CSSProperties}
                />
              ))}
            </div>
            {Array.from({ length: VISIBLE_ROWS }, (_, vi) => {
              const row = vi + HIDDEN_ROWS; // actual board row
              return Array.from({ length: COLS }, (_, col) => {
                const key = `${row},${col}`;
                const boardColor = state.board[row][col];
                const pieceColor = displayCells.pieceMap.get(key);
                const isClearing = displayCells.clearingSet.has(key);
                const ghostColor = ghostCells.get(key);
                const isGhost = !!ghostColor && !pieceColor;
                const color = pieceColor ?? boardColor;

                return (
                  <div
                    key={key}
                    style={{
                      width: CELL,
                      height: CELL,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRight: col < COLS - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                      borderBottom: vi < VISIBLE_ROWS - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    }}
                  >
                    {color ? (
                      <PuyoCircle
                        color={color}
                        size={CELL - 6}
                        clearClass={isClearing ? getClearClass(state.chainNum - 1) : undefined}
                        isLanding={landingCells.has(key)}
                      />
                    ) : isGhost ? (
                      <PuyoCircle color={ghostColor!} size={CELL - 6} isGhost />
                    ) : null}
                  </div>
                );
              });
            })}
          </div>

          {/* Game Over overlay */}
          {state.phase === 'gameover' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.82)',
                backdropFilter: 'blur(4px)',
                borderRadius: 12,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 16,
              }}
            >
              <div style={{ fontSize: 28, fontWeight: 800, color: '#FF4757' }}>GAME OVER</div>
              <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 15 }}>
                Score: <span style={{ color: '#FFD32A', fontWeight: 700 }}>{state.score.toLocaleString()}</span>
              </div>
              {state.maxChain > 1 && (
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13 }}>
                  Best chain: <span style={{ color: '#2ED573', fontWeight: 700 }}>{state.maxChain}</span>
                </div>
              )}
              <button
                onClick={() => dispatch({ type: 'RESTART' })}
                style={{
                  marginTop: 8,
                  padding: '10px 28px',
                  borderRadius: 999,
                  border: 'none',
                  background: 'linear-gradient(135deg, #FF4757, #FF8A00)',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 15,
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(255,71,87,0.4)',
                  transition: 'transform 0.1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.05)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                もう一度
              </button>
            </div>
          )}

          {/* Idle overlay */}
          {state.phase === 'idle' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.75)',
                backdropFilter: 'blur(4px)',
                borderRadius: 12,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
              }}
            >
              <div
                style={{
                  fontSize: 42,
                  fontWeight: 900,
                  background: 'linear-gradient(90deg, #FF4757 0%, #FFD32A 33%, #2ED573 66%, #3D9FFF 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                ぷよぷよ
              </div>
              <button
                onClick={() => dispatch({ type: 'START' })}
                style={{
                  padding: '12px 36px',
                  borderRadius: 999,
                  border: 'none',
                  background: 'linear-gradient(135deg, #3D9FFF, #2ED573)',
                  color: '#fff',
                  fontWeight: 800,
                  fontSize: 16,
                  cursor: 'pointer',
                  boxShadow: '0 4px 24px rgba(61,159,255,0.4)',
                  letterSpacing: 0.5,
                }}
              >
                スタート
              </button>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 4 }}>
                Press Space or Enter
              </div>
            </div>
          )}
        </div>

        {/* ── Side Panel ────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: 120 }}>
          {/* Score */}
          <StatCard label="SCORE" value={state.score.toLocaleString()} accent="#FFD32A" />
          <StatCard label="LEVEL" value={String(state.level)} accent="#3D9FFF" />
          <StatCard
            label="CHAIN"
            value={state.chainCount > 0 ? `${state.chainCount}連鎖` : '-'}
            accent="#FF4757"
          />
          {state.maxChain > 1 && (
            <StatCard label="MAX" value={`${state.maxChain}連鎖`} accent="#2ED573" />
          )}

          {/* Next piece */}
          <NextPiecePanel piece={state.nextPiece} />

          {/* Controls */}
          <div
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 11,
              color: 'rgba(255,255,255,0.35)',
              lineHeight: 1.8,
            }}
          >
            <div>← → 移動</div>
            <div>↑ / X 回転</div>
            <div>Z 逆回転</div>
            <div>↓ 加速</div>
            <div>Space 落下</div>
          </div>

          <button
            onClick={toggleMute}
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              padding: '8px 0',
              color: 'rgba(255,255,255,0.6)',
              fontSize: 20,
              cursor: 'pointer',
              width: '100%',
            }}
          >
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
      </div>

      {/* Chain popup */}
      {state.phase === 'clearing' && state.chainCount >= 2 && (
        <ChainPopup count={state.chainCount} key={state.clearKey} />
      )}
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10,
        padding: '10px 14px',
      }}
    >
      <div
        style={{
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 2,
          color: 'rgba(255,255,255,0.4)',
          textTransform: 'uppercase',
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 800,
          color: accent,
          letterSpacing: -0.5,
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}

// ─── ChainPopup ───────────────────────────────────────────────────────────────

function ChainPopup({ count }: { count: number }) {
  const tier  = count >= 5 ? 3 : count >= 3 ? 2 : 1;
  const sizes = [48, 60, 76] as const;
  const colors: Record<1 | 2 | 3, string> = { 1: '#2ED573', 2: '#FFD32A', 3: '#FF4757' };
  const glows: Record<1 | 2 | 3, string> = {
    1: '0 0 20px',
    2: '0 0 30px, 0 0 60px',
    3: '0 0 40px, 0 0 80px, 0 0 120px',
  };
  const color = colors[tier as 1 | 2 | 3];
  const shadow = glows[tier as 1 | 2 | 3]
    .split(', ')
    .map((g) => `${g} ${color}`)
    .join(', ');

  return (
    <div
      className="chain-popup"
      style={{
        position: 'fixed',
        top: '40%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: sizes[tier - 1],
        fontWeight: 900,
        color,
        textShadow: shadow,
        pointerEvents: 'none',
        zIndex: 100,
        letterSpacing: -1,
      }}
    >
      {count}連鎖！
    </div>
  );
}
