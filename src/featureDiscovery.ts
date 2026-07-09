import { STORAGE_NAMESPACE_SUFFIX } from '../runtimeMode';
import { CardSet, Folder, Settings, Tag } from '../types';

export const FEATURE_DISCOVERY_STORAGE_KEY =
  `flashcardsish-feature-discovery-v1${STORAGE_NAMESPACE_SUFFIX}`;

export type FeatureDiscoveryPromptId =
  | 'empty-library-import'
  | 'builder-formatting'
  | 'library-multistudy'
  | 'library-organize'
  | 'set-detail-srs'
  | 'set-detail-starred-only'
  | 'set-detail-keybinds'
  | 'sync-backup'
  | 'sync-needs-attention'
  | 'study-retry';

export type FeatureDiscoveryScreen =
  | 'menu'
  | 'builder'
  | 'set-detail'
  | 'study-summary';

export type FeatureDiscoveryAction =
  | 'open-raw-import'
  | 'open-markdown-help'
  | 'select-multistudy'
  | 'open-organizer'
  | 'start-srs'
  | 'study-starred'
  | 'open-keybinds'
  | 'open-sync'
  | 'restart-session';

export interface FeatureDiscoveryPrompt {
  id: FeatureDiscoveryPromptId;
  screen: FeatureDiscoveryScreen;
  title: string;
  body: string;
  actionLabel: string;
  action: FeatureDiscoveryAction;
  priority: number;
}

export type DismissedFeaturePrompts = Partial<Record<FeatureDiscoveryPromptId, true>>;

export interface FeatureDiscoveryContext {
  screen: FeatureDiscoveryScreen;
  librarySets?: CardSet[];
  folders?: Folder[];
  tags?: Tag[];
  currentSet?: CardSet | null;
  settings?: Pick<Settings, 'starredOnly'>;
  builderCardCount?: number;
  builderHasContent?: boolean;
  hasCompletedOnboarding?: boolean;
  isSignedIn?: boolean;
  offlineMode?: boolean;
  syncNeedsAttention?: boolean;
  dismissed?: DismissedFeaturePrompts;
}

interface FeatureDiscoveryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const getDiscoveryStorage = (): FeatureDiscoveryStorage | null => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
};

