'use client';

import { useRef, useState, useCallback } from 'react';
import type { PuyoColor } from '@/lib/puyoLogic';

const PUYO_HEX: Record<PuyoColor, string> = {
  red:    '#FF4757',
  green:  '#2ED573',
  blue:   '#3D9FFF',
  yellow: '#FFD32A',
};

export interface Particle {
  id: number;
  x: number;
  y: number;
  color: string;
  dx: string;
  dy: string;
  size: number;
}

export function useParticles() {
  const [particles, setParticles] = useState<Particle[]>([]);
  const counterRef = useRef(0);

  const spawnBurst = useCallback(
    (
      cells: Array<{ row: number; col: number; color: PuyoColor }>,
      cellSize: number,
      chainNum: number,
      hiddenRows: number,
    ) => {
      const count = Math.min(2 + chainNum, 6);
      const speedBase = 30 + Math.min(chainNum / 3, 1) * 50;

      const newParticles: Particle[] = cells.flatMap((cell) => {
        const cx = cell.col * cellSize + cellSize / 2;
        const cy = (cell.row - hiddenRows) * cellSize + cellSize / 2;

        return Array.from({ length: count }, (_, i) => {
          const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
          const speed = speedBase + Math.random() * 30;
          return {
            id: counterRef.current++,
            x: cx,
            y: cy,
            color: PUYO_HEX[cell.color],
            dx: `${Math.cos(angle) * speed}px`,
            dy: `${Math.sin(angle) * speed}px`,
            size: 4 + Math.random() * 4,
          };
        });
      });

      setParticles((prev) => [...prev, ...newParticles]);

      const ids = new Set(newParticles.map((p) => p.id));
      setTimeout(() => {
        setParticles((prev) => prev.filter((p) => !ids.has(p.id)));
      }, 520);
    },
    [],
  );

  return { particles, spawnBurst };
}
