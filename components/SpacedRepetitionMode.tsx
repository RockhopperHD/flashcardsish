import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Card, CardSet, Settings } from '../types';
import {
    ArrowLeft,
    Brain,
    CheckCircle2,
    Sparkles,
    RefreshCw,
    CalendarDays,
    X as XIcon,
    Triangle,
} from 'lucide-react';
import clsx from 'clsx';
import { renderInline, renderMarkdown, sanitizeImageUrl } from '../utils';

// ─── SM-2 Algorithm ──────────────────────────────────────────────────────────

/** 0 = Again, 1 = Hard, 2 = Good, 3 = Easy */
export type SR_Rating = 0 | 1 | 2 | 3;

const SM2_INITIAL_EASE = 2.5;
const SM2_MIN_EASE = 1.3;

const getDaysUntilTarget = (srTargetDate?: number): number | null => {
    if (!srTargetDate) return null;
    const diffMs = srTargetDate - Date.now();
    return Math.max(0, diffMs / (1000 * 60 * 60 * 24));
};

const applySM2 = (
    card: Card,
    rating: SR_Rating,
    daysUntilTarget: number | null = null
): Pick<Card, 'srInterval' | 'srEaseFactor' | 'srDueAt' | 'srReps'> => {
    const now = Date.now();
    const reps = card.srReps ?? 0;
    const interval = card.srInterval ?? 1;
    const ease = card.srEaseFactor ?? SM2_INITIAL_EASE;

    const quality = [1, 3, 4, 5][rating];

    let newInterval: number;
    let newReps: number;
    let newEase: number;

    if (quality < 3) {
        newReps = 0;
        newInterval = 1;
        newEase = ease;
    } else {
        if (reps === 0) newInterval = 1;
        else if (reps === 1) newInterval = 6;
        else newInterval = Math.round(interval * ease);

        newReps = reps + 1;
        newEase = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
        newEase = Math.max(SM2_MIN_EASE, newEase);

        if (daysUntilTarget !== null && daysUntilTarget > 0) {
            newInterval = Math.min(newInterval, Math.max(1, Math.floor(daysUntilTarget)));
        }
    }

    return {
        srInterval: newInterval,
        srEaseFactor: parseFloat(newEase.toFixed(3)),
        srDueAt: now + newInterval * 24 * 60 * 60 * 1000,
        srReps: newReps,
    };
};

const formatNextDue = (card: Card, rating: SR_Rating, daysUntilTarget: number | null): string => {
    if (rating === 0) return '< 1 day';
    const { srInterval } = applySM2(card, rating, daysUntilTarget);
    const d = srInterval ?? 1;
    if (d === 1) return '1 day';
    if (d < 7) return `${d} days`;
    const weeks = Math.round(d / 7);
    if (weeks === 1) return '1 week';
    if (d < 30) return `${weeks} weeks`;
    const months = Math.round(d / 30);
    return months === 1 ? '1 month' : `${months} months`;
};

const formatComeback = (dueAt: number): string => {
    const now = Date.now();
    const diffMs = dueAt - now;
    const diffHours = diffMs / (1000 * 60 * 60);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffHours < 1) return 'in a few minutes';
    if (diffHours < 24) { const h = Math.round(diffHours); return `in ${h} hour${h !== 1 ? 's' : ''}`; }
    if (diffDays < 2) return 'tomorrow';
    if (diffDays < 7) return `in ${Math.round(diffDays)} days`;
    if (diffDays < 14) return 'in 1 week';
    return `in ${Math.round(diffDays / 7)} weeks`;
};

// ─── Queue helpers ────────────────────────────────────────────────────────────

interface SessionCard {
    card: Card;
    isNew: boolean;
    isRequeue?: boolean;
    isCram?: boolean;
}

