import React, { useEffect, useState } from 'react';

const COLORS = ['#d0a45e', '#f5c16c', '#93d26c', '#e57373', '#c6a972', '#f5f3ef'];

interface Piece {
  id: number;
  left: string;
  width: string;
  height: string;
  bg: string;
  opacity: number;
  animDuration: string;
  animDelay: string;
}

export const Confetti: React.FC = () => {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    const newPieces: Piece[] = [];
    for (let i = 0; i < 150; i++) {
      newPieces.push({
        id: i,
        left: Math.random() * 100 + '%',
        width: Math.random() * 8 + 6 + 'px',
        height: Math.random() * 6 + 4 + 'px',
        bg: COLORS[Math.floor(Math.random() * COLORS.length)],
        opacity: Math.random() * 0.5 + 0.5,
        animDuration: (3 + Math.random() * 3) + 's',
        animDelay: (Math.random() * 1) + 's'
      });
    }
    setPieces(newPieces);
    
    // Cleanup pieces after animation (visually removed via styles, logic cleanup here)
    const timer = setTimeout(() => setPieces([]), 8000);
    return () => clearTimeout(timer);
  }, []);

  if (pieces.length === 0) return null;

  return (
    <div className="fixed top-0 left-0 w-full h-full pointer-events-none overflow-hidden z-50">
      {pieces.map((p) => (
        <div
          key={p.id}
          className="absolute animate-fall"
          style={{
            left: p.left,
            width: p.width,
            height: p.height,
            background: p.bg,
            opacity: p.opacity,
            animationDuration: p.animDuration,
            animationDelay: p.animDelay
          }}
        />
      ))}
    </div>
  );
};
