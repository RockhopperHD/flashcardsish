import { describe, expect, it } from 'vitest';
import { checkAnswer } from '../utils';
import { Card, CardSet } from '../types';
import { parseRawImportCards } from '../src/rawImport';
import {
  formatSrsCountdown,
  getSrsCounts,
  normalizeSrsMastery,
  scheduleSrsReview
} from '../srs';
import {
  mergeSetWithoutLosingCards,
  parseExportData
} from '../src/dataMerge';
import { getSafeStorageId, normalizeStorageId, normalizeCardSet } from '../storageV2';
import { ShareValidationError, validateSetForSharing } from '../src/shareValidation';
import { deriveSyncDashboardState } from '../src/syncDashboard';
import {
  dismissFeaturePrompt,
  getFeatureDiscoveryPrompts,
  readDismissedFeaturePrompts,
  resetFeatureDiscoveryState,
  selectFeatureDiscoveryPrompt
} from '../src/featureDiscovery';

const makeCard = (overrides: Partial<Card> = {}): Card => ({
  id: overrides.id || 'card-1',
  term: overrides.term || ['Paris'],
  content: overrides.content || 'Capital of France',
  mastery: overrides.mastery ?? 0,
  star: overrides.star ?? false,
  ...overrides
});

const makeSet = (overrides: Partial<CardSet> = {}): CardSet => ({
  id: overrides.id || 'set-1',
  name: overrides.name || 'Set',
  cards: overrides.cards || [makeCard()],
  lastPlayed: overrides.lastPlayed ?? 0,
  elapsedTime: overrides.elapsedTime ?? 0,
  topStreak: overrides.topStreak ?? 0,
  ...overrides
});

describe('answer matching', () => {
  it('accepts exact and capitalization-insensitive terms', () => {
    const card = makeCard({ term: ['Declaration of Independence'] });

    expect(checkAnswer('declaration of independence', '', {}, card, false).isMatch).toBe(true);
    expect(checkAnswer('Declaration Independence', '', {}, card, true).isMatch).toBe(false);
  });

  it('uses fuzzy matching when strict mode is off', () => {
    const card = makeCard({ term: ['Napoleon'] });

    expect(checkAnswer('Napolean', '', {}, card, false).isMatch).toBe(true);
    expect(checkAnswer('Napolean', '', {}, card, true).isMatch).toBe(false);
  });
});

describe('raw import parsing', () => {
  it('splits pasted text into cards with deterministic IDs', () => {
    let counter = 0;
    const cards = parseRawImportCards('A / Alpha\n\nB / Beta', {
      termDefinitionSeparator: '/',
      cardSeparator: '\\n\\n',
      createId: () => `id-${counter++}`
    });

    expect(cards).toHaveLength(2);
    expect(cards[0]).toMatchObject({ id: 'id-0', term: ['A'], content: 'Alpha' });
    expect(cards[1]).toMatchObject({ id: 'id-1', term: ['B'], content: 'Beta' });
  });

  it('turns configured bullet markers into markdown bullets', () => {
    const cards = parseRawImportCards('Term / first\n> second\n\n> third', {
      termDefinitionSeparator: '/',
      cardSeparator: '\\n\\n',
      useBulletMarker: true,
      bulletMarker: '>',
      createId: () => 'id'
    });

    expect(cards).toHaveLength(1);
    expect(cards[0].content).toBe('first\n- second\n- third');
  });
});

describe('SRS scheduling', () => {
  it('normalizes mastery into the supported range', () => {
    expect(normalizeSrsMastery(-5)).toBe(0);
    expect(normalizeSrsMastery(9)).toBe(4);
    expect(normalizeSrsMastery(3)).toBe(3);
  });

  it('schedules stronger ratings farther out', () => {
    const now = 1_700_000_000_000;
    const card = makeCard();
    const red = scheduleSrsReview(card, 1, undefined, now);
    const blue = scheduleSrsReview(card, 4, undefined, now);

    expect(red.updatedCard.srsMastery).toBe(1);
    expect(blue.updatedCard.srsMastery).toBe(4);
    expect(blue.intervalMs).toBeGreaterThan(red.intervalMs);
  });

  it('counts cards by SRS mastery bucket', () => {
    const counts = getSrsCounts([
      makeCard({ id: 'a', srsMastery: 0 }),
      makeCard({ id: 'b', srsMastery: 1 }),
      makeCard({ id: 'c', srsMastery: 4 })
    ]);

    expect(counts).toMatchObject({ unseen: 1, red: 1, blue: 1 });
    expect(formatSrsCountdown(61_000)).toBe('00:01:01');
  });
});

describe('backup and cloud merge helpers', () => {
  it('preserves both variants when local and cloud cards share an ID but differ in content', () => {
    const local = makeSet({
      cards: [makeCard({ id: 'same', term: ['Local'], content: 'Local answer', mastery: 2 })],
      lastPlayed: 10
    });
    const cloud = makeSet({
      cards: [makeCard({ id: 'same', term: ['Cloud'], content: 'Cloud answer', star: true })],
      lastPlayed: 5
    });

    const merged = mergeSetWithoutLosingCards(local, cloud);

    expect(merged.cards).toHaveLength(2);
    expect(merged.cards.some(card => card.term[0] === 'Local')).toBe(true);
    expect(merged.cards.some(card => card.term[0] === 'Cloud')).toBe(true);
    expect(merged.cards[0].mastery).toBe(2);
    expect(merged.cards[0].star).toBe(true);
  });

  it('rejects unsupported backup versions', () => {
    expect(() => parseExportData(JSON.stringify({ version: 'old' }))).toThrow(/Unsupported backup version/);
  });
});

