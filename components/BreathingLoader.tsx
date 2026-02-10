import React from 'react';

const BreathingLoader: React.FC = () => {
    const crests = [
        { count: 8, offset: false },
        { count: 16, offset: false },
        { count: 16, offset: true },
        { count: 16, offset: false },
        { count: 16, offset: true },
        { count: 16, offset: false },
    ];
    const circleSize = 3;
    const amp = 12;

    // Total duration of one breathe cycle
    const DURATION = 1; // seconds

    return (
        <div className="flex flex-col items-center justify-center py-20 animate-in fade-in duration-700">
            <svg width="200" height="200" viewBox="0 0 200 200" className="text-accent">
                <style>
                    {`
            @keyframes breathe-translate {
              0% {
                transform: translateX(var(--r));
              }
              100% {
                transform: translateX(calc(var(--r) * 0.2)); /* Contract to center */
              }
            }
            @keyframes breathe-scale {
              0% {
                r: ${circleSize}px;
              }
              100% {
                r: ${circleSize / 4}px;
              }
            }
            .loader-dot-group {
              animation: breathe-translate ${DURATION}s ease-in-out infinite alternate;
            }
            .loader-dot {
              animation: breathe-scale ${DURATION}s ease-in-out infinite alternate;
              fill: currentColor;
            }
            .loader-nucleus {
               animation: breathe-scale ${DURATION}s ease-in-out infinite alternate;
               fill: currentColor;
            }
          `}
                </style>
                <g transform="translate(100, 100)">
                    {/* Center Nucleus */}
                    <circle cx="0" cy="0" r={circleSize} className="loader-nucleus" style={{ animationDelay: '0s' }} />

                    {crests.map((crest, crestIdx) => {
                        const radius = amp + (amp * crestIdx);
                        // Stagger delay based on distance from center
                        const delay = (0.8 * (crestIdx + 1) / crests.length) * -1; // Negative delay to start mid-animation if needed, or positive? 
                        // GSAP delay was just delay. User's code: delay: 0.8 * (idx + 1) / crests.length
                        // With CSS infinite alternate, a positive delay offsets the start time.
                        const delayStyle = `${delay}s`;

                        return Array.from({ length: crest.count }).map((_, i) => {
                            const theta = (2 * Math.PI) / crest.count;
                            const delta = crest.offset ? theta / 2 : 0;
                            const angle = (theta * i) + delta;
                            const deg = (angle * 180) / Math.PI;

                            return (
                                <g key={`${crestIdx}-${i}`} transform={`rotate(${deg})`}>
                                    <g
                                        className="loader-dot-group"
                                        style={{
                                            '--r': `${radius}px`,
                                            animationDelay: delayStyle
                                        } as React.CSSProperties}
                                    >
                                        <circle r={circleSize} className="loader-dot" style={{ animationDelay: delayStyle }} />
                                    </g>
                                </g>
                            );
                        });
                    })}
                </g>
            </svg>
            <div className="mt-8 text-muted font-bold animate-pulse tracking-widest uppercase text-xs">
                Loading Library...
            </div>
        </div>
    );
};

export default BreathingLoader;
