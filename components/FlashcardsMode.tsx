import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardSet, Settings } from '../types';
import { renderMarkdown, renderInline } from '../utils';
import {
    ArrowLeft,
    ArrowRight,
    Shuffle,
    RotateCcw,
    Undo2,
    Layers,
    CheckCircle2,
    XCircle,
    ChevronLeft
} from 'lucide-react';
import clsx from 'clsx';
import { Confetti } from './Confetti';

// Encouraging messages for round completion
const ROUND_MESSAGES = [
    "Nice Progress!",
    "Keep it up!",
    "Doing great!",
    "On a roll!",
    "Excellent work!",
    "Knowledge is power!",
    "You're crushing it!",
    "Way to go!",
    "Making strides!",
    "Steady progress!"
];

interface FlashcardsModeProps {
    set: CardSet;
    settings: Settings;
    onExit: () => void;
    onUpdateSet: (set: CardSet) => void;
}

type FlashcardsSubMode = 'stack' | 'sort';

interface SortState {
    reviewPile: Card[];
    gotItPile: Card[];
    history: { card: Card; action: 'review' | 'gotIt' }[];
}

export const FlashcardsMode: React.FC<FlashcardsModeProps> = ({
    set,
    settings,
    onExit,
    onUpdateSet
}) => {
    // Sub-mode selection
    const [subMode, setSubMode] = useState<FlashcardsSubMode | null>(null);

    // Card state
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [shuffled, setShuffled] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [stackCompleted, setStackCompleted] = useState(false);
    const [slideDir, setSlideDir] = useState<'next' | 'prev' | null>(null);

    // Cards to study (respecting starred only setting)
    const baseCards = useMemo(() => {
        let cards = [...set.cards];
        if (settings.starredOnly) {
            cards = cards.filter(c => c.star);
        }
        return cards;
    }, [set.cards, settings.starredOnly]);

    // Working deck (can be shuffled)
    const [deck, setDeck] = useState<Card[]>(baseCards);

    // Sort mode state
    const [sortState, setSortState] = useState<SortState>({
        reviewPile: [],
        gotItPile: [],
        history: []
    });
    const [sortRound, setSortRound] = useState(1);
    const [sortCompleted, setSortCompleted] = useState(false);
    const [isRoundFinished, setIsRoundFinished] = useState(false);

    // Reset deck when base cards change
    useEffect(() => {
        setDeck(baseCards);
        setCurrentIndex(0);
        setIsFlipped(false);
    }, [baseCards]);

    // Current card
    const currentCard = deck[currentIndex] || null;

    // Determine which side to show based on settings
    const showTermFirst = settings.answerWithDefinition; // If answering with def, show term first

    const frontContent = useMemo(() => {
        if (!currentCard) return null;
        return showTermFirst ? currentCard.term.join(' / ') : currentCard.content;
    }, [currentCard, showTermFirst]);

    const backContent = useMemo(() => {
        if (!currentCard) return null;
        return showTermFirst ? currentCard.content : currentCard.term.join(' / ');
    }, [currentCard, showTermFirst]);

    // Memoize a random message when round finishes
    const roundMessage = useMemo(() => {
        if (!isRoundFinished) return "";
        const randomIndex = Math.floor(Math.random() * ROUND_MESSAGES.length);
        return ROUND_MESSAGES[randomIndex];
    }, [isRoundFinished]);

    // Shuffle the deck
    const handleShuffle = useCallback(() => {
        const shuffledDeck = [...deck];
        for (let i = shuffledDeck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledDeck[i], shuffledDeck[j]] = [shuffledDeck[j], shuffledDeck[i]];
        }
        setDeck(shuffledDeck);
        setCurrentIndex(0);
        setIsFlipped(false);
        setShuffled(true);
    }, [deck]);

    // Stack mode navigation
    const goNext = useCallback(() => {
        if (currentIndex < deck.length - 1) {
            setSlideDir('next');
            setTimeout(() => {
                setCurrentIndex(currentIndex + 1);
                setIsFlipped(false);
                setSlideDir(null);
            }, 100);
        } else {
            // Finished the stack
            setStackCompleted(true);
            setShowConfetti(true);
            setTimeout(() => setShowConfetti(false), 4000);
        }
    }, [currentIndex, deck.length]);

    const goPrev = useCallback(() => {
        if (currentIndex > 0) {
            setSlideDir('prev');
            setTimeout(() => {
                setCurrentIndex(currentIndex - 1);
                setIsFlipped(false);
                setSlideDir(null);
            }, 100);
        }
    }, [currentIndex]);

    // Flip card
    const flipCard = useCallback(() => {
        setIsFlipped(!isFlipped);
    }, [isFlipped]);

    // Toggle star
    const toggleStar = useCallback(() => {
        if (!currentCard) return;
        const newCards = set.cards.map(c =>
            c.id === currentCard.id ? { ...c, star: !c.star } : c
        );
        onUpdateSet({ ...set, cards: newCards });
    }, [currentCard, set, onUpdateSet]);

    // Sort mode actions
    const startNextRound = useCallback(() => {
        if (sortState.reviewPile.length > 0) {
            setDeck(sortState.reviewPile);
            setCurrentIndex(0);
            setIsFlipped(false);
            setSortRound(r => r + 1);
            setSortState(prev => ({
                reviewPile: [],
                gotItPile: prev.gotItPile,
                history: []
            }));
            setIsRoundFinished(false);
        } else {
            // All cards in Got It pile - show completion with burst confetti
            setSortCompleted(true);
            setShowConfetti(true);
            setIsRoundFinished(true);
            setTimeout(() => setShowConfetti(false), 4000);
        }
    }, [sortState.reviewPile]);

    const sortReview = useCallback(() => {
        if (!currentCard || isRoundFinished) return;
        setSortState(prev => ({
            ...prev,
            reviewPile: [...prev.reviewPile, currentCard],
            history: [...prev.history, { card: currentCard, action: 'review' }]
        }));

        if (currentIndex < deck.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setIsFlipped(false);
        } else {
            setIsRoundFinished(true);
        }
    }, [currentCard, currentIndex, deck.length, isRoundFinished]);

    const sortGotIt = useCallback(() => {
        if (!currentCard || isRoundFinished) return;
        setSortState(prev => ({
            ...prev,
            gotItPile: [...prev.gotItPile, currentCard],
            history: [...prev.history, { card: currentCard, action: 'gotIt' }]
        }));

        if (currentIndex < deck.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setIsFlipped(false);
        } else {
            // Last card - check if review pile is empty (all cards mastered)
            if (sortState.reviewPile.length === 0) {
                // All cards in Got It pile - immediate completion
                setSortCompleted(true);
                setShowConfetti(true);
                setIsRoundFinished(true);
                setTimeout(() => setShowConfetti(false), 4000);
            } else {
                setIsRoundFinished(true);
            }
        }
    }, [currentCard, currentIndex, deck.length, isRoundFinished, sortState.reviewPile.length]);

    const sortUndo = useCallback(() => {
        if (sortState.history.length === 0) return;

        if (isRoundFinished) {
            setIsRoundFinished(false);
            // Current index stays at deck.length - 1
        } else if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }

        const lastAction = sortState.history[sortState.history.length - 1];
        const newHistory = sortState.history.slice(0, -1);

        if (lastAction.action === 'review') {
            setSortState(prev => ({
                ...prev,
                reviewPile: prev.reviewPile.slice(0, -1),
                history: newHistory
            }));
        } else {
            setSortState(prev => ({
                ...prev,
                gotItPile: prev.gotItPile.slice(0, -1),
                history: newHistory
            }));
        }
        setIsFlipped(false);
    }, [sortState.history, currentIndex, isRoundFinished]);



    // Keyboard handlers
    useEffect(() => {
        if (!subMode) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            // Round finished handling (Space or Enter to continue)
            if (subMode === 'sort' && isRoundFinished) {
                if (e.code === 'Space' || e.code === 'Enter') {
                    e.preventDefault();
                    startNextRound();
                    return;
                }
                if (e.key.toLowerCase() === 'z') {
                    e.preventDefault();
                    sortUndo();
                    return;
                }
            }

            // Space to flip
            if (e.code === 'Space') {
                e.preventDefault();
                flipCard();
            }

            if (subMode === 'stack') {
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    goNext();
                }
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    goPrev();
                }
            }

            if (subMode === 'sort') {
                if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    sortGotIt();
                }
                if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    sortReview();
                }
                if (e.key.toLowerCase() === 'z') {
                    e.preventDefault();
                    sortUndo();
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [subMode, isRoundFinished, flipCard, goNext, goPrev, sortGotIt, sortReview, sortUndo, startNextRound]);

    // Reset stack mode
    const resetStack = useCallback(() => {
        setCurrentIndex(0);
        setIsFlipped(false);
        setStackCompleted(false);
        setShowConfetti(false);
    }, []);

    // Reset sort mode
    const resetSort = useCallback(() => {
        setDeck(baseCards);
        setCurrentIndex(0);
        setIsFlipped(false);
        setSortState({
            reviewPile: [],
            gotItPile: [],
            history: []
        });
        setSortRound(1);
        setSortCompleted(false);
        setShowConfetti(false);
        setIsRoundFinished(false);
    }, [baseCards]);

    // Sub-mode selection screen
    if (!subMode) {
        return (
            <div className="w-full max-w-4xl mx-auto pb-20 pt-0 animate-in fade-in">
                {/* Back Button */}
                <button
                    onClick={onExit}
                    className="mb-8 flex items-center gap-3 text-muted hover:text-text transition-colors font-bold uppercase text-xs tracking-wider group"
                >
                    <div className="p-2 rounded-full border border-outline group-hover:bg-panel group-hover:border-accent transition-colors">
                        <ChevronLeft size={16} />
                    </div>
                    Back
                </button>

                <div className="text-center mb-12">
                    <h1 className="text-4xl font-bold text-text mb-3">Flashcards Mode</h1>
                    <p className="text-muted text-lg">Choose how you want to study</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                    {/* Stack Mode */}
                    <button
                        onClick={() => setSubMode('stack')}
                        className="group relative bg-panel border-2 border-outline hover:border-accent rounded-2xl p-8 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-accent/10"
                    >
                        <div className="absolute top-4 right-4 p-2 rounded-lg bg-panel-2 text-muted group-hover:text-accent transition-colors">
                            <Layers size={24} />
                        </div>
                        <div className="text-left">
                            <h3 className="text-2xl font-bold text-text mb-2">Stack</h3>
                            <p className="text-muted text-sm leading-relaxed">
                                Flip through your cards one by one. Use arrow keys or buttons to navigate through the deck.
                            </p>
                        </div>
                        <div className="mt-6 flex gap-2">
                            <span className="px-2 py-1 bg-panel-2 rounded text-xs font-mono text-muted">← →</span>
                            <span className="px-2 py-1 bg-panel-2 rounded text-xs font-mono text-muted">SPACE</span>
                        </div>
                    </button>

                    {/* Sort Mode */}
                    <button
                        onClick={() => setSubMode('sort')}
                        className="group relative bg-panel border-2 border-outline hover:border-accent rounded-2xl p-8 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-accent/10"
                    >
                        <div className="absolute top-4 right-4 flex gap-1">
                            <div className="p-2 rounded-lg bg-red/10 text-red">
                                <XCircle size={20} />
                            </div>
                            <div className="p-2 rounded-lg bg-green/10 text-green">
                                <CheckCircle2 size={20} />
                            </div>
                        </div>
                        <div className="text-left">
                            <h3 className="text-2xl font-bold text-text mb-2">Sort</h3>
                            <p className="text-muted text-sm leading-relaxed">
                                Sort cards into "Review" or "Got it" piles. Keep going until you've mastered them all.
                            </p>
                        </div>
                        <div className="mt-6 flex gap-2">
                            <span className="px-2 py-1 bg-red/10 rounded text-xs font-mono text-red">← Review</span>
                            <span className="px-2 py-1 bg-green/10 rounded text-xs font-mono text-green">Got it →</span>
                        </div>
                    </button>
                </div>

                {/* Card count info */}
                <div className="text-center mt-8 text-muted text-sm">
                    {settings.starredOnly ? (
                        <span>Studying {baseCards.length} starred cards</span>
                    ) : (
                        <span>{baseCards.length} cards in this set</span>
                    )}
                </div>
            </div>
        );
    }

    // No cards available
    if (baseCards.length === 0) {
        return (
            <div className="w-full max-w-4xl mx-auto pb-20 pt-0 text-center animate-in fade-in">
                <button
                    onClick={onExit}
                    className="mb-8 flex items-center gap-3 text-muted hover:text-text transition-colors font-bold uppercase text-xs tracking-wider group"
                >
                    <div className="p-2 rounded-full border border-outline group-hover:bg-panel group-hover:border-accent transition-colors">
                        <ChevronLeft size={16} />
                    </div>
                    Back
                </button>

                <div className="py-20">
                    <h2 className="text-2xl font-bold text-muted mb-4">No Cards Available</h2>
                    <p className="text-muted">
                        {settings.starredOnly
                            ? "No starred cards in this set. Turn off 'Starred Only' in settings or star some cards."
                            : "This set doesn't have any cards yet."}
                    </p>
                </div>
            </div>
        );
    }







    return (
        <div className="w-full max-w-4xl mx-auto pb-20 pt-0 animate-in fade-in">
            {showConfetti && <Confetti />}

            {/* Top Controls */}
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => {
                            // Full reset when going back
                            resetSort();
                            resetStack();
                            setSubMode(null);
                        }}
                        className="flex items-center gap-2 text-muted hover:text-text transition-colors font-bold uppercase text-xs tracking-wider group"
                    >
                        <div className="p-2 rounded-full border border-outline group-hover:bg-panel group-hover:border-accent transition-colors">
                            <ChevronLeft size={16} />
                        </div>
                        Back
                    </button>

                    <span className="text-sm font-bold text-muted uppercase tracking-wider relative -top-[1px]">
                        {subMode === 'stack' ? 'Stack Mode' : `Sort Mode • Round ${sortRound}`}
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    {/* Shuffle button */}
                    <button
                        onClick={handleShuffle}
                        className={clsx(
                            "p-2 rounded-lg border transition-all",
                            shuffled
                                ? "border-accent text-accent bg-accent/10"
                                : "border-outline text-muted hover:text-text hover:border-accent"
                        )}
                        title="Shuffle deck"
                    >
                        <Shuffle size={18} />
                    </button>

                    {/* Progress indicator */}
                    <div className="px-3 py-1.5 bg-panel-2 border border-outline rounded-lg text-sm font-mono text-muted">
                        {currentIndex + 1} / {deck.length}
                    </div>
                </div>
            </div>

            {/* Sort Mode Piles Indicator */}
            {subMode === 'sort' && (
                <div className="flex justify-between items-center mb-4 px-2">
                    <div className="flex items-center gap-2 text-red">
                        <XCircle size={16} />
                        <span className="text-sm font-bold">{sortState.reviewPile.length} Review</span>
                    </div>
                    <div className="flex items-center gap-2 text-green">
                        <span className="text-sm font-bold">{sortState.gotItPile.length} Got it</span>
                        <CheckCircle2 size={16} />
                    </div>
                </div>
            )}

            {/* Main Content Area: Card OR Summary */}
            {(isRoundFinished && subMode === 'sort') || (stackCompleted && subMode === 'stack') ? (
                // Completion/Summary View
                <div className="relative min-h-[400px] w-full flex flex-col items-center justify-center animate-in fade-in duration-500">
                    <div className="text-center">
                        {subMode === 'sort' && sortCompleted ? (
                            // Sort final completion
                            <>
                                <h2 className="text-5xl font-bold text-text mb-4 tracking-tight">
                                    Everything Sorted!
                                </h2>
                                <p className="text-muted text-lg max-w-md mx-auto opacity-75">
                                    You mastered all {sortState.gotItPile.length} cards in {sortRound} round{sortRound > 1 ? 's' : ''}.
                                </p>
                            </>
                        ) : subMode === 'sort' ? (
                            // Mid-round summary with stats
                            <>
                                <h2 className="text-5xl font-bold text-text mb-4 tracking-tight">
                                    {roundMessage}
                                </h2>

                                <div className="flex justify-center gap-16 mt-12 mb-8">
                                    <div className="text-center group">
                                        <div className="text-5xl font-bold text-green mb-2 group-hover:scale-110 transition-transform">{sortState.gotItPile.length}</div>
                                        <div className="text-sm font-bold text-muted uppercase tracking-widest opacity-60">Got It</div>
                                    </div>
                                    <div className="text-center group">
                                        <div className="text-5xl font-bold text-red mb-2 group-hover:scale-110 transition-transform">{sortState.reviewPile.length}</div>
                                        <div className="text-sm font-bold text-muted uppercase tracking-widest opacity-60">Review</div>
                                    </div>
                                </div>

                                <p className="text-muted text-lg max-w-md mx-auto opacity-75">
                                    You have {sortState.reviewPile.length} cards left to master.
                                </p>
                            </>
                        ) : (
                            // Stack completion
                            <>
                                <h2 className="text-5xl font-bold text-text mb-4 tracking-tight">
                                    You did it!
                                </h2>
                                <p className="text-muted text-lg max-w-md mx-auto opacity-75">
                                    You finished the entire stack of {deck.length} cards.
                                </p>
                            </>
                        )}
                    </div>
                </div>
            ) : (
                // Normal Card View
                <div className="relative mb-8 perspective-1000">
                    {/* The Card Inner (Container that rotates) */}
                    <div
                        onClick={flipCard}
                        className={clsx(
                            "relative min-h-[400px] w-full transition-all duration-500 transform-style-3d cursor-pointer",
                            isFlipped ? "rotate-x-180" : "",
                            slideDir === 'next' ? "animate-out slide-out-to-left-10 fade-out duration-100" :
                                slideDir === 'prev' ? "animate-out slide-out-to-right-10 fade-out duration-100" :
                                    "animate-in fade-in duration-300"
                        )}
                    >
                        {/* FRONT SIDE */}
                        <div className={clsx(
                            "absolute inset-0 p-8 flex flex-col bg-panel border-2 rounded-3xl backface-hidden",
                            isFlipped ? "border-accent" : "border-outline"
                        )}>
                            {/* Top Row: Star + Side Label */}
                            <div className="flex justify-between items-start mb-6">
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleStar(); }}
                                    className={clsx(
                                        "transition-all hover:scale-110 active:scale-95",
                                        currentCard?.star ? "text-yellow" : "text-muted hover:text-yellow"
                                    )}
                                >
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill={currentCard?.star ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                    </svg>
                                </button>

                                <div className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-panel-2 text-muted">
                                    {showTermFirst ? (set.termLabel || 'Term') : (set.definitionLabel || 'Definition')}
                                </div>
                            </div>

                            {/* Main Content */}
                            <div className="flex-1 flex items-center justify-center">
                                <div className="text-center max-w-full">
                                    {currentCard && (
                                        <>
                                            {currentCard.image && showTermFirst && (
                                                <div className="mb-6 flex justify-center">
                                                    <img
                                                        src={currentCard.image}
                                                        alt=""
                                                        className="max-h-[150px] w-auto rounded-xl border border-outline"
                                                    />
                                                </div>
                                            )}

                                            <div className={clsx(
                                                "font-medium leading-relaxed text-text",
                                                frontContent?.length! > 200 ? "text-xl" :
                                                    frontContent?.length! > 100 ? "text-2xl" :
                                                        frontContent?.length! > 50 ? "text-3xl" : "text-4xl"
                                            )}>
                                                {showTermFirst
                                                    ? currentCard.term.map((t, i) => <div key={i}>{renderInline(t, `term-${i}`)}</div>)
                                                    : renderMarkdown(currentCard.content)
                                                }
                                            </div>

                                            {currentCard.year && (
                                                <div className="mt-4 inline-block px-3 py-1 bg-accent/10 border border-accent/30 rounded-lg text-accent font-mono text-sm">
                                                    {currentCard.year}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="text-center text-muted text-sm opacity-50">
                                Tap or press SPACE to reveal
                            </div>
                        </div>

                        {/* BACK SIDE */}
                        <div className={clsx(
                            "absolute inset-0 p-8 flex flex-col bg-panel border-2 rounded-3xl backface-hidden rotate-x-180",
                            isFlipped ? "border-accent shadow-2xl shadow-accent/10" : "border-outline"
                        )}>
                            {/* Top Row: Star + Side Label */}
                            <div className="flex justify-between items-start mb-6">
                                <button
                                    onClick={(e) => { e.stopPropagation(); toggleStar(); }}
                                    className={clsx(
                                        "transition-all hover:scale-110 active:scale-95",
                                        currentCard?.star ? "text-yellow" : "text-muted hover:text-yellow"
                                    )}
                                >
                                    <svg width="28" height="28" viewBox="0 0 24 24" fill={currentCard?.star ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                                    </svg>
                                </button>

                                <div className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-accent/20 text-accent">
                                    {showTermFirst ? (set.definitionLabel || 'Definition') : (set.termLabel || 'Term')}
                                </div>
                            </div>

                            {/* Main Content */}
                            <div className="flex-1 flex items-center justify-center">
                                <div className="text-center max-w-full">
                                    {currentCard && (
                                        <>
                                            {currentCard.image && !showTermFirst && (
                                                <div className="mb-6 flex justify-center">
                                                    <img
                                                        src={currentCard.image}
                                                        alt=""
                                                        className="max-h-[150px] w-auto rounded-xl border border-outline"
                                                    />
                                                </div>
                                            )}

                                            <div className={clsx(
                                                "font-medium leading-relaxed text-text",
                                                backContent?.length! > 200 ? "text-xl" :
                                                    backContent?.length! > 100 ? "text-2xl" :
                                                        backContent?.length! > 50 ? "text-3xl" : "text-4xl"
                                            )}>
                                                {showTermFirst
                                                    ? renderMarkdown(currentCard.content)
                                                    : currentCard.term.map((t, i) => <div key={i}>{renderInline(t, `term-${i}`)}</div>)
                                                }
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className="text-center text-muted text-sm opacity-50">
                                Tap or press SPACE to flip back
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Navigation Controls */}
            <div className="flex justify-center items-center gap-4">
                {subMode === 'stack' && (
                    stackCompleted ? (
                        // Stack completion - Start Over button
                        <div className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <button
                                onClick={resetStack}
                                className="flex items-center gap-2 px-12 py-4 rounded-xl font-bold text-lg transition-all bg-accent text-bg hover:opacity-90 shadow-xl shadow-accent/20"
                            >
                                <RotateCcw size={20} />
                                Start Over
                            </button>
                        </div>
                    ) : (
                        // Normal Stack navigation
                        <>
                            <button
                                onClick={goPrev}
                                disabled={currentIndex === 0}
                                className={clsx(
                                    "flex items-center gap-2 px-6 py-4 rounded-xl font-bold text-lg transition-all border-2",
                                    currentIndex === 0
                                        ? "bg-panel-2/50 border-outline/50 text-muted/50 cursor-not-allowed"
                                        : "bg-panel-2 border-outline text-text hover:border-accent hover:text-accent"
                                )}
                            >
                                <ArrowLeft size={24} />
                                <span className="hidden sm:inline">Previous</span>
                            </button>

                            <button
                                onClick={goNext}
                                className="flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-lg transition-all bg-accent text-bg hover:opacity-90 border-2 border-accent"
                            >
                                <span className="hidden sm:inline">Next</span>
                                <ArrowRight size={24} />
                            </button>
                        </>
                    )
                )}

                {subMode === 'sort' && (
                    isRoundFinished ? (
                        <div className="flex flex-col items-center gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            {sortCompleted ? (
                                // Final completion - only Start Over
                                <button
                                    onClick={resetSort}
                                    className="flex items-center gap-2 px-12 py-4 rounded-xl font-bold text-lg transition-all bg-accent text-bg hover:opacity-90 shadow-xl shadow-accent/20"
                                >
                                    <RotateCcw size={20} />
                                    Start Over
                                </button>
                            ) : (
                                // Mid-round - Start Next Round
                                <>
                                    <button
                                        onClick={startNextRound}
                                        className="flex items-center gap-2 px-12 py-4 rounded-xl font-bold text-lg transition-all bg-accent text-bg hover:opacity-90 shadow-xl shadow-accent/20"
                                    >
                                        Start Next Round
                                        <span className="ml-2 px-2 py-0.5 bg-bg/20 rounded text-[10px] uppercase">Space</span>
                                    </button>

                                    <button
                                        onClick={sortUndo}
                                        className="text-sm font-medium text-muted hover:text-text underline decoration-muted/30 underline-offset-4 transition-all"
                                    >
                                        Undo Last Choice
                                    </button>
                                </>
                            )}
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={sortReview}
                                className="flex items-center gap-2 px-6 py-4 rounded-xl font-bold text-lg transition-all bg-red/10 border-2 border-red/30 text-red hover:bg-red/20 hover:border-red/50"
                            >
                                <ArrowLeft size={24} />
                                <span className="hidden sm:inline">Review</span>
                            </button>

                            <button
                                onClick={sortUndo}
                                disabled={sortState.history.length === 0}
                                className={clsx(
                                    "p-3 rounded-xl transition-all border-2",
                                    sortState.history.length === 0
                                        ? "bg-panel-2/50 border-outline/50 text-muted/50 cursor-not-allowed"
                                        : "bg-panel-2 border-outline text-muted hover:text-text hover:border-accent"
                                )}
                                title="Undo (Z)"
                            >
                                <Undo2 size={20} />
                            </button>

                            <button
                                onClick={sortGotIt}
                                className="flex items-center gap-2 px-6 py-4 rounded-xl font-bold text-lg transition-all bg-green/10 border-2 border-green/30 text-green hover:bg-green/20 hover:border-green/50"
                            >
                                <span className="hidden sm:inline">Got it</span>
                                <ArrowRight size={24} />
                            </button>
                        </>
                    )
                )}
            </div>

            {/* Keyboard hints */}
            <div className="mt-6 flex justify-center gap-4 text-xs text-muted opacity-60">
                <span><kbd className="px-1.5 py-0.5 bg-panel-2 rounded border border-outline font-mono">SPACE</kbd> flip</span>
                {subMode === 'stack' && (
                    <>
                        <span><kbd className="px-1.5 py-0.5 bg-panel-2 rounded border border-outline font-mono">←</kbd> prev</span>
                        <span><kbd className="px-1.5 py-0.5 bg-panel-2 rounded border border-outline font-mono">→</kbd> next</span>
                    </>
                )}
                {subMode === 'sort' && !isRoundFinished && (
                    <>
                        <span><kbd className="px-1.5 py-0.5 bg-panel-2 rounded border border-outline font-mono">←</kbd> review</span>
                        <span><kbd className="px-1.5 py-0.5 bg-panel-2 rounded border border-outline font-mono">→</kbd> got it</span>
                        <span><kbd className="px-1.5 py-0.5 bg-panel-2 rounded border border-outline font-mono">Z</kbd> undo</span>
                    </>
                )}
            </div>
        </div>
    );
};
