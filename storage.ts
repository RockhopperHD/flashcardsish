import { get, set, del } from 'idb-keyval';
import { Card, CardSet, Folder, Settings, SetMetadata, Tag } from './types';
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
const LIBRARY_LOCAL_UPDATED_AT_KEY = 'flashcard-library-v3-updated-at';
const LIBRARY_IDB_UPDATED_AT_KEY = 'flashcard-library-v3-idb-updated-at';
const FOLDERS_KEY = 'flashcard-folders-v1';
const SETTINGS_KEY = 'flashcard-settings-v2';
const BADGES_KEY = 'flashcard-badges-v1';
const STATS_KEY = 'flashcard-stats-v1';
const TAGS_KEY = 'flashcard-tags-v1';
const DRIVE_FOLDER_ID_KEY = 'flashcardsish-drive-folder-id';
const MIGRATION_DONE_KEY = 'flashcardsish-v2-migrated';

// Re-export V2 types and functions that are needed externally
export type { CorruptionReport } from './storageV2';
export {
    DEFAULT_SETTINGS,
    resetSettingsToDefault,
    updateLastUsedSets
} from './storageV2';

export interface CloudConflictDetail {
    setId: string;
    setName: string;
    localCardCount: number;
    cloudCardCount: number;
    cardsAddedLocally: number;
    cardsDeletedLocally: number;
    cardsEditedLocally: number;
    addedCardLabels: string[];
    deletedCardLabels: string[];
    editedCardLabels: string[];
    localModifiedAt?: string;
    cloudModifiedAt?: string;
}

// ============================================================================
// HELPERS
// ============================================================================

const getUser = async (): Promise<GoogleDriveUser | null> => {
    return await googleDrive.getSession();
};

const parseTimestamp = (value: unknown): number => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
};

const writeLibraryToIndexedDb = async (sets: CardSet[], timestamp: number): Promise<void> => {
    await set(LIBRARY_KEY, sets);
    await set(LIBRARY_IDB_UPDATED_AT_KEY, timestamp);
};

const writeLibraryToLocalFallback = (sets: CardSet[], timestamp: number): void => {
    try {
        localStorage.setItem(LIBRARY_KEY, JSON.stringify(sets));
        localStorage.setItem(LIBRARY_LOCAL_UPDATED_AT_KEY, String(timestamp));
    } catch (error) {
        console.warn('[Storage] Failed to write local fallback library cache:', error);
    }
};

