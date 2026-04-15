import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronDown, Clock3, RotateCcw, SlidersHorizontal, XCircle, Zap } from 'lucide-react';
import clsx from 'clsx';
import { Card, CardSet, Settings } from '../types';
import { checkAnswer, checkDefinitionAnswer, renderInline } from '../utils';
import { CursorTooltip } from './CursorTooltip';
import { StudyModeOptionCard } from './StudyModeOptionCard';

interface ExamModeProps {
  set: CardSet;
  settings: Settings;
  onExit: () => void;
}

type ExamPhase = 'setup' | 'running' | 'results';
type ExamFinishReason = 'submitted' | 'timeout';
type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer';

interface ExamQuestion {
  id: string;
  cardKey: string;
  card: Card;
  type: QuestionType;
  prompt: string;
  correctAnswer: string;
  options?: string[];
  statementAnswer?: string;
  trueFalseExpected?: boolean;
}

interface ExamResponse {
  choice?: string;
  tf?: boolean;
  text?: string;
}

interface EvaluatedExamResult {
  questionId: string;
  question: ExamQuestion;
  isCorrect: boolean;
  isAnswered: boolean;
  selectedDisplay: string | null;
  correctDisplay: string;
}

type QuestionMixWeights = Record<QuestionType, number>;
type MixKnob = 'first' | 'second';

const MIX_TYPE_ORDER: QuestionType[] = ['multiple_choice', 'true_false', 'short_answer'];

const DEFAULT_MIX_BREAKPOINTS = {
  first: 45,
  second: 70
};

const BETA_BADGE_CLASSNAME = 'rounded-full border border-yellow/35 bg-yellow/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-yellow';

const normalizeChoice = (value: string): string => value.trim().toLowerCase();

const getShuffled = <T,>(items: T[]): T[] => {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
};

const formatTimer = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const getGradeLabel = (percent: number): string => {
  if (percent >= 97) return 'A+';
  if (percent >= 93) return 'A';
  if (percent >= 90) return 'A-';
  if (percent >= 87) return 'B+';
  if (percent >= 83) return 'B';
  if (percent >= 80) return 'B-';
  if (percent >= 77) return 'C+';
  if (percent >= 73) return 'C';
  if (percent >= 70) return 'C-';
  if (percent >= 60) return 'D';
  return 'F';
};

const getQuestionTypeLabel = (type: QuestionType): string => {
  if (type === 'multiple_choice') return 'Multiple Choice';
  if (type === 'true_false') return 'True / False';
  return 'Typed Response';
};

const getAnsweredState = (question: ExamQuestion, response?: ExamResponse): boolean => {
  if (!response) return false;

  if (question.type === 'multiple_choice') return Boolean(response.choice);
  if (question.type === 'true_false') return typeof response.tf === 'boolean';
  return Boolean(response.text?.trim());
};

const getMixDescription = (weights: QuestionMixWeights): string => {
  const total = MIX_TYPE_ORDER.reduce((sum, key) => sum + Math.max(0, weights[key]), 0);
  if (total <= 0) {
    return 'Balanced fallback: equal mix of multiple choice, true/false, and typed responses.';
  }

  const shares = MIX_TYPE_ORDER.map(type => ({
    type,
    share: Math.round((Math.max(0, weights[type]) / total) * 100)
  })).sort((a, b) => b.share - a.share);

  const top = shares[0];
  const second = shares[1];

  if (top.share >= 70) {
    return `This test will be heavily ${getQuestionTypeLabel(top.type).toLowerCase()} focused (${top.share}%).`;
  }

  if (top.share >= 45 && second.share >= 30) {
    return `This test will lean toward ${getQuestionTypeLabel(top.type).toLowerCase()} with a strong ${getQuestionTypeLabel(second.type).toLowerCase()} secondary component.`;
  }

  return 'This test will be mixed across all three question types.';
};

const getProjectedTypeCounts = (totalQuestions: number, weights: QuestionMixWeights): Record<QuestionType, number> => {
  if (totalQuestions <= 0) {
    return { multiple_choice: 0, true_false: 0, short_answer: 0 };
  }

  const positiveTotal = MIX_TYPE_ORDER.reduce((sum, key) => sum + Math.max(0, weights[key]), 0);
  const normalizedWeights = positiveTotal > 0
    ? weights
    : { multiple_choice: 1, true_false: 1, short_answer: 1 };
  const normalizedTotal = positiveTotal > 0 ? positiveTotal : 3;

  const raw = MIX_TYPE_ORDER.map(type => ({
    type,
    value: (Math.max(0, normalizedWeights[type]) / normalizedTotal) * totalQuestions
  }));

  const counts: Record<QuestionType, number> = {
    multiple_choice: 0,
    true_false: 0,
    short_answer: 0
  };

  let assigned = 0;
  raw.forEach(item => {
    const floored = Math.floor(item.value);
    counts[item.type] = floored;
    assigned += floored;
  });

  let remaining = totalQuestions - assigned;
  if (remaining > 0) {
    const byFraction = [...raw].sort((a, b) => {
      const fractionA = a.value - Math.floor(a.value);
      const fractionB = b.value - Math.floor(b.value);
      return fractionB - fractionA;
    });

    let idx = 0;
    while (remaining > 0) {
      const target = byFraction[idx % byFraction.length];
      counts[target.type] += 1;
      remaining -= 1;
      idx += 1;
    }
  }

  return counts;
};

const clampNumber = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const getNumericInputValue = (value: string, fallback: number): number => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
};

