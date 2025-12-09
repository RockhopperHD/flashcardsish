import { get, set } from 'idb-keyval';
import { CardSet } from './types';

const LIBRARY_KEY = 'flashcard-library-v3';

export const saveLibrary = async (sets: CardSet[]) => {
    try {
        await set(LIBRARY_KEY, sets);
    } catch (error) {
        console.error('Failed to save library to IndexedDB:', error);
    }
};

export const loadLibrary = async (): Promise<CardSet[] | undefined> => {
    try {
        return await get<CardSet[]>(LIBRARY_KEY);
    } catch (error) {
        console.error('Failed to load library from IndexedDB:', error);
        return undefined;
    }
};
