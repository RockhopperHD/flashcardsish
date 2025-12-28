import { get, set } from 'idb-keyval';
import { CardSet, Folder, Settings } from './types';
import { supabase } from './src/supabaseClient';

const LIBRARY_KEY = 'flashcard-library-v3';
const FOLDERS_KEY = 'flashcard-folders-v1';
const SETTINGS_KEY = 'flashcard-settings-v2';

// Helper to check if user is logged in
const getUser = async () => {
    const { data } = await supabase.auth.getUser();
    return data.user;
};

// --- LIBRARY ---

export const saveLibrary = async (sets: CardSet[]) => {
    const user = await getUser();
    if (user) {
        // Cloud Save
        const { error } = await supabase
            .from('profiles')
            .upsert({ id: user.id, library_sets: sets, updated_at: new Date() });
        if (error) console.error('Supabase save failed:', error);
    } else {
        // Local Save
        try {
            await set(LIBRARY_KEY, sets);
        } catch (error) {
            console.error('Failed to save library to IndexedDB:', error);
        }
    }
};

export const loadLibrary = async (): Promise<CardSet[] | undefined> => {
    const user = await getUser();
    if (user) {
        // Cloud Load
        const { data, error } = await supabase
            .from('profiles')
            .select('library_sets')
            .eq('id', user.id)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 is "Row not found" (new user)
            console.error('Supabase load failed:', error);
            return undefined;
        }
        return data?.library_sets as CardSet[] | undefined;
    } else {
        // Local Load
        try {
            return await get<CardSet[]>(LIBRARY_KEY);
        } catch (error) {
            console.error('Failed to load library from IndexedDB:', error);
            return undefined;
        }
    }
};

// --- FOLDERS & SETTINGS ---

export const saveFolders = async (folders: Folder[]) => {
    const user = await getUser();
    if (user) {
        await supabase.from('profiles').upsert({ id: user.id, folders: folders, updated_at: new Date() });
    } else {
        localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));
    }
};

export const saveSettings = async (settings: Settings) => {
    const user = await getUser();
    if (user) {
        await supabase.from('profiles').upsert({ id: user.id, settings: settings, updated_at: new Date() });
    } else {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    }
};

// We also need a way to load everything at once when logging in
export const loadAllUserData = async () => {
    const user = await getUser();
    if (!user) return null;

    const { data } = await supabase
        .from('profiles')
        .select('library_sets, folders, settings')
        .eq('id', user.id)
        .single();

    return data;
};