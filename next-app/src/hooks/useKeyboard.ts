import { useEffect } from 'react';

type KeyControls = {
  moveLeft: () => void;
  moveRight: () => void;
  moveDown: () => void;
  rotate: () => void;
};

export const useKeyboard = (controls: KeyControls) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent default scrolling for game keys
      if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' '].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
          controls.moveLeft();
          break;
        case 'ArrowRight':
        case 'd':
          controls.moveRight();
          break;
        case 'ArrowDown':
        case 's':
          controls.moveDown();
          break;
        case 'ArrowUp':
        case 'w':
        case ' ': // spacebar
          controls.rotate();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: false });
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [controls]);
};