const buildReviewQueue = (
    cards: Card[],
    daysUntilTarget: number | null,
    shuffleCards: boolean
): SessionCard[] => {
    const now = Date.now();
    const cramMode = daysUntilTarget !== null && daysUntilTarget <= 2;

    let result: SessionCard[];
    if (cramMode) {
        result = cards.map(c => ({
            card: c,
            isNew: c.srDueAt === undefined,
            isCram: c.srDueAt !== undefined && c.srDueAt > now,
        }));
    } else {
        result = cards
            .filter(c => c.srDueAt === undefined || c.srDueAt <= now)
            .map(c => ({ card: c, isNew: c.srDueAt === undefined }));
    }

    if (shuffleCards) {
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
    }

    return result;
};

export const countDueCards = (cards: Card[]): number => {
    const now = Date.now();
    return cards.filter(c => c.srDueAt === undefined || c.srDueAt <= now).length;
};

export const getNextDueAt = (cards: Card[]): number | null => {
    const now = Date.now();
    const future = cards.filter(c => c.srDueAt !== undefined && c.srDueAt > now).map(c => c.srDueAt!);
    return future.length > 0 ? Math.min(...future) : null;
};

// ─── Dynamic text sizing ──────────────────────────────────────────────────────

const getTextSizeClass = (text: string): string => {
    const len = text.length;
    if (len > 200) return 'text-xl';
    if (len > 100) return 'text-2xl';
    if (len > 50) return 'text-3xl';
    return 'text-4xl';
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

const tsToDateStr = (ts: number): string => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const dateStrToTs = (str: string): number => {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d, 23, 59, 59).getTime();
};

// ─── SR Maturity Triangle ────────────────────────────────────────────────────
// Single triangle, color = interval maturity. Matches the size of Learn mode dots.

