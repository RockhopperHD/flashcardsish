import { get, set, del } from 'idb-keyval';
import { CardSet, Folder, Settings, SetMetadata, Tag } from './types';
import { googleDrive, GoogleDriveUser } from './src/googleDriveClient';
import * as storageV2 from './storageV2';

/**
 * STORAGE BRIDGE LAYER
 * 
 * This module provides backward-compatible functions while migrating to the 
 * new distributed storage system (V2). It:
 * 
 * 1. Checks for legacy data and triggers migration
 * 2. Routes save/load operations to the appropriate V2 functions
 * 3. Maintains local caching for offline/fast access
 * 
 * The V2 system stores:
 * - config.json (settings + last used sets)
 * - structure.json (folders + set references)
 * - sets/[id].flashcards (individual set files)
 * - sessions/[id].json (in-progress session data)
 */

const LIBRARY_KEY = 'flashcard-library-v3';
const FOLDERS_KEY = 'flashcard-folders-v1';
const SETTINGS_KEY = 'flashcard-settings-v2';
const BADGES_KEY = 'flashcard-badges-v1';
const STATS_KEY = 'flashcard-stats-v1';
const DRIVE_FOLDER_ID_KEY = 'flashcardsish-drive-folder-id';
const MIGRATION_DONE_KEY = 'flashcardsish-v2-migrated';

// Re-export V2 types and functions that are needed externally
export type { CorruptionReport } from './storageV2';
export {
    DEFAULT_SETTINGS,
    resetSettingsToDefault,
    updateLastUsedSets
} from './storageV2';

// ============================================================================
// HELPERS
// ============================================================================

const getUser = async (): Promise<GoogleDriveUser | null> => {
    return await googleDrive.getSession();
};

// ============================================================================
// MIGRATION CHECK
// ============================================================================

let migrationCheckDone = false;
let migrationInProgress = false;

/**
 * Check if migration to V2 is needed and perform it
 */
export const checkAndMigrate = async (): Promise<{
    migrated: boolean;
    error?: string
}> => {
    if (migrationCheckDone) return { migrated: false };
    if (migrationInProgress) return { migrated: false };

    migrationInProgress = true;

    try {
        // Already migrated?
        if (localStorage.getItem(MIGRATION_DONE_KEY) === 'true') {
            migrationCheckDone = true;
            migrationInProgress = false;
            return { migrated: false };
        }

        // ...
        const needsMig = await storageV2.needsMigration();
        if (needsMig) {
            // console.log('[Storage] Starting migration to V2...');
            const result = await storageV2.migrateFromV1();

            if (result.success) {
                localStorage.setItem(MIGRATION_DONE_KEY, 'true');
                // console.log('[Storage] Migration to V2 complete');
                migrationCheckDone = true;
                migrationInProgress = false;
                return { migrated: true };
            } else {
                console.error('[Storage] Migration failed:', result.error);
                migrationInProgress = false;
                return { migrated: false, error: result.error };
            }
        }

        // Even if no migration needed, mark as done for future loads
        localStorage.setItem(MIGRATION_DONE_KEY, 'true');
        migrationCheckDone = true;
        migrationInProgress = false;
        return { migrated: false };
    } catch (error) {
        console.error('[Storage] Migration check failed:', error);
        migrationInProgress = false;
        return { migrated: false, error: (error as Error).message };
    }
};

// ============================================================================
// LIBRARY (SETS)
// ============================================================================

/**
 * Save all library sets
 * In V2, this saves each set as a separate .flashcards file
 * Returns { success, savedToCloud, error? } to enable UI feedback
 */
