import { Card, SRSSessionStats } from './types';

export type SRSRating = 1 | 2 | 3 | 4;

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const TEST_WARNING_WINDOW_MS = 48 * HOUR_MS;
const TEST_DATE_CAP_BUFFER_MS = 2 * HOUR_MS;

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

const normalizeNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

export const normalizeSrsMastery = (value: unknown): number => {
  const parsed = normalizeNumber(value, 0);
  return clamp(Math.trunc(parsed), 0, 4);
};

export const createEmptySrsSessionStats = (startedAt = Date.now()): SRSSessionStats => ({
  currentCardId: null,
  cardsReviewed: 0,
  totalReviews: 0,
  startedAt
});

export const normalizeSrsSessionStats = (stats?: SRSSessionStats | null): SRSSessionStats => {
  if (!stats || typeof stats !== 'object') {
    return createEmptySrsSessionStats();
  }

  return {
    currentCardId: typeof stats.currentCardId === 'string' ? stats.currentCardId : null,
    testDate: Number.isFinite(stats.testDate) ? Math.max(0, Number(stats.testDate)) : undefined,
    cardsReviewed: Math.max(0, Math.trunc(normalizeNumber(stats.cardsReviewed, 0))),
    totalReviews: Math.max(0, Math.trunc(normalizeNumber(stats.totalReviews, 0))),
    startedAt: Math.max(0, Math.trunc(normalizeNumber(stats.startedAt, Date.now())))
  };
};

export const getSrsCounts = (cards: Card[]) => cards.reduce(
  (acc, card) => {
    const level = normalizeSrsMastery(card.srsMastery);
    if (level === 0) acc.unseen += 1;
    if (level === 1) acc.red += 1;
    if (level === 2) acc.yellow += 1;
    if (level === 3) acc.green += 1;
    if (level === 4) acc.blue += 1;
    return acc;
  },
  { unseen: 0, red: 0, yellow: 0, green: 0, blue: 0 }
);

export const getSrsMasteryLabel = (level = 0): string => {
  switch (normalizeSrsMastery(level)) {
    case 1:
      return 'Red';
    case 2:
      return 'Yellow';
    case 3:
      return 'Green';
    case 4:
      return 'Blue';
    default:
      return 'Unseen';
  }
};

export const getSrsTriangleClassName = (level = 0): string => {
  switch (normalizeSrsMastery(level)) {
    case 1:
      return 'border-red bg-red';
    case 2:
      return 'border-yellow bg-yellow';
    case 3:
      return 'border-green bg-green';
    case 4:
      return 'border-blue bg-blue';
    default:
      return 'border-outline bg-transparent';
  }
};

export const isSrsCardDue = (card: Card, now = Date.now()): boolean => {
  const nextReviewDate = normalizeNumber(card.nextReviewDate, 0);
  return nextReviewDate <= now;
};

export const getNextDueDate = (cards: Card[]): number | null => {
  let nextDue: number | null = null;

  cards.forEach(card => {
    const nextReviewDate = normalizeNumber(card.nextReviewDate, 0);
    if (nextReviewDate <= 0) return;
    if (nextDue === null || nextReviewDate < nextDue) {
      nextDue = nextReviewDate;
    }
  });

  return nextDue;
};

export const shouldShowSrsWarning = (testDate?: number, now = Date.now()): boolean => (
  typeof testDate === 'number' &&
  Number.isFinite(testDate) &&
  testDate > now &&
  testDate - now <= TEST_WARNING_WINDOW_MS
);

export const formatSrsInterval = (ms: number): string => {
  if (ms >= HOUR_MS) {
    const hours = Math.max(1, Math.round(ms / HOUR_MS));
    return `${hours}h`;
  }

  const minutes = Math.max(1, Math.round(ms / MINUTE_MS));
  return `${minutes}m`;
};

export const formatSrsCountdown = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (days > 0) {
    return `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m`;
  }

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const hashWithSeed = (value: string, seed: number): number => {
  let hash = seed | 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

export const getSrsShuffleScore = (value: string, seed: number): number => hashWithSeed(value, seed);

export const getSrsShortcutKeys = (style?: 'letters' | 'numbers'): string[] =>
  style === 'numbers' ? ['1', '2', '3', '4'] : ['A', 'B', 'C', 'D'];

export const matchesSrsShortcut = (event: KeyboardEvent, shortcut: string): boolean => {
  const normalizedKey = event.key.length === 1 ? event.key.toLowerCase() : event.key;
  const normalizedShortcut = shortcut.toLowerCase();

  if (normalizedKey === normalizedShortcut) return true;

  if (/^\d$/.test(shortcut)) {
    return event.code === `Digit${shortcut}` || event.code === `Numpad${shortcut}`;
  }

  return false;
};

export interface SrsScheduleResult {
  updatedCard: Card;
  nextReviewDate: number;
  intervalMs: number;
}

const getGeneralStudyIntervalMs = (rating: SRSRating): number => {
  switch (rating) {
    case 1:
      return MINUTE_MS;
    case 2:
      return 10 * MINUTE_MS;
    case 3:
      return HOUR_MS;
    case 4:
      return 12 * HOUR_MS;
    default:
      return MINUTE_MS;
  }
};

const getFixedHorizonIntervalMs = (rating: SRSRating, testDate: number, now: number): number => {
  if (rating === 1) return MINUTE_MS;

  const remainingMs = Math.max(0, testDate - now);
  const fraction =
    rating === 2 ? 0.04 :
      rating === 3 ? 0.12 :
        0.25;

  return Math.max(MINUTE_MS, Math.round(remainingMs * fraction));
};

const capNextDueDate = (nextReviewDate: number, testDate?: number): number => {
  if (!testDate || nextReviewDate <= testDate) return nextReviewDate;
  return testDate - TEST_DATE_CAP_BUFFER_MS;
};

export const scheduleSrsReview = (
  card: Card,
  rating: SRSRating,
  testDate?: number,
  now = Date.now()
): SrsScheduleResult => {
  const nextIntervalMs = testDate
    ? getFixedHorizonIntervalMs(rating, testDate, now)
    : getGeneralStudyIntervalMs(rating);
  const nextReviewDate = capNextDueDate(now + nextIntervalMs, testDate);
  const updatedCard: Card = {
    ...card,
    srsMastery: rating,
    easinessFactor: undefined,
    interval: undefined,
    repetitions: undefined,
    nextReviewDate
  };

  return {
    updatedCard,
    nextReviewDate,
    intervalMs: Math.max(MINUTE_MS, nextReviewDate - now)
  };
};
