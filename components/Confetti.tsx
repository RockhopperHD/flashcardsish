
import React, { useEffect, useRef } from 'react';

const COLORS = ['#d0a45e', '#f5c16c', '#93d26c', '#e57373', '#c6a972', '#f5f3ef'];

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  swing?: number;
  swingSpeed?: number;
  drag?: number;
}

interface ConfettiProps {
  mode?: 'burst' | 'rain';
  duration?: number;
}

export const Confetti: React.FC<ConfettiProps> = ({ mode = 'burst', duration = 4000 }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const animationId = useRef<number>(0);
  const startTime = useRef<number>(Date.now());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();

    // Init Particles
    const createParticles = () => {
      const count = mode === 'burst' ? 120 : 150;

      for (let i = 0; i < count; i++) {
        if (mode === 'burst') {
          // Burst from center
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 15 + 8;
          particles.current.push({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 8, // upward bias
            w: Math.random() * 10 + 5,
            h: Math.random() * 10 + 5,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 12,
            drag: 0.97
          });
        } else {
          // Rain from top
          particles.current.push({
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight * -1,
            vx: 0,
            vy: Math.random() * 3 + 2,
            w: Math.random() * 8 + 4,
            h: Math.random() * 8 + 4,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 4,
            swing: Math.random() * Math.PI * 2,
            swingSpeed: Math.random() * 0.05 + 0.02
          });
        }
      }
    };

    createParticles();
    startTime.current = Date.now();

    // Loop
    const loop = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const elapsed = Date.now() - startTime.current;
      const shouldRecycle = mode === 'rain' && elapsed < duration;

      particles.current.forEach((p) => {
        if (mode === 'burst') {
          // Burst physics
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.4; // Gravity
          p.vx *= p.drag!;
          p.vy *= p.drag!;
        } else {
          // Rain physics
          p.swing! += p.swingSpeed!;
          p.vx = Math.sin(p.swing!) * 2;
          p.x += p.vx;
          p.y += p.vy;
        }
        p.rotation += p.rotationSpeed;

        // Draw
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();

        // Recycle rain particles (only if within duration)
        if (shouldRecycle && p.y > canvas.height + 20) {
          p.y = -20;
          p.x = Math.random() * canvas.width;
          p.vy = Math.random() * 3 + 2;
        }
      });

      // Stop loop if all particles are off screen
      const activeParticles = particles.current.filter(p => p.y < canvas.height + 100);
      if (activeParticles.length > 0) {
        animationId.current = requestAnimationFrame(loop);
      }
    };

    loop();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId.current);
    };
  }, [mode, duration]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[100]"
    />
  );
};