export const saveLibrary = async (sets: CardSet[]): Promise<{ success: boolean; savedToCloud: boolean; error?: string }> => {
    // Always save locally first for speed
    try {
        await set(LIBRARY_KEY, sets);
    } catch (error) {
        console.error('Failed to save library to IndexedDB:', error);
    }

    const user = await getUser();
    if (!user) {
        // console.log('[Storage] No user session - saving locally only');
        return { success: true, savedToCloud: false };
    }

    // Filter out local-only sets for cloud storage
    const cloudSets = sets.filter(s => !s.isLocalOnly);
    const cloudSetIds = new Set(cloudSets.map(s => s.id));

    try {
        // console.log(`[Storage] Saving ${cloudSets.length} sets to Google Drive...`);

        // Get current structure to track root sets
        const { structure } = await storageV2.readStructure();

        // Write eligible sets to Drive
        for (const cardSet of cloudSets) {
            // console.log(`[Storage] Writing set "${cardSet.name}" (${cardSet.id})...`);
            await storageV2.writeFlashcardSet(cardSet);
        }

        // Rebuild structure based on current cloud sets
        // 1. Filter existing root sets to only include current cloud sets
        let newRootSets = structure.rootSets.filter(id => cloudSetIds.has(id));

        // 2. Filter folder contents
        let newFolders = structure.folders.map(f => ({
            ...f,
            setIds: f.setIds.filter(id => cloudSetIds.has(id))
        }));

        // 3. Add any new cloud sets to root if they aren't in a folder
        cloudSets.forEach(cardSet => {
            const inFolder = newFolders.some(f => f.setIds.includes(cardSet.id));
            if (!inFolder && !newRootSets.includes(cardSet.id)) {
                newRootSets.push(cardSet.id);
            }
        });

        // 4. Assign new structure
        structure.rootSets = newRootSets;
        structure.folders = newFolders;

        await storageV2.writeStructure(structure);
        // console.log(`[Storage] Successfully saved ${cloudSets.length} sets to Google Drive`);
        return { success: true, savedToCloud: true };
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[Storage] Failed to save library to Google Drive:', msg);
        return { success: true, savedToCloud: false, error: msg };
    }
};

/**
 * Load library sets
 * In V2, loads from structure + individual .flashcards files
 */
export const loadLibrary = async (): Promise<CardSet[] | undefined> => {
    let user = null;

    // Try to get user, but don't let Google Drive errors break local loading
    try {
        user = await getUser();
    } catch (error) {
        console.warn('[Storage] Could not check Google Drive user (this is OK for offline use):', error);
    }

    // 1. Get Local Cache (we ALWAYS want this as base/fallback)
    let localSets: CardSet[] = [];
    try {
        const cached = await get<CardSet[]>(LIBRARY_KEY);
        if (cached && Array.isArray(cached)) {
            localSets = cached;
        } else {
            // Fallback to localStorage
            const local = localStorage.getItem(LIBRARY_KEY);
            if (local) {
                localSets = JSON.parse(local);
            }
        }
    } catch (e) {
        console.error('Failed to load from IndexedDB/LocalStorage:', e);
    }

    if (!user) {
        return localSets.length > 0 ? localSets : undefined;
    }

    // 2. Load from V2 Cloud
    try {
        const { structure } = await storageV2.readStructure();

        // Collect all set IDs
        const allSetIds: string[] = [...structure.rootSets];
        structure.folders.forEach(folder => {
            folder.setIds.forEach(id => {
                if (!allSetIds.includes(id)) {
                    allSetIds.push(id);
                }
            });
        });

        // Load each cloud set
        const cloudSets: CardSet[] = [];
        for (const setId of allSetIds) {
            const { set: cardSet } = await storageV2.readFlashcardSet(setId);
            if (cardSet) {
                // Set folderId from structure
                for (const folder of structure.folders) {
                    if (folder.setIds.includes(setId)) {
                        cardSet.folderId = folder.id;
                        break;
                    }
                }
                cloudSets.push(cardSet);
            }
        }

        // 3. Smart Merge: Cloud wins for same ID, Local-only kept and marked
        const mergedMap = new Map<string, CardSet>();

        // Add Cloud Sets first (authoritative)
        cloudSets.forEach(s => mergedMap.set(s.id, s));

        // Add Local Sets if not present (and mark as Local Only if not in cloud)
        localSets.forEach(s => {
            if (!mergedMap.has(s.id)) {
                // This set exists locally but not in cloud structure.
                const localOnlySet = { ...s, isLocalOnly: true };
                mergedMap.set(s.id, localOnlySet);
            }
        });

        const finalSets = Array.from(mergedMap.values());

        // Cache merged result locally
        await set(LIBRARY_KEY, finalSets);

        return finalSets;
    } catch (error) {
        console.error('[Storage] Failed to load library from V2:', error);
        return localSets.length > 0 ? localSets : undefined;
    }
};

/**
 * Load a single set by ID (lazy loading)
 */
export const loadSet = async (setId: string): Promise<CardSet | null> => {
    const { set: cardSet, wasCorrupted, recoveredCards, totalCards } =
        await storageV2.readFlashcardSet(setId);

    if (wasCorrupted) {
        console.warn(`[Storage] Set ${setId} was corrupted, recovered ${recoveredCards}/${totalCards} cards`);
    }

    return cardSet;
};

/**
 * Save a single set (for lazy loading architecture)
 */
export const saveSet = async (cardSet: CardSet): Promise<void> => {
    await storageV2.writeFlashcardSet(cardSet);

    // Also update local cache
    try {
        const cached = await get<CardSet[]>(LIBRARY_KEY) || [];
        const idx = cached.findIndex(s => s.id === cardSet.id);
        if (idx >= 0) {
            cached[idx] = cardSet;
        } else {
            cached.push(cardSet);
        }
        await set(LIBRARY_KEY, cached);
    } catch (e) {
        console.error('[Storage] Failed to update local cache:', e);
    }
};

