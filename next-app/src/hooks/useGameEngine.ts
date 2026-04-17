import { useState, useEffect, useCallback, useRef } from 'react';
import { BOARD_WIDTH, BOARD_HEIGHT, EMPTY, COLORS, ROTATION_OFFSETS, CHAIN_BONUS } from '../lib/constants';

export type GameState = 'START' | 'PLAYING' | 'SETTLING' | 'CLEARING' | 'GRAVITY' | 'GAMEOVER';

export interface ActivePiece {
  x: number;
  y: number;
  mainColor: number;
  subColor: number;
  rotation: number; // 0: sub UP, 1: sub RIGHT, 2: sub DOWN, 3: sub LEFT
}

const createEmptyBoard = () => Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(EMPTY));
const getRandomColor = () => COLORS[Math.floor(Math.random() * COLORS.length)];

export const useGameEngine = () => {
  const [board, setBoard] = useState<number[][]>(createEmptyBoard());
  const [activePiece, setActivePiece] = useState<ActivePiece | null>(null);
  const [nextPiece, setNextPiece] = useState({ mainColor: getRandomColor(), subColor: getRandomColor() });
  const [gameState, setGameState] = useState<GameState>('START');
  const [score, setScore] = useState(0);
  const [chain, setChain] = useState(0);
  const [clearingPuyos, setClearingPuyos] = useState<{x: number, y: number}[]>([]);
  
  const stateRef = useRef({ board, activePiece, gameState, chain, score });
  useEffect(() => {
    stateRef.current = { board, activePiece, gameState, chain, score };
  }, [board, activePiece, gameState, chain, score]);

  const startGame = () => {
    setBoard(createEmptyBoard());
    setScore(0);
    setChain(0);
    setNextPiece({ mainColor: getRandomColor(), subColor: getRandomColor() });
    spawnPiece();
  };

  const spawnPiece = useCallback(() => {
    const newPiece: ActivePiece = {
      x: 2,
      y: 1, // spawn slightly below the top hidden row
      mainColor: stateRef.current.board ? nextPiece.mainColor : getRandomColor(),
      subColor: nextPiece.subColor,
      rotation: 0
    };
    
    // Check if spawn point is blocked -> Game Over
    if (stateRef.current.board[1][2] !== EMPTY) {
      setGameState('GAMEOVER');
      return;
    }

    setNextPiece({ mainColor: getRandomColor(), subColor: getRandomColor() });
    setActivePiece(newPiece);
    setGameState('PLAYING');
  }, [nextPiece]);

  // Checks if a position is free
  const isValidPos = (x: number, y: number, b: number[][]) => {
    return x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT && b[y][x] === EMPTY;
  };

  const canMove = (piece: ActivePiece | null, dx: number, dy: number, b = stateRef.current.board): boolean => {
    if (!piece) return false;
    const nx = piece.x + dx;
    const ny = piece.y + dy;
    const nsx = nx + ROTATION_OFFSETS[piece.rotation].dx;
    const nsy = ny + ROTATION_OFFSETS[piece.rotation].dy;
    return isValidPos(nx, ny, b) && isValidPos(nsx, nsy, b);
  };

  // Move Actions for controllers
  const moveLeft = () => {
    if (stateRef.current.gameState === 'PLAYING' && canMove(stateRef.current.activePiece, -1, 0)) {
      setActivePiece(prev => prev ? { ...prev, x: prev.x - 1 } : null);
    }
  };

  const moveRight = () => {
    if (stateRef.current.gameState === 'PLAYING' && canMove(stateRef.current.activePiece, 1, 0)) {
      setActivePiece(prev => prev ? { ...prev, x: prev.x + 1 } : null);
    }
  };

  const moveDown = () => {
    const { activePiece, board, gameState } = stateRef.current;
    if (gameState === 'PLAYING' && activePiece) {
      if (canMove(activePiece, 0, 1)) {
        setActivePiece(prev => prev ? { ...prev, y: prev.y + 1 } : null);
      } else {
        settlePiece();
      }
    }
  };

  const rotate = () => {
    const { activePiece, board, gameState } = stateRef.current;
    if (gameState !== 'PLAYING' || !activePiece) return;

    let newRot = (activePiece.rotation + 1) % 4;
    let tempPiece = { ...activePiece, rotation: newRot };

    // Wall Kick Logic
    if (!canMove(tempPiece, 0, 0, board)) {
      if (canMove(tempPiece, 1, 0, board)) tempPiece.x += 1;
      else if (canMove(tempPiece, -1, 0, board)) tempPiece.x -= 1;
      else if (canMove(tempPiece, 0, -1, board)) tempPiece.y -= 1;
      else return; // Cannot rotate
    }
    setActivePiece(tempPiece);
  };

  const settlePiece = useCallback(() => {
    setGameState('SETTLING');
    const { activePiece, board } = stateRef.current;
    if (!activePiece) return;

    const newBoard = board.map(row => [...row]);
    newBoard[activePiece.y][activePiece.x] = activePiece.mainColor;
    newBoard[activePiece.y + ROTATION_OFFSETS[activePiece.rotation].dy][activePiece.x + ROTATION_OFFSETS[activePiece.rotation].dx] = activePiece.subColor;
    
    setActivePiece(null);
    setBoard(newBoard);
    
    // Switch to Gravity checking (to let dangling puyo fall)
    setTimeout(() => {
      applyGravity(newBoard);
    }, 200);
  }, []);

  const applyGravity = useCallback((currentBoard: number[][]) => {
    setGameState('GRAVITY');
    let moved = false;
    const newBoard = currentBoard.map(row => [...row]);

    for (let col = 0; col < BOARD_WIDTH; col++) {
      let emptyRow = BOARD_HEIGHT - 1;
      for (let row = BOARD_HEIGHT - 1; row >= 0; row--) {
        if (newBoard[row][col] !== EMPTY) {
          if (emptyRow !== row) {
            newBoard[emptyRow][col] = newBoard[row][col];
            newBoard[row][col] = EMPTY;
            moved = true;
          }
          emptyRow--;
        }
      }
    }

    setBoard(newBoard);

    if (moved) {
      setTimeout(() => checkClears(newBoard), 400); // Wait for fall animation
    } else {
      checkClears(newBoard);
    }
  }, []);

  const checkClears = useCallback((currentBoard: number[][]) => {
    setGameState('CLEARING');
    const visited = Array.from({ length: BOARD_HEIGHT }, () => Array(BOARD_WIDTH).fill(false));
    let toClear: {x: number, y: number}[] = [];

    // Simple BFS for finding connected sets >= 4
    for (let r = 0; r < BOARD_HEIGHT; r++) {
      for (let c = 0; c < BOARD_WIDTH; c++) {
        if (currentBoard[r][c] !== EMPTY && !visited[r][c]) {
          const color = currentBoard[r][c];
          let group: {x: number, y: number}[] = [];
          let queue = [{x: c, y: r}];
          visited[r][c] = true;

          while (queue.length > 0) {
            const {x, y} = queue.shift()!;
            group.push({x, y});

            const dirs = [[0,1], [1,0], [0,-1], [-1,0]];
            for (let [dx, dy] of dirs) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < BOARD_WIDTH && ny >= 0 && ny < BOARD_HEIGHT) {
                if (!visited[ny][nx] && currentBoard[ny][nx] === color) {
                  visited[ny][nx] = true;
                  queue.push({x: nx, y: ny});
                }
              }
            }
          }

          if (group.length >= 4) {
            toClear.push(...group);
          }
        }
      }
    }

    if (toClear.length > 0) {
      setClearingPuyos(toClear);
      
      const newChain = stateRef.current.chain + 1;
      setChain(newChain);
      const bonus = CHAIN_BONUS[Math.min(newChain, CHAIN_BONUS.length - 1)];
      const points = toClear.length * 10 * Math.max(1, bonus);
      setScore(prev => prev + points);

      setTimeout(() => {
        const nextBoard = currentBoard.map(row => [...row]);
        toClear.forEach(({x, y}) => {
          nextBoard[y][x] = EMPTY;
        });
        setClearingPuyos([]);
        setBoard(nextBoard);
        applyGravity(nextBoard);
      }, 500); // Explosion animation time
    } else {
      // No more clears
      setChain(0);
      spawnPiece();
    }
  }, [applyGravity, spawnPiece]);

  // Main game loop (Gravity during PLAYING)
  useEffect(() => {
    if (gameState !== 'PLAYING') return;

    const interval = setInterval(() => {
      moveDown();
    }, 800); // 800ms drop speed

    return () => clearInterval(interval);
  }, [gameState]);

  return {
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
    moveDown, // can be used for soft-drop
    rotate
  };
};
