import React, { useState, useEffect, useCallback } from 'react';
import { CardSet, Card, Settings, SRSQuality } from '../types';
import { calculateNextSRS, getSRSDueCards, formatSRSInterval, previewNextInterval, formatSRSDueDate, getSRSDueCount } from '../utils';
import { ArrowLeft, Brain, CheckCircle2, XCircle, ChevronRight, RotateCcw, Calendar, Zap, TrendingUp } from 'lucide-react';
import clsx from 'clsx';

interface SRSReviewProps {
  set: CardSet;
  settings: Settings;
  onExit: () => void;
  onUpdateSet: (set: CardSet) => void;
}

type Phase = 'question' | 'rating' | 'complete';

interface SessionResult {
  cardId: string;
  label: string;
  quality: SRSQuality;
  newInterval: number;
}

const QUALITY_CONFIG = [
  {
    quality: 0 as SRSQuality,
    label: 'Again',
    description: 'Completely forgot',
    shortcut: '1',
    colorClass: 'border-red/60 bg-red/10 text-red hover:bg-red/20',
    badgeClass: 'bg-red text-white',
    intervalColorClass: 'text-red',
  },
  {
    quality: 1 as SRSQuality,
    label: 'Hard',
    description: 'Barely recalled',
    shortcut: '2',
    colorClass: 'border-orange-400/60 bg-orange-400/10 text-orange-400 hover:bg-orange-400/20',
    badgeClass: 'bg-orange-400 text-white',
    intervalColorClass: 'text-orange-400',
  },
  {
    quality: 2 as SRSQuality,
    label: 'Good',
    description: 'Recalled with effort',
    shortcut: '3',
    colorClass: 'border-emerald-400/60 bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20',
    badgeClass: 'bg-emerald-400 text-white',
    intervalColorClass: 'text-emerald-400',
  },
  {
    quality: 3 as SRSQuality,
    label: 'Easy',
    description: 'Perfect recall',
    shortcut: '4',
    colorClass: 'border-sky-400/60 bg-sky-400/10 text-sky-400 hover:bg-sky-400/20',
    badgeClass: 'bg-sky-400 text-white',
    intervalColorClass: 'text-sky-400',
  },
] as const;

