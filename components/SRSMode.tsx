import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, Calendar, ChevronDown, Clock, RotateCcw, Star, X } from 'lucide-react';
import clsx from 'clsx';
import { Card, CardSet, CustomFieldDefinition, Settings, SRSSessionStats } from '../types';
import { renderInline, renderMarkdown, sanitizeImageUrl } from '../utils';
import {
  SRSRating,
  createEmptySrsSessionStats,
  formatSrsCountdown,
  formatSrsInterval,
  getNextDueDate,
  getSrsCounts,
  getSrsShortcutKeys,
  getSrsShuffleScore,
  isSrsCardDue,
  matchesSrsShortcut,
  normalizeSrsMastery,
  normalizeSrsSessionStats,
  scheduleSrsReview,
  shouldShowSrsWarning
} from '../srs';
import { StreakCornerBadge } from './StreakCornerBadge';
import { SrsTriangle } from './SrsTriangle';
import { StudyModeOptionCard } from './StudyModeOptionCard';

interface SRSModeProps {
  set: CardSet;
  settings: Settings;
  onExit: () => void;
  onUpdateSet: (updatedSet: CardSet) => void;
  onUseLearnInstead: () => void;
}

const renderMasteryTriangle = (level: number, sizeClass = 'w-4 h-4') => (
  <SrsTriangle level={level} className={clsx(sizeClass, 'transition-all')} />
);

const getFieldName = (field: string | CustomFieldDefinition): string => typeof field === 'string' ? field : field.name;

const MONTH_OPTIONS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' }
] as const;

interface CustomDateInput {
  month: string;
  day: string;
  year: string;
}

const EMPTY_CUSTOM_DATE_INPUT: CustomDateInput = {
  month: '',
  day: '',
  year: ''
};

const formatCustomDateInput = (testDate?: number): CustomDateInput => {
  if (!testDate) return EMPTY_CUSTOM_DATE_INPUT;

  const parsed = new Date(testDate);
  if (Number.isNaN(parsed.getTime())) return EMPTY_CUSTOM_DATE_INPUT;

  return {
    month: String(parsed.getMonth() + 1),
    day: String(parsed.getDate()),
    year: String(parsed.getFullYear())
  };
};

const sanitizeNumericInput = (value: string, maxLength: number): string => (
  value.replace(/\D/g, '').slice(0, maxLength)
);

const getDateValidation = (
  input: CustomDateInput,
  now = new Date()
): {
  error: string | null;
  parsedTimestamp?: number;
  resolvedYear?: number;
} => {
  if (!input.month && !input.day.trim() && !input.year.trim()) {
    return { error: null };
  }

  if (!input.month) {
    return { error: 'Choose a month.' };
  }

  if (!input.day.trim()) {
    return { error: 'Enter a day.' };
  }

  const day = Number(input.day);
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    return { error: 'Enter a valid day.' };
  }

  const trimmedYear = input.year.trim();
  const resolvedYear = trimmedYear ? Number(trimmedYear) : now.getFullYear();
  if (
    !Number.isInteger(resolvedYear) ||
    resolvedYear < 1000 ||
    resolvedYear > 9999 ||
    (trimmedYear.length > 0 && trimmedYear.length !== 4)
  ) {
    return { error: 'Enter a valid 4-digit year.' };
  }

  const month = Number(input.month);
  const parsedDate = new Date(resolvedYear, month - 1, day, 23, 59, 59, 999);
  if (
    parsedDate.getFullYear() !== resolvedYear ||
    parsedDate.getMonth() !== month - 1 ||
    parsedDate.getDate() !== day
  ) {
    return { error: 'Enter a real calendar date.' };
  }

  if (parsedDate.getTime() < now.getTime()) {
    return { error: `That date has already passed in ${resolvedYear}.`, parsedTimestamp: parsedDate.getTime(), resolvedYear };
  }

  return {
    error: null,
    parsedTimestamp: parsedDate.getTime(),
    resolvedYear
  };
};

const createDueCardSorter = (
  getCardKey: (card: Card) => string,
  shuffleCards: boolean,
  seed: number
) => (a: Card, b: Card): number => {
  const aNext = a.nextReviewDate || 0;
  const bNext = b.nextReviewDate || 0;
  if (aNext !== bNext) return aNext - bNext;

  const aMastery = normalizeSrsMastery(a.srsMastery);
  const bMastery = normalizeSrsMastery(b.srsMastery);
  if (aMastery !== bMastery) return aMastery - bMastery;

  if (shuffleCards) {
    return getSrsShuffleScore(getCardKey(a), seed) - getSrsShuffleScore(getCardKey(b), seed);
  }

  return (a.term[0] || '').localeCompare(b.term[0] || '');
};

const SideFields: React.FC<{
  card: Card;
  fields?: (string | CustomFieldDefinition)[];
}> = ({ card, fields }) => {
  if (!fields?.length) return null;

  return (
    <div className="flex flex-wrap gap-3 mb-4 opacity-85">
      {fields.map(field => {
        const name = getFieldName(field);
        const value = card.customFields?.find(entry => entry.name === name)?.value;
        if (!value) return null;

        return (
          <div key={name} className="px-3 py-1 bg-panel-2 border border-outline rounded-lg text-sm">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted mr-2">{name}</span>
            <span className="text-text">{renderInline(value, `srs-field-${name}`)}</span>
          </div>
        );
      })}
    </div>
  );
};

