import { get, set } from 'idb-keyval';
import { CardSet, Folder, Settings } from './types';
import { googleDrive, GoogleDriveUser } from './src/googleDriveClient';

/**
 * LOCAL-FIRST STORAGE WITH GOOGLE DRIVE SYNC
 * 
 * This storage layer implements a local-first approach where:
 * 1. All data is stored locally in IndexedDB/localStorage for fast access
 * 2. When signed in, data syncs to a "Flashcardsish" folder in Google Drive
 * 3. The folder ID is stored in localStorage for persistence
 * 4. A single flashcardsish_data.json file stores all user data in Drive
 * 
 * The folder selection happens on first use via Google Drive Picker API.
 */

const LIBRARY_KEY = 'flashcard-library-v3';
const FOLDERS_KEY = 'flashcard-folders-v1';
const SETTINGS_KEY = 'flashcard-settings-v2';
const BADGES_KEY = 'flashcard-badges-v1';
const DRIVE_FOLDER_ID_KEY = 'flashcardsish-drive-folder-id';

// Helper to check if user is logged in
const getUser = async (): Promise<GoogleDriveUser | null> => {
    return await googleDrive.getSession();
};

// Helper to get the Drive folder ID
const getDriveFolderId = (): string | null => {
    return localStorage.getItem(DRIVE_FOLDER_ID_KEY);
};

// Helper to set the Drive folder ID
const setDriveFolderId = (folderId: string) => {
    localStorage.setItem(DRIVE_FOLDER_ID_KEY, folderId);
};

// --- GOOGLE DRIVE SYNC HELPERS ---

interface DriveData {
    library_sets?: CardSet[];
    folders?: Folder[];
    settings?: Settings;
    badges?: any[];
    updated_at?: string;
}

/**
 * Save all data to Google Drive
 */
const syncToGoogleDrive = async (data: DriveData) => {
    const user = await getUser();
    if (!user) return;

    try {
        let folderId = getDriveFolderId();

        // Get or create the app folder
        folderId = await googleDrive.getOrCreateAppFolder(folderId || undefined);
        setDriveFolderId(folderId);

        // Write the data file
        await googleDrive.writeDataFile(folderId, {
            ...data,
            updated_at: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Failed to sync to Google Drive:', error);
    }
};

/**
 * Load all data from Google Drive
 */
const loadFromGoogleDrive = async (): Promise<DriveData | null> => {
    const user = await getUser();
    if (!user) return null;

    try {
        let folderId = getDriveFolderId();

        // Get or create the app folder
        folderId = await googleDrive.getOrCreateAppFolder(folderId || undefined);
        setDriveFolderId(folderId);

        // Read the data file
        const data = await googleDrive.readDataFile(folderId);
        return data;
    } catch (error) {
        console.error('Failed to load from Google Drive:', error);
        return null;
    }
};

// --- LIBRARY ---

export const saveLibrary = async (sets: CardSet[]) => {
    const user = await getUser();

    // Always save locally first for speed
    try {
        await set(LIBRARY_KEY, sets);
    } catch (error) {
        console.error('Failed to save library to IndexedDB:', error);
    }

    // Sync to Google Drive if signed in
    if (user) {
        await syncToGoogleDrive({ library_sets: sets });
    }
};

export const loadLibrary = async (): Promise<CardSet[] | undefined> => {
    const user = await getUser();

    if (user) {
        // Try to load from Google Drive first
        const driveData = await loadFromGoogleDrive();
        if (driveData?.library_sets && driveData.library_sets.length > 0) {
            // Save to local cache
            try {
                await set(LIBRARY_KEY, driveData.library_sets);
            } catch (error) {
                console.error('Failed to cache library to IndexedDB:', error);
            }
            return driveData.library_sets;
        }
    }

    // Fall back to local storage
    try {
        return await get<CardSet[]>(LIBRARY_KEY);
    } catch (error) {
        console.error('Failed to load library from IndexedDB:', error);
        return undefined;
    }
};

// --- FOLDERS & SETTINGS ---

export const saveFolders = async (folders: Folder[]) => {
    const user = await getUser();

    // Save locally
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));

    // Sync to Drive if signed in
    if (user) {
        await syncToGoogleDrive({ folders });
    }
};

export const saveSettings = async (settings: Settings) => {
    const user = await getUser();

    // Save locally
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

    // Sync to Drive if signed in
    if (user) {
        await syncToGoogleDrive({ settings });
    }
};

export const saveBadges = async (badges: any[]) => {
    const user = await getUser();

    // Save locally
    localStorage.setItem(BADGES_KEY, JSON.stringify(badges));

    // Sync to Drive if signed in
    if (user) {
        await syncToGoogleDrive({ badges });
    }
};

// Load everything at once when logging in
export const loadAllUserData = async (): Promise<DriveData | null> => {
    const user = await getUser();
    if (!user) return null;

    const data = await loadFromGoogleDrive();

    // Cache to local storage
    if (data) {
        if (data.library_sets) {
            try {
                await set(LIBRARY_KEY, data.library_sets);
            } catch (e) {
                console.error('Failed to cache library:', e);
            }
        }
        if (data.folders) localStorage.setItem(FOLDERS_KEY, JSON.stringify(data.folders));
        if (data.settings) localStorage.setItem(SETTINGS_KEY, JSON.stringify(data.settings));
        if (data.badges) localStorage.setItem(BADGES_KEY, JSON.stringify(data.badges));
    }

    return data;
};

// --- DELETE ALL USER DATA (GDPR Compliance) ---

export const deleteAllUserData = async (): Promise<{ success: boolean; error?: string }> => {
    try {
        const user = await getUser();

        // Delete cloud data if logged in
        if (user) {
            try {
                const folderId = getDriveFolderId();
                if (folderId) {
                    // Delete the data file from Drive
                    await googleDrive.writeDataFile(folderId, {
                        library_sets: [],
                        folders: [],
                        settings: {},
                        badges: [],
                    });
                }
            } catch (error) {
                console.error('Failed to delete cloud data:', error);
                return { success: false, error: 'Failed to delete cloud data: ' + (error as Error).message };
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
        localStorage.removeItem(DRIVE_FOLDER_ID_KEY);

        return { success: true };
    } catch (error) {
        console.error('Error deleting user data:', error);
        return { success: false, error: 'An unexpected error occurred' };
    }
};

// --- GOOGLE DRIVE FOLDER INITIALIZATION ---

/**
 * Initialize or select the Google Drive folder for the app
 * This should be called on first run or if folder is not set
 */
export const initializeDriveFolder = async (): Promise<string> => {
    const user = await getUser();
    if (!user) throw new Error('Not signed in');

    let folderId = getDriveFolderId();
    folderId = await googleDrive.getOrCreateAppFolder(folderId || undefined);
    setDriveFolderId(folderId);

    return folderId;
};