const MIX_COLOR_CLASSES: Record<QuestionType, { text: string; border: string; bg: string }> = {
  multiple_choice: {
    text: 'text-blue',
    border: 'border-blue/40',
    bg: 'bg-blue/15'
  },
  true_false: {
    text: 'text-yellow',
    border: 'border-yellow/40',
    bg: 'bg-yellow/15'
  },
  short_answer: {
    text: 'text-green',
    border: 'border-green/40',
    bg: 'bg-green/15'
  }
};

const EXAM_TOOLTIPS = {
  scope: 'Choose whether the exam uses all cards or only starred cards from this set.',
  questionCount: 'How many total questions appear in this exam.',
  timeLimit: 'Turn on a countdown. If time runs out, the exam submits automatically.',
  questionMix: 'Drag the two knobs to split the exam between multiple choice, true/false, and typed response.'
};

const ExamSettingRow: React.FC<{
  label: string;
  tooltip: string;
  settings: Settings;
  children: React.ReactNode;
}> = ({ label, tooltip, settings, children }) => (
  <div className="flex items-center justify-between gap-4 p-3 bg-panel-2 rounded-xl border border-transparent hover:border-accent transition-all">
    <CursorTooltip content={tooltip} isEnabled={!settings.hideTooltips} tooltipClassName="w-80 max-w-[90vw]">
      <span className="font-medium text-text">{label}</span>
    </CursorTooltip>
    <div className="flex items-center justify-end">{children}</div>
  </div>
);