interface LoadOptions {
    localOnly?: boolean;
}

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
export const saveLibrary = async (
    sets: CardSet[],
    options?: { ignoreConflicts?: boolean; folders?: Folder[]; skipCloud?: boolean }
): Promise<{ success: boolean; savedToCloud: boolean; error?: string; conflicts?: string[]; conflictDetails?: CloudConflictDetail[] }> => {
    // Always save locally first for speed
    const localWriteTimestamp = Date.now();
    try {
        await writeLibraryToIndexedDb(sets, localWriteTimestamp);
    } catch (error) {
        console.error('Failed to save library to IndexedDB:', error);
    }
    writeLibraryToLocalFallback(sets, localWriteTimestamp);

    const user = await getUser();
    if (!user || options?.skipCloud) {
        // console.log('[Storage] No user session - saving locally only');
        return { success: true, savedToCloud: false };
    }

    // Filter out local-only sets for cloud storage
    const cloudSets = sets.filter(s => !s.isLocalOnly);

    try {
        // Best-effort snapshot backup of current cloud state before mutating files.
        await storageV2.createCloudSafetyBackupIfNeeded();

        const conflicts: string[] = [];
        const conflictDetails: CloudConflictDetail[] = [];
        // console.log(`[Storage] Saving ${cloudSets.length} sets to Google Drive...`);

        // Get current structure to track root sets
        const { structure } = await storageV2.readStructure();

        // Write eligible sets to Drive
        for (const cardSet of cloudSets) {
            try {
                // console.log(`[Storage] Writing set "${cardSet.name}" (${cardSet.id})...`);
                await storageV2.writeFlashcardSet(cardSet, { ignoreConflicts: options?.ignoreConflicts });
            } catch (error: any) {
                if (error?.code === 'CLOUD_CONFLICT' || error?.name === 'DriveConflictError') {
                    conflicts.push(cardSet.name || cardSet.id);
                    try {
                        const { set: cloudSet } = await storageV2.readFlashcardSet(cardSet.id, true);
                        conflictDetails.push(buildConflictDetail(cardSet, cloudSet, {
                            localModifiedAt: error?.expectedModifiedTime,
                            cloudModifiedAt: error?.actualModifiedTime
                        }));
                    } catch {
                        conflictDetails.push(buildConflictDetail(cardSet, null, {
                            localModifiedAt: error?.expectedModifiedTime,
                            cloudModifiedAt: error?.actualModifiedTime
                        }));
                    }
                    continue;
                }
                throw error;
            }
        }

        if (conflicts.length > 0 && !options?.ignoreConflicts) {
            return {
                success: false,
                savedToCloud: false,
                error: 'Cloud conflict detected',
                conflicts,
                conflictDetails
            };
        }

        // Rebuild structure from the current in-memory set.folderId assignments.
        // This prevents stale folder.setIds metadata from dropping moves.
        const sourceFolders = options?.folders ?? structure.folders;
        const folderIds = new Set(sourceFolders.map(folder => folder.id));
        const folderMembership = new Map<string, string[]>();
        const rootSets: string[] = [];
        const now = Date.now();

        for (const cardSet of cloudSets) {
            if (cardSet.folderId && folderIds.has(cardSet.folderId)) {
                const bucket = folderMembership.get(cardSet.folderId) ?? [];
                bucket.push(cardSet.id);
                folderMembership.set(cardSet.folderId, bucket);
                continue;
            }
            rootSets.push(cardSet.id);
        }

        const normalizedFolders = sourceFolders.map(folder => ({
            ...folder,
            setIds: folderMembership.get(folder.id) ?? []
        }));

        structure.rootSets = rootSets;
        structure.folders = normalizedFolders;

        // V3: Update manifest for all written sets
        if (!structure.setManifest) structure.setManifest = {};
        for (const cardSet of cloudSets) {
            structure.setManifest[cardSet.id] = { modifiedAt: now };
        }

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
 * V3: Save only the sets that have actually changed (dirty sets).
 * This avoids re-uploading every set when only one card was edited.
 * Also updates structure.json for folder/set membership if needed.
 */
export const saveDirtySets = async (
    allSets: CardSet[],
    dirtySetIds: Set<string>,
    options?: { ignoreConflicts?: boolean; folders?: Folder[]; skipCloud?: boolean; structureChanged?: boolean }
): Promise<{ success: boolean; savedToCloud: boolean; savedSetIds: string[]; error?: string; conflicts?: string[]; conflictDetails?: CloudConflictDetail[] }> => {
    // Always save full library locally for fast offline access
    const localWriteTimestamp = Date.now();
    try {
        await writeLibraryToIndexedDb(allSets, localWriteTimestamp);
    } catch (error) {
        console.error('Failed to save library to IndexedDB:', error);
    }
    writeLibraryToLocalFallback(allSets, localWriteTimestamp);

    const savedSetIds: string[] = [];

    const user = await getUser();
    if (!user || options?.skipCloud) {
        return { success: true, savedToCloud: false, savedSetIds };
    }

    // Only write dirty cloud sets
    const dirtySets = allSets.filter(s => dirtySetIds.has(s.id) && !s.isLocalOnly);

    if (dirtySets.length === 0 && !options?.structureChanged) {
        return { success: true, savedToCloud: false, savedSetIds };
    }

    try {
        const conflicts: string[] = [];
        const conflictDetails: CloudConflictDetail[] = [];
        console.log(`[Storage V3] Saving ${dirtySets.length} dirty sets to Google Drive...`);

        // Write only the dirty sets
        for (const cardSet of dirtySets) {
            try {
                await storageV2.writeFlashcardSet(cardSet, { ignoreConflicts: options?.ignoreConflicts });
                savedSetIds.push(cardSet.id);
            } catch (error: any) {
                if (error?.code === 'CLOUD_CONFLICT' || error?.name === 'DriveConflictError') {
                    conflicts.push(cardSet.name || cardSet.id);
                    try {
                        const { set: cloudSet } = await storageV2.readFlashcardSet(cardSet.id, true);
                        conflictDetails.push(buildConflictDetail(cardSet, cloudSet, {
                            localModifiedAt: error?.expectedModifiedTime,
                            cloudModifiedAt: error?.actualModifiedTime
                        }));
                    } catch {
                        conflictDetails.push(buildConflictDetail(cardSet, null, {
                            localModifiedAt: error?.expectedModifiedTime,
                            cloudModifiedAt: error?.actualModifiedTime
                        }));
                    }
                    continue;
                }
                throw error;
            }
        }

        if (conflicts.length > 0 && !options?.ignoreConflicts) {
            return {
                success: false,
                savedToCloud: false,
                savedSetIds,
                error: 'Cloud conflict detected',
                conflicts,
                conflictDetails
            };
        }

        // Only rebuild structure if explicitly told or if we wrote sets
        if (options?.structureChanged || savedSetIds.length > 0) {
            const { structure } = await storageV2.readStructure();
            const cloudSets = allSets.filter(s => !s.isLocalOnly);
            const sourceFolders = options?.folders ?? structure.folders;
            const folderIds = new Set(sourceFolders.map(folder => folder.id));
            const folderMembership = new Map<string, string[]>();
            const rootSets: string[] = [];
            const now = Date.now();

            for (const cardSet of cloudSets) {
                if (cardSet.folderId && folderIds.has(cardSet.folderId)) {
                    const bucket = folderMembership.get(cardSet.folderId) ?? [];
                    bucket.push(cardSet.id);
                    folderMembership.set(cardSet.folderId, bucket);
                    continue;
                }
                rootSets.push(cardSet.id);
            }

            const normalizedFolders = sourceFolders.map(folder => ({
                ...folder,
                setIds: folderMembership.get(folder.id) ?? []
            }));

            structure.rootSets = rootSets;
            structure.folders = normalizedFolders;

            // V3: Update manifest only for sets we actually wrote
            if (!structure.setManifest) structure.setManifest = {};
            for (const setId of savedSetIds) {
                structure.setManifest[setId] = { modifiedAt: now };
            }

            await storageV2.writeStructure(structure);
        }

        console.log(`[Storage V3] Successfully saved ${savedSetIds.length} dirty sets to Google Drive`);
        return { success: true, savedToCloud: true, savedSetIds };
    } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[Storage V3] Failed to save dirty sets to Google Drive:', msg);
        return { success: true, savedToCloud: false, savedSetIds, error: msg };
    }
};

const describeCard = (card: Card): string => {
    const termText = Array.isArray(card.term) ? card.term.join(' / ').trim() : '';
    if (termText) return termText.slice(0, 80);
    const contentText = (card.content || '').trim();
    if (contentText) return contentText.slice(0, 80);
    return card.id;
};

const normalizedCardSignature = (card: Card): string => {
    const normalizedCustomFields = (card.customFields || [])
        .map(field => ({ name: field.name || '', value: field.value || '' }))
        .sort((a, b) => a.name.localeCompare(b.name));

    return JSON.stringify({
        term: Array.isArray(card.term) ? card.term : [],
        content: card.content || '',
        year: card.year || '',
        image: card.image || '',
        termImage: card.termImage || '',
        tags: [...(card.tags || [])].sort(),
        customFields: normalizedCustomFields,
        star: card.star === true
    });
};

const buildConflictDetail = (
    localSet: CardSet,
    cloudSet: CardSet | null,
    options?: { localModifiedAt?: string; cloudModifiedAt?: string }
): CloudConflictDetail => {
    const localCards = localSet.cards || [];
    const cloudCards = cloudSet?.cards || [];

    const localById = new Map(localCards.map(card => [card.id, card]));
    const cloudById = new Map(cloudCards.map(card => [card.id, card]));

    const addedLocally: Card[] = [];
    const deletedLocally: Card[] = [];
    const editedLocally: Card[] = [];

    for (const [cardId, localCard] of localById.entries()) {
        const cloudCard = cloudById.get(cardId);
        if (!cloudCard) {
            addedLocally.push(localCard);
            continue;
        }
        if (normalizedCardSignature(localCard) !== normalizedCardSignature(cloudCard)) {
            editedLocally.push(localCard);
        }
    }

    for (const [cardId, cloudCard] of cloudById.entries()) {
        if (!localById.has(cardId)) {
            deletedLocally.push(cloudCard);
        }
    }

    return {
        setId: localSet.id,
        setName: localSet.name || cloudSet?.name || localSet.id,
        localCardCount: localCards.length,
        cloudCardCount: cloudCards.length,
        cardsAddedLocally: addedLocally.length,
        cardsDeletedLocally: deletedLocally.length,
        cardsEditedLocally: editedLocally.length,
        addedCardLabels: addedLocally.slice(0, 6).map(describeCard),
        deletedCardLabels: deletedLocally.slice(0, 6).map(describeCard),
        editedCardLabels: editedLocally.slice(0, 6).map(describeCard),
        localModifiedAt: options?.localModifiedAt,
        cloudModifiedAt: options?.cloudModifiedAt
    };
};

/**
 * Load library sets
 * In V2, loads from structure + individual .flashcards files
 */
export const loadLibrary = async (options?: LoadOptions): Promise<CardSet[] | undefined> => {
    let user = null;

    // Try to get user, but don't let Google Drive errors break local loading
    if (!options?.localOnly) {
        try {
            user = await getUser();
        } catch (error) {
            console.warn('[Storage] Could not check Google Drive user (this is OK for offline use):', error);
        }
    }

    // 1. Get Local Cache (we ALWAYS want this as base/fallback)
    let localSets: CardSet[] = [];
    let indexedDbSets: CardSet[] = [];
    let localStorageSets: CardSet[] = [];
    let indexedDbUpdatedAt = 0;
    let localStorageUpdatedAt = 0;
    try {
        const [cachedSets, cachedUpdatedAt] = await Promise.all([
            get<CardSet[]>(LIBRARY_KEY),
            get<number>(LIBRARY_IDB_UPDATED_AT_KEY)
        ]);

        if (Array.isArray(cachedSets)) {
            indexedDbSets = cachedSets;
        }
        indexedDbUpdatedAt = parseTimestamp(cachedUpdatedAt);
    } catch (e) {
        console.error('Failed to load library from IndexedDB:', e);
    }

    try {
        const local = localStorage.getItem(LIBRARY_KEY);
        if (local) {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed)) {
                localStorageSets = parsed;
            }
        }
        localStorageUpdatedAt = parseTimestamp(localStorage.getItem(LIBRARY_LOCAL_UPDATED_AT_KEY));
    } catch (e) {
        console.error('Failed to load library from localStorage:', e);
    }

    const hasIndexedDbSnapshot = indexedDbSets.length > 0;
    const hasLocalStorageSnapshot = localStorageSets.length > 0;
    const shouldPreferLocalStorage = hasLocalStorageSnapshot && (
        !hasIndexedDbSnapshot ||
        localStorageUpdatedAt > indexedDbUpdatedAt ||
        (localStorageUpdatedAt > 0 && indexedDbUpdatedAt === 0)
    );

    if (shouldPreferLocalStorage) {
        localSets = localStorageSets;

        // Keep IndexedDB aligned so future loads are consistent.
        try {
            await writeLibraryToIndexedDb(localSets, localStorageUpdatedAt || Date.now());
        } catch (error) {
            console.warn('[Storage] Failed to refresh IndexedDB cache from localStorage snapshot:', error);
        }
    } else if (hasIndexedDbSnapshot) {
        localSets = indexedDbSets;

        if (!hasLocalStorageSnapshot || indexedDbUpdatedAt > localStorageUpdatedAt) {
            writeLibraryToLocalFallback(localSets, indexedDbUpdatedAt || Date.now());
        }
    } else if (hasLocalStorageSnapshot) {
        localSets = localStorageSets;
    }

    // Safety-first boot behavior:
    // If local cache already has sets, do NOT let cloud replace them during initial load.
    // Cloud reconciliation runs separately via syncCloudData() with no-loss merge logic.
    if (localSets.length > 0) {
        return localSets.length > 0 ? localSets : undefined;
    }

    if (options?.localOnly || !user) {
        return undefined;
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
        const mergedWriteTimestamp = Date.now();
        await writeLibraryToIndexedDb(finalSets, mergedWriteTimestamp);
        writeLibraryToLocalFallback(finalSets, mergedWriteTimestamp);

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
        const localWriteTimestamp = Date.now();
        await writeLibraryToIndexedDb(cached, localWriteTimestamp);
        writeLibraryToLocalFallback(cached, localWriteTimestamp);
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
        const nextSets = cached.filter(s => s.id !== setId);
        const localWriteTimestamp = Date.now();
        await writeLibraryToIndexedDb(nextSets, localWriteTimestamp);
        writeLibraryToLocalFallback(nextSets, localWriteTimestamp);
    } catch (e) {
        console.error('[Storage] Failed to update local cache:', e);
    }
};