const SrTriangle: React.FC<{ card: Card }> = ({ card }) => {
    const interval = card.srInterval ?? 0;
    const reps = card.srReps ?? 0;

    let colorClass: string;
    if (reps === 0) {
        colorClass = 'text-muted/30';
    } else if (interval <= 3) {
        colorClass = 'text-red';
    } else if (interval <= 14) {
        colorClass = 'text-yellow';
    } else {
        colorClass = 'text-green';
    }

    return (
        <Triangle
            size={14}
            className={clsx('transition-colors duration-300', colorClass)}
            fill="currentColor"
            strokeWidth={0}
        />
    );
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

type Phase = 'setup' | 'active' | 'done';

export const SpacedRepetitionMode: React.FC<SpacedRepetitionModeProps> = ({
    set,
    settings,
    onExit,
    onUpdateSet,
}) => {
    // ── Setup ─────────────────────────────────────────────────────────────────
    const [phase, setPhase] = useState<Phase>('setup');
    const [setupDateStr, setSetupDateStr] = useState(() =>
        set.srTargetDate ? tsToDateStr(set.srTargetDate) : ''
    );

    // ── Session ───────────────────────────────────────────────────────────────
    const [sessionTargetDate, setSessionTargetDate] = useState<number | null>(null);
    const daysUntilTarget = useMemo(
        () => getDaysUntilTarget(sessionTargetDate ?? undefined),
        [sessionTargetDate]
    );
    const cramMode = daysUntilTarget !== null && daysUntilTarget <= 2;

    const [queue, setQueue] = useState<SessionCard[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isRevealed, setIsRevealed] = useState(false);
    const [sessionStats, setSessionStats] = useState({ again: 0, hard: 0, good: 0, easy: 0, total: 0 });
    const [nextReviewAt, setNextReviewAt] = useState<number | null>(null);

    const updatedCardsRef = useRef<Map<string, Card>>(new Map());
    const currentItem: SessionCard | undefined = queue[currentIndex];

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleStartSession = useCallback((withDate: boolean) => {
        const targetTs = withDate && setupDateStr ? dateStrToTs(setupDateStr) : undefined;
        const computedDays = getDaysUntilTarget(targetTs);
        const initialQueue = buildReviewQueue(set.cards, computedDays, settings.shuffleCards);
        setSessionTargetDate(targetTs ?? null);
        setQueue(initialQueue);
        onUpdateSet({ ...set, srTargetDate: targetTs });
        setPhase('active');
    }, [setupDateStr, set, onUpdateSet, settings.shuffleCards]);

    const handleExit = useCallback(() => {
        if (updatedCardsRef.current.size > 0) {
            const finalCards = set.cards.map(c => updatedCardsRef.current.get(c.id) ?? c);
            onUpdateSet({ ...set, cards: finalCards });
            updatedCardsRef.current.clear();
        }
        onExit();
    }, [set, onUpdateSet, onExit]);

    const handleReveal = useCallback(() => setIsRevealed(true), []);

    const handleRate = useCallback((rating: SR_Rating) => {
        if (!currentItem) return;

        const card = currentItem.card;
        const srUpdates = applySM2(card, rating, daysUntilTarget);
        const updatedCard: Card = { ...card, ...srUpdates };
        updatedCardsRef.current.set(card.id, updatedCard);

        const statKeys = ['again', 'hard', 'good', 'easy'] as const;
        setSessionStats(prev => ({
            ...prev,
            [statKeys[rating]]: prev[statKeys[rating]] + 1,
            total: prev.total + 1,
        }));

        if (rating === 0) {
            setQueue(prev => {
                const next = [...prev];
                next.splice(currentIndex, 1);
                next.push({ card: updatedCard, isNew: false, isRequeue: true });
                return next;
            });
            setIsRevealed(false);
            return;
        }

        const isLast = currentIndex >= queue.length - 1;
        if (isLast) {
            const now = Date.now();
            const dueTimes = [...updatedCardsRef.current.values()]
                .map(c => c.srDueAt ?? 0).filter(d => d > now);
            setNextReviewAt(dueTimes.length > 0 ? Math.min(...dueTimes) : null);
            const finalCards = set.cards.map(c => updatedCardsRef.current.get(c.id) ?? c);
            onUpdateSet({ ...set, cards: finalCards, srTargetDate: sessionTargetDate ?? undefined });
            updatedCardsRef.current.clear();
            setPhase('done');
        } else {
            setCurrentIndex(prev => prev + 1);
            setIsRevealed(false);
        }
    }, [currentItem, currentIndex, queue.length, daysUntilTarget, set, onUpdateSet, sessionTargetDate]);

    // ── Keyboard ──────────────────────────────────────────────────────────────

    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (phase !== 'active' || !currentItem) return;
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            if (!isRevealed) {
                if (e.code === 'Space' || e.key === 'Enter' || e.key === 'f' || e.key === 'F') {
                    e.preventDefault();
                    handleReveal();
                }
            } else {
                // Space does nothing once revealed — only ratings
                if (e.key === '1') { e.preventDefault(); handleRate(0); }
                else if (e.key === '2') { e.preventDefault(); handleRate(1); }
                else if (e.key === '3') { e.preventDefault(); handleRate(2); }
                else if (e.key === '4') { e.preventDefault(); handleRate(3); }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [phase, isRevealed, currentItem, handleReveal, handleRate]);

    // ── Setup screen ──────────────────────────────────────────────────────────

    if (phase === 'setup') {
        const setupDays = setupDateStr ? getDaysUntilTarget(dateStrToTs(setupDateStr)) : null;
        const isCramDate = setupDays !== null && setupDays <= 2;

        return (
            <div className="max-w-lg mx-auto w-full pt-4 pb-20 animate-in fade-in duration-300">
                <button
                    onClick={onExit}
                    className="mb-10 flex items-center gap-2 text-muted hover:text-text transition-colors font-bold uppercase text-xs tracking-wider group"
                >
                    <div className="p-2 rounded-full border border-outline group-hover:border-accent group-hover:bg-panel transition-colors">
                        <ArrowLeft size={16} />
                    </div>
                    Back
                </button>

                <div className="bg-panel border border-outline rounded-[24px] shadow-2xl p-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-3 rounded-xl bg-panel-2">
                            <Brain size={22} className="text-accent" />
                        </div>
                        <div>
                            <h2
                                className="text-2xl font-bold text-text leading-tight"
                                style={{ fontFamily: "'Red Hat Display', sans-serif" }}
                            >
                                Spaced Review
                            </h2>
                            <p className="text-xs text-muted">{set.name}</p>
                        </div>
                    </div>

                    <div className="my-8 border-t border-outline" />

                    <div className="mb-8">
                        <p className="text-sm font-bold text-text mb-1">Do you have a test or exam date?</p>
                        <p className="text-xs text-muted mb-5 leading-relaxed">
                            Setting a date adapts the algorithm — intervals are capped to fit, and cram mode activates when your test is 2 days away.
                        </p>

                        <div className="flex items-center gap-3">
                            <CalendarDays size={16} className="text-muted shrink-0" />
                            <input
                                type="date"
                                value={setupDateStr}
                                min={new Date().toISOString().split('T')[0]}
                                onChange={e => setSetupDateStr(e.target.value)}
                                className="flex-1 bg-panel-2 border border-outline rounded-xl px-4 py-2.5 text-sm text-text focus:border-accent focus:outline-none transition-colors"
                            />
                            {setupDateStr && (
                                <button
                                    onClick={() => setSetupDateStr('')}
                                    className="p-2 text-muted hover:text-red transition-colors"
                                    title="Clear date"
                                >
                                    <XIcon size={16} />
                                </button>
                            )}
                        </div>

                        {setupDateStr && setupDays !== null && (
                            <p className={clsx('text-xs mt-3 font-medium', isCramDate ? 'text-red' : 'text-muted')}>
                                {isCramDate
                                    ? `Test in ${Math.ceil(setupDays)} day${Math.ceil(setupDays) !== 1 ? 's' : ''} — cram mode will activate`
                                    : `${Math.ceil(setupDays)} day${Math.ceil(setupDays) !== 1 ? 's' : ''} until test`}
                            </p>
                        )}
                    </div>

                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => handleStartSession(true)}
                            className="w-full py-3.5 bg-accent text-bg font-bold rounded-xl hover:opacity-90 transition-opacity text-sm"
                        >
                            Start Review
                        </button>
                        {setupDateStr && (
                            <button
                                onClick={() => { setSetupDateStr(''); handleStartSession(false); }}
                                className="w-full py-3 border border-outline rounded-xl font-medium text-muted hover:text-text hover:border-accent transition-colors text-sm"
                            >
                                Start without a date
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ── All caught up ─────────────────────────────────────────────────────────

    if (phase === 'active' && queue.length === 0) {
        const nextDueAt = getNextDueAt(set.cards);
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-in fade-in duration-500">
                <div className="p-6 rounded-full bg-green/10 border border-green/20 mb-6">
                    <CheckCircle2 size={48} className="text-green" />
                </div>
                <h2
                    className="text-5xl font-bold text-text mb-4 tracking-tight"
                    style={{ fontFamily: "'Red Hat Display', sans-serif" }}
                >
                    All caught up!
                </h2>
                {nextDueAt ? (
                    <div className="mb-8">
                        <p className="text-xs font-bold text-muted uppercase tracking-widest mb-2">Next review</p>
                        <p className="text-3xl font-bold text-text">{formatComeback(nextDueAt)}</p>
                    </div>
                ) : (
                    <p className="text-muted mb-8 max-w-sm leading-relaxed">
                        No cards are due right now. Come back later to reinforce what you've learned.
                    </p>
                )}
                {sessionTargetDate && (
                    <p className="text-sm text-muted mb-6">
                        Test on {new Date(sessionTargetDate).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
                    </p>
                )}
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

    if (phase === 'done') {
        const accuracy = sessionStats.total > 0
            ? Math.round(((sessionStats.good + sessionStats.easy) / sessionStats.total) * 100)
            : 0;

        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4 animate-in fade-in duration-500">
                <h2
                    className="text-5xl font-bold text-text mb-4 tracking-tight"
                    style={{ fontFamily: "'Red Hat Display', sans-serif" }}
                >
                    Review Complete
                </h2>
                <div className="text-7xl font-bold text-accent mb-2" style={{ fontFamily: "'Red Hat Display', sans-serif" }}>
                    {accuracy}%
                </div>
                <p className="text-muted mb-10">
                    {sessionStats.total} reviewed &nbsp;·&nbsp; {sessionStats.good + sessionStats.easy} remembered
                </p>

                {nextReviewAt && (
                    <div className="mb-10 w-full max-w-xs">
                        <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">Next review</p>
                        <div className="bg-panel border border-outline rounded-[24px] shadow-2xl px-8 py-6">
                            <p className="text-4xl font-bold text-text" style={{ fontFamily: "'Red Hat Display', sans-serif" }}>
                                {formatComeback(nextReviewAt)}
                            </p>
                            {sessionTargetDate && (
                                <p className="text-xs text-muted mt-3">
                                    Test: {new Date(sessionTargetDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                <div className="flex items-center gap-6 text-sm mb-10 text-muted">
                    <span className="text-red font-bold">{sessionStats.again} again</span>
                    <span className="text-yellow font-bold">{sessionStats.hard} hard</span>
                    <span className="text-green font-bold">{sessionStats.good} good</span>
                    <span className="text-blue font-bold">{sessionStats.easy} easy</span>
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

    const card = currentItem!.card;
    const termText = Array.isArray(card.term) ? card.term[0] ?? '' : card.term;
    const termAliases = Array.isArray(card.term) ? card.term.slice(1) : [];
    const termImageUrl = sanitizeImageUrl(card.termImage);
    const defImageUrl = sanitizeImageUrl(card.image);
    const termLabel = set.termLabel || 'Term';
    const defLabel = set.definitionLabel || 'Definition';

    const againPending = queue.filter(c => c.isRequeue).length;
    const progressPercent = queue.length > 0 ? (currentIndex / queue.length) * 100 : 0;
    const termSizeClass = getTextSizeClass(termText);
    const defSizeClass = getTextSizeClass(card.content);

    const ratingConfig: Array<{ label: string; shortcut: string; colorClasses: string; rating: SR_Rating }> = [
        { label: 'Again', shortcut: '1', colorClasses: 'text-red border-red/30 hover:bg-red/10 hover:border-red/60', rating: 0 },
        { label: 'Hard',  shortcut: '2', colorClasses: 'text-yellow border-yellow/30 hover:bg-yellow/10 hover:border-yellow/60', rating: 1 },
        { label: 'Good',  shortcut: '3', colorClasses: 'text-green border-green/30 hover:bg-green/10 hover:border-green/60', rating: 2 },
        { label: 'Easy',  shortcut: '4', colorClasses: 'text-blue border-blue/30 hover:bg-blue/10 hover:border-blue/60', rating: 3 },
    ];

    return (
        <div className="max-w-2xl mx-auto w-full pb-20 animate-in fade-in duration-300">

            {/* ── Header ─────────────────────────────────────────────────────── */}
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
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-muted font-bold uppercase tracking-widest">Spaced Review</span>
                            {cramMode && <span className="text-xs font-bold text-red uppercase tracking-widest">· Cram</span>}
                            {sessionTargetDate && !cramMode && daysUntilTarget !== null && (
                                <span className="text-xs text-muted">· Test in {Math.ceil(daysUntilTarget)}d</span>
                            )}
                        </div>
                        <div className="flex items-center gap-3">
                            {againPending > 0 && (
                                <span className="flex items-center gap-1 text-xs text-red">
                                    <RefreshCw size={11} /> {againPending}
                                </span>
                            )}
                            <span className="text-xs font-mono text-muted">{currentIndex + 1} / {queue.length}</span>
                        </div>
                    </div>
                    <div className="h-1.5 bg-panel-2 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${progressPercent}%` }}
                        />
                    </div>
                </div>
            </div>

            {/* ── Card ───────────────────────────────────────────────────────── */}
            <div className="bg-panel border border-outline rounded-[24px] shadow-2xl p-10 mb-6">

                {/* Top row: term label | status badges + triangle */}
                <div className="flex justify-between items-center mb-8">
                    <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted">
                        {termLabel}
                    </span>
                    <div className="flex items-center gap-3">
                        {currentItem!.isNew && (
                            <span className="flex items-center gap-1 text-xs font-bold text-blue uppercase tracking-wider">
                                <Sparkles size={11} /> New
                            </span>
                        )}
                        {currentItem!.isCram && !currentItem!.isNew && (
                            <span className="flex items-center gap-1 text-xs font-bold text-red uppercase tracking-wider">
                                <CalendarDays size={11} /> Cram
                            </span>
                        )}
                        <SrTriangle card={card} />
                    </div>
                </div>

                {/* Term content */}
                <div className="min-h-[160px] flex flex-col justify-center">
                    {termImageUrl && (
                        <img
                            src={termImageUrl}
                            alt=""
                            className="rounded-xl max-h-[200px] w-auto object-contain border border-outline shadow-sm bg-bg/50 mb-6"
                        />
                    )}
                    <div className={clsx('font-medium leading-tight text-text font-sans text-left', termSizeClass)}>
                        {renderInline(termText, 'sr-term')}
                    </div>
                    {termAliases.length > 0 && (
                        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 text-sm text-muted">
                            {termAliases.map((a, i) => (
                                <span key={i}>{renderInline(a, `sr-alias-${i}`)}</span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Revealed: divider + definition */}
                {isRevealed && (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                        <div className="border-t border-outline/60 my-8" />
                        <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-muted block mb-6">
                            {defLabel}
                        </span>
                        {defImageUrl && (
                            <img
                                src={defImageUrl}
                                alt=""
                                className="rounded-xl max-h-[200px] w-auto object-contain border border-outline shadow-sm bg-bg/50 mb-6"
                            />
                        )}
                        <div className={clsx('font-medium leading-tight text-text font-sans text-left', defSizeClass)}>
                            {renderMarkdown(card.content)}
                        </div>
                        {card.year && (
                            <div className="mt-4 inline-block px-3 py-1 bg-accent/10 border border-accent/30 rounded-lg text-accent font-mono text-sm">
                                {card.year}
                            </div>
                        )}
                        {card.customFields && card.customFields.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-4">
                                {card.customFields.map(f => (
                                    <span key={f.name} className="px-3 py-1 bg-panel-2 border border-outline rounded-lg text-sm text-muted font-medium">
                                        <span className="text-xs font-bold uppercase tracking-wider opacity-70 mr-1">{f.name}:</span>
                                        {f.value}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Space hint when not yet revealed */}
                {!isRevealed && (
                    <div className="flex justify-end mt-8">
                        <div className="flex items-center gap-1.5 text-xs text-muted/35">
                            <kbd className="px-1.5 py-0.5 bg-panel-2 border border-outline/60 rounded text-xs">Space</kbd>
                            to reveal
                        </div>
                    </div>
                )}
            </div>

            {/* ── Below card ─────────────────────────────────────────────────── */}
            {isRevealed ? (
                <div className="animate-in fade-in duration-150">
                    <p className="text-xs text-muted uppercase tracking-widest font-bold mb-4 pl-1">
                        How well did you know this?
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                        {ratingConfig.map(cfg => (
                            <RatingBtn
                                key={cfg.rating}
                                label={cfg.label}
                                shortcut={cfg.shortcut}
                                nextDue={formatNextDue(card, cfg.rating, daysUntilTarget)}
                                colorClasses={cfg.colorClasses}
                                onClick={() => handleRate(cfg.rating)}
                            />
                        ))}
                    </div>
                </div>
            ) : (
                <button
                    onClick={handleReveal}
                    className="w-full py-5 bg-panel-2 border border-outline rounded-[24px] font-bold text-text hover:border-accent transition-colors shadow-sm text-lg"
                >
                    Show Answer
                </button>
            )}
        </div>
    );
};