export const ExamMode: React.FC<ExamModeProps> = ({ set, settings, onExit }) => {
  const [phase, setPhase] = useState<ExamPhase>('setup');
  const [setupMode, setSetupMode] = useState<'custom' | null>(null);
  const [starredOnly, setStarredOnly] = useState(settings.starredOnly);
  const [questionCountInput, setQuestionCountInput] = useState('20');
  const [hasTimeLimit, setHasTimeLimit] = useState(true);
  const [timeLimitMinutesInput, setTimeLimitMinutesInput] = useState('30');
  const [mixBreakpoints, setMixBreakpoints] = useState(DEFAULT_MIX_BREAKPOINTS);
  const [activeKnob, setActiveKnob] = useState<MixKnob | null>(null);
  const [isScopeDropdownOpen, setIsScopeDropdownOpen] = useState(false);

  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [responses, setResponses] = useState<Record<string, ExamResponse>>({});
  const [evaluatedResults, setEvaluatedResults] = useState<EvaluatedExamResult[]>([]);
  const [finishReason, setFinishReason] = useState<ExamFinishReason>('submitted');
  const [examStartedAt, setExamStartedAt] = useState<number | null>(null);
  const [submittedAt, setSubmittedAt] = useState<number | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);
  const [showSubmitWarning, setShowSubmitWarning] = useState(false);

  const deadlineRef = useRef<number | null>(null);
  const mixBarRef = useRef<HTMLDivElement | null>(null);
  const scopeDropdownRef = useRef<HTMLDivElement | null>(null);

  const getCardKey = useCallback((card: Card): string => {
    if (set.isMultistudy && card.originalSetId) return `${card.originalSetId}::${card.id}`;
    return card.id;
  }, [set.isMultistudy]);

  const starredCards = useMemo(() => set.cards.filter(card => card.star), [set.cards]);
  const availableCards = useMemo(
    () => (starredOnly ? starredCards : set.cards),
    [set.cards, starredCards, starredOnly]
  );

  useEffect(() => {
    if (starredOnly && starredCards.length === 0) {
      setStarredOnly(false);
    }
  }, [starredOnly, starredCards.length]);

  useEffect(() => {
    if (!isScopeDropdownOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (scopeDropdownRef.current && !scopeDropdownRef.current.contains(event.target as Node)) {
        setIsScopeDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
    };
  }, [isScopeDropdownOpen]);

  const maxQuestionCount = Math.max(1, availableCards.length);
  const parsedQuestionCount = clampNumber(
    getNumericInputValue(questionCountInput, Math.min(20, maxQuestionCount)),
    1,
    maxQuestionCount
  );
  const parsedTimeLimitMinutes = hasTimeLimit
    ? clampNumber(getNumericInputValue(timeLimitMinutesInput, 30), 1, 600)
    : 0;

  const mixWeights = useMemo<QuestionMixWeights>(() => ({
    multiple_choice: mixBreakpoints.first,
    true_false: Math.max(0, mixBreakpoints.second - mixBreakpoints.first),
    short_answer: Math.max(0, 100 - mixBreakpoints.second)
  }), [mixBreakpoints.first, mixBreakpoints.second]);

  useEffect(() => {
    setQuestionCountInput(prev => String(clampNumber(getNumericInputValue(prev, parsedQuestionCount), 1, maxQuestionCount)));
  }, [maxQuestionCount]);

  const promptLabel = settings.answerWithDefinition ? (set.termLabel || 'Term') : (set.definitionLabel || 'Definition');
  const answerLabel = settings.answerWithDefinition ? (set.definitionLabel || 'Definition') : (set.termLabel || 'Term');

  const getPromptText = useCallback((card: Card): string => (
    settings.answerWithDefinition ? card.term.join(' / ') : card.content
  ), [settings.answerWithDefinition]);

  const getCanonicalAnswer = useCallback((card: Card): string => (
    settings.answerWithDefinition
      ? (card.content || '')
      : (card.term.find(value => value.trim()) || '')
  ), [settings.answerWithDefinition]);

  const buildTypeSequence = useCallback((totalQuestions: number, weights: QuestionMixWeights): QuestionType[] => {
    const counts = getProjectedTypeCounts(totalQuestions, weights);
    const sequence: QuestionType[] = [];

    MIX_TYPE_ORDER.forEach(type => {
      for (let i = 0; i < counts[type]; i += 1) {
        sequence.push(type);
      }
    });

    return getShuffled(sequence);
  }, []);

  const buildQuestions = useCallback((sourceCards: Card[], desiredCount: number): ExamQuestion[] => {
    const cards = getShuffled(sourceCards).slice(0, desiredCount);
    const typeSequence = buildTypeSequence(cards.length, mixWeights);
    const answerPool = Array.from(
      new Set(
        sourceCards
          .map(getCanonicalAnswer)
          .map(value => value.trim())
          .filter(Boolean)
      )
    );

    return cards.map((card, index) => {
      const prompt = getPromptText(card).trim() || 'No prompt available for this card.';
      const canonicalAnswer = getCanonicalAnswer(card).trim() || 'No answer available.';
      const questionType = typeSequence[index] || 'short_answer';
      const normalizedCanonical = normalizeChoice(canonicalAnswer);
      const questionBase = {
        id: `${getCardKey(card)}::${index}`,
        cardKey: getCardKey(card),
        card,
        prompt,
        correctAnswer: canonicalAnswer
      };

      if (questionType === 'multiple_choice') {
        const distractors = getShuffled(
          answerPool.filter(answer => normalizeChoice(answer) !== normalizedCanonical)
        ).slice(0, 3);

        if (distractors.length >= 1) {
          return {
            ...questionBase,
            type: 'multiple_choice',
            options: getShuffled([canonicalAnswer, ...distractors])
          } satisfies ExamQuestion;
        }
      }

      if (questionType === 'true_false') {
        const wrongChoices = getShuffled(
          answerPool.filter(answer => normalizeChoice(answer) !== normalizedCanonical)
        );

        if (wrongChoices.length > 0) {
          const presentTrueStatement = Math.random() >= 0.5;
          return {
            ...questionBase,
            type: 'true_false',
            statementAnswer: presentTrueStatement ? canonicalAnswer : wrongChoices[0],
            trueFalseExpected: presentTrueStatement
          } satisfies ExamQuestion;
        }
      }

      return {
        ...questionBase,
        type: 'short_answer'
      } satisfies ExamQuestion;
    });
  }, [buildTypeSequence, getCanonicalAnswer, getCardKey, getPromptText, mixWeights]);

  const evaluateQuestion = useCallback((question: ExamQuestion, response?: ExamResponse): EvaluatedExamResult => {
    if (question.type === 'multiple_choice') {
      const selected = response?.choice?.trim() || null;
      const isAnswered = Boolean(selected);
      const isCorrect = isAnswered && normalizeChoice(selected) === normalizeChoice(question.correctAnswer);
      return {
        questionId: question.id,
        question,
        isCorrect: Boolean(isCorrect),
        isAnswered,
        selectedDisplay: selected,
        correctDisplay: question.correctAnswer
      };
    }

    if (question.type === 'true_false') {
      const selected = response?.tf;
      const isAnswered = typeof selected === 'boolean';
      const isCorrect = isAnswered && selected === question.trueFalseExpected;
      return {
        questionId: question.id,
        question,
        isCorrect: Boolean(isCorrect),
        isAnswered,
        selectedDisplay: isAnswered ? (selected ? 'True' : 'False') : null,
        correctDisplay: question.trueFalseExpected ? 'True' : 'False'
      };
    }

    const typedValue = response?.text?.trim() || '';
    const isAnswered = typedValue.length > 0;
    const strict = !settings.forgiveSpellingErrors;
    const isCorrect = isAnswered
      ? (
        settings.answerWithDefinition
          ? checkDefinitionAnswer(typedValue, '', {}, question.card, strict).isMatch
          : checkAnswer(typedValue, '', {}, question.card, strict).isMatch
      )
      : false;

    return {
      questionId: question.id,
      question,
      isCorrect,
      isAnswered,
      selectedDisplay: isAnswered ? typedValue : null,
      correctDisplay: question.correctAnswer
    };
  }, [settings.answerWithDefinition, settings.forgiveSpellingErrors]);

  const finalizeExam = useCallback((reason: ExamFinishReason) => {
    const now = Date.now();
    const evaluated = questions.map(question => evaluateQuestion(question, responses[question.id]));
    setEvaluatedResults(evaluated);
    setFinishReason(reason);
    setSubmittedAt(now);
    setPhase('results');
    setShowSubmitWarning(false);
    deadlineRef.current = null;
    setTimeLeftMs(reason === 'timeout' ? 0 : timeLeftMs);
  }, [evaluateQuestion, questions, responses, timeLeftMs]);

  const startExam = useCallback((sourceCards: Card[], requestedCount: number, overrideTimeLimitMinutes?: number) => {
    if (sourceCards.length === 0) return;

    const safeCount = clampNumber(requestedCount, 1, sourceCards.length);
    const generatedQuestions = buildQuestions(sourceCards, safeCount);
    if (generatedQuestions.length === 0) return;

    const now = Date.now();
    const minutes = typeof overrideTimeLimitMinutes === 'number' ? overrideTimeLimitMinutes : parsedTimeLimitMinutes;
    const durationMs = minutes > 0 ? minutes * 60 * 1000 : null;

    setQuestions(generatedQuestions);
    setResponses({});
    setEvaluatedResults([]);
    setFinishReason('submitted');
    setExamStartedAt(now);
    setSubmittedAt(null);
    setShowSubmitWarning(false);
    setPhase('running');

    if (durationMs) {
      deadlineRef.current = now + durationMs;
      setTimeLeftMs(durationMs);
    } else {
      deadlineRef.current = null;
      setTimeLeftMs(null);
    }
  }, [buildQuestions, parsedTimeLimitMinutes]);

  useEffect(() => {
    if (phase !== 'running' || deadlineRef.current === null) return;

    const tick = () => {
      if (deadlineRef.current === null) return;
      const remaining = deadlineRef.current - Date.now();

      if (remaining <= 0) {
        setTimeLeftMs(0);
        finalizeExam('timeout');
        return;
      }

      setTimeLeftMs(remaining);
    };

    tick();
    const interval = window.setInterval(tick, 250);
    return () => window.clearInterval(interval);
  }, [finalizeExam, phase]);

  const answeredCount = useMemo(
    () => questions.reduce((count, question) => count + (getAnsweredState(question, responses[question.id]) ? 1 : 0), 0),
    [questions, responses]
  );
  const unansweredCount = Math.max(0, questions.length - answeredCount);
  const progressPercent = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  const score = useMemo(() => {
    const total = evaluatedResults.length;
    const correctCount = evaluatedResults.filter(result => result.isCorrect).length;
    const answered = evaluatedResults.filter(result => result.isAnswered).length;
    const unanswered = total - answered;
    const percent = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const elapsedMs = submittedAt && examStartedAt ? Math.max(0, submittedAt - examStartedAt) : 0;
    const avgPerAnswered = answered > 0 ? Math.round(elapsedMs / answered) : 0;

    return {
      total,
      correctCount,
      answered,
      unanswered,
      percent,
      grade: getGradeLabel(percent),
      elapsedMs,
      avgPerAnswered
    };
  }, [evaluatedResults, examStartedAt, submittedAt]);

  const incorrectResults = useMemo(
    () => evaluatedResults.filter(result => !result.isCorrect),
    [evaluatedResults]
  );

  const projectedTypeCounts = useMemo(
    () => getProjectedTypeCounts(parsedQuestionCount, mixWeights),
    [mixWeights, parsedQuestionCount]
  );

  const mixDescription = useMemo(() => getMixDescription(mixWeights), [mixWeights]);

  const handleRetryAll = useCallback(() => {
    startExam(availableCards, parsedQuestionCount);
  }, [availableCards, parsedQuestionCount, startExam]);

  const handleRetryIncorrect = useCallback(() => {
    if (incorrectResults.length === 0) return;

    const dedupedCards = new Map<string, Card>();
    incorrectResults.forEach(result => {
      dedupedCards.set(result.question.cardKey, result.question.card);
    });

    const cards = Array.from(dedupedCards.values());
    startExam(cards, cards.length);
  }, [incorrectResults, startExam]);

  const handleAttemptSubmit = () => {
    if (unansweredCount > 0) {
      setShowSubmitWarning(true);
      return;
    }
    finalizeExam('submitted');
  };

  const clientXToBarPercent = useCallback((clientX: number): number => {
    const bar = mixBarRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const raw = ((clientX - rect.left) / rect.width) * 100;
    return clampNumber(raw, 0, 100);
  }, []);

  const setKnobPositionFromClientX = useCallback((knob: MixKnob, clientX: number) => {
    const pct = clientXToBarPercent(clientX);
    setMixBreakpoints(prev => {
      if (knob === 'first') {
        return { ...prev, first: clampNumber(pct, 0, prev.second) };
      }
      return { ...prev, second: clampNumber(pct, prev.first, 100) };
    });
  }, [clientXToBarPercent]);

  useEffect(() => {
    if (!activeKnob) return;

    const handleMouseMove = (event: MouseEvent) => {
      event.preventDefault();
      setKnobPositionFromClientX(activeKnob, event.clientX);
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!event.touches[0]) return;
      event.preventDefault();
      setKnobPositionFromClientX(activeKnob, event.touches[0].clientX);
    };

    const stopDragging = () => setActiveKnob(null);

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', stopDragging);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', stopDragging);
    window.addEventListener('touchcancel', stopDragging);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', stopDragging);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', stopDragging);
      window.removeEventListener('touchcancel', stopDragging);
    };
  }, [activeKnob, setKnobPositionFromClientX]);

  const handleTrackPointerStart = (clientX: number) => {
    const pct = clientXToBarPercent(clientX);
    const distFirst = Math.abs(pct - mixBreakpoints.first);
    const distSecond = Math.abs(pct - mixBreakpoints.second);
    const targetKnob: MixKnob = distFirst <= distSecond ? 'first' : 'second';
    setKnobPositionFromClientX(targetKnob, clientX);
    setActiveKnob(targetKnob);
  };

  const handleStartAutomaticExam = () => {
    if (set.cards.length === 0) return;

    const automaticCount = clampNumber(Math.round(set.cards.length * 0.75), 1, Math.min(40, set.cards.length));
    const automaticMinutes = automaticCount <= 15 ? 20 : automaticCount <= 30 ? 30 : 45;
    const automaticBreakpoints = DEFAULT_MIX_BREAKPOINTS;

    setStarredOnly(false);
    setQuestionCountInput(String(automaticCount));
    setHasTimeLimit(true);
    setTimeLimitMinutesInput(String(automaticMinutes));
    setMixBreakpoints(automaticBreakpoints);

    startExam(set.cards, automaticCount, automaticMinutes);
  };

  const canStartExam = availableCards.length > 0;

  if (phase === 'setup') {
    return (
      <div className="w-full max-w-5xl mx-auto pb-20 pt-0 animate-in fade-in">
        <button
          onClick={onExit}
          className="mb-8 flex items-center gap-3 text-muted hover:text-text transition-colors font-bold uppercase text-xs tracking-wider group"
        >
          <div className="p-2 rounded-full border border-outline group-hover:bg-panel group-hover:border-accent transition-colors">
            <ArrowLeft size={16} />
          </div>
          Back
        </button>

        <div className="max-w-4xl mx-auto">
          {setupMode === null && (
            <>
              <div className="text-center mb-12">
                <div className="mb-3 flex flex-wrap items-center justify-center gap-3">
                  <h1
                    className="text-4xl text-text"
                    style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}
                  >
                    Exam Mode
                  </h1>
                  <span className={BETA_BADGE_CLASSNAME}>Beta</span>
                </div>
                <p className="text-muted text-lg">Choose how to configure this exam.</p>
              </div>

              <div className="mb-8 mx-auto max-w-2xl rounded-2xl border border-yellow/25 bg-yellow/10 px-5 py-4 text-left">
                <div className="flex items-start gap-3">
                  <AlertTriangle size={18} className="mt-0.5 shrink-0 text-yellow" />
                  <p className="text-sm leading-relaxed text-text">
                    Exam mode is still rough around the edges. You may run into uneven question quality or grading while it is being refined.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
                <StudyModeOptionCard
                  title="Automatic"
                  description="Instantly start with a recommended question count, timer, and balanced mix."
                  onClick={handleStartAutomaticExam}
                  disabled={!canStartExam}
                  topLeft={<span className={BETA_BADGE_CLASSNAME}>Beta</span>}
                  topRight={
                    <div className="p-2 rounded-lg bg-panel-2 text-muted group-hover:text-accent transition-colors">
                      <Zap size={24} />
                    </div>
                  }
                  className="pt-16"
                />
                <StudyModeOptionCard
                  title="Custom"
                  description="Adjust card scope, question count, timer, and mix before starting."
                  onClick={() => setSetupMode('custom')}
                  disabled={!canStartExam}
                  topLeft={<span className={BETA_BADGE_CLASSNAME}>Beta</span>}
                  topRight={
                    <div className="p-2 rounded-lg bg-panel-2 text-muted group-hover:text-accent transition-colors">
                      <SlidersHorizontal size={24} />
                    </div>
                  }
                  className="pt-16"
                />
              </div>
            </>
          )}

          {setupMode === 'custom' && (
            <div className="bg-panel border border-outline rounded-2xl p-6 space-y-4">
              <button
                type="button"
                onClick={() => setSetupMode(null)}
                className="text-xs font-bold uppercase tracking-widest text-muted hover:text-text transition-colors"
              >
                Back to Mode Selection
              </button>

              <ExamSettingRow label="Card Scope" tooltip={EXAM_TOOLTIPS.scope} settings={settings}>
                <div className="relative min-w-[170px]" ref={scopeDropdownRef}>
                  <button
                    type="button"
                    onClick={() => setIsScopeDropdownOpen(prev => !prev)}
                    className="w-full bg-panel border border-outline rounded-lg px-3 py-2 text-sm font-bold focus:border-accent outline-none transition-colors flex items-center justify-between gap-2 hover:border-accent"
                  >
                    <span>{starredOnly ? `Starred (${starredCards.length})` : `All Cards (${set.cards.length})`}</span>
                    <ChevronDown size={14} className={clsx('opacity-60 transition-transform', isScopeDropdownOpen && 'rotate-180')} />
                  </button>

                  {isScopeDropdownOpen && (
                    <div className="absolute top-full right-0 mt-2 w-full bg-panel border border-outline rounded-xl shadow-xl z-50 overflow-hidden animate-in zoom-in-95">
                      <button
                        type="button"
                        onClick={() => {
                          setStarredOnly(false);
                          setIsScopeDropdownOpen(false);
                        }}
                        className={clsx(
                          'w-full text-left px-3 py-2 text-sm transition-colors',
                          !starredOnly ? 'text-accent font-bold bg-accent/5' : 'text-text hover:bg-panel-2'
                        )}
                      >
                        All Cards ({set.cards.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (starredCards.length === 0) return;
                          setStarredOnly(true);
                          setIsScopeDropdownOpen(false);
                        }}
                        disabled={starredCards.length === 0}
                        className={clsx(
                          'w-full text-left px-3 py-2 text-sm transition-colors',
                          starredOnly ? 'text-accent font-bold bg-accent/5' : 'text-text hover:bg-panel-2',
                          starredCards.length === 0 && 'opacity-50 cursor-not-allowed'
                        )}
                      >
                        Starred ({starredCards.length})
                      </button>
                    </div>
                  )}
                </div>
              </ExamSettingRow>

              <ExamSettingRow label="Question Count" tooltip={EXAM_TOOLTIPS.questionCount} settings={settings}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={questionCountInput}
                  onChange={(event) => setQuestionCountInput(event.target.value.replace(/\D/g, '').slice(0, 4))}
                  onBlur={() => setQuestionCountInput(String(parsedQuestionCount))}
                  className="bg-panel border border-outline rounded-lg px-3 py-2 text-sm font-bold text-text focus:border-accent outline-none w-28 text-right"
                />
              </ExamSettingRow>

              <ExamSettingRow label="Time Limit" tooltip={EXAM_TOOLTIPS.timeLimit} settings={settings}>
                <label className="flex items-center gap-2 text-sm font-bold text-text cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasTimeLimit}
                    onChange={(event) => setHasTimeLimit(event.target.checked)}
                    className="h-4 w-4 rounded border-outline bg-panel-2 text-accent focus:ring-accent"
                  />
                  Enabled
                </label>
              </ExamSettingRow>

              {hasTimeLimit && (
                <div className="ml-4">
                  <ExamSettingRow label="Minutes" tooltip="How long this exam runs before auto-submit." settings={settings}>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={timeLimitMinutesInput}
                      onChange={(event) => setTimeLimitMinutesInput(event.target.value.replace(/\D/g, '').slice(0, 4))}
                      onBlur={() => setTimeLimitMinutesInput(String(parsedTimeLimitMinutes))}
                      className="bg-panel border border-outline rounded-lg px-3 py-2 text-sm font-bold text-text focus:border-accent outline-none w-28 text-right"
                    />
                  </ExamSettingRow>
                </div>
              )}

              <div className="p-4 bg-panel-2 rounded-xl border border-outline">
                <div className="mb-3">
                  <CursorTooltip content={EXAM_TOOLTIPS.questionMix} isEnabled={!settings.hideTooltips} tooltipClassName="w-80 max-w-[90vw]">
                    <div className="font-medium text-text">Question Mix</div>
                  </CursorTooltip>
                </div>

                <div
                  ref={mixBarRef}
                  className="relative h-10 mb-4 select-none touch-none"
                  onMouseDown={(event) => handleTrackPointerStart(event.clientX)}
                  onTouchStart={(event) => {
                    if (!event.touches[0]) return;
                    handleTrackPointerStart(event.touches[0].clientX);
                  }}
                >
                  <div className="absolute top-1/2 left-0 right-0 h-3 -translate-y-1/2 rounded-full border border-outline overflow-hidden bg-panel">
                    <div className={clsx('absolute inset-y-0 left-0', MIX_COLOR_CLASSES.multiple_choice.bg)} style={{ width: `${mixBreakpoints.first}%` }} />
                    <div className={clsx('absolute inset-y-0', MIX_COLOR_CLASSES.true_false.bg)} style={{ left: `${mixBreakpoints.first}%`, width: `${Math.max(0, mixBreakpoints.second - mixBreakpoints.first)}%` }} />
                    <div className={clsx('absolute inset-y-0 right-0', MIX_COLOR_CLASSES.short_answer.bg)} style={{ width: `${Math.max(0, 100 - mixBreakpoints.second)}%` }} />
                  </div>

                  <button
                    type="button"
                    aria-label="Adjust multiple choice / true-false split"
                    className="absolute top-1/2 w-5 h-5 rounded-full border-2 border-blue bg-panel shadow-md cursor-grab active:cursor-grabbing"
                    style={{ left: `${mixBreakpoints.first}%`, transform: 'translate(-50%, -50%)' }}
                    onMouseDown={(event) => {
                      event.stopPropagation();
                      setActiveKnob('first');
                    }}
                    onTouchStart={(event) => {
                      event.stopPropagation();
                      setActiveKnob('first');
                    }}
                  />

                  <button
                    type="button"
                    aria-label="Adjust true-false / typed split"
                    className="absolute top-1/2 w-5 h-5 rounded-full border-2 border-yellow bg-panel shadow-md cursor-grab active:cursor-grabbing"
                    style={{ left: `${mixBreakpoints.second}%`, transform: 'translate(-50%, -50%)' }}
                    onMouseDown={(event) => {
                      event.stopPropagation();
                      setActiveKnob('second');
                    }}
                    onTouchStart={(event) => {
                      event.stopPropagation();
                      setActiveKnob('second');
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs mb-3">
                  <div className={clsx('rounded-lg border p-2 flex items-center justify-between', MIX_COLOR_CLASSES.multiple_choice.border, MIX_COLOR_CLASSES.multiple_choice.bg)}>
                    <span className={clsx('font-bold uppercase tracking-wider', MIX_COLOR_CLASSES.multiple_choice.text)}>Multiple Choice</span>
                    <span className="text-text font-mono">{projectedTypeCounts.multiple_choice}</span>
                  </div>
                  <div className={clsx('rounded-lg border p-2 flex items-center justify-between', MIX_COLOR_CLASSES.true_false.border, MIX_COLOR_CLASSES.true_false.bg)}>
                    <span className={clsx('font-bold uppercase tracking-wider', MIX_COLOR_CLASSES.true_false.text)}>True/False</span>
                    <span className="text-text font-mono">{projectedTypeCounts.true_false}</span>
                  </div>
                  <div className={clsx('rounded-lg border p-2 flex items-center justify-between', MIX_COLOR_CLASSES.short_answer.border, MIX_COLOR_CLASSES.short_answer.bg)}>
                    <span className={clsx('font-bold uppercase tracking-wider', MIX_COLOR_CLASSES.short_answer.text)}>Typed</span>
                    <span className="text-text font-mono">{projectedTypeCounts.short_answer}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-outline bg-panel p-3 text-sm text-muted">
                  {mixDescription}
                </div>
              </div>

              {!canStartExam && (
                <div className="rounded-xl border border-yellow/40 bg-yellow/10 p-3 text-sm text-yellow flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  No cards available for this scope.
                </div>
              )}

              <button
                type="button"
                onClick={() => startExam(availableCards, parsedQuestionCount)}
                disabled={!canStartExam}
                className={clsx(
                  'w-full rounded-xl py-4 text-lg font-bold transition-colors',
                  canStartExam
                    ? 'bg-accent text-bg hover:bg-accent/90'
                    : 'bg-panel border border-outline text-muted cursor-not-allowed'
                )}
              >
                Start Exam
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (phase === 'running') {
    return (
      <div className="w-full max-w-5xl mx-auto pb-20 pt-0 animate-in fade-in">
        <button
          onClick={onExit}
          className="mb-6 flex items-center gap-3 text-muted hover:text-text transition-colors font-bold uppercase text-xs tracking-wider group"
        >
          <div className="p-2 rounded-full border border-outline group-hover:bg-panel group-hover:border-accent transition-colors">
            <ArrowLeft size={16} />
          </div>
          Back
        </button>

        <div className="sticky top-[86px] z-20 mb-5 rounded-2xl border border-outline bg-panel/95 backdrop-blur p-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-muted">Progress</div>
              <div className="mt-1 text-sm text-text font-bold">
                {answeredCount} / {questions.length} answered
              </div>
            </div>
            <div className="flex items-center gap-3">
              {timeLeftMs !== null && (
                <div className={clsx(
                  'px-3 py-2 rounded-lg border font-mono text-sm inline-flex items-center gap-2',
                  timeLeftMs <= 60_000
                    ? 'border-red/50 bg-red/10 text-red'
                    : 'border-outline bg-panel-2 text-text'
                )}>
                  <Clock3 size={14} />
                  {formatTimer(timeLeftMs)}
                </div>
              )}
              <button
                type="button"
                onClick={handleAttemptSubmit}
                className="rounded-lg bg-accent text-bg px-4 py-2 font-bold hover:bg-accent/90 transition-colors"
              >
                Submit Exam
              </button>
            </div>
          </div>
          <div className="h-2 w-full rounded-full bg-panel-2 border border-outline overflow-hidden mt-4">
            <div className="h-full bg-accent transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
        </div>

        <div className="space-y-4">
          {questions.map((question, index) => {
            const response = responses[question.id];
            const isAnswered = getAnsweredState(question, response);
            const color = MIX_COLOR_CLASSES[question.type];

            return (
              <article key={question.id} className="rounded-2xl border border-outline bg-panel p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-muted">Q{index + 1}</span>
                    <span className={clsx(
                      'text-xs px-2 py-1 rounded-md border font-bold',
                      color.border,
                      color.bg,
                      color.text
                    )}>
                      {getQuestionTypeLabel(question.type)}
                    </span>
                  </div>
                  <span className={clsx(
                    'text-xs px-2 py-1 rounded-md border font-bold',
                    isAnswered
                      ? 'border-green/50 bg-green/10 text-green'
                      : 'border-outline bg-panel-2 text-muted'
                  )}>
                    {isAnswered ? 'Answered' : 'Unanswered'}
                  </span>
                </div>

                <div className="text-sm text-muted uppercase tracking-wider font-bold mb-2">{promptLabel}</div>
                <div className="text-xl text-text font-bold leading-tight mb-4">
                  {renderInline(question.prompt, `exam-prompt-${question.id}`)}
                </div>

                {question.type === 'multiple_choice' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {question.options?.map(option => {
                      const selected = response?.choice === option;
                      return (
                        <button
                          key={`${question.id}-${option}`}
                          type="button"
                          onClick={() => setResponses(prev => ({
                            ...prev,
                            [question.id]: { ...prev[question.id], choice: option }
                          }))}
                          className={clsx(
                            'rounded-lg border px-3 py-3 text-left transition-colors',
                            selected
                              ? 'border-blue bg-blue/10 text-blue'
                              : 'border-outline bg-panel-2 text-text hover:border-accent'
                          )}
                        >
                          {renderInline(option, `exam-option-${question.id}-${option}`)}
                        </button>
                      );
                    })}
                  </div>
                )}

                {question.type === 'true_false' && (
                  <div className="space-y-3">
                    <div className="rounded-lg border border-outline bg-panel-2 p-3">
                      <div className="text-xs uppercase tracking-wider text-muted font-bold mb-1">{answerLabel} Statement</div>
                      <div className="text-text font-medium">{question.statementAnswer}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: 'True', value: true },
                        { label: 'False', value: false }
                      ].map(choice => {
                        const selected = response?.tf === choice.value;
                        return (
                          <button
                            key={`${question.id}-${choice.label}`}
                            type="button"
                            onClick={() => setResponses(prev => ({
                              ...prev,
                              [question.id]: { ...prev[question.id], tf: choice.value }
                            }))}
                            className={clsx(
                              'rounded-lg border px-3 py-3 font-bold transition-colors',
                              selected
                                ? 'border-yellow bg-yellow/10 text-yellow'
                                : 'border-outline bg-panel-2 text-text hover:border-accent'
                            )}
                          >
                            {choice.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {question.type === 'short_answer' && (
                  <div>
                    <label className="text-xs uppercase tracking-wider text-muted font-bold">{answerLabel}</label>
                    <textarea
                      value={response?.text || ''}
                      onChange={(event) => setResponses(prev => ({
                        ...prev,
                        [question.id]: { ...prev[question.id], text: event.target.value }
                      }))}
                      rows={3}
                      placeholder={`Type your ${answerLabel.toLowerCase()}...`}
                      className="mt-2 w-full rounded-lg border border-outline bg-panel-2 px-3 py-2 text-text focus:outline-none focus:border-accent transition-colors resize-y"
                    />
                  </div>
                )}
              </article>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleAttemptSubmit}
            className="rounded-xl bg-accent text-bg px-6 py-3 font-bold hover:bg-accent/90 transition-colors"
          >
            Submit Exam
          </button>
        </div>

        {showSubmitWarning && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onMouseDown={() => setShowSubmitWarning(false)}
          >
            <div
              className="bg-panel border border-outline rounded-2xl p-6 w-full max-w-sm shadow-2xl"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="mb-4">
                <h3 className="text-xl font-bold text-text mb-2">Unfinished Exam</h3>
                <p className="text-text leading-relaxed">
                  You still have <span className="font-bold">{unansweredCount}</span> unanswered {unansweredCount === 1 ? 'question' : 'questions'}.
                  Submit anyway?
                </p>
              </div>
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => setShowSubmitWarning(false)}
                  className="w-full py-3 border border-outline bg-panel-2 rounded-xl font-bold text-text hover:border-accent transition-colors"
                >
                  Keep Reviewing
                </button>
                <button
                  type="button"
                  onClick={() => finalizeExam('submitted')}
                  className="w-full py-3 bg-accent text-bg rounded-xl font-bold hover:bg-accent/90 transition-colors"
                >
                  Submit Anyway
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto pb-20 pt-0 animate-in fade-in">
      <button
        onClick={onExit}
        className="mb-6 flex items-center gap-3 text-muted hover:text-text transition-colors font-bold uppercase text-xs tracking-wider group"
      >
        <div className="p-2 rounded-full border border-outline group-hover:bg-panel group-hover:border-accent transition-colors">
          <ArrowLeft size={16} />
        </div>
        Back
      </button>

      <div className="bg-panel border border-outline rounded-3xl p-8">
        <div className="text-center mb-8">
          <h1
            className="text-4xl text-text mb-2"
            style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}
          >
            Exam Complete
          </h1>
          <p className="text-muted">
            {finishReason === 'timeout'
              ? 'Time expired. Your answers were submitted automatically.'
              : 'Submission received. Here is your report.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 mb-8">
          <div className="rounded-xl border border-outline bg-panel-2 p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-muted">Score</div>
            <div className="mt-2 text-2xl font-bold text-text">{score.correctCount}/{score.total}</div>
          </div>
          <div className="rounded-xl border border-outline bg-panel-2 p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-muted">Percent</div>
            <div className="mt-2 text-2xl font-bold text-accent">{score.percent}%</div>
          </div>
          <div className="rounded-xl border border-outline bg-panel-2 p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-muted">Grade</div>
            <div className="mt-2 text-2xl font-bold text-text">{score.grade}</div>
          </div>
          <div className="rounded-xl border border-outline bg-panel-2 p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-muted">Answered</div>
            <div className="mt-2 text-2xl font-bold text-text">{score.answered}</div>
          </div>
          <div className="rounded-xl border border-outline bg-panel-2 p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-muted">Unanswered</div>
            <div className="mt-2 text-2xl font-bold text-yellow">{score.unanswered}</div>
          </div>
          <div className="rounded-xl border border-outline bg-panel-2 p-4">
            <div className="text-xs font-bold uppercase tracking-widest text-muted">Avg / Answer</div>
            <div className="mt-2 text-2xl font-bold text-text">
              {score.answered > 0 ? formatTimer(score.avgPerAnswered) : '--:--'}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-outline bg-panel-2 p-4 mb-8">
          <div className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Time Used</div>
          <div className="text-2xl font-bold text-text">{formatTimer(score.elapsedMs)}</div>
        </div>

        <div className="flex flex-wrap gap-3 mb-8">
          <button
            type="button"
            onClick={handleRetryAll}
            className="rounded-xl border border-outline bg-panel-2 px-5 py-3 font-bold text-text hover:border-accent transition-colors inline-flex items-center gap-2"
          >
            <RotateCcw size={16} />
            Retry Full Exam
          </button>
          <button
            type="button"
            onClick={handleRetryIncorrect}
            disabled={incorrectResults.length === 0}
            className={clsx(
              'rounded-xl px-5 py-3 font-bold inline-flex items-center gap-2 transition-colors',
              incorrectResults.length > 0
                ? 'bg-accent text-bg hover:bg-accent/90'
                : 'bg-panel-2 border border-outline text-muted cursor-not-allowed'
            )}
          >
            <RotateCcw size={16} />
            Retry Incorrect ({incorrectResults.length})
          </button>
          <button
            type="button"
            onClick={() => {
              setSetupMode(null);
              setPhase('setup');
            }}
            className="rounded-xl border border-outline bg-panel-2 px-5 py-3 font-bold text-text hover:border-accent transition-colors"
          >
            New Setup
          </button>
          <button
            type="button"
            onClick={onExit}
            className="rounded-xl border border-outline bg-panel-2 px-5 py-3 font-bold text-text hover:border-accent transition-colors"
          >
            Back to Set
          </button>
        </div>

        {incorrectResults.length > 0 ? (
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-widest text-muted">Questions to Review</h2>
            {incorrectResults.map((result, index) => (
              <div key={`${result.questionId}-review`} className="rounded-2xl border border-outline bg-panel-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-widest text-muted font-bold mb-1">
                      Q{index + 1} • {getQuestionTypeLabel(result.question.type)}
                    </div>
                    <div className="text-text font-bold">
                      {renderInline(result.question.prompt, `exam-review-prompt-${result.question.id}`)}
                    </div>
                  </div>
                </div>

                {result.question.type === 'true_false' && (
                  <div className="mt-3 rounded-xl border border-outline bg-panel p-3 text-sm">
                    <span className="text-muted font-bold uppercase tracking-wider mr-2">{answerLabel} Statement:</span>
                    <span className="text-text">{result.question.statementAnswer}</span>
                  </div>
                )}

                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-red/30 bg-red/10 p-3">
                    <div className="flex items-center gap-2 font-bold text-red mb-1">
                      <XCircle size={14} />
                      Your Answer
                    </div>
                    <div className="text-text">{result.selectedDisplay || 'No answer'}</div>
                  </div>
                  <div className="rounded-xl border border-green/30 bg-green/10 p-3">
                    <div className="flex items-center gap-2 font-bold text-green mb-1">
                      <CheckCircle2 size={14} />
                      Correct Answer
                    </div>
                    <div className="text-text">{result.correctDisplay}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-green/40 bg-green/10 p-5 text-green font-bold inline-flex items-center gap-2">
            <CheckCircle2 size={18} />
            Perfect run. No missed questions.
          </div>
        )}
      </div>
    </div>
  );
};
