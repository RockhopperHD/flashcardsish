import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { CursorTooltip } from './CursorTooltip';

interface StreakCornerBadgeProps {
   streak: number;
   isTooltipEnabled?: boolean;
   className?: string;
}

const EIGHT_POINT_STAR_PATH = (() => {
   const cx = 50;
   const cy = 50;
   const outer = 42;
   const inner = 28;
   const points: string[] = [];

   for (let i = 0; i < 16; i += 1) {
      const angle = (-Math.PI / 2) + (i * Math.PI / 8);
      const r = i % 2 === 0 ? outer : inner;
      const x = cx + (Math.cos(angle) * r);
      const y = cy + (Math.sin(angle) * r);
      points.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
   }

   return `M ${points.join(' L ')} Z`;
})();

const SHALLOW_HALO_STAR_PATH = (() => {
   const cx = 50;
   const cy = 50;
   const outer = 44;
   const inner = 40;
   const points: string[] = [];

   for (let i = 0; i < 16; i += 1) {
      const angle = (-Math.PI / 2) + (i * Math.PI / 8);
      const r = i % 2 === 0 ? outer : inner;
      const x = cx + (Math.cos(angle) * r);
      const y = cy + (Math.sin(angle) * r);
      points.push(`${x.toFixed(2)} ${y.toFixed(2)}`);
   }

   return `M ${points.join(' L ')} Z`;
})();

export const StreakCornerBadge: React.FC<StreakCornerBadgeProps> = ({
   streak,
   isTooltipEnabled = true,
   className
}) => {
   if (streak < 3) return null;

   const [numberPopActive, setNumberPopActive] = useState(false);
   const prevStreakRef = useRef(streak);

   useEffect(() => {
      if (streak > prevStreakRef.current) {
         setNumberPopActive(true);
         const timer = window.setTimeout(() => setNumberPopActive(false), 280);
         prevStreakRef.current = streak;
         return () => window.clearTimeout(timer);
      }

      prevStreakRef.current = streak;
      return;
   }, [streak]);

   const displayStreak = Math.min(99, streak);
   const isMaxed = streak >= 99;
   const isFilled = streak >= 5;
   const isSpinning = streak >= 8;
   const hasOutlineClone = streak >= 11;
   const hasHalo = streak >= 14;
   const spinStyle = isSpinning ? { animation: 'streakOrbitSpin 20s linear infinite' } : undefined;
   const haloSpinStyle = { animation: 'streakOrbitSpin 26s linear infinite reverse' };
   const tooltipMessage = streak >= 99
      ? 'Your streak knows no bounds -- only those with complete mastery of a vast amount of knowledge have reached this height.'
      : `You're on a ${displayStreak} streak!`;

   return (
      <CursorTooltip content={tooltipMessage} isEnabled={isTooltipEnabled}>
         <div
            className={clsx(
               'absolute -top-12 -right-12 z-20 pointer-events-auto animate-in fade-in zoom-in-95 duration-500',
               className
            )}
            aria-label={tooltipMessage}
         >
            <div className="relative w-[96px] h-[96px]">
               <div className="absolute inset-0" style={spinStyle}>
                  {hasOutlineClone && (
                     <svg className="absolute inset-0" viewBox="0 0 100 100" style={{ transform: 'rotate(22.5deg)' }}>
                        <path
                           d={EIGHT_POINT_STAR_PATH}
                           fill="transparent"
                           stroke={isMaxed ? 'white' : 'var(--accent)'}
                           strokeWidth="4"
                           strokeLinejoin="round"
                           strokeLinecap="round"
                        />
                     </svg>
                  )}

                  <svg className="absolute inset-0" viewBox="0 0 100 100">
                     <path
                        d={EIGHT_POINT_STAR_PATH}
                        fill={isFilled ? (isMaxed ? 'white' : 'var(--yellow)') : 'transparent'}
                        stroke={isFilled ? (isMaxed ? 'white' : 'var(--yellow)') : (isMaxed ? 'white' : 'var(--accent)')}
                        strokeWidth="4"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                     />
                  </svg>
               </div>

               {hasHalo && (
                  <div className="absolute inset-[-6px]">
                     <svg className="absolute inset-0 pointer-events-none" viewBox="0 0 100 100" style={haloSpinStyle}>
                        <path
                           d={SHALLOW_HALO_STAR_PATH}
                           fill="none"
                           stroke={isMaxed ? 'white' : 'color-mix(in srgb, var(--yellow) 88%, white 12%)'}
                           strokeWidth="2.2"
                           strokeLinejoin="round"
                           strokeLinecap="round"
                           opacity={0.9}
                        />
                     </svg>
                     <svg className="absolute inset-[7px] pointer-events-none" viewBox="0 0 100 100" style={haloSpinStyle}>
                        <path
                           d={SHALLOW_HALO_STAR_PATH}
                           fill="none"
                           stroke={isMaxed ? 'white' : 'color-mix(in srgb, var(--yellow) 62%, transparent)'}
                           strokeWidth="1.7"
                           strokeLinejoin="round"
                           strokeLinecap="round"
                           opacity={0.8}
                        />
                     </svg>
                  </div>
               )}

               <div className={clsx(
                  'absolute inset-0 flex items-center justify-center text-[38px] font-black leading-none',
                  numberPopActive && 'streak-number-pop',
                  isFilled ? 'text-bg' : 'text-yellow'
               )}>
                  {displayStreak}
               </div>
            </div>
         </div>
      </CursorTooltip>
   );
};
