export type CustomFieldType = 'text' | 'number' | 'ab' | 'tf';

export interface CustomFieldDefinition {
  id?: string;
  name: string;
  type: CustomFieldType;
  options?: { a: string; b: string }; // For 'ab' type
}

export interface Card {
  id: string;
  term: string[];
  content: string;
  year?: string; // Optional year field
  image?: string; // Optional image URL or Base64 (definition side)
  termImage?: string; // Optional image URL or Base64 (term side)
  customFields?: { name: string; value: string }[]; // Optional custom fields
  tags?: string[]; // Optional tags
  mastery: number; // 0: Unseen, 1: Learning, 2: Learned
  star: boolean;
  originalSetId?: string;
  originalSetName?: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface CardSet {
  id: string;
  sourceId?: string; // Link to original library set
  name: string;
  cards: Card[];
  customFieldNames?: string[]; // Names of custom fields (Legacy V1)
  tags?: string[]; // IDs of tags applied to this set

  // V2 Fields
  version?: number;
  termLabel?: string; // default "Term"
  definitionLabel?: string; // default "Definition"
  termSideFields?: CustomFieldDefinition[]; // Custom fields shown on term side
  defSideFields?: CustomFieldDefinition[]; // Custom fields shown on definition side
  enableTermCards?: boolean; // Enable images on term side (default false)
  lastPlayed: number; // Timestamp
  elapsedTime: number; // Time spent in ms
  topStreak: number;
  isSessionActive?: boolean;
  isMultistudy?: boolean;
  sourceSetIds?: string[]; // IDs of sets that this multistudy session draws from
  folderId?: string; // If belongs to a folder
  isLocalOnly?: boolean; // If true, this set is not synced to the cloud
}

export interface Folder {
  id: string;
  name: string;
  color: 'brown' | 'red' | 'blue' | 'yellow' | 'green' | 'purple';
  setIds: string[];
}

export interface Settings {
  forgiveSpellingErrors: boolean;
  ignoreDiacritics: boolean;
  ignoreCapitalization: boolean;
  forgiveThe: boolean;
  wiggleRoom: number;
  retypeOnMistake: boolean;
  darkMode: boolean;
  starredOnly: boolean;
  mode: 'standard' | 'multiple_choice';
  answerWithDefinition: boolean;
  hideTooltips: boolean;
  shuffleCards: boolean; // Shuffle cards in Learn mode (default true)
  brutalMode: boolean; // Zen mode: if wrong at 1/2 mastery, reset to 0/2 (default false)
  autoCloseImageWindow?: boolean; // Automatically close image window on paste (default false)
  // AI Features
  // AI Features
  learnModeLeftKey1?: string; // Primary key for Left/Option A/True (default 'a')
  learnModeLeftKey2?: string; // Secondary key for Left/Option A/True (default 'ArrowLeft')
  learnModeRightKey1?: string; // Primary key for Right/Option B/False (default 'b')
  learnModeRightKey2?: string; // Secondary key for Right/Option B/False (default 'ArrowRight')
  autoAdvanceOnAnswer?: boolean; // Whether to auto-advance after answering A/B/True/False (default true)
  tabSelectsEverythingInBuilder?: boolean; // If true, Tab follows normal page navigation in Visual Builder
  flipCardKey1?: string; // Primary key for flipping flashcard (default ' ' i.e. Space)
  flipCardKey2?: string; // Secondary key for flipping flashcard (default 'Enter')
  submitAnswerKey1?: string; // Primary key for submitting answer in Learn mode (default 'Enter')
  nextFieldKey1?: string; // Primary key for moving to next field (default 'Tab', locked)
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string; // Lucide icon name
  color: string; // tailwind color class alias like 'text-yellow'
  earnedAt: number;
}

/**
 * Lightweight metadata for a set - used for lazy loading
 * Contains enough info to display in the library without loading full card data
 */
export interface SetMetadata {
  id: string;
  name: string;
  cardCount: number;
  lastPlayed: number;
  elapsedTime: number;
  topStreak: number;
  isSessionActive?: boolean;
  folderId?: string;
}

/**
 * Loading state for lazy-loaded sets
 */
export type SetLoadingState = 'unloaded' | 'loading' | 'loaded' | 'error';

export enum GameState {
  MENU = 'MENU',
  SET_DETAIL = 'SET_DETAIL',
  PLAYING = 'PLAYING',
  FLASHCARDS = 'FLASHCARDS',
  WIN = 'WIN',
  DOCUMENTATION = 'DOCUMENTATION'
}

// Mixup detection info - when user confuses content from different cards
export interface MixupInfo {
  // Each mixup item describes what the user entered and which card it belongs to
  mixups: Array<{
    field: 'term' | 'definition' | 'year' | string; // field name, 'string' for custom fields
    fieldType: 'text' | 'number'; // 'number' for year and number-only custom fields
    inputValue: string; // What the user typed
    matchedCardTerm: string; // The term of the card it actually belongs to
    matchedCard: Card;
  }>;
}

export type FeedbackState =
  | { type: 'idle' }
  | { type: 'correct'; correction?: string }
  | { type: 'incorrect'; message: string; customResults?: { year?: boolean; custom?: Record<string, boolean> }; mixupInfo?: MixupInfo }
  | { type: 'reveal'; message: string }
  | {
    type: 'retype_needed';
    results?: {
      isTermMatch: boolean;
      isYearMatch: boolean;
      isCustomMatch: boolean;
      customResults: Record<string, boolean>;
    };
  };
