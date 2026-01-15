import { get, set } from 'idb-keyval';
import { CardSet, Folder, Settings } from './types';
import { supabase } from './src/supabaseClient';

/**
 * SECURITY: Supabase Row-Level Security (RLS) Requirements
 * 
 * The 'profiles' table MUST have RLS enabled with the following policies:
 * 
 * 1. SELECT: auth.uid() = id
 *    - Users can only read their own profile data
 * 
 * 2. INSERT: auth.uid() = id  
 *    - Users can only create their own profile (on first login)
 * 
 * 3. UPDATE: auth.uid() = id
 *    - Users can only update their own profile data
 * 
 * 4. DELETE: auth.uid() = id
 *    - Users can only delete their own profile data
 * 
 * Without these policies, any authenticated user could access other users' data!
 * 
 * SQL to enable RLS:
 * ```sql
 * ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
 * 
 * CREATE POLICY "Users can view own profile" ON profiles
 *   FOR SELECT USING (auth.uid() = id);
 * 
 * CREATE POLICY "Users can insert own profile" ON profiles
 *   FOR INSERT WITH CHECK (auth.uid() = id);
 * 
 * CREATE POLICY "Users can update own profile" ON profiles
 *   FOR UPDATE USING (auth.uid() = id);
 * 
 * CREATE POLICY "Users can delete own profile" ON profiles
 *   FOR DELETE USING (auth.uid() = id);
 * ```
 */

const LIBRARY_KEY = 'flashcard-library-v3';
const FOLDERS_KEY = 'flashcard-folders-v1';
const SETTINGS_KEY = 'flashcard-settings-v2';
const BADGES_KEY = 'flashcard-badges-v1';

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

export const saveBadges = async (badges: any[]) => { // Using any[] to avoid circular dependency if Badge type isn't imported yet, but better to import it.
    const user = await getUser();
    if (user) {
        await supabase.from('profiles').upsert({ id: user.id, badges: badges, updated_at: new Date() });
    } else {
        localStorage.setItem(BADGES_KEY, JSON.stringify(badges));
    }
};

// We also need a way to load everything at once when logging in
export const loadAllUserData = async () => {
    const user = await getUser();
    if (!user) return null;

    const { data } = await supabase
        .from('profiles')
        .select('library_sets, folders, settings, badges')
        .eq('id', user.id)
        .single();

    return data;
};

// --- DELETE ALL USER DATA (GDPR Compliance) ---

export const deleteAllUserData = async (): Promise<{ success: boolean; error?: string }> => {
    try {
        const user = await getUser();

        // Delete cloud data if logged in
        if (user) {
            const { error } = await supabase
                .from('profiles')
                .delete()
                .eq('id', user.id);

            if (error) {
                console.error('Failed to delete cloud data:', error);
                return { success: false, error: 'Failed to delete cloud data: ' + error.message };
            }
        }

        // Clear IndexedDB
        try {
            const { del } = await import('idb-keyval');
            await del(LIBRARY_KEY);
        } catch (e) {
            console.error('Failed to clear IndexedDB:', e);
        }

        // Clear all localStorage keys related to the app
        localStorage.removeItem(LIBRARY_KEY);
        localStorage.removeItem(FOLDERS_KEY);
        localStorage.removeItem(SETTINGS_KEY);
        localStorage.removeItem(BADGES_KEY);
        localStorage.removeItem('flashcard-stats-v1');

        return { success: true };
    } catch (error) {
        console.error('Error deleting user data:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
};