export const SRSReview: React.FC<SRSReviewProps> = ({ set, settings, onExit, onUpdateSet }) => {
  const [liveCards, setLiveCards] = useState<Card[]>(set.cards);
  const [sessionKey, setSessionKey] = useState(0);
  const [dueCards, setDueCards] = useState<Card[]>(() => getSRSDueCards(set.cards));
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('question');
  const [results, setResults] = useState<SessionResult[]>([]);

  const currentCard = dueCards[index] ?? null;
  const totalDue = dueCards.length;
  const done = index >= totalDue;

  // ── Keyboard shortcuts in rating phase ──────────────────────
  useEffect(() => {
    if (phase !== 'rating') return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const map: Record<string, SRSQuality> = { '1': 0, '2': 1, '3': 2, '4': 3 };
      if (e.key in map) {
        e.preventDefault();
        handleRate(map[e.key]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  // ── Show answer shortcut (Space / Enter in question phase) ──
  useEffect(() => {
    if (phase !== 'question') return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        setPhase('rating');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const handleRate = useCallback((quality: SRSQuality) => {
    if (!currentCard) return;

    const newSRS = calculateNextSRS(currentCard.srs, quality);
    const result: SessionResult = {
      cardId: currentCard.id,
      label: currentCard.term[0] ?? 'Card',
      quality,
      newInterval: newSRS.interval,
    };

    // Update card in liveCards
    const updatedCards = liveCards.map(c =>
      c.id === currentCard.id ? { ...c, srs: newSRS } : c
    );
    setLiveCards(updatedCards);

    // Persist to parent immediately (so cloud sync picks it up)
    onUpdateSet({ ...set, cards: updatedCards });

    setResults(prev => [...prev, result]);

    const next = index + 1;
    if (next >= totalDue) {
      setPhase('complete');
    } else {
      setIndex(next);
      setPhase('question');
    }
  }, [currentCard, index, totalDue, liveCards, set, onUpdateSet]);

  // ── Progress bar ─────────────────────────────────────────────
  const progressPct = totalDue > 0 ? Math.round((index / totalDue) * 100) : 100;

  // ── Complete screen stats ────────────────────────────────────
  const againCount = results.filter(r => r.quality === 0).length;
  const hardCount = results.filter(r => r.quality === 1).length;
  const goodCount = results.filter(r => r.quality === 2).length;
  const easyCount = results.filter(r => r.quality === 3).length;
  const retentionPct = totalDue > 0
    ? Math.round(((goodCount + easyCount + hardCount) / totalDue) * 100)
    : 0;

  const nextDueCount = getSRSDueCount(liveCards);

  // ── Empty state (nothing due) ────────────────────────────────
  if (totalDue === 0) {
    const nextDueSoonest = set.cards
      .filter(c => c.srs)
      .sort((a, b) => a.srs!.nextReview - b.srs!.nextReview)[0];
    return (
      <div className="max-w-2xl mx-auto w-full animate-in fade-in duration-500 pt-8 px-4">
        <button
          onClick={onExit}
          className="mb-8 flex items-center gap-3 text-muted hover:text-text transition-colors font-bold uppercase text-xs tracking-wider group"
        >
          <div className="p-2 rounded-full border border-outline group-hover:bg-panel group-hover:border-accent transition-colors">
            <ArrowLeft size={16} />
          </div>
          Back
        </button>
        <div className="text-center py-16 space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-400/10 border-2 border-emerald-400/30 flex items-center justify-center">
            <CheckCircle2 size={36} className="text-emerald-400" />
          </div>
          <h2
            className="text-4xl text-text"
            style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}
          >
            All caught up!
          </h2>
          <p className="text-muted text-lg">No cards due for review right now.</p>
          {nextDueSoonest && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-panel-2 border border-outline text-sm text-muted">
              <Calendar size={14} />
              Next review: {formatSRSDueDate(nextDueSoonest)}
            </div>
          )}
          {set.cards.some(c => !c.srs) && (
            <p className="text-sm text-muted/70">
              {set.cards.filter(c => !c.srs).length} card{set.cards.filter(c => !c.srs).length !== 1 ? 's' : ''} haven't been introduced to SRS yet — they'll appear in your next session.
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Session complete screen ──────────────────────────────────
  if (phase === 'complete' || done) {
    return (
      <div className="max-w-2xl mx-auto w-full animate-in fade-in duration-500 pt-8 px-4 pb-20">
        <div className="text-center mb-10 space-y-3">
          <div className="w-20 h-20 mx-auto rounded-full bg-accent/10 border-2 border-accent/30 flex items-center justify-center">
            <Brain size={36} className="text-accent" />
          </div>
          <h2
            className="text-4xl text-text"
            style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}
          >
            Review Complete
          </h2>
          <p className="text-muted text-lg">
            {totalDue} card{totalDue !== 1 ? 's' : ''} reviewed
          </p>
        </div>

        {/* Retention stat */}
        <div className="mb-8 p-6 rounded-2xl bg-panel-2 border border-outline text-center">
          <div
            className={clsx(
              "text-6xl font-black mb-2",
              retentionPct >= 80 ? "text-emerald-400" : retentionPct >= 60 ? "text-orange-400" : "text-red"
            )}
            style={{ fontFamily: "'Red Hat Display', sans-serif" }}
          >
            {retentionPct}%
          </div>
          <div className="text-muted text-sm">Retention this session</div>
          {nextDueCount > 0 && (
            <div className="mt-3 text-xs text-muted/70 flex items-center justify-center gap-1">
              <Calendar size={12} />
              {nextDueCount} card{nextDueCount !== 1 ? 's' : ''} still due
            </div>
          )}
        </div>

        {/* Rating breakdown */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          {[
            { label: 'Again', count: againCount, colorClass: 'text-red border-red/30 bg-red/5' },
            { label: 'Hard', count: hardCount, colorClass: 'text-orange-400 border-orange-400/30 bg-orange-400/5' },
            { label: 'Good', count: goodCount, colorClass: 'text-emerald-400 border-emerald-400/30 bg-emerald-400/5' },
            { label: 'Easy', count: easyCount, colorClass: 'text-sky-400 border-sky-400/30 bg-sky-400/5' },
          ].map(({ label, count, colorClass }) => (
            <div key={label} className={clsx("rounded-xl border p-3 text-center", colorClass)}>
              <div className="text-2xl font-black" style={{ fontFamily: "'Red Hat Display', sans-serif" }}>{count}</div>
              <div className="text-xs font-bold opacity-70">{label}</div>
            </div>
          ))}
        </div>

        {/* Card-by-card log */}
        {results.length > 0 && (
          <div className="mb-8 rounded-2xl bg-panel-2 border border-outline overflow-hidden">
            <div className="px-4 py-3 border-b border-outline">
              <h3 className="text-xs font-bold text-muted uppercase tracking-widest">Session Log</h3>
            </div>
            <div className="divide-y divide-outline/50 max-h-64 overflow-y-auto">
              {results.map((r, i) => {
                const cfg = QUALITY_CONFIG[r.quality];
                return (
                  <div key={i} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className="text-text truncate max-w-[60%]">{r.label}</span>
                    <div className="flex items-center gap-2">
                      <span className={clsx("text-xs font-bold px-2 py-0.5 rounded-full", cfg.badgeClass)}>
                        {cfg.label}
                      </span>
                      <span className="text-muted font-mono text-xs">{formatSRSInterval(r.newInterval)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          {nextDueCount > 0 && (
            <button
              onClick={() => {
                // Reset session with the still-due cards
                const newDue = getSRSDueCards(liveCards);
                setDueCards(newDue);
                setIndex(0);
                setPhase('question');
                setResults([]);
                setSessionKey(k => k + 1);
              }}
              className="w-full bg-accent text-bg px-6 py-4 rounded-xl font-bold text-lg hover:bg-accent/90 transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw size={20} /> Continue ({nextDueCount} remaining)
            </button>
          )}
          <button
            onClick={onExit}
            className="w-full bg-panel-2 border border-outline text-text px-6 py-4 rounded-xl font-bold text-lg hover:border-accent transition-all flex items-center justify-center gap-2"
          >
            <ArrowLeft size={20} /> Back to Set
          </button>
        </div>
      </div>
    );
  }

  // ── Main review card ─────────────────────────────────────────
  const isNew = !currentCard.srs;
  const termLabel = set.termLabel ?? 'Term';
  const defLabel = set.definitionLabel ?? 'Definition';

  return (
    <div className="max-w-2xl mx-auto w-full animate-in fade-in duration-500 pb-20 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 pt-2">
        <button
          onClick={onExit}
          className="flex items-center gap-2 text-muted hover:text-text transition-colors font-bold text-xs uppercase tracking-wider group"
        >
          <div className="p-2 rounded-full border border-outline group-hover:bg-panel group-hover:border-accent transition-colors">
            <ArrowLeft size={14} />
          </div>
          Exit
        </button>

        <div className="flex items-center gap-2">
          <Brain size={16} className="text-accent" />
          <span className="text-xs font-bold text-accent uppercase tracking-wider">Spaced Repetition</span>
        </div>

        <span className="text-xs font-mono text-muted tabular-nums">
          {index + 1} / {totalDue}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-panel-3 rounded-full mb-8 overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Card */}
      <div
        className={clsx(
          "rounded-2xl border-2 p-8 mb-6 min-h-[200px] flex flex-col justify-between transition-all duration-300",
          phase === 'question'
            ? "border-outline bg-panel-2"
            : "border-accent/30 bg-panel-2"
        )}
      >
        {/* Top: SRS status badge */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {isNew ? (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-sky-400/20 text-sky-400 border border-sky-400/30">
                New card
              </span>
            ) : (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-panel-3 text-muted border border-outline">
                {formatSRSDueDate(currentCard)}
              </span>
            )}
          </div>
          <div className="text-xs text-muted font-mono">
            {termLabel}
          </div>
        </div>

        {/* Term */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p
              className="text-3xl font-bold text-text leading-snug"
              style={{ fontFamily: "'Red Hat Display', sans-serif" }}
            >
              {currentCard.term[0] ?? ''}
            </p>
            {currentCard.term.length > 1 && (
              <p className="mt-2 text-sm text-muted">
                Also: {currentCard.term.slice(1).join(', ')}
              </p>
            )}
          </div>
        </div>

        {/* Answer reveal */}
        <div className="mt-6">
          {phase === 'question' ? (
            <button
              onClick={() => setPhase('rating')}
              className="w-full py-3 rounded-xl border-2 border-dashed border-outline/60 text-muted hover:border-accent/60 hover:text-accent transition-all text-sm font-bold flex items-center justify-center gap-2"
            >
              <span>Show Answer</span>
              <span className="opacity-40 text-xs">Space or Enter</span>
            </button>
          ) : (
            <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="text-xs font-bold text-muted uppercase tracking-wider mb-2">{defLabel}</div>
              <div className="p-4 rounded-xl bg-panel-3 border border-outline/60 text-text text-lg leading-relaxed">
                {currentCard.content}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Rating buttons */}
      {phase === 'rating' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
          <p className="text-center text-xs text-muted mb-4 uppercase tracking-wider font-bold">
            How well did you know this?
          </p>
          <div className="grid grid-cols-4 gap-3">
            {QUALITY_CONFIG.map(cfg => {
              const nextDays = previewNextInterval(currentCard.srs, cfg.quality);
              return (
                <button
                  key={cfg.quality}
                  onClick={() => handleRate(cfg.quality)}
                  className={clsx(
                    "flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border-2 transition-all duration-200 hover:scale-[1.03] active:scale-95",
                    cfg.colorClass
                  )}
                >
                  <span className="font-black text-sm" style={{ fontFamily: "'Red Hat Display', sans-serif" }}>
                    {cfg.label}
                  </span>
                  <span className="text-xs opacity-60">{cfg.description}</span>
                  <span className={clsx("text-xs font-bold font-mono", cfg.intervalColorClass)}>
                    {formatSRSInterval(nextDays)}
                  </span>
                  <span className="text-xs opacity-40">({cfg.shortcut})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Hint: press space to show */}
      {phase === 'question' && (
        <p className="text-center text-xs text-muted/50 mt-4">
          Press <kbd className="px-1.5 py-0.5 rounded border border-outline/60 bg-panel-3 font-mono text-[10px]">Space</kbd> to reveal answer
        </p>
      )}
    </div>
  );
};