export const readDismissedFeaturePrompts = (
  storage: FeatureDiscoveryStorage | null = getDiscoveryStorage()
): DismissedFeaturePrompts => {
  if (!storage) return {};

  try {
    const raw = storage.getItem(FEATURE_DISCOVERY_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};

    return Object.entries(parsed).reduce<DismissedFeaturePrompts>((acc, [key, value]) => {
      if (value === true) {
        acc[key as FeatureDiscoveryPromptId] = true;
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
};

export const dismissFeaturePrompt = (
  id: FeatureDiscoveryPromptId,
  storage: FeatureDiscoveryStorage | null = getDiscoveryStorage()
): DismissedFeaturePrompts => {
  const next = { ...readDismissedFeaturePrompts(storage), [id]: true };
  if (!storage) return next;

  try {
    storage.setItem(FEATURE_DISCOVERY_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Discovery hints are optional; failed persistence should never block the app.
  }
  return next;
};

export const resetFeatureDiscoveryState = (
  storage: FeatureDiscoveryStorage | null = getDiscoveryStorage()
): void => {
  if (!storage) return;
  try {
    storage.removeItem(FEATURE_DISCOVERY_STORAGE_KEY);
  } catch {
    // Best effort only.
  }
};

const getStudyableSets = (sets: CardSet[] = []): CardSet[] =>
  sets.filter(set => !set.isMultistudy && set.cards.length > 0);

const hasStudyHistory = (set: CardSet): boolean =>
  set.lastPlayed > 0 ||
  set.elapsedTime > 0 ||
  Boolean(set.learnSessionStats || set.flashcardsSessionStats || set.srsSessionStats);

export const getFeatureDiscoveryPrompts = (
  context: FeatureDiscoveryContext
): FeatureDiscoveryPrompt[] => {
  const dismissed = context.dismissed ?? {};
  const prompts: FeatureDiscoveryPrompt[] = [];
  const sets = getStudyableSets(context.librarySets);
  const currentSet = context.currentSet ?? null;

  const addPrompt = (prompt: FeatureDiscoveryPrompt) => {
    if (!dismissed[prompt.id]) {
      prompts.push(prompt);
    }
  };

  if (context.screen === 'menu') {
    if (context.syncNeedsAttention) {
      addPrompt({
        id: 'sync-needs-attention',
        screen: 'menu',
        title: 'Your sync status has details worth checking.',
        body: 'Open the dashboard to see pending local changes, conflicts, or fallback saves.',
        actionLabel: 'Open sync',
        action: 'open-sync',
        priority: 100
      });
    } else if (!context.offlineMode && !context.isSignedIn && sets.length > 0) {
      addPrompt({
        id: 'sync-backup',
        screen: 'menu',
        title: 'You can back up sets across devices.',
        body: 'Sign in when you want cloud sync, while local editing keeps working either way.',
        actionLabel: 'Set up sync',
        action: 'open-sync',
        priority: 82
      });
    }

    if (sets.length === 0 && context.hasCompletedOnboarding) {
      addPrompt({
        id: 'empty-library-import',
        screen: 'menu',
        title: 'You can paste notes and turn them into cards.',
        body: 'Raw import is faster than building every card one by one.',
        actionLabel: 'Import cards',
        action: 'open-raw-import',
        priority: 90
      });
    }

    if (sets.length >= 2 && !sets.some(set => set.isSessionActive)) {
      addPrompt({
        id: 'library-multistudy',
        screen: 'menu',
        title: 'You can study several sets together.',
        body: 'Select a couple of sets and Flashcardsish can make one combined practice session.',
        actionLabel: 'Study these together',
        action: 'select-multistudy',
        priority: 72
      });
    }

    const uncategorizedCount = sets.filter(set => !set.folderId && !set.isLocalOnly).length;
    if (uncategorizedCount >= 4 && ((context.folders?.length ?? 0) === 0 || (context.tags?.length ?? 0) === 0)) {
      addPrompt({
        id: 'library-organize',
        screen: 'menu',
        title: 'Folders and tags can keep this library tidy.',
        body: 'Use them when your set list starts getting long.',
        actionLabel: 'Open organizer',
        action: 'open-organizer',
        priority: 68
      });
    }
  }

  if (context.screen === 'builder' && context.builderHasContent && (context.builderCardCount ?? 0) >= 2) {
    addPrompt({
      id: 'builder-formatting',
      screen: 'builder',
      title: 'You can format cards as you build.',
      body: 'Markdown, highlights, images, and custom fields can make dense cards easier to scan.',
      actionLabel: 'Show me',
      action: 'open-markdown-help',
      priority: 80
    });
  }

  if (context.screen === 'set-detail' && currentSet) {
    const starredCount = currentSet.cards.filter(card => card.star).length;
    const isSrsSet = Boolean(currentSet.srsSessionStats);

    if (!isSrsSet && currentSet.cards.length >= 8 && hasStudyHistory(currentSet)) {
      addPrompt({
        id: 'set-detail-srs',
        screen: 'set-detail',
        title: 'Spaced repetition can schedule what to review next.',
        body: 'SRS works well once a set has enough cards to revisit over time.',
        actionLabel: 'Start SRS',
        action: 'start-srs',
        priority: 84
      });
    }

    if (starredCount > 0 && !context.settings?.starredOnly) {
      addPrompt({
        id: 'set-detail-starred-only',
        screen: 'set-detail',
        title: 'You can study only starred cards.',
        body: 'Great for focusing on the terms you marked as tricky.',
        actionLabel: 'Study starred',
        action: 'study-starred',
        priority: 78
      });
    }

    if (hasStudyHistory(currentSet)) {
      addPrompt({
        id: 'set-detail-keybinds',
        screen: 'set-detail',
        title: 'You can customize study keybinds.',
        body: 'Tune answer, flip, and submit keys for faster keyboard-heavy sessions.',
        actionLabel: 'Open keybinds',
        action: 'open-keybinds',
        priority: 52
      });
    }
  }

  if (context.screen === 'study-summary') {
    addPrompt({
      id: 'study-retry',
      screen: 'study-summary',
      title: 'You can run the set again right now.',
      body: 'Restarting immediately is useful when the last pass exposed weak spots.',
      actionLabel: 'Retry set',
      action: 'restart-session',
      priority: 76
    });
  }

  return prompts.sort((a, b) => b.priority - a.priority);
};

export const selectFeatureDiscoveryPrompt = (
  context: FeatureDiscoveryContext
): FeatureDiscoveryPrompt | null => getFeatureDiscoveryPrompts(context)[0] ?? null;