// ============================================================================
// FOLDERS
// ============================================================================

export const saveFolders = async (folders: Folder[], options?: { skipCloud?: boolean }) => {
    // Save locally
    localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));

    if (options?.skipCloud) return;

    const user = await getUser();
    if (!user) return;

    // Preserve current set membership from cloud structure.
    // Folder state in UI intentionally treats set.folderId as source of truth.
    const { structure } = await storageV2.readStructure();
    const existingSetIdsByFolder = new Map(structure.folders.map(folder => [folder.id, folder.setIds]));
    const normalizedFolders = folders.map(folder => ({
        ...folder,
        setIds: existingSetIdsByFolder.get(folder.id) ?? []
    }));

    await storageV2.updateFolders(normalizedFolders);
};

export const loadFolders = async (options?: LoadOptions): Promise<Folder[]> => {
    // Try local first
    const local = localStorage.getItem(FOLDERS_KEY);
    if (local) {
        try {
            return JSON.parse(local);
        } catch (e) { }
    }

    if (options?.localOnly) return [];

    const user = await getUser();
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

export const saveSettings = async (settings: Settings, options?: { skipCloud?: boolean }) => {
    // Save locally
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));

    if (options?.skipCloud) return;

    const user = await getUser();
    if (!user) return;

    // Save to V2
    await storageV2.updateSettings(settings);
};

