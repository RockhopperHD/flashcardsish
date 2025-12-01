
export interface Card {
  id: string;
  term: string[];
  content: string;
  year?: string; // Optional year field
  image?: string; // Optional image URL or Base64
  mastery: number; // 0: Unseen, 1: Learning, 2: Learned
  star: boolean;
}

export interface CardSet {
  id: string;
  name: string;
  cards: Card[];
  lastPlayed: number; // Timestamp
  elapsedTime: number; // Time spent in ms
  topStreak: number;
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
  PLAYING = 'PLAYING',
  WIN = 'WIN'
}

export interface FeedbackState {
  type: 'idle' | 'correct' | 'incorrect' | 'reveal' | 'retype_needed';
  message?: string;
  correction?: string; // "Did you mean..."
}