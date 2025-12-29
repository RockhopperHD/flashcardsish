
export interface Card {
  id: string;
  term: string[];
  content: string;
  year?: string; // Optional year field
  image?: string; // Optional image URL or Base64
  customFields?: { name: string; value: string }[]; // Optional custom fields
  tags?: string[]; // Optional tags
  mastery: number; // 0: Unseen, 1: Learning, 2: Learned
  star: boolean;
  originalSetId?: string;
  originalSetName?: string;
}

export interface CardSet {
  id: string;
  sourceId?: string; // Link to original library set
  name: string;
  cards: Card[];
  customFieldNames?: string[]; // Names of custom fields
  lastPlayed: number; // Timestamp
  elapsedTime: number; // Time spent in ms
  topStreak: number;
  isSessionActive?: boolean;
  isMultistudy?: boolean;
  folderId?: string; // If belongs to a folder
}

export interface Folder {
  id: string;
  name: string;
  color: 'brown' | 'red' | 'blue' | 'yellow' | 'green' | 'purple';
  setIds: string[];
}

export interface Settings {
  strictSpelling: boolean;
  retypeOnMistake: boolean;
  darkMode: boolean;
  starredOnly: boolean;
  mode: 'standard' | 'multiple_choice';
}

export enum GameState {
  MENU = 'MENU',
  SET_DETAIL = 'SET_DETAIL',
  PLAYING = 'PLAYING',
  WIN = 'WIN'
}

export type FeedbackState =
  | { type: 'idle' }
  | { type: 'correct'; correction?: string }
  | { type: 'incorrect'; message: string; customResults?: { year?: boolean; custom?: Record<string, boolean> } }
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