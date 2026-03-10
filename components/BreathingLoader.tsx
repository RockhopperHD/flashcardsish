import React, { useEffect, useState } from 'react';

type LoadingTip =
    | { type: 'tip'; text: string }
    | { type: 'quote'; text: string; author: string };

const LOADING_TIPS: LoadingTip[] = [
    { type: 'tip', text: 'You can drag sets into folders from the library.' },
    { type: 'tip', text: 'Markdown is the best.' },
    { type: 'tip', text: 'Use cues to organize individual cards.' },
    { type: 'tip', text: 'Use slabs for fill-in-the blank style cards.' },
    { type: 'tip', text: 'You can download sets for sharing.' },
    { type: 'tip', text: 'Flashcardsish can be fully offline... if you\'re hacky enough.' },
    { type: 'tip', text: 'Did you know this app was originally made to allow people to study on trains?' },
    { type: 'tip', text: 'Speedrun making cards with raw text; you can annotate them later.' },
    { type: 'tip', text: 'Editing cards mid-run helps them stick.' },
    { type: 'quote', text: 'Only you can fight Forest Flashcards.', author: 'A Confused Bear' },
    { type: 'quote', text: 'Cramming is bad. Not studying is bad-er.', author: 'Tudio, Flashcardsish Mascot' },
    { type: 'quote', text: 'Brown, huh?', author: 'Someone testing Flashcardsish' },
    { type: 'quote', text: 'Leaving feedback on apps you like gives you 50 years of clear skin.', author: 'Someone Smart, Maybe' },
    { type: 'tip', text: 'Reviewing just before you forget is where memory gets stronger.' },
    { type: 'tip', text: 'They\'re your flashcards -- annotate them!' },
    { type: 'tip', text: 'You don\'t have to tag sets, but it makes them much prettier.' },
];

const TIP_VISIBLE_MS = 5000;
const TIP_FADE_MS = 350;

const getRandomTipIndex = (excludeIndex = -1) => {
    if (LOADING_TIPS.length <= 1) {
        return 0;
    }

    let nextIndex = excludeIndex;
    while (nextIndex === excludeIndex) {
        nextIndex = Math.floor(Math.random() * LOADING_TIPS.length);
    }

    return nextIndex;
};

const BreathingLoader: React.FC = () => {
    const [currentTipIndex, setCurrentTipIndex] = useState(() => getRandomTipIndex());
    const [isTipVisible, setIsTipVisible] = useState(true);
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
    const currentTip = LOADING_TIPS[currentTipIndex];

    useEffect(() => {
        if (LOADING_TIPS.length <= 1) {
            return;
        }

        let fadeTimeoutId: number | undefined;

        const intervalId = window.setInterval(() => {
            setIsTipVisible(false);

            fadeTimeoutId = window.setTimeout(() => {
                setCurrentTipIndex((index) => getRandomTipIndex(index));
                setIsTipVisible(true);
            }, TIP_FADE_MS);
        }, TIP_VISIBLE_MS);

        return () => {
            window.clearInterval(intervalId);
            if (fadeTimeoutId !== undefined) {
                window.clearTimeout(fadeTimeoutId);
            }
        };
    }, []);

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
            <div
                className={`mt-8 min-h-[4.25rem] max-w-sm px-6 text-center font-sans transition-all ${isTipVisible ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'}`}
                style={{ transitionDuration: `${TIP_FADE_MS}ms` }}
            >
                <div className="text-sm leading-relaxed text-muted">
                    {currentTip.text}
                </div>
                {currentTip.type === 'quote' && (
                    <div className="mt-2 text-xs leading-snug text-muted/80">
                        {currentTip.author}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BreathingLoader;