export const loadSettings = async (options?: LoadOptions): Promise<Settings> => {
    // Try local first
    const local = localStorage.getItem(SETTINGS_KEY);
    if (local) {
        try {
            const parsed = JSON.parse(local);
            // Merge with defaults for any new keys
            return { ...storageV2.DEFAULT_SETTINGS, ...parsed };
        } catch (e) { }
    }

    if (options?.localOnly) return { ...storageV2.DEFAULT_SETTINGS };

    const user = await getUser();
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

export const loadBadges = async (options?: LoadOptions): Promise<any[]> => {
    // Try local first
    const local = localStorage.getItem(BADGES_KEY);
    if (local) {
        try {
            return JSON.parse(local);
        } catch (e) { }
    }

    if (options?.localOnly) return [];

    const user = await getUser();
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

export const saveTags = async (tags: Tag[], options?: { skipCloud?: boolean }) => {
    // Save locally
    localStorage.setItem(TAGS_KEY, JSON.stringify(tags));

    if (options?.skipCloud) return;

    const user = await getUser();
    if (!user) return;

    // Save to V2
    await storageV2.updateTags(tags);
};

export const loadTags = async (options?: LoadOptions): Promise<Tag[]> => {
    // Try local first
    const local = localStorage.getItem(TAGS_KEY);
    if (local) {
        try {
            const parsed = JSON.parse(local);
            if (Array.isArray(parsed)) return parsed;
        } catch (e) { }
    }

    if (options?.localOnly) return [];

    const user = await getUser();
    if (!user) return [];

    // Load from V2
    try {
        const { structure } = await storageV2.readStructure();
        const tags = structure.tags || [];

        // Cache locally
        localStorage.setItem(TAGS_KEY, JSON.stringify(tags));

        return tags;
    } catch (error) {
        console.error('[Storage] Failed to load tags from V2:', error);
        return [];
    }
};

// ============================================================================
// STATS
// ============================================================================

export const saveStats = async (stats: { lifetimeCorrect: number }, options?: { skipCloud?: boolean }) => {
    // Save locally
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));

    if (options?.skipCloud) return;

    const user = await getUser();
    if (!user) return;

    // Save to V2
    await storageV2.updateStats(stats);
};

export const loadStats = async (options?: LoadOptions): Promise<{ lifetimeCorrect: number }> => {
    // Try local first
    const local = localStorage.getItem(STATS_KEY);
    if (local) {
        try {
            return JSON.parse(local);
        } catch (e) { }
    }

    if (options?.localOnly) return { lifetimeCorrect: 0 };

    const user = await getUser();
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
                const localWriteTimestamp = Date.now();
                await writeLibraryToIndexedDb(allSets, localWriteTimestamp);
                writeLibraryToLocalFallback(allSets, localWriteTimestamp);
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
    localStorage.removeItem(LIBRARY_LOCAL_UPDATED_AT_KEY);
    localStorage.removeItem(FOLDERS_KEY);
    localStorage.removeItem(SETTINGS_KEY);
    localStorage.removeItem(BADGES_KEY);
    localStorage.removeItem(STATS_KEY);
    localStorage.removeItem(TAGS_KEY);
    localStorage.removeItem(DRIVE_FOLDER_ID_KEY);
    localStorage.removeItem(MIGRATION_DONE_KEY);

    // Clear IndexedDB
    try {
        await del(LIBRARY_KEY);
        await del(LIBRARY_IDB_UPDATED_AT_KEY);
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