/**
 * Delete a single set
 */
export const deleteSet = async (setId: string): Promise<void> => {
    await storageV2.deleteFlashcardSet(setId);

    // Update local cache
    try {
        const cached = await get<CardSet[]>(LIBRARY_KEY) || [];
        await set(LIBRARY_KEY, cached.filter(s => s.id !== setId));
    } catch (e) {
        console.error('[Storage] Failed to update local cache:', e);
    }
};

// ============================================================================
// FOLDERS
// ============================================================================

export const saveFolders = async (folders: Folder[]) => {
    // Save locally
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));

    const user = await getUser();
    if (!user) return;

    // Save to V2 structure
    await storageV2.updateFolders(folders);
};

export const loadFolders = async (): Promise<Folder[]> => {
    const user = await getUser();

    // Try local first
    const local = localStorage.getItem(FOLDERS_KEY);
    if (local) {
        try {
            return JSON.parse(local);
        } catch (e) { }
    }

    if (!user) return [];

    // Load from V2
    try {
        const { structure } = await storageV2.readStructure();

        // Cache locally
        localStorage.setItem(FOLDERS_KEY, JSON.stringify(structure.folders));

        return structure.folders;
    } catch (error) {
        console.error('[Storage] Failed to load folders from V2:', error);
        return [];
    }
};

// ============================================================================
// SETTINGS
// ============================================================================

export const saveSettings = async (settings: Settings) => {
    // Save locally
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

    const user = await getUser();
    if (!user) return;

    // Save to V2
    await storageV2.updateSettings(settings);
};

export const loadSettings = async (): Promise<Settings> => {
    const user = await getUser();

    // Try local first
    const local = localStorage.getItem(SETTINGS_KEY);
    if (local) {
        try {
            const parsed = JSON.parse(local);
            // Merge with defaults for any new keys
            return { ...storageV2.DEFAULT_SETTINGS, ...parsed };
        } catch (e) { }
    }

    if (!user) return { ...storageV2.DEFAULT_SETTINGS };

    // Load from V2
    try {
        const { config } = await storageV2.readConfig();

        // Cache locally
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(config.settings));

        return config.settings;
    } catch (error) {
        console.error('[Storage] Failed to load settings from V2:', error);
        return { ...storageV2.DEFAULT_SETTINGS };
    }
};

// ============================================================================
// BADGES
// ============================================================================

export const saveBadges = async (badges: any[]) => {
    // Save locally
    localStorage.setItem(BADGES_KEY, JSON.stringify(badges));

    const user = await getUser();
    if (!user) return;

    // Save to V2
    await storageV2.updateBadges(badges);
};

export const loadBadges = async (): Promise<any[]> => {
    const user = await getUser();

    // Try local first
    const local = localStorage.getItem(BADGES_KEY);
    if (local) {
        try {
            return JSON.parse(local);
        } catch (e) { }
    }

    if (!user) return [];

    // Load from V2
    try {
        const { structure } = await storageV2.readStructure();

        // Cache locally
        localStorage.setItem(BADGES_KEY, JSON.stringify(structure.badges));

        return structure.badges;
    } catch (error) {
        console.error('[Storage] Failed to load badges from V2:', error);
        return [];
    }
};

// ============================================================================
// TAGS
// ============================================================================

export const saveTags = async (tags: Tag[]) => {
    // Save locally
    // localStorage.setItem(TAGS_KEY, JSON.stringify(tags));

    const user = await getUser();
    if (!user) return;

    // Save to V2
    await storageV2.updateTags(tags);
};

// ============================================================================
// STATS
// ============================================================================

export const saveStats = async (stats: { lifetimeCorrect: number }) => {
    // Save locally
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));

    const user = await getUser();
    if (!user) return;

    // Save to V2
    await storageV2.updateStats(stats);
};

export const loadStats = async (): Promise<{ lifetimeCorrect: number }> => {
    const user = await getUser();

    // Try local first
    const local = localStorage.getItem(STATS_KEY);
    if (local) {
        try {
            return JSON.parse(local);
        } catch (e) { }
    }

    if (!user) return { lifetimeCorrect: 0 };

    // Load from V2
    try {
        const { structure } = await storageV2.readStructure();

        // Cache locally
        localStorage.setItem(STATS_KEY, JSON.stringify(structure.stats));

        return structure.stats;
    } catch (error) {
        console.error('[Storage] Failed to load stats from V2:', error);
        return { lifetimeCorrect: 0 };
    }
};

