import React, { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { CursorTooltip } from './CursorTooltip';

interface StreakCornerBadgeProps {
   streak: number;
   isTooltipEnabled?: boolean;
   reduceMotion?: boolean;
   className?: string;
}

const STREAK_VISIBILITY_THRESHOLD = 3;
const STREAK_NUMBER_POP_MS = 280;
const STREAK_EXIT_MS = 220;
const SPIN_START_STREAK = 5;
const SPIN_MAX_STREAK = 50;
const SPIN_SLOW_DURATION = 62;
const SPIN_FAST_DURATION = 24;
const PARTICLE_LAYOUT = [
   { x: 50, y: 8, delay: '0ms' },
   { x: 50, y: 92, delay: '260ms' },
   { x: 12, y: 27, delay: '120ms' },
   { x: 88, y: 27, delay: '120ms' },
   { x: 18, y: 73, delay: '380ms' },
   { x: 82, y: 73, delay: '380ms' },
   { x: 29, y: 12, delay: '200ms' },
   { x: 71, y: 12, delay: '200ms' },
   { x: 29, y: 88, delay: '440ms' },
   { x: 71, y: 88, delay: '440ms' }
] as const;

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
   reduceMotion = false,
   className
}) => {
   const [numberPopActive, setNumberPopActive] = useState(false);
   const [isVisible, setIsVisible] = useState(streak >= STREAK_VISIBILITY_THRESHOLD);
   const [isExiting, setIsExiting] = useState(false);
   const [displayedStreak, setDisplayedStreak] = useState(
      streak >= STREAK_VISIBILITY_THRESHOLD ? streak : 0
   );
   const prevStreakRef = useRef(streak);
   const numberPopTimerRef = useRef<number | null>(null);

   const triggerNumberPop = () => {
      setNumberPopActive(false);

      requestAnimationFrame(() => {
         setNumberPopActive(true);

         if (numberPopTimerRef.current !== null) {
            window.clearTimeout(numberPopTimerRef.current);
         }

         numberPopTimerRef.current = window.setTimeout(() => {
            setNumberPopActive(false);
            numberPopTimerRef.current = null;
         }, STREAK_NUMBER_POP_MS);
      });
   };

   useEffect(() => {
      return () => {
         if (numberPopTimerRef.current !== null) {
            window.clearTimeout(numberPopTimerRef.current);
         }
      };
   }, []);

   useEffect(() => {
      const prevStreak = prevStreakRef.current;

      if (streak >= STREAK_VISIBILITY_THRESHOLD) {
         setDisplayedStreak(streak);
         setIsVisible(true);
         setIsExiting(false);

         if (prevStreak < STREAK_VISIBILITY_THRESHOLD || streak > prevStreak) {
            triggerNumberPop();
         }
      } else if (prevStreak >= STREAK_VISIBILITY_THRESHOLD) {
         setIsExiting(true);
         const timer = window.setTimeout(() => {
            setIsVisible(false);
            setIsExiting(false);
            setDisplayedStreak(0);
         }, STREAK_EXIT_MS);

         prevStreakRef.current = streak;
         return () => window.clearTimeout(timer);
      } else {
         setIsVisible(false);
         setIsExiting(false);
         setDisplayedStreak(0);
      }

      prevStreakRef.current = streak;
      return;
   }, [streak]);

   if (!isVisible && !isExiting) return null;

   const displayStreak = Math.min(99, displayedStreak);
   const isMaxed = displayedStreak >= 99;
   const isFilled = displayedStreak >= 5;
   const hasOutlineClone = displayedStreak >= 9;
   const hasHalo = displayedStreak >= 15;
   const hasParticles = displayedStreak >= 17;
   const spinProgress = Math.max(
      0,
      Math.min(
         1,
         (displayedStreak - SPIN_START_STREAK) / (SPIN_MAX_STREAK - SPIN_START_STREAK)
      )
   );
   const spinDurationSeconds = SPIN_SLOW_DURATION - ((SPIN_SLOW_DURATION - SPIN_FAST_DURATION) * spinProgress);
   const spinStyle = reduceMotion
      ? undefined
      : displayedStreak >= SPIN_START_STREAK
         ? { animation: `streakOrbitSpin ${spinDurationSeconds.toFixed(2)}s linear infinite` }
         : undefined;
   const haloSpinStyle = reduceMotion
      ? undefined
      : displayedStreak >= SPIN_START_STREAK
         ? { animation: `streakOrbitSpin ${(spinDurationSeconds * 1.35).toFixed(2)}s linear infinite reverse` }
         : undefined;
   const accentStroke = isMaxed ? 'white' : 'var(--accent)';
   const starColor = isMaxed ? 'white' : 'var(--yellow)';
   const tooltipMessage = displayedStreak >= 99
      ? 'Your streak knows no bounds -- only those with complete mastery of a vast amount of knowledge have reached this height.'
      : `You're on a ${displayStreak} streak!`;

   return (
      <CursorTooltip content={tooltipMessage} isEnabled={isTooltipEnabled}>
         <div
            className={clsx(
               'absolute -top-12 -right-12 z-20 pointer-events-auto',
               isExiting && 'streak-badge-exit',
               className
            )}
            aria-label={tooltipMessage}
         >
            <div className="relative w-[96px] h-[96px]">
               {hasParticles && (
                  <div className="absolute inset-[-12px] pointer-events-none">
                     {PARTICLE_LAYOUT.map((particle, index) => (
                        <span
                           key={`${particle.x}-${particle.y}-${index}`}
                           className="absolute block w-1.5 h-1.5 rounded-full streak-particle-pulse"
                           style={{
                              left: `${particle.x}%`,
                              top: `${particle.y}%`,
                              marginLeft: '-3px',
                              marginTop: '-3px',
                              backgroundColor: starColor,
                              boxShadow: `0 0 12px ${starColor}`,
                              animationDelay: particle.delay
                           }}
                        />
                     ))}
                  </div>
               )}

               <div className="absolute inset-0 streak-star-pop">
                  <div className="absolute inset-0" style={spinStyle}>
                     {hasOutlineClone && (
                        <svg className="absolute inset-0" viewBox="0 0 100 100" style={{ transform: 'rotate(22.5deg)' }}>
                           <path
                              d={EIGHT_POINT_STAR_PATH}
                              fill="transparent"
                              stroke={accentStroke}
                              strokeWidth="4"
                              strokeLinejoin="round"
                              strokeLinecap="round"
                           />
                        </svg>
                     )}

                     <svg className="absolute inset-0" viewBox="0 0 100 100">
                        <path
                           d={EIGHT_POINT_STAR_PATH}
                           fill={isFilled ? starColor : 'transparent'}
                           stroke={isFilled ? starColor : accentStroke}
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
               </div>

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