const SrsActionButton: React.FC<{
  rating: SRSRating;
  title: string;
  subtitle: string;
  intervalText: string;
  onClick: () => void;
}> = ({ rating, title, subtitle, intervalText, onClick }) => {
  const tone =
    rating === 1
      ? 'border-red bg-red/10 text-red hover:bg-red/15'
      : rating === 2
        ? 'border-yellow bg-yellow/10 text-yellow hover:bg-yellow/15'
        : rating === 3
          ? 'border-green bg-green/10 text-green hover:bg-green/15'
          : 'border-blue bg-blue/10 text-blue hover:bg-blue/15';

  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'w-full h-full min-h-[112px] rounded-2xl border-2 p-4 text-left transition-all hover:-translate-y-0.5',
        tone
      )}
    >
      <div className="flex items-center gap-3">
        {renderMasteryTriangle(rating, 'w-4 h-4')}
        <div>
          <div className="text-lg font-bold leading-none">{title}</div>
          <div className="mt-1 text-xs font-bold uppercase tracking-widest opacity-75">{subtitle}</div>
        </div>
      </div>
      <div className="mt-4 text-sm font-medium opacity-85">{intervalText}</div>
    </button>
  );
};

export const SRSMode: React.FC<SRSModeProps> = ({
  set,
  settings,
  onExit,
  onUpdateSet,
  onUseLearnInstead
}) => {
  const [isCustomDateEntryOpen, setIsCustomDateEntryOpen] = useState(false);
  const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
  const [warningDismissedForTestDate, setWarningDismissedForTestDate] = useState<number | null>(null);
  const monthDropdownRef = useRef<HTMLDivElement>(null);
  const getCardKey = useCallback((card: Card): string => {
    if (set.isMultistudy && card.originalSetId) return `${card.originalSetId}::${card.id}`;
    return card.id;
  }, [set.isMultistudy]);

  const [sessionStats, setSessionStats] = useState<SRSSessionStats>(() =>
    set.srsSessionStats ? normalizeSrsSessionStats(set.srsSessionStats) : createEmptySrsSessionStats()
  );
  const [showTestDatePrompt, setShowTestDatePrompt] = useState(() => !set.srsSessionStats);
  const [customDateInput, setCustomDateInput] = useState<CustomDateInput>(() => formatCustomDateInput(set.srsSessionStats?.testDate));
  const [isFlipped, setIsFlipped] = useState(false);
  const [currentStreak, setCurrentStreak] = useState(0);
  const [topStreak, setTopStreak] = useState(set.topStreak || 0);
  const [isManageSessionOpen, setIsManageSessionOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);
  const [clockNow, setClockNow] = useState(Date.now());
  const dueCardSorter = useMemo(
    () => createDueCardSorter(getCardKey, settings.shuffleCards, sessionStats.startedAt),
    [getCardKey, settings.shuffleCards, sessionStats.startedAt]
  );

  useEffect(() => {
    const nextStats = set.srsSessionStats ? normalizeSrsSessionStats(set.srsSessionStats) : createEmptySrsSessionStats();
    setSessionStats(nextStats);
    setShowTestDatePrompt(!set.srsSessionStats);
    setIsCustomDateEntryOpen(false);
    setIsMonthDropdownOpen(false);
    setWarningDismissedForTestDate(null);
    setCustomDateInput(formatCustomDateInput(set.srsSessionStats?.testDate));
    setIsFlipped(false);
    setCurrentStreak(0);
    setTopStreak(set.topStreak || 0);
    setIsManageSessionOpen(false);
    setIsResetConfirmOpen(false);
    setClockNow(Date.now());
  }, [set.id]);

  const studyCards = useMemo(() => {
    if (settings.starredOnly) {
      return set.cards.filter(card => card.star);
    }
    return set.cards;
  }, [set.cards, settings.starredOnly]);

  const dueCards = useMemo(
    () => studyCards.filter(card => isSrsCardDue(card, clockNow)).sort(dueCardSorter),
    [studyCards, clockNow, dueCardSorter]
  );

  const reviewQueue = useMemo(
    () => dueCards,
    [dueCards]
  );

  useEffect(() => {
    if (reviewQueue.length > 0) return;

    const timer = window.setInterval(() => {
      setClockNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [reviewQueue.length]);

  useEffect(() => {
    const availableIds = new Set(reviewQueue.map(getCardKey));
    const nextCurrentCardId = reviewQueue[0] ? getCardKey(reviewQueue[0]) : null;

    if (!sessionStats.currentCardId && nextCurrentCardId) {
      setSessionStats(prev => ({ ...prev, currentCardId: nextCurrentCardId }));
      return;
    }

    if (sessionStats.currentCardId && !availableIds.has(sessionStats.currentCardId)) {
      setSessionStats(prev => ({ ...prev, currentCardId: nextCurrentCardId }));
      setIsFlipped(false);
    }
  }, [reviewQueue, getCardKey, sessionStats.currentCardId]);

  useEffect(() => {
    if (!isMonthDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (monthDropdownRef.current && !monthDropdownRef.current.contains(event.target as Node)) {
        setIsMonthDropdownOpen(false);
      }
    };
    const closeDropdown = () => setIsMonthDropdownOpen(false);

    document.addEventListener('mousedown', handleClickOutside, true);
    window.addEventListener('scroll', closeDropdown, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      window.removeEventListener('scroll', closeDropdown, true);
    };
  }, [isMonthDropdownOpen]);

  const currentCard = useMemo(
    () => reviewQueue.find(card => getCardKey(card) === sessionStats.currentCardId) || reviewQueue[0] || null,
    [reviewQueue, sessionStats.currentCardId, getCardKey]
  );

  const persistSessionState = useCallback((
    nextCards: Card[] = set.cards,
    nextSessionStats: SRSSessionStats | null = sessionStats,
    overrides?: Partial<CardSet>
  ) => {
    onUpdateSet({
      ...set,
      cards: nextCards,
      srsSessionStats: nextSessionStats ?? undefined,
      isSessionActive: nextSessionStats ? true : false,
      ...overrides
    });
  }, [onUpdateSet, sessionStats, set]);

  const syncSessionTargetDate = useCallback((testDate?: number) => {
    const currentCardId = currentCard ? getCardKey(currentCard) : (reviewQueue[0] ? getCardKey(reviewQueue[0]) : null);
    const nextStats: SRSSessionStats = {
      ...sessionStats,
      testDate,
      currentCardId
    };
    setSessionStats(nextStats);
    persistSessionState(set.cards, nextStats);
  }, [currentCard, getCardKey, persistSessionState, reviewQueue, sessionStats, set.cards]);

  const handleTestDateSelection = useCallback((testDate?: number) => {
    setShowTestDatePrompt(false);
    setIsCustomDateEntryOpen(false);
    setIsMonthDropdownOpen(false);
    setWarningDismissedForTestDate(null);
    setClockNow(Date.now());
    syncSessionTargetDate(testDate);
  }, [syncSessionTargetDate]);

  const customDateValidation = useMemo(
    () => getDateValidation(customDateInput),
    [customDateInput]
  );
  const selectedMonthLabel = useMemo(
    () => MONTH_OPTIONS.find(option => option.value === customDateInput.month)?.label ?? 'Month',
    [customDateInput.month]
  );
  const canSubmitCustomDate = Boolean(customDateInput.month && customDateInput.day.trim()) && !customDateValidation.error;

  const handleSetCustomDate = useCallback(() => {
    const validation = getDateValidation(customDateInput);
    if (validation.error || !validation.parsedTimestamp) return;

    if (!customDateInput.year.trim() && validation.resolvedYear) {
      setCustomDateInput(prev => ({ ...prev, year: String(validation.resolvedYear) }));
    }

    handleTestDateSelection(validation.parsedTimestamp);
  }, [customDateInput, handleTestDateSelection]);

  const handleExit = useCallback(() => {
    if (!showTestDatePrompt || set.srsSessionStats || sessionStats.cardsReviewed > 0) {
      const currentCardId = currentCard ? getCardKey(currentCard) : null;
      const nextStats: SRSSessionStats = { ...sessionStats, currentCardId };
      setSessionStats(nextStats);
      persistSessionState(set.cards, nextStats);
    }
    onExit();
  }, [currentCard, getCardKey, onExit, persistSessionState, sessionStats, set.cards, set.srsSessionStats, showTestDatePrompt]);

  const handleFlip = useCallback(() => {
    if (!currentCard) return;
    setIsFlipped(true);
  }, [currentCard]);

  const toggleStar = useCallback(() => {
    if (!currentCard) return;

    const currentCardId = getCardKey(currentCard);
    const nextCards = set.cards.map(card =>
      getCardKey(card) === currentCardId ? { ...card, star: !card.star } : card
    );

    persistSessionState(nextCards);
  }, [currentCard, getCardKey, persistSessionState, set.cards]);

  const handleRating = useCallback((rating: SRSRating) => {
    if (!currentCard) return;

    const now = Date.now();
    const currentCardId = getCardKey(currentCard);
    const { updatedCard } = scheduleSrsReview(currentCard, rating, sessionStats.testDate, now);
    const nextCards = set.cards.map(card => getCardKey(card) === currentCardId ? updatedCard : card);
    const nextStudyCards = settings.starredOnly ? nextCards.filter(card => card.star) : nextCards;
    const nextReviewQueue = nextStudyCards.filter(card => isSrsCardDue(card, now)).sort(dueCardSorter);
    const nextCurrentCardId = nextReviewQueue[0] ? getCardKey(nextReviewQueue[0]) : null;
    const nextStreak = rating >= 3 ? currentStreak + 1 : 0;
    let nextTopStreak = topStreak;
    if (nextStreak > topStreak) {
      nextTopStreak = nextStreak;
      setTopStreak(nextTopStreak);
    }
    const nextSessionStats: SRSSessionStats = {
      ...sessionStats,
      currentCardId: nextCurrentCardId,
      cardsReviewed: sessionStats.cardsReviewed + 1,
      totalReviews: sessionStats.totalReviews + 1
    };

    setSessionStats(nextSessionStats);
    setCurrentStreak(nextStreak);
    setIsFlipped(false);
    setClockNow(now);

    persistSessionState(nextCards, nextSessionStats, {
      topStreak: nextTopStreak
    });
  }, [currentCard, currentStreak, dueCardSorter, getCardKey, persistSessionState, sessionStats, set, settings.starredOnly, topStreak]);

  const handleReset = useCallback(() => {
    const resetCards = set.cards.map(card => ({
      ...card,
      srsMastery: 0,
      easinessFactor: undefined,
      interval: undefined,
      repetitions: undefined,
      nextReviewDate: undefined
    }));

    const nextSessionStats = createEmptySrsSessionStats();
    setSessionStats(nextSessionStats);
    setShowTestDatePrompt(true);
    setIsCustomDateEntryOpen(false);
    setIsMonthDropdownOpen(false);
    setWarningDismissedForTestDate(null);
    setCustomDateInput(EMPTY_CUSTOM_DATE_INPUT);
    setCurrentStreak(0);
    setTopStreak(0);
    setIsFlipped(false);
    setIsManageSessionOpen(false);
    setIsResetConfirmOpen(false);
    setClockNow(Date.now());

    onUpdateSet({
      ...set,
      cards: resetCards,
      srsSessionStats: undefined,
      isSessionActive: false
    });
  }, [onUpdateSet, set]);

  const shortcutKeys = useMemo(
    () => getSrsShortcutKeys(settings.multipleChoiceKeybindStyle),
    [settings.multipleChoiceKeybindStyle]
  );
  const showWarningModal = !showTestDatePrompt &&
    shouldShowSrsWarning(sessionStats.testDate, clockNow) &&
    warningDismissedForTestDate !== sessionStats.testDate;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (showTestDatePrompt || isManageSessionOpen || isResetConfirmOpen || showWarningModal) return;

      if ((event.key === ' ' || event.key === 'Enter') && !isFlipped && !event.shiftKey && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        handleFlip();
        return;
      }

      if (!isFlipped) return;

      const rating = shortcutKeys.findIndex(shortcut => matchesSrsShortcut(event, shortcut));
      if (rating >= 0) {
        event.preventDefault();
        handleRating((rating + 1) as SRSRating);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleFlip, handleRating, isFlipped, isManageSessionOpen, isResetConfirmOpen, shortcutKeys, showTestDatePrompt, showWarningModal]);

  const counts = useMemo(() => getSrsCounts(set.cards), [set.cards]);
  const nextDueDate = useMemo(() => getNextDueDate(studyCards), [studyCards]);
  const countdownText = nextDueDate ? formatSrsCountdown(Math.max(0, nextDueDate - clockNow)) : null;
  const termLabel = set.termLabel || 'Term';
  const definitionLabel = set.definitionLabel || 'Definition';
  const isAnsweringWithDefinition = settings.answerWithDefinition;
  const promptLabel = isAnsweringWithDefinition ? termLabel : definitionLabel;
  const answerLabel = isAnsweringWithDefinition ? definitionLabel : termLabel;

  const previewIntervals = useMemo(() => {
    if (!currentCard) return null;

    return [1, 2, 3, 4].map(value => {
      const rating = value as SRSRating;
      const result = scheduleSrsReview(currentCard, rating, sessionStats.testDate, clockNow);
      return formatSrsInterval(result.intervalMs);
    });
  }, [clockNow, currentCard, sessionStats.testDate]);

  const promptFields = isAnsweringWithDefinition ? set.termSideFields : set.defSideFields;
  const answerFields = isAnsweringWithDefinition ? set.defSideFields : set.termSideFields;
  const promptImage = sanitizeImageUrl(isAnsweringWithDefinition ? currentCard?.termImage : currentCard?.image);
  const answerImage = sanitizeImageUrl(isAnsweringWithDefinition ? currentCard?.image : currentCard?.termImage);
  const promptText = currentCard
    ? (isAnsweringWithDefinition ? currentCard.term.join(' / ') : currentCard.content)
    : '';
  const promptLength = promptText.length;
  let promptTextSizeClass = 'text-4xl';
  if (promptLength > 50) promptTextSizeClass = 'text-3xl';
  if (promptLength > 100) promptTextSizeClass = 'text-2xl';
  if (promptLength > 200) promptTextSizeClass = 'text-xl';

  if (showTestDatePrompt && isCustomDateEntryOpen) {
    return (
      <div className="w-full max-w-4xl mx-auto pb-20 pt-0 animate-in fade-in">
        <button
          onClick={() => {
            setIsCustomDateEntryOpen(false);
            setIsMonthDropdownOpen(false);
          }}
          className="mb-8 flex items-center gap-3 text-muted hover:text-text transition-colors font-bold uppercase text-xs tracking-wider group"
        >
          <div className="p-2 rounded-full border border-outline group-hover:bg-panel group-hover:border-accent transition-colors">
            <ArrowLeft size={16} />
          </div>
          Back
        </button>

        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h1
              className="text-4xl text-text mb-3"
              style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}
            >
              Target Date
            </h1>
            <p className="text-muted text-lg">Pick your deadline, then start the session.</p>
          </div>

          <div className="bg-panel border-2 border-outline rounded-2xl p-8">
            <div className="flex items-center gap-3 mb-4 text-text">
              <div className="p-2 rounded-lg bg-panel-2 text-accent">
                <Calendar size={20} />
              </div>
              <div>
                <div className="text-lg font-bold">Study toward a deadline</div>
                <div className="text-sm text-muted">
                  Flashcardsish will tighten spacing as that date approaches.
                </div>
                </div>
              </div>

            <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1.5fr)_110px_120px] gap-3">
              <div className="relative" ref={monthDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsMonthDropdownOpen(prev => !prev)}
                  className={clsx(
                    'w-full bg-panel-2 border rounded-xl px-4 py-3 text-left text-text focus:border-accent focus:outline-none transition-colors flex items-center justify-between gap-3',
                    customDateValidation.error && !customDateInput.month ? 'border-red' : 'border-outline'
                  )}
                >
                  <span className={clsx(customDateInput.month ? 'text-text' : 'text-muted')}>{selectedMonthLabel}</span>
                  <ChevronDown size={18} className={clsx('text-muted transition-transform', isMonthDropdownOpen && 'rotate-180')} />
                </button>

                {isMonthDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-panel border border-outline rounded-2xl shadow-2xl z-50 overflow-hidden animate-in zoom-in-95">
                    <div className="max-h-72 overflow-y-auto p-2 custom-scrollbar">
                      {MONTH_OPTIONS.map(option => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            setCustomDateInput(prev => ({ ...prev, month: option.value }));
                            setIsMonthDropdownOpen(false);
                          }}
                          className={clsx(
                            'w-full rounded-xl px-3 py-2.5 text-left transition-colors',
                            customDateInput.month === option.value
                              ? 'bg-accent/10 text-accent font-bold'
                              : 'text-text hover:bg-panel-2'
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={customDateInput.day}
                onChange={(event) => {
                  const day = sanitizeNumericInput(event.target.value, 2);
                  setCustomDateInput(prev => ({ ...prev, day }));
                }}
                placeholder="Day"
                className={clsx(
                  'bg-panel-2 border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none transition-colors',
                  customDateValidation.error && !customDateInput.day.trim() ? 'border-red' : 'border-outline'
                )}
              />
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={customDateInput.year}
                onChange={(event) => {
                  const year = sanitizeNumericInput(event.target.value, 4);
                  setCustomDateInput(prev => ({ ...prev, year }));
                }}
                placeholder="Year"
                className={clsx(
                  'bg-panel-2 border rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none transition-colors',
                  customDateValidation.error && customDateInput.year.trim().length > 0 ? 'border-red' : 'border-outline'
                )}
              />
            </div>

            <div className="mt-3 flex items-start gap-2 text-sm">
              {customDateValidation.error ? (
                <>
                  <AlertTriangle size={16} className="text-red mt-0.5 shrink-0" />
                  <p className="text-red">{customDateValidation.error}</p>
                </>
              ) : (
                <p className="text-muted">Leave year blank to use {new Date().getFullYear()}.</p>
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleSetCustomDate}
                disabled={!canSubmitCustomDate}
                className={clsx(
                  'rounded-xl px-5 py-3 font-bold transition-colors inline-flex items-center justify-center gap-2',
                  canSubmitCustomDate ? 'bg-accent text-bg hover:bg-accent/90' : 'bg-panel-2 border border-outline text-muted cursor-not-allowed'
                )}
              >
                <Calendar size={18} />
                Start SRS
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (showTestDatePrompt) {
    return (
      <div className="w-full max-w-4xl mx-auto pb-20 pt-0 animate-in fade-in">
        <button
          onClick={handleExit}
          className="mb-8 flex items-center gap-3 text-muted hover:text-text transition-colors font-bold uppercase text-xs tracking-wider group"
        >
          <div className="p-2 rounded-full border border-outline group-hover:bg-panel group-hover:border-accent transition-colors">
            <ArrowLeft size={16} />
          </div>
          Back
        </button>

        <div>
          <div className="text-center mb-12">
            <h1
              className="text-4xl text-text mb-3"
              style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}
            >
              SRS Mode
            </h1>
            <p className="text-muted text-lg">Choose how you want to pace this set</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            <StudyModeOptionCard
              title="Target Date"
              description="Best if you have a quiz, exam, or deadline. Flashcardsish will tighten spacing so cards come back sooner as that date approaches."
              onClick={() => setIsCustomDateEntryOpen(true)}
              topRight={
                <div className="p-2 rounded-lg bg-panel-2 text-muted group-hover:text-accent transition-colors">
                  <Calendar size={24} />
                </div>
              }
            />

            <StudyModeOptionCard
              title="No Date"
              description="Start reviewing immediately and let the schedule roll forward without a deadline."
              onClick={() => handleTestDateSelection(undefined)}
              topRight={
                <div className="p-2 rounded-lg bg-panel-2 text-muted group-hover:text-accent transition-colors">
                  <Clock size={24} />
                </div>
              }
            />
          </div>
        </div>
      </div>
    );
  }

  if (studyCards.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto pb-20 pt-0 animate-in fade-in">
        <button
          onClick={handleExit}
          className="mb-8 flex items-center gap-3 text-muted hover:text-text transition-colors font-bold uppercase text-xs tracking-wider group"
        >
          <div className="p-2 rounded-full border border-outline group-hover:bg-panel group-hover:border-accent transition-colors">
            <ArrowLeft size={16} />
          </div>
          Back
        </button>

        <div className="bg-panel border border-outline rounded-[28px] p-10 text-center">
          <h2 className="text-3xl font-bold text-text mb-4">No Cards Available</h2>
          <p className="text-muted">Your current filter left SRS with nothing to study.</p>
        </div>
      </div>
    );
  }

  if (!currentCard) {
    return (
      <div className="w-full max-w-4xl mx-auto pb-20 pt-0 animate-in fade-in">
        <button
          onClick={handleExit}
          className="mb-8 flex items-center gap-3 text-muted hover:text-text transition-colors font-bold uppercase text-xs tracking-wider group"
        >
          <div className="p-2 rounded-full border border-outline group-hover:bg-panel group-hover:border-accent transition-colors">
            <ArrowLeft size={16} />
          </div>
          Back
        </button>

        <div className="bg-panel border border-outline rounded-[28px] p-12 text-center">
          <div className="flex justify-center mb-6">
            <Clock size={68} className="text-accent" />
          </div>
          <h2 className="text-4xl font-bold text-text mb-3">All Caught Up</h2>
          <p className="text-lg text-muted mb-8">Nothing is due right now.</p>

          {countdownText && nextDueDate && (
            <div className="max-w-md mx-auto rounded-3xl border border-outline bg-panel-2 p-8 mb-8">
              <div className="text-xs font-bold uppercase tracking-widest text-muted mb-3">Next review in</div>
              <div className="text-5xl font-bold text-accent tracking-tight">{countdownText}</div>
              <div className="mt-3 text-sm text-muted">
                {new Date(nextDueDate).toLocaleString()}
              </div>
            </div>
          )}

          <div className="max-w-sm mx-auto flex flex-col gap-3">
            <button
              type="button"
              onClick={() => setIsManageSessionOpen(true)}
              className="w-full rounded-2xl border border-outline bg-panel-2 px-6 py-4 font-bold text-text hover:border-accent transition-colors"
            >
              Manage Session
            </button>
            <button
              type="button"
              onClick={handleExit}
              className="w-full rounded-2xl border border-outline bg-panel-2 px-6 py-4 font-bold text-text hover:border-accent transition-colors"
            >
              Back to Set
            </button>
          </div>
        </div>

        {isManageSessionOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm" onMouseDown={() => setIsManageSessionOpen(false)}>
            <div className="w-full max-w-4xl rounded-[28px] border border-outline bg-panel shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
              <div className="flex items-start justify-between gap-4 border-b border-outline/60 px-8 py-6">
                <div>
                  <h2 className="text-3xl text-text" style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}>Manage Session</h2>
                </div>
                <button onClick={() => setIsManageSessionOpen(false)} className="rounded-lg p-2 text-muted hover:bg-panel-2 hover:text-text transition-colors">
                  <X size={22} />
                </button>
              </div>
              <div className="px-8 py-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                  <div className="rounded-2xl border border-outline bg-panel-2/70 p-4">
                    <div className="text-xs font-bold uppercase tracking-widest text-muted">Reviewed</div>
                    <div className="mt-2 text-3xl font-bold text-text">{sessionStats.cardsReviewed}</div>
                    <div className="mt-1 text-sm text-muted">This ongoing session</div>
                  </div>
                  <div className="rounded-2xl border border-outline bg-panel-2/70 p-4">
                    <div className="text-xs font-bold uppercase tracking-widest text-muted">Lifetime Reviews</div>
                    <div className="mt-2 text-3xl font-bold text-text">{sessionStats.totalReviews}</div>
                    <div className="mt-1 text-sm text-muted">Across this set</div>
                  </div>
                  <div className="rounded-2xl border border-outline bg-panel-2/70 p-4">
                    <div className="text-xs font-bold uppercase tracking-widest text-muted">Due Now</div>
                    <div className="mt-2 text-3xl font-bold text-red">{dueCards.length}</div>
                    <div className="mt-1 text-sm text-muted">Currently due and ready to review</div>
                  </div>
                  <div className="rounded-2xl border border-outline bg-panel-2/70 p-4">
                    <div className="text-xs font-bold uppercase tracking-widest text-muted">Target Date</div>
                    <div className="mt-2 text-lg font-bold text-text">{sessionStats.testDate ? new Date(sessionStats.testDate).toLocaleDateString() : 'None'}</div>
                    <div className="mt-1 text-sm text-muted">Optional pacing target</div>
                  </div>
                  <div className="rounded-2xl border border-outline bg-panel-2/70 p-4">
                    <div className="text-xs font-bold uppercase tracking-widest text-muted">Next Review</div>
                    <div className="mt-2 text-lg font-bold text-text">{nextDueDate ? new Date(nextDueDate).toLocaleTimeString() : 'None'}</div>
                    <div className="mt-1 text-sm text-muted">{countdownText || 'Nothing scheduled yet'}</div>
                  </div>
                </div>

                <div className="rounded-2xl border border-outline bg-panel-2/50 p-5">
                  <div className="text-sm font-bold uppercase tracking-widest text-muted">Mastery Split</div>
                  <div className="mt-4 flex flex-wrap items-center gap-4 text-text">
                    <span className="flex items-center gap-2"><span className="font-bold">{counts.unseen}</span>{renderMasteryTriangle(0, 'w-3.5 h-3.5')}</span>
                    <span className="flex items-center gap-2"><span className="font-bold">{counts.red}</span>{renderMasteryTriangle(1, 'w-3.5 h-3.5')}</span>
                    <span className="flex items-center gap-2"><span className="font-bold">{counts.yellow}</span>{renderMasteryTriangle(2, 'w-3.5 h-3.5')}</span>
                    <span className="flex items-center gap-2"><span className="font-bold">{counts.green}</span>{renderMasteryTriangle(3, 'w-3.5 h-3.5')}</span>
                    <span className="flex items-center gap-2"><span className="font-bold">{counts.blue}</span>{renderMasteryTriangle(4, 'w-3.5 h-3.5')}</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setIsManageSessionOpen(false);
                    setIsResetConfirmOpen(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-2xl bg-red px-6 py-4 font-bold text-bg hover:opacity-90 transition-opacity"
                >
                  <RotateCcw size={18} />
                  Reset SRS Progress
                </button>
              </div>
            </div>
          </div>
        )}

        {isResetConfirmOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onMouseDown={() => setIsResetConfirmOpen(false)}>
            <div className="bg-panel border border-outline rounded-2xl p-6 w-full max-w-sm shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
              <div className="mb-4">
                <h3 className="text-xl font-bold text-text mb-2">Reset SRS Progress</h3>
                <p className="text-text leading-relaxed">
                  This clears the triangle history and all scheduled review times for this set.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button type="button" onClick={handleReset} className="w-full py-3 bg-panel-2 border border-outline text-red rounded-xl font-bold hover:bg-red/10 transition-colors">
                  Yes, Reset Progress
                </button>
                <button type="button" onClick={() => setIsResetConfirmOpen(false)} className="w-full py-3 text-muted hover:text-text font-medium rounded-xl hover:bg-panel-2 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {showWarningModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm" onMouseDown={onUseLearnInstead}>
            <div className="bg-panel border border-outline rounded-2xl p-6 w-full max-w-md shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
              <div className="mb-4">
                <h3 className="text-xl font-bold text-text mb-2">Cram Warning</h3>
                <p className="text-text leading-relaxed">
                  Your target date is within 48 hours. Learn mode is usually better for last-minute review, but you can continue with SRS if you want.
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={onUseLearnInstead}
                  className="w-full py-3 rounded-xl bg-accent text-bg font-bold transition-colors hover:bg-accent/90"
                >
                  Use Learn Instead
                </button>
                <button
                  type="button"
                  onClick={() => setWarningDismissedForTestDate(sessionStats.testDate ?? null)}
                  className="w-full py-3 rounded-xl border border-outline bg-panel-2 text-text font-bold transition-colors hover:border-accent"
                >
                  Continue with SRS
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto pb-20 pt-0">
      {currentStreak > 0 && (
        <StreakCornerBadge streak={currentStreak} reduceMotion={settings.reduceStreakMotion} />
      )}

      <div className="flex justify-between items-end mb-4 select-none">
        <div className="flex items-center gap-4 mb-2">
          <button
            onClick={handleExit}
            className="flex items-center gap-3 text-muted hover:text-text font-bold uppercase text-xs tracking-wider transition-colors group"
          >
            <div className="p-2 rounded-full border border-outline group-hover:bg-panel group-hover:border-accent transition-colors">
              <ArrowLeft size={16} />
            </div>
            Back
          </button>
        </div>

        <div className="flex flex-wrap justify-end items-stretch gap-3">
          <button
            type="button"
            onClick={() => setIsManageSessionOpen(true)}
            className="h-14 px-5 rounded-xl border border-outline bg-panel text-sm text-text font-bold hover:border-accent hover:text-accent transition-colors inline-flex items-center whitespace-nowrap"
          >
            Manage Session
          </button>
          <div className="flex gap-3">
            {[
              { level: 0, value: counts.unseen },
              { level: 1, value: counts.red },
              { level: 2, value: counts.yellow },
              { level: 3, value: counts.green },
              { level: 4, value: counts.blue }
            ].map(item => (
              <div
                key={item.level}
                className="h-14 w-16 flex flex-col items-center justify-center rounded-xl border bg-panel border-outline"
              >
                <span className="text-lg font-bold leading-none mb-1 text-text">{item.value}</span>
                {renderMasteryTriangle(item.level)}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-panel border border-outline rounded-[24px] shadow-2xl p-10 relative overflow-visible transition-all duration-500">
        <div className="flex justify-between items-start mb-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleStar}
              className={clsx(
                "transition-all hover:scale-110 active:scale-95",
                currentCard.star ? "text-yellow" : "text-muted hover:text-yellow"
              )}
              title={currentCard.star ? 'Unstar' : 'Star'}
            >
              <Star size={24} fill={currentCard.star ? "currentColor" : "none"} />
            </button>
            <div className="text-xs font-bold uppercase tracking-widest text-muted">
              {promptLabel}
            </div>
          </div>

          <div className="flex items-center">
            {renderMasteryTriangle(currentCard.srsMastery || 0, 'w-7 h-7')}
          </div>
        </div>

        <div className="min-h-[220px] mb-10 flex flex-col justify-center">
          <div className={clsx('flex flex-col gap-6', promptImage ? 'lg:flex-row lg:items-center' : '')}>
            {promptImage && (
              <div className="flex-shrink-0 mx-auto lg:mx-0">
                <img
                  src={promptImage}
                  alt="Card prompt"
                  className="rounded-xl max-h-[300px] w-auto object-contain border border-outline shadow-sm bg-bg/50"
                />
              </div>
            )}

            <div className="flex-1 min-w-0">
              <SideFields card={currentCard} fields={promptFields} />

              {isAnsweringWithDefinition ? (
                <div className={clsx("font-medium leading-tight text-text font-sans text-left transition-all", promptTextSizeClass)}>
                  {currentCard.term.map((term, index) => (
                    <div key={`${currentCard.id}-term-${index}`}>{renderInline(term, `srs-term-${index}`)}</div>
                  ))}
                  {currentCard.year && (
                    <div className="mt-4 inline-flex items-center px-3 py-1 rounded-lg bg-panel-2 border border-outline text-sm font-mono text-text">
                      {currentCard.year}
                    </div>
                  )}
                </div>
              ) : (
                <div className={clsx("font-medium leading-tight text-text font-sans text-left transition-all", promptTextSizeClass)}>
                  {renderMarkdown(currentCard.content)}
                </div>
              )}
            </div>
          </div>
        </div>

        {isFlipped && (
          <div className="mb-10 rounded-3xl border border-outline bg-panel-2 p-6">
            <div className="text-xs font-bold uppercase tracking-widest text-muted mb-4">{answerLabel}</div>
            <SideFields card={currentCard} fields={answerFields} />

            {isAnsweringWithDefinition ? (
              <div className="text-text prose-content text-lg leading-relaxed">
                {renderMarkdown(currentCard.content)}
              </div>
            ) : (
              <div className="text-3xl font-medium leading-tight text-text">
                {currentCard.term.map((term, index) => (
                  <div key={`${currentCard.id}-answer-term-${index}`}>{renderInline(term, `srs-answer-term-${index}`)}</div>
                ))}
                {currentCard.year && (
                  <div className="mt-4 inline-flex items-center px-3 py-1 rounded-lg bg-panel border border-outline text-sm font-mono text-text">
                    {currentCard.year}
                  </div>
                )}
              </div>
            )}

            {answerImage && (
              <img
                src={answerImage}
                alt="Card answer"
                className="mt-6 rounded-xl max-h-[260px] w-auto object-contain border border-outline shadow-sm bg-bg/50"
              />
            )}
          </div>
        )}
      </div>

      {!isFlipped ? (
        <div className="mt-6 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={handleFlip}
            className="flex items-center gap-2 px-12 py-4 rounded-xl font-bold text-lg transition-all bg-accent text-bg hover:opacity-90 shadow-xl shadow-accent/20"
          >
            Reveal Answer
          </button>
          <div className="flex justify-center gap-4 text-xs text-muted opacity-60 uppercase tracking-wider">
            <span><kbd className="px-1.5 py-0.5 bg-panel-2 rounded border border-outline font-mono">Space</kbd> flip</span>
            <span><kbd className="px-1.5 py-0.5 bg-panel-2 rounded border border-outline font-mono">Enter</kbd> flip</span>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
            <SrsActionButton
              rating={1}
              title="Red"
              subtitle="Needs review"
              intervalText={previewIntervals?.[0] || '1m'}
              onClick={() => handleRating(1)}
            />
            <SrsActionButton
              rating={2}
              title="Yellow"
              subtitle="Shaky"
              intervalText={previewIntervals?.[1] || '10m'}
              onClick={() => handleRating(2)}
            />
            <SrsActionButton
              rating={3}
              title="Green"
              subtitle="Solid recall"
              intervalText={previewIntervals?.[2] || '1h'}
              onClick={() => handleRating(3)}
            />
            <SrsActionButton
              rating={4}
              title="Blue"
              subtitle="Locked in"
              intervalText={previewIntervals?.[3] || '12h'}
              onClick={() => handleRating(4)}
            />
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-muted opacity-60">
            {shortcutKeys.map((shortcut, index) => (
              <span key={shortcut}>
                <kbd className="px-1.5 py-0.5 bg-panel-2 rounded border border-outline font-mono">{shortcut}</kbd> {['red', 'yellow', 'green', 'blue'][index]}
              </span>
            ))}
          </div>
        </>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <span>{reviewQueue.length} ready now</span>
        <span>{sessionStats.cardsReviewed} reviewed this session</span>
        <span>{sessionStats.testDate ? `Target: ${new Date(sessionStats.testDate).toLocaleDateString()}` : 'No target date'}</span>
      </div>

      {isManageSessionOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm" onMouseDown={() => setIsManageSessionOpen(false)}>
          <div className="w-full max-w-4xl rounded-[28px] border border-outline bg-panel shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 border-b border-outline/60 px-8 py-6">
              <div>
                <h2 className="text-3xl text-text" style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}>
                  Manage Session
                </h2>
              </div>
              <button onClick={() => setIsManageSessionOpen(false)} className="rounded-lg p-2 text-muted hover:bg-panel-2 hover:text-text transition-colors">
                <X size={22} />
              </button>
            </div>

            <div className="px-8 py-8 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                <div className="rounded-2xl border border-outline bg-panel-2/70 p-4">
                  <div className="text-xs font-bold uppercase tracking-widest text-muted">Reviewed</div>
                  <div className="mt-2 text-3xl font-bold text-text">{sessionStats.cardsReviewed}</div>
                  <div className="mt-1 text-sm text-muted">This ongoing session</div>
                </div>
                <div className="rounded-2xl border border-outline bg-panel-2/70 p-4">
                  <div className="text-xs font-bold uppercase tracking-widest text-muted">Lifetime Reviews</div>
                  <div className="mt-2 text-3xl font-bold text-text">{sessionStats.totalReviews}</div>
                  <div className="mt-1 text-sm text-muted">Across this set</div>
                </div>
                <div className="rounded-2xl border border-outline bg-panel-2/70 p-4">
                  <div className="text-xs font-bold uppercase tracking-widest text-muted">Due Now</div>
                  <div className="mt-2 text-3xl font-bold text-red">{dueCards.length}</div>
                  <div className="mt-1 text-sm text-muted">Cards whose due time has arrived</div>
                </div>
                <div className="rounded-2xl border border-outline bg-panel-2/70 p-4">
                  <div className="text-xs font-bold uppercase tracking-widest text-muted">Target Date</div>
                  <div className="mt-2 text-lg font-bold text-text">
                    {sessionStats.testDate ? new Date(sessionStats.testDate).toLocaleDateString() : 'None'}
                  </div>
                  <div className="mt-1 text-sm text-muted">Optional pacing target</div>
                </div>
                <div className="rounded-2xl border border-outline bg-panel-2/70 p-4">
                  <div className="text-xs font-bold uppercase tracking-widest text-muted">Next Review</div>
                  <div className="mt-2 text-lg font-bold text-text">
                    {nextDueDate ? new Date(nextDueDate).toLocaleTimeString() : 'None'}
                  </div>
                  <div className="mt-1 text-sm text-muted">{countdownText || 'Nothing scheduled yet'}</div>
                </div>
              </div>

              <div className="rounded-2xl border border-outline bg-panel-2/50 p-5">
                <div className="text-sm font-bold uppercase tracking-widest text-muted">Mastery Split</div>
                <div className="mt-4 flex flex-wrap items-center gap-4 text-text">
                  <span className="flex items-center gap-2"><span className="font-bold">{counts.unseen}</span>{renderMasteryTriangle(0, 'w-3.5 h-3.5')}</span>
                  <span className="flex items-center gap-2"><span className="font-bold">{counts.red}</span>{renderMasteryTriangle(1, 'w-3.5 h-3.5')}</span>
                  <span className="flex items-center gap-2"><span className="font-bold">{counts.yellow}</span>{renderMasteryTriangle(2, 'w-3.5 h-3.5')}</span>
                  <span className="flex items-center gap-2"><span className="font-bold">{counts.green}</span>{renderMasteryTriangle(3, 'w-3.5 h-3.5')}</span>
                  <span className="flex items-center gap-2"><span className="font-bold">{counts.blue}</span>{renderMasteryTriangle(4, 'w-3.5 h-3.5')}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-outline bg-panel-2/50 p-5">
                <div className="text-sm font-bold uppercase tracking-widest text-muted">Current Card</div>
                <div className="mt-3 text-xl font-bold text-text line-clamp-2">
                  {currentCard.term.join(' / ')}
                </div>
                <div className="mt-2 text-sm text-muted">
                  {reviewQueue.length > 1 ? `${reviewQueue.length - 1} more cards already due.` : 'This is the last due card right now.'}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsManageSessionOpen(false);
                  setIsResetConfirmOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-2xl bg-red px-6 py-4 font-bold text-bg hover:opacity-90 transition-opacity"
              >
                <RotateCcw size={18} />
                Reset SRS Progress
              </button>
            </div>
          </div>
        </div>
      )}

      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onMouseDown={() => setIsResetConfirmOpen(false)}>
          <div className="bg-panel border border-outline rounded-2xl p-6 w-full max-w-sm shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mb-4">
              <h3 className="text-xl font-bold text-text mb-2">Reset SRS Progress</h3>
              <p className="text-text leading-relaxed">
                This clears the triangle history and all scheduled review times for this set.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button type="button" onClick={handleReset} className="w-full py-3 bg-panel-2 border border-outline text-red rounded-xl font-bold hover:bg-red/10 transition-colors">
                Yes, Reset Progress
              </button>
              <button type="button" onClick={() => setIsResetConfirmOpen(false)} className="w-full py-3 text-muted hover:text-text font-medium rounded-xl hover:bg-panel-2 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {showWarningModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm" onMouseDown={onUseLearnInstead}>
          <div className="bg-panel border border-outline rounded-2xl p-6 w-full max-w-md shadow-2xl" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mb-4">
              <h3 className="text-xl font-bold text-text mb-2">Cram Warning</h3>
              <p className="text-text leading-relaxed">
                Your target date is within 48 hours. Learn mode is usually better for last-minute review, but you can continue with SRS if you want.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={onUseLearnInstead}
                className="w-full py-3 rounded-xl bg-accent text-bg font-bold transition-colors hover:bg-accent/90"
              >
                Use Learn Instead
              </button>
              <button
                type="button"
                onClick={() => setWarningDismissedForTestDate(sessionStats.testDate ?? null)}
                className="w-full py-3 rounded-xl border border-outline bg-panel-2 text-text font-bold transition-colors hover:border-accent"
              >
                Continue with SRS
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
