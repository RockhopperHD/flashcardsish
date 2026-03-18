import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardSet, Settings } from '../types';
import {
    ArrowLeft,
    Brain,
    CheckCircle2,
    Sparkles,
    RefreshCw,
    Clock,
} from 'lucide-react';
import clsx from 'clsx';
import { renderInline, renderMarkdown, sanitizeImageUrl } from '../utils';

// ─── SM-2 Algorithm ──────────────────────────────────────────────────────────

/** 0 = Again, 1 = Hard, 2 = Good, 3 = Easy */
export type SR_Rating = 0 | 1 | 2 | 3;

const SM2_INITIAL_EASE = 2.5;
const SM2_MIN_EASE = 1.3;

/** Apply one SM-2 step and return updated card fields. */
const applySM2 = (card: Card, rating: SR_Rating): Pick<Card, 'srInterval' | 'srEaseFactor' | 'srDueAt' | 'srReps'> => {
    const now = Date.now();
    const reps = card.srReps ?? 0;
    const interval = card.srInterval ?? 1;
    const ease = card.srEaseFactor ?? SM2_INITIAL_EASE;

    // Quality mapping  — Again=1, Hard=3, Good=4, Easy=5  (SM-2 uses 0-5 scale)
    const quality = [1, 3, 4, 5][rating];

    let newInterval: number;
    let newReps: number;
    let newEase: number;

    if (quality < 3) {
        // Failed — reset repetition count but keep ease (no extra penalty)
        newReps = 0;
        newInterval = 1;
        newEase = ease;
    } else {
        // Passed
        if (reps === 0) {
            newInterval = 1;
        } else if (reps === 1) {
            newInterval = 6;
        } else {
            newInterval = Math.round(interval * ease);
        }
        newReps = reps + 1;
        // Classic SM-2 ease adjustment
        newEase = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        newEase = Math.max(SM2_MIN_EASE, newEase);
    }

    const dueAt = now + newInterval * 24 * 60 * 60 * 1000;

    return {
        srInterval: newInterval,
        srEaseFactor: parseFloat(newEase.toFixed(3)),
        srDueAt: dueAt,
        srReps: newReps,
    };
};

/** Human-readable label for when a card will next be due, given proposed SR updates. */
const formatNextDue = (card: Card, rating: SR_Rating): string => {
    if (rating === 0) return '< 1 day';
    const { srInterval } = applySM2(card, rating);
    const d = srInterval ?? 1;
    if (d === 1) return '1 day';
    if (d < 7) return `${d} days`;
    const weeks = Math.round(d / 7);
    if (weeks === 1) return '1 week';
    if (d < 30) return `${weeks} weeks`;
    const months = Math.round(d / 30);
    return months === 1 ? '1 month' : `${months} months`;
};

// ─── Queue helpers ────────────────────────────────────────────────────────────

interface SessionCard {
    card: Card;
    isNew: boolean;
    isRequeue?: boolean; // true if card was pushed back after "Again"
}

/** Cards that belong in this review session: new (never scheduled) + currently due. */
const buildReviewQueue = (cards: Card[]): SessionCard[] => {
    const now = Date.now();
    return cards
        .filter(c => c.srDueAt === undefined || c.srDueAt <= now)
        .map(c => ({ card: c, isNew: c.srDueAt === undefined }));
};

/** Count how many cards in a set are due right now (new + overdue). */
export const countDueCards = (cards: Card[]): number => {
    const now = Date.now();
    return cards.filter(c => c.srDueAt === undefined || c.srDueAt <= now).length;
};

// ─── Rating Button ────────────────────────────────────────────────────────────

interface RatingBtnProps {
    label: string;
    shortcut: string;
    nextDue: string;
    colorClasses: string;
    onClick: () => void;
}

const RatingBtn: React.FC<RatingBtnProps> = ({ label, shortcut, nextDue, colorClasses, onClick }) => (
    <button
        onClick={onClick}
        className={clsx(
            'flex flex-col items-center gap-1.5 py-4 px-2 border-2 rounded-xl transition-all duration-150 font-bold focus:outline-none focus:ring-2 focus:ring-accent/40',
            colorClasses,
        )}
    >
        <span className="text-sm">{label}</span>
        <kbd className="text-xs font-mono bg-panel border border-outline px-1.5 py-0.5 rounded opacity-70">
            {shortcut}
        </kbd>
        <span className="text-xs font-normal opacity-70">{nextDue}</span>
    </button>
);

// ─── Main Component ───────────────────────────────────────────────────────────

interface SpacedRepetitionModeProps {
    set: CardSet;
    settings: Settings;
    onExit: () => void;
    onUpdateSet: (set: CardSet) => void;
}