describe('storage normalization', () => {
  it('accepts only safe storage ids', () => {
    expect(getSafeStorageId('abc-123_DEF')).toBe('abc-123_DEF');
    expect(getSafeStorageId('../bad')).toBeNull();
    expect(normalizeStorageId('../bad', 'set')).toMatch(/^set-/);
  });

  it('normalizes malformed card sets without dropping cards', () => {
    const normalized = normalizeCardSet({
      id: '../bad',
      name: '',
      cards: [{ id: 'card', term: ['Term'], content: 123, mastery: 99, star: 'yes' }]
    } as unknown as CardSet);

    expect(normalized.id).toMatch(/^set-/);
    expect(normalized.cards).toHaveLength(1);
    expect(normalized.cards[0].mastery).toBe(2);
    expect(normalized.cards[0].star).toBe(false);
  });
});

describe('shared set validation', () => {
  it('allows a normal shareable set', () => {
    expect(() => validateSetForSharing(makeSet())).not.toThrow();
  });

  it('blocks oversize shared sets', () => {
    const cards = Array.from({ length: 151 }, (_, index) => makeCard({ id: `card-${index}` }));
    expect(() => validateSetForSharing(makeSet({ cards }))).toThrow(ShareValidationError);
  });
});

describe('sync dashboard derivation', () => {
  it('describes offline mode without enabling manual cloud sync', () => {
    const state = deriveSyncDashboardState({
      offlineMode: true,
      isSignedIn: false,
      isLibraryLoaded: true,
      isCloudLoading: false,
      cloudSyncStatus: 'idle',
      cloudConflictCount: 0,
      dirtySetCount: 1,
      hasPendingLocalLibraryChanges: true,
      hasPendingLibrarySave: false,
      hasPendingStructureChanges: false,
      cloudSaveInFlight: false,
      syncInProgress: false,
      lastLocalFallbackAt: null
    });

    expect(state.modeLabel).toBe('Offline-only');
    expect(state.canManualSync).toBe(false);
    expect(state.tone).toBe('warning');
  });

  it('allows manual sync after a signed-in sync error', () => {
    const state = deriveSyncDashboardState({
      offlineMode: false,
      isSignedIn: true,
      isLibraryLoaded: true,
      isCloudLoading: false,
      cloudSyncStatus: 'error',
      cloudConflictCount: 0,
      dirtySetCount: 0,
      hasPendingLocalLibraryChanges: false,
      hasPendingLibrarySave: false,
      hasPendingStructureChanges: false,
      cloudSaveInFlight: false,
      syncInProgress: false,
      lastLocalFallbackAt: 1_700_000_000_000
    });

    expect(state.tone).toBe('error');
    expect(state.canManualSync).toBe(true);
    expect(state.lastLocalFallbackLabel).not.toBe('Not written yet');
  });
});

describe('feature discovery prompts', () => {
  it('prioritizes immediate sync attention over general menu tips', () => {
    const prompt = selectFeatureDiscoveryPrompt({
      screen: 'menu',
      librarySets: [makeSet({ id: 'a' }), makeSet({ id: 'b' })],
      folders: [],
      tags: [],
      hasCompletedOnboarding: true,
      isSignedIn: true,
      syncNeedsAttention: true
    });

    expect(prompt?.id).toBe('sync-needs-attention');
    expect(prompt?.action).toBe('open-sync');
  });

  it('suggests raw import for an empty library after onboarding', () => {
    const prompt = selectFeatureDiscoveryPrompt({
      screen: 'menu',
      librarySets: [],
      folders: [],
      tags: [],
      hasCompletedOnboarding: true,
      isSignedIn: false
    });

    expect(prompt?.id).toBe('empty-library-import');
    expect(prompt?.action).toBe('open-raw-import');
  });

  it('suggests formatting once the builder has real card content', () => {
    const prompt = selectFeatureDiscoveryPrompt({
      screen: 'builder',
      builderHasContent: true,
      builderCardCount: 2
    });

    expect(prompt?.id).toBe('builder-formatting');
    expect(prompt?.action).toBe('open-markdown-help');
  });

  it('returns set detail prompts for SRS, starred-only, and keybinds when eligible', () => {
    const prompts = getFeatureDiscoveryPrompts({
      screen: 'set-detail',
      currentSet: makeSet({
        cards: Array.from({ length: 8 }, (_, index) => makeCard({
          id: `card-${index}`,
          star: index === 0
        })),
        lastPlayed: 1
      }),
      settings: { starredOnly: false }
    });

    expect(prompts.map(prompt => prompt.id)).toEqual([
      'set-detail-srs',
      'set-detail-starred-only',
      'set-detail-keybinds'
    ]);
  });

  it('honors dismissed prompts and can reset dismissal state', () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => { store.set(key, value); },
      removeItem: (key: string) => { store.delete(key); }
    };

    dismissFeaturePrompt('builder-formatting', storage);
    expect(readDismissedFeaturePrompts(storage)).toMatchObject({ 'builder-formatting': true });
    expect(selectFeatureDiscoveryPrompt({
      screen: 'builder',
      builderHasContent: true,
      builderCardCount: 2,
      dismissed: readDismissedFeaturePrompts(storage)
    })).toBeNull();

    resetFeatureDiscoveryState(storage);
    expect(readDismissedFeaturePrompts(storage)).toEqual({});
  });
});