// ============================================================================
// CONSOLIDATED LOAD
// ============================================================================

interface AllUserData {
    library_sets?: CardSet[];
    folders?: Folder[];
    settings?: Settings;
    badges?: any[];
    stats?: { lifetimeCorrect: number };
    tags?: Tag[];
    corruptions?: storageV2.CorruptionReport[];
}

/**
 * Load all user data at once (for cloud sync / login)
 * Invalidates local caches first, then reads everything from Google Drive.
 * Loads ALL sets (not just preloaded), so syncCloudData can do a proper merge.
 */
export const loadAllUserData = async (): Promise<AllUserData | null> => {
    const user = await getUser();
    if (!user) return null;

    // Check for migration first
    await checkAndMigrate();

    try {
        // Invalidate local caches so we get fresh data from Drive
        await storageV2.invalidateLocalCaches();

        // Load boot data (forceCloud = true by default)
        const bootData = await storageV2.loadBootData();

        // Cache locally
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(bootData.settings));
        localStorage.setItem(FOLDERS_KEY, JSON.stringify(bootData.folders));
        localStorage.setItem(BADGES_KEY, JSON.stringify(bootData.badges));
        localStorage.setItem(STATS_KEY, JSON.stringify(bootData.stats));

        // Now load ALL sets from cloud, not just the preloaded 3
        // Collect all set IDs from the cloud structure
        const allSetIds = new Set<string>();
        bootData.allSetMetadata.forEach(m => allSetIds.add(m.id));
        // Also include preloaded set IDs
        bootData.preloadedSets.forEach(s => allSetIds.add(s.id));

        // console.log(`[Storage] Loading ALL ${allSetIds.size} sets from cloud...`);

        const allSets: CardSet[] = [];
        const corruptions = [...bootData.corruptions];

        // Preloaded sets are already loaded, use them directly
        const preloadedMap = new Map<string, CardSet>();
        bootData.preloadedSets.forEach(s => preloadedMap.set(s.id, s));

        for (const setId of allSetIds) {
            // Re-use preloaded if available
            if (preloadedMap.has(setId)) {
                allSets.push(preloadedMap.get(setId)!);
                continue;
            }

            // Load from cloud (forceCloud = true)
            const { set: cardSet, wasCorrupted, recoveredCards, totalCards } = await storageV2.readFlashcardSet(setId, true);
            if (cardSet) {
                allSets.push(cardSet);
            }
            if (wasCorrupted) {
                corruptions.push({
                    type: 'set',
                    fileName: `${setId}.flashcards`,
                    recoveredCards,
                    totalCards,
                    error: recoveredCards ? `Recovered ${recoveredCards}/${totalCards} cards` : 'Set was completely corrupted'
                });
            }
        }

        // console.log(`[Storage] Loaded ${allSets.length} sets from cloud`);

        // Cache all loaded sets in IndexedDB
        if (allSets.length > 0) {
            try {
                await set(LIBRARY_KEY, allSets);
            } catch (e) { }
        }

        return {
            library_sets: allSets,
            folders: bootData.folders,
            settings: bootData.settings,
            badges: bootData.badges,
            tags: bootData.tags,
            stats: bootData.stats,
            corruptions
        };
    } catch (error) {
        console.error('[Storage] Failed to load all user data:', error);
        return null;
    }
};

// ============================================================================
// DELETE ALL DATA (GDPR)
// ============================================================================

export const deleteAllUserData = async (): Promise<{ success: boolean; error?: string }> => {
    // Use V2 delete
    const result = await storageV2.deleteAllDataV2();

    // Also clear legacy keys
    localStorage.removeItem(LIBRARY_KEY);
    localStorage.removeItem(FOLDERS_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(BADGES_KEY);
    localStorage.removeItem(STATS_KEY);
    localStorage.removeItem(DRIVE_FOLDER_ID_KEY);
    localStorage.removeItem(MIGRATION_DONE_KEY);

    // Clear IndexedDB
    try {
        await del(LIBRARY_KEY);
    } catch (e) {
        console.error('Failed to clear IndexedDB:', e);
    }

    return result;
};

// ============================================================================
// DRIVE FOLDER INITIALIZATION
// ============================================================================

export const initializeDriveFolder = async (): Promise<string> => {
    const user = await getUser();
    if (!user) throw new Error('Not signed in');

    let folderId = localStorage.getItem(DRIVE_FOLDER_ID_KEY);
    folderId = await googleDrive.getOrCreateAppFolder(folderId || undefined);
    localStorage.setItem(DRIVE_FOLDER_ID_KEY, folderId);

    return folderId;
};