export const SpacedRepetitionMode: React.FC<SpacedRepetitionModeProps> = ({
    set,
    settings,
    onExit,
    onUpdateSet,
}) => {
    // Build queue once on mount (we don't rebuild mid-session)
    const [queue, setQueue] = useState<SessionCard[]>(() => buildReviewQueue(set.cards));
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [isDone, setIsDone] = useState(false);
    const [sessionStats, setSessionStats] = useState({ again: 0, hard: 0, good: 0, easy: 0, total: 0 });

    // Use a ref so we can read the latest updates synchronously in handleRate
    const updatedCardsRef = useRef<Map<string, Card>>(new Map());

    const currentItem: SessionCard | undefined = queue[currentIndex];

    // ── Exit (flush any partial progress) ────────────────────────────────────

    const handleExit = useCallback(() => {
        if (updatedCardsRef.current.size > 0) {
            const finalCards = set.cards.map(c => updatedCardsRef.current.get(c.id) ?? c);
            onUpdateSet({ ...set, cards: finalCards });
            updatedCardsRef.current.clear();
        }
        onExit();
    }, [set, onUpdateSet, onExit]);

    // ── Flip ──────────────────────────────────────────────────────────────────

    const handleFlip = useCallback(() => {
        setIsFlipped(prev => !prev);
    }, []);

    // ── Rate ──────────────────────────────────────────────────────────────────

    const handleRate = useCallback((rating: SR_Rating) => {
        if (!currentItem) return;

        const card = currentItem.card;
        const srUpdates = applySM2(card, rating);
        const updatedCard: Card = { ...card, ...srUpdates };

        // Persist the update in the ref (synchronous — no stale closure issues)
        updatedCardsRef.current.set(card.id, updatedCard);

        // Update session stats
        const statKeys = ['again', 'hard', 'good', 'easy'] as const;
        setSessionStats(prev => ({
            ...prev,
            [statKeys[rating]]: prev[statKeys[rating]] + 1,
            total: prev.total + 1,
        }));

        if (rating === 0) {
            // "Again" — remove from current position and re-queue at end
            setQueue(prev => {
                const next = [...prev];
                next.splice(currentIndex, 1);
                next.push({ card: updatedCard, isNew: false, isRequeue: true });
                return next;
            });
            setIsFlipped(false);
            // Don't advance currentIndex — the card that was at currentIndex+1
            // is now at currentIndex after the splice.
            return;
        }

        // Good / Hard / Easy — check if this was the last card
        const isLast = currentIndex >= queue.length - 1;
        if (isLast) {
            // Flush all SR updates back to the set, then clear the ref
            const finalCards = set.cards.map(c => updatedCardsRef.current.get(c.id) ?? c);
            onUpdateSet({ ...set, cards: finalCards });
            updatedCardsRef.current.clear();
            setIsDone(true);
        } else {
            setCurrentIndex(prev => prev + 1);
            setIsFlipped(false);
        }
    }, [currentItem, currentIndex, queue.length, set, onUpdateSet]);

    // ── Keyboard shortcuts ────────────────────────────────────────────────────

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (isDone || !currentItem) return;
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (!isFlipped) {
                if (e.code === 'Space' || e.key === 'Enter' || e.key === 'f' || e.key === 'F') {
                    e.preventDefault();
                    handleFlip();
                }
            } else {
                if (e.key === '1') { e.preventDefault(); handleRate(0); }
                else if (e.key === '2') { e.preventDefault(); handleRate(1); }
                else if (e.key === '3') { e.preventDefault(); handleRate(2); }
                else if (e.key === '4') { e.preventDefault(); handleRate(3); }
                else if (e.code === 'Space') { e.preventDefault(); handleFlip(); }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isDone, isFlipped, currentItem, handleFlip, handleRate]);

    // ── Empty state (nothing due) ─────────────────────────────────────────────

    if (queue.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-in fade-in duration-500">
                <div className="p-6 rounded-full bg-green/10 border border-green/20 mb-6">
                    <CheckCircle2 size={48} className="text-green" />
                </div>
                <h2
                    className="text-3xl font-bold text-text mb-3"
                    style={{ fontFamily: "'Red Hat Display', sans-serif" }}
                >
                    All caught up!
                </h2>
                <p className="text-muted mb-8 max-w-sm leading-relaxed">
                    No cards are due for review right now. Come back later to reinforce what you've learned.
                </p>
                <button
                    onClick={handleExit}
                    className="flex items-center gap-2 px-6 py-3 bg-panel-2 border border-outline rounded-xl font-bold hover:border-accent transition-colors"
                >
                    <ArrowLeft size={18} /> Back to Set
                </button>
            </div>
        );
    }

    // ── Session complete ──────────────────────────────────────────────────────

    if (isDone) {
        const accuracy = sessionStats.total > 0
            ? Math.round(((sessionStats.good + sessionStats.easy) / sessionStats.total) * 100)
            : 0;

        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-in fade-in duration-500">
                <div className="p-6 rounded-full bg-accent/10 border border-accent/30 mb-6">
                    <Brain size={48} className="text-accent" />
                </div>
                <h2
                    className="text-3xl font-bold text-accent mb-2"
                    style={{ fontFamily: "'Red Hat Display', sans-serif" }}
                >
                    Review Complete
                </h2>
                <p className="text-muted mb-8">{sessionStats.total} card{sessionStats.total !== 1 ? 's' : ''} reviewed</p>

                {/* Stats grid */}
                <div className="grid grid-cols-3 gap-3 w-full max-w-xs mb-8">
                    <div className="col-span-3 bg-panel-2 border border-outline rounded-xl p-4 flex items-center justify-between">
                        <div>
                            <div className="text-2xl font-bold text-text">{accuracy}%</div>
                            <div className="text-xs text-muted mt-0.5">Accuracy</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-text">{sessionStats.total}</div>
                            <div className="text-xs text-muted mt-0.5">Reviewed</div>
                        </div>
                        <div>
                            <div className="text-2xl font-bold text-green">{sessionStats.good + sessionStats.easy}</div>
                            <div className="text-xs text-muted mt-0.5">Remembered</div>
                        </div>
                    </div>
                    <div className="bg-red/10 border border-red/20 rounded-xl p-3 text-center">
                        <div className="text-xl font-bold text-red">{sessionStats.again}</div>
                        <div className="text-xs text-muted mt-1">Again</div>
                    </div>
                    <div className="bg-yellow/10 border border-yellow/20 rounded-xl p-3 text-center">
                        <div className="text-xl font-bold text-yellow">{sessionStats.hard}</div>
                        <div className="text-xs text-muted mt-1">Hard</div>
                    </div>
                    <div className="bg-green/10 border border-green/20 rounded-xl p-3 text-center">
                        <div className="text-xl font-bold text-green">{sessionStats.good}</div>
                        <div className="text-xs text-muted mt-1">Good</div>
                    </div>
                </div>

                <button
                    onClick={handleExit}
                    className="flex items-center gap-2 px-6 py-3 bg-panel-2 border border-outline rounded-xl font-bold hover:border-accent transition-colors"
                >
                    <ArrowLeft size={18} /> Back to Set
                </button>
            </div>
        );
    }

    // ── Active session ────────────────────────────────────────────────────────

    const card = currentItem.card;
    const termText = Array.isArray(card.term) ? card.term[0] ?? '' : card.term;
    const termAliases = Array.isArray(card.term) ? card.term.slice(1) : [];
    const termImageUrl = sanitizeImageUrl(card.termImage);
    const defImageUrl = sanitizeImageUrl(card.image);
    const termLabel = set.termLabel || 'Term';
    const defLabel = set.definitionLabel || 'Definition';

    // How many "Again" re-queued cards are still pending (not yet resolved)
    const againPending = queue.filter(c => c.isRequeue).length;
    const progressPercent = queue.length > 0 ? (currentIndex / queue.length) * 100 : 0;

    const ratingConfig: Array<{ label: string; shortcut: string; colorClasses: string; rating: SR_Rating }> = [
        {
            label: 'Again',
            shortcut: '1',
            colorClasses: 'text-red border-red/30 hover:bg-red/10 hover:border-red/60 focus:ring-red/30',
            rating: 0,
        },
        {
            label: 'Hard',
            shortcut: '2',
            colorClasses: 'text-yellow border-yellow/30 hover:bg-yellow/10 hover:border-yellow/60 focus:ring-yellow/30',
            rating: 1,
        },
        {
            label: 'Good',
            shortcut: '3',
            colorClasses: 'text-green border-green/30 hover:bg-green/10 hover:border-green/60 focus:ring-green/30',
            rating: 2,
        },
        {
            label: 'Easy',
            shortcut: '4',
            colorClasses: 'text-blue border-blue/30 hover:bg-blue/10 hover:border-blue/60 focus:ring-blue/30',
            rating: 3,
        },
    ];

    return (
        <div className="max-w-2xl mx-auto w-full pb-20 animate-in fade-in duration-300">

            {/* ── Header row ─────────────────────────────────────────────────── */}
            <div className="flex items-center gap-4 mb-6">
                <button
                    onClick={handleExit}
                    className="flex items-center gap-2 text-muted hover:text-text transition-colors font-bold uppercase text-xs tracking-wider group shrink-0"
                >
                    <div className="p-2 rounded-full border border-outline group-hover:border-accent group-hover:bg-panel transition-colors">
                        <ArrowLeft size={16} />
                    </div>
                    Exit
                </button>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-muted font-bold uppercase tracking-widest">Spaced Review</span>
                        <span className="text-xs font-mono text-muted">{currentIndex + 1} / {queue.length}</span>
                    </div>
                    <div className="h-1.5 bg-panel-2 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* ── Card badge row ─────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 mb-3 h-5">
                {currentItem.isNew && (
                    <div className="flex items-center gap-1.5 text-xs font-bold text-blue uppercase tracking-widest">
                        <Sparkles size={12} />
                        New
                    </div>
                )}
                {!currentItem.isNew && card.srInterval !== undefined && (
                    <div className="flex items-center gap-1.5 text-xs text-muted">
                        <Clock size={12} />
                        Was every {card.srInterval} day{card.srInterval !== 1 ? 's' : ''}
                    </div>
                )}
                {againPending > 0 && (
                    <div className="flex items-center gap-1 text-xs text-red ml-auto">
                        <RefreshCw size={12} />
                        {againPending} to retry
                    </div>
                )}
            </div>

            {/* ── Flashcard ──────────────────────────────────────────────────── */}
            <div
                className={clsx(
                    'relative cursor-pointer select-none mb-6 min-h-[260px]',
                    'bg-panel-2 border-2 rounded-2xl p-8',
                    'flex flex-col items-center justify-center',
                    'transition-all duration-200',
                    isFlipped ? 'border-accent/40' : 'border-outline hover:border-accent/30',
                )}
                onClick={handleFlip}
                role="button"
                tabIndex={0}
                aria-label={isFlipped ? 'Card back — click to flip' : 'Card front — click to flip'}
                onKeyDown={e => {
                    if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        handleFlip();
                    }
                }}
            >
                {/* Side label */}
                <div className="absolute top-4 left-0 right-0 flex justify-center">
                    <span className="text-xs font-bold text-muted uppercase tracking-widest">
                        {isFlipped ? defLabel : termLabel}
                    </span>
                </div>

                {/* Content */}
                <div className="flex flex-col items-center gap-4 w-full mt-4">
                    {!isFlipped ? (
                        <>
                            {termImageUrl && (
                                <img
                                    src={termImageUrl}
                                    alt=""
                                    className="max-h-36 max-w-full object-contain rounded-lg"
                                />
                            )}
                            <div className="text-2xl text-text text-center leading-relaxed font-bold">
                                {renderInline(termText, 'sr-term')}
                            </div>
                            {termAliases.length > 0 && (
                                <div className="flex flex-wrap justify-center gap-x-2 gap-y-1 text-sm text-muted text-center">
                                    {termAliases.map((a, i) => (
                                        <span key={i}>{renderInline(a, `sr-alias-${i}`)}</span>
                                    ))}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            {defImageUrl && (
                                <img
                                    src={defImageUrl}
                                    alt=""
                                    className="max-h-36 max-w-full object-contain rounded-lg"
                                />
                            )}
                            <div className="text-lg text-text text-center leading-relaxed w-full">
                                {renderMarkdown(card.content)}
                            </div>
                            {card.year && (
                                <div className="text-sm text-muted">Year: {card.year}</div>
                            )}
                            {card.customFields && card.customFields.length > 0 && (
                                <div className="flex flex-wrap gap-2 justify-center mt-1">
                                    {card.customFields.map(f => (
                                        <span key={f.name} className="text-xs bg-panel border border-outline px-2 py-1 rounded-lg text-muted">
                                            <span className="opacity-60">{f.name}:</span> {f.value}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>

                {/* Flip hint (only before flipping) */}
                {!isFlipped && (
                    <div className="absolute bottom-4 flex items-center gap-1.5 text-xs text-muted/50">
                        <kbd className="px-1.5 py-0.5 bg-panel border border-outline rounded text-xs">Space</kbd>
                        to flip
                    </div>
                )}
            </div>

            {/* ── Rating buttons / Show Answer ───────────────────────────────── */}
            {isFlipped ? (
                <div>
                    <p className="text-xs text-muted text-center uppercase tracking-widest font-bold mb-4">
                        How well did you know this?
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                        {ratingConfig.map(cfg => (
                            <RatingBtn
                                key={cfg.rating}
                                label={cfg.label}
                                shortcut={cfg.shortcut}
                                nextDue={formatNextDue(card, cfg.rating)}
                                colorClasses={cfg.colorClasses}
                                onClick={() => handleRate(cfg.rating)}
                            />
                        ))}
                    </div>
                </div>
            ) : (
                <div className="flex justify-center">
                    <button
                        onClick={handleFlip}
                        className="px-8 py-3 bg-accent text-bg rounded-xl font-bold hover:bg-accent/90 transition-colors flex items-center gap-2"
                    >
                        Show Answer
                    </button>
                </div>
            )}
        </div>
    );
};
