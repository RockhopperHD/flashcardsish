/**
 * DISTRIBUTED STORAGE LAYER V2
 * 
 * This storage layer implements a distributed file system where:
 * 1. config.json - User settings and last-used sets for preloading
 * 2. structure.json - Folder hierarchy and set references
 * 3. sets/[id].flashcards - Individual flashcard set files
 * 4. sessions/[id].json - In-progress session data
 * 
 * Benefits:
 * - Lazy loading: Only fetch sets when needed
 * - Resilience: Corruption in one file doesn't affect others
 * - Auto-discovery: Orphaned files are automatically recovered
 */

import { get, set, del } from 'idb-keyval';
import { CardSet, Card, Folder, Settings, SetMetadata } from './types';
import { googleDrive, GoogleDriveUser } from './src/googleDriveClient';

// ============================================================================
// CONSTANTS
// ============================================================================

const WARNING_LINES = [
    "DO NOT EDIT THESE FILES! YOU WILL BREAK YOUR SAVE DATA!",
    "Flashcardsish is designed to read this data in a very specific way. If you change data here, such as deleting things randomly, you could corrupt and ruin your sets.",
    "You modify anything here at your own risk!"
];

export const DEFAULT_SETTINGS: Settings = {
    forgiveSpellingErrors: true,
    ignoreDiacritics: false,
    ignoreCapitalization: true,
    forgiveThe: true,
    wiggleRoom: 3,
    retypeOnMistake: false,
    starredOnly: false,
    answerWithDefinition: false,
    mode: 'standard',
    batchLength: 10,
    shuffleCards: true,
    brutalMode: false,
    importAppend: true,
    importOverride: 'duplicate',
    autoCloseImageWindow: false,
    hideTooltips: false,
    darkMode: true
};

const CURRENT_VERSION = 1;

// Local storage keys for caching
const CONFIG_CACHE_KEY = 'flashcardsish-config-v2';
const STRUCTURE_CACHE_KEY = 'flashcardsish-structure-v2';
const SET_CACHE_PREFIX = 'flashcardsish-set-';
const DRIVE_FOLDER_ID_KEY = 'flashcardsish-drive-folder-id';

// ============================================================================
// TYPES
// ============================================================================

export interface ConfigFile {
    _WARNING: string[];
    version: number;
    settings: Settings;
    lastUsedSets: string[]; // IDs of last 3 used sets for preloading
}

export interface StructureFile {
    _WARNING: string[];
    version: number;
    folders: Folder[];
    rootSets: string[]; // Set IDs not in any folder
    badges: any[];
    stats: {
        lifetimeCorrect: number;
    };
}

export interface FlashcardFile {
    version: number;
    id: string;
    name: string;
    cards: Card[];
    termLabel?: string;
    definitionLabel?: string;
    termSideFields?: any[];
    defSideFields?: any[];
    enableTermCards?: boolean;
    lastPlayed: number;
    elapsedTime: number;
    topStreak: number;
    isSessionActive?: boolean;
    isMultistudy?: boolean;
}

export interface SessionFile {
    version: number;
    sourceSetId: string;
    startedAt: number;
    masteryProgress: Record<string, number>;
    starredCards: string[];
    currentStreak: number;
    elapsedTime: number;
}

export type SetLoadingState = 'unloaded' | 'loading' | 'loaded' | 'error';

export interface CorruptionReport {
    type: 'config' | 'structure' | 'set';
    fileName: string;
    recoveredCards?: number;
    totalCards?: number;
    error?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const getUser = async (): Promise<GoogleDriveUser | null> => {
    return await googleDrive.getSession();
};

const getDriveFolderId = (): string | null => {
    return localStorage.getItem(DRIVE_FOLDER_ID_KEY);
};

const setDriveFolderId = (folderId: string) => {
    localStorage.setItem(DRIVE_FOLDER_ID_KEY, folderId);
};

/**
 * Creates a default config file with warning header
 */
const createDefaultConfig = (): ConfigFile => ({
    _WARNING: WARNING_LINES,
    version: CURRENT_VERSION,
    settings: { ...DEFAULT_SETTINGS },
    lastUsedSets: []
});

/**
 * Creates a default structure file with warning header
 */
const createDefaultStructure = (): StructureFile => ({
    _WARNING: WARNING_LINES,
    version: CURRENT_VERSION,
    folders: [],
    rootSets: [],
    badges: [],
    stats: {
        lifetimeCorrect: 0
    }
});

/**
 * Deep merge two objects, preferring values from 'updates' but keeping
 * existing keys from 'base' if not present in 'updates'
 */
const deepMerge = <T extends object>(base: T, updates: Partial<T>): T => {
    const result = { ...base };
    for (const key of Object.keys(updates) as (keyof T)[]) {
        if (updates[key] !== undefined) {
            if (typeof base[key] === 'object' && !Array.isArray(base[key]) && base[key] !== null) {
                result[key] = deepMerge(base[key] as object, updates[key] as object) as T[keyof T];
            } else {
                result[key] = updates[key] as T[keyof T];
            }
        }
    }
    return result;
};

/**
 * Safely parse JSON with error recovery
 */
const safeParseJSON = <T>(text: string, fallback: T): { data: T; hadError: boolean } => {
    try {
        return { data: JSON.parse(text), hadError: false };
    } catch (e) {
        console.error('[StorageV2] JSON parse error:', e);
        return { data: fallback, hadError: true };
    }
};

/**
 * Try to recover cards from a partially corrupted set file
 */
const recoverCardsFromCorruptedSet = (text: string): { cards: Card[]; recovered: number; total: number } => {
    const cards: Card[] = [];
    let recovered = 0;
    let total = 0;

    try {
        // First try normal parse
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed.cards)) {
            for (const card of parsed.cards) {
                total++;
                if (isValidCard(card)) {
                    cards.push(card);
                    recovered++;
                }
            }
        }
    } catch (e) {
        // Try to extract cards array from corrupted JSON
        const cardsMatch = text.match(/"cards"\s*:\s*\[([\s\S]*?)\]/);
        if (cardsMatch) {
            // Try to parse individual card objects
            const cardPattern = /\{[^{}]*"id"\s*:\s*"[^"]+[^{}]*\}/g;
            const matches = text.match(cardPattern) || [];
            total = matches.length;

            for (const match of matches) {
                try {
                    const card = JSON.parse(match);
                    if (isValidCard(card)) {
                        cards.push(card);
                        recovered++;
                    }
                } catch {
                    // Skip corrupted card
                }
            }
        }
    }

    return { cards, recovered, total };
};

/**
 * Validate that a card object has required fields
 */
const isValidCard = (card: any): card is Card => {
    return typeof card === 'object' &&
        typeof card.id === 'string' &&
        Array.isArray(card.term) &&
        typeof card.content === 'string' &&
        typeof card.mastery === 'number' &&
        typeof card.star === 'boolean';
};

/**
 * Convert a CardSet to FlashcardFile format
 */
const setToFile = (set: CardSet): FlashcardFile => ({
    version: CURRENT_VERSION,
    id: set.id,
    name: set.name,
    cards: set.cards,
    termLabel: set.termLabel,
    definitionLabel: set.definitionLabel,
    termSideFields: set.termSideFields,
    defSideFields: set.defSideFields,
    enableTermCards: set.enableTermCards,
    lastPlayed: set.lastPlayed,
    elapsedTime: set.elapsedTime,
    topStreak: set.topStreak,
    isSessionActive: set.isSessionActive,
    isMultistudy: set.isMultistudy
});

/**
 * Convert a FlashcardFile to CardSet format
 */
const fileToSet = (file: FlashcardFile, folderId?: string): CardSet => ({
    id: file.id,
    name: file.name,
    cards: file.cards,
    termLabel: file.termLabel,
    definitionLabel: file.definitionLabel,
    termSideFields: file.termSideFields,
    defSideFields: file.defSideFields,
    enableTermCards: file.enableTermCards,
    lastPlayed: file.lastPlayed,
    elapsedTime: file.elapsedTime,
    topStreak: file.topStreak,
    isSessionActive: file.isSessionActive,
    isMultistudy: file.isMultistudy,
    folderId
});

/**
 * Extract metadata from a set without loading full cards
 */
const setToMetadata = (set: CardSet): SetMetadata => ({
    id: set.id,
    name: set.name,
    cardCount: set.cards.length,
    lastPlayed: set.lastPlayed,
    elapsedTime: set.elapsedTime,
    topStreak: set.topStreak,
    isSessionActive: set.isSessionActive,
    folderId: set.folderId
});

// ============================================================================
// GOOGLE DRIVE OPERATIONS
// ============================================================================

/**
 * Get or create the Flashcardsish folder in Google Drive
 */
const ensureDriveFolder = async (): Promise<string> => {
    const user = await getUser();
    if (!user) throw new Error('Not authenticated');

    let folderId = getDriveFolderId();
    folderId = await googleDrive.getOrCreateAppFolder(folderId || undefined);
    setDriveFolderId(folderId);
    return folderId;
};

/**
 * Get or create the 'sets' subfolder
 */
const ensureSetsFolder = async (parentFolderId: string): Promise<string> => {
    return await googleDrive.getOrCreateSubfolder(parentFolderId, 'sets');
};

/**
 * Get or create the 'sessions' subfolder
 */
const ensureSessionsFolder = async (parentFolderId: string): Promise<string> => {
    return await googleDrive.getOrCreateSubfolder(parentFolderId, 'sessions');
};

// ============================================================================
// CONFIG FILE OPERATIONS
// ============================================================================

/**
 * Read config.json from Google Drive
 */
export const readConfig = async (): Promise<{ config: ConfigFile; wasCorrupted: boolean }> => {
    const user = await getUser();

    // Try local cache first
    const cached = localStorage.getItem(CONFIG_CACHE_KEY);
    if (cached) {
        const { data, hadError } = safeParseJSON<ConfigFile>(cached, createDefaultConfig());
        if (!hadError) {
            // Merge with defaults to add any new settings
            data.settings = deepMerge(DEFAULT_SETTINGS, data.settings);
            return { config: data, wasCorrupted: false };
        }
    }

    if (!user) {
        return { config: createDefaultConfig(), wasCorrupted: false };
    }

    try {
        const folderId = await ensureDriveFolder();
        const content = await googleDrive.readFile(folderId, 'config.json');

        if (content === null) {
            // File doesn't exist, create default
            const defaultConfig = createDefaultConfig();
            await writeConfig(defaultConfig);
            return { config: defaultConfig, wasCorrupted: false };
        }

        const { data, hadError } = safeParseJSON<ConfigFile>(content, createDefaultConfig());
        if (hadError) {
            console.warn('[StorageV2] Config file was corrupted, using defaults');
            const defaultConfig = createDefaultConfig();
            await writeConfig(defaultConfig);
            return { config: defaultConfig, wasCorrupted: true };
        }

        // Deep merge with defaults to pick up new settings
        data.settings = deepMerge(DEFAULT_SETTINGS, data.settings);

        // Cache locally
        localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(data));

        return { config: data, wasCorrupted: false };
    } catch (error) {
        console.error('[StorageV2] Failed to read config:', error);
        return { config: createDefaultConfig(), wasCorrupted: true };
    }
};

/**
 * Write config.json to Google Drive
 */
export const writeConfig = async (config: ConfigFile): Promise<void> => {
    // Always ensure warning header
    config._WARNING = WARNING_LINES;
    config.version = CURRENT_VERSION;

    // Cache locally
    localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(config));

    const user = await getUser();
    if (!user) return;

    try {
        const folderId = await ensureDriveFolder();
        await googleDrive.writeFile(folderId, 'config.json', JSON.stringify(config, null, 2));
    } catch (error) {
        console.error('[StorageV2] Failed to write config:', error);
    }
};

/**
 * Update just the settings portion of config
 */
export const updateSettings = async (settings: Settings): Promise<void> => {
    const { config } = await readConfig();
    config.settings = settings;
    await writeConfig(config);
};

/**
 * Update the last used sets list
 */
export const updateLastUsedSets = async (setId: string): Promise<void> => {
    const { config } = await readConfig();

    // Remove if already present, then add to front
    config.lastUsedSets = config.lastUsedSets.filter(id => id !== setId);
    config.lastUsedSets.unshift(setId);

    // Keep only last 3
    config.lastUsedSets = config.lastUsedSets.slice(0, 3);

    await writeConfig(config);
};

// ============================================================================
// STRUCTURE FILE OPERATIONS
// ============================================================================

/**
 * Read structure.json from Google Drive
 */
export const readStructure = async (): Promise<{ structure: StructureFile; wasCorrupted: boolean }> => {
    const user = await getUser();

    // Try local cache first
    const cached = localStorage.getItem(STRUCTURE_CACHE_KEY);
    if (cached) {
        const { data, hadError } = safeParseJSON<StructureFile>(cached, createDefaultStructure());
        if (!hadError) {
            return { structure: data, wasCorrupted: false };
        }
    }

    if (!user) {
        return { structure: createDefaultStructure(), wasCorrupted: false };
    }

    try {
        const folderId = await ensureDriveFolder();
        const content = await googleDrive.readFile(folderId, 'structure.json');

        if (content === null) {
            const defaultStructure = createDefaultStructure();
            await writeStructure(defaultStructure);
            return { structure: defaultStructure, wasCorrupted: false };
        }

        const { data, hadError } = safeParseJSON<StructureFile>(content, createDefaultStructure());
        if (hadError) {
            console.warn('[StorageV2] Structure file was corrupted, using defaults');
            const defaultStructure = createDefaultStructure();
            await writeStructure(defaultStructure);
            return { structure: defaultStructure, wasCorrupted: true };
        }

        // Cache locally
        localStorage.setItem(STRUCTURE_CACHE_KEY, JSON.stringify(data));

        return { structure: data, wasCorrupted: false };
    } catch (error) {
        console.error('[StorageV2] Failed to read structure:', error);
        return { structure: createDefaultStructure(), wasCorrupted: true };
    }
};

/**
 * Write structure.json to Google Drive
 */
export const writeStructure = async (structure: StructureFile): Promise<void> => {
    // Always ensure warning header
    structure._WARNING = WARNING_LINES;
    structure.version = CURRENT_VERSION;

    // Cache locally
    localStorage.setItem(STRUCTURE_CACHE_KEY, JSON.stringify(structure));

    const user = await getUser();
    if (!user) return;

    try {
        const folderId = await ensureDriveFolder();

        // Check for orphaned .flashcards files before saving
        await discoverOrphanedSets(folderId, structure);

        await googleDrive.writeFile(folderId, 'structure.json', JSON.stringify(structure, null, 2));
    } catch (error) {
        console.error('[StorageV2] Failed to write structure:', error);
    }
};

/**
 * Discover .flashcards files not mentioned in structure and add them to rootSets
 */
const discoverOrphanedSets = async (folderId: string, structure: StructureFile): Promise<void> => {
    try {
        const setsFolderId = await ensureSetsFolder(folderId);
        const files = await googleDrive.listFilesInFolder(setsFolderId, '.flashcards');

        // Get all known set IDs from structure
        const knownIds = new Set<string>();
        structure.rootSets.forEach(id => knownIds.add(id));
        structure.folders.forEach(folder => folder.setIds.forEach(id => knownIds.add(id)));

        // Find orphaned files
        for (const file of files) {
            const setId = file.name.replace('.flashcards', '');
            if (!knownIds.has(setId)) {
                console.log('[StorageV2] Found orphaned set, adding to root:', setId);
                structure.rootSets.push(setId);
            }
        }
    } catch (error) {
        console.error('[StorageV2] Failed to discover orphaned sets:', error);
    }
};

/**
 * Update folders in structure
 */
export const updateFolders = async (folders: Folder[]): Promise<void> => {
    const { structure } = await readStructure();
    structure.folders = folders;
    await writeStructure(structure);
};

/**
 * Update stats in structure
 */
export const updateStats = async (stats: { lifetimeCorrect: number }): Promise<void> => {
    const { structure } = await readStructure();
    structure.stats = stats;
    await writeStructure(structure);
};

/**
 * Update badges in structure
 */
export const updateBadges = async (badges: any[]): Promise<void> => {
    const { structure } = await readStructure();
    structure.badges = badges;
    await writeStructure(structure);
};

// ============================================================================
// FLASHCARD SET OPERATIONS
// ============================================================================

/**
 * Read a single flashcard set file
 */
export const readFlashcardSet = async (setId: string): Promise<{
    set: CardSet | null;
    wasCorrupted: boolean;
    recoveredCards?: number;
    totalCards?: number;
}> => {
    const user = await getUser();

    // Try local cache first
    const cached = await get<CardSet>(`${SET_CACHE_PREFIX}${setId}`);
    if (cached) {
        return { set: cached, wasCorrupted: false };
    }

    if (!user) {
        return { set: null, wasCorrupted: false };
    }

    try {
        const folderId = await ensureDriveFolder();
        const setsFolderId = await ensureSetsFolder(folderId);
        const content = await googleDrive.readFile(setsFolderId, `${setId}.flashcards`);

        if (content === null) {
            return { set: null, wasCorrupted: false };
        }

        // Try to parse normally first
        const { data, hadError } = safeParseJSON<FlashcardFile>(content, null as any);

        if (hadError || !data) {
            // Try to recover cards from corrupted file
            const { cards, recovered, total } = recoverCardsFromCorruptedSet(content);

            if (recovered > 0) {
                console.warn(`[StorageV2] Recovered ${recovered}/${total} cards from corrupted set ${setId}`);
                const recoveredSet: CardSet = {
                    id: setId,
                    name: 'Recovered Set',
                    cards,
                    lastPlayed: Date.now(),
                    elapsedTime: 0,
                    topStreak: 0
                };

                // Save recovered version
                await writeFlashcardSet(recoveredSet);
                await set(`${SET_CACHE_PREFIX}${setId}`, recoveredSet);

                return {
                    set: recoveredSet,
                    wasCorrupted: true,
                    recoveredCards: recovered,
                    totalCards: total
                };
            }

            // Completely corrupted
            return { set: null, wasCorrupted: true, recoveredCards: 0, totalCards: total };
        }

        // Find folder for this set
        const { structure } = await readStructure();
        let fId: string | undefined;
        for (const folder of structure.folders) {
            if (folder.setIds.includes(setId)) {
                fId = folder.id;
                break;
            }
        }

        const cardSet = fileToSet(data, fId);

        // Cache locally
        await set(`${SET_CACHE_PREFIX}${setId}`, cardSet);

        return { set: cardSet, wasCorrupted: false };
    } catch (error) {
        console.error(`[StorageV2] Failed to read set ${setId}:`, error);
        return { set: null, wasCorrupted: true };
    }
};

/**
 * Write a flashcard set file
 */
export const writeFlashcardSet = async (cardSet: CardSet): Promise<void> => {
    const file = setToFile(cardSet);

    // Cache locally
    await set(`${SET_CACHE_PREFIX}${cardSet.id}`, cardSet);

    const user = await getUser();
    if (!user) return;

    try {
        const folderId = await ensureDriveFolder();
        const setsFolderId = await ensureSetsFolder(folderId);
        await googleDrive.writeFile(setsFolderId, `${cardSet.id}.flashcards`, JSON.stringify(file, null, 2));
    } catch (error) {
        console.error(`[StorageV2] Failed to write set ${cardSet.id}:`, error);
    }
};

/**
 * Delete a flashcard set file
 */
export const deleteFlashcardSet = async (setId: string): Promise<void> => {
    // Remove from cache
    await del(`${SET_CACHE_PREFIX}${setId}`);

    const user = await getUser();
    if (!user) return;

    try {
        const folderId = await ensureDriveFolder();
        const setsFolderId = await ensureSetsFolder(folderId);
        await googleDrive.deleteFile(setsFolderId, `${setId}.flashcards`);

        // Also remove from structure
        const { structure } = await readStructure();
        structure.rootSets = structure.rootSets.filter(id => id !== setId);
        structure.folders = structure.folders.map(folder => ({
            ...folder,
            setIds: folder.setIds.filter(id => id !== setId)
        }));
        await writeStructure(structure);
    } catch (error) {
        console.error(`[StorageV2] Failed to delete set ${setId}:`, error);
    }
};

/**
 * List all flashcard set metadata (without loading full cards)
 */
export const listFlashcardSetMetadata = async (): Promise<SetMetadata[]> => {
    const { structure } = await readStructure();
    const metadata: SetMetadata[] = [];

    // Collect all set IDs
    const allSetIds = new Set<string>();
    structure.rootSets.forEach(id => allSetIds.add(id));
    structure.folders.forEach(folder => folder.setIds.forEach(id => allSetIds.add(id)));

    // For each set, try to get metadata
    for (const setId of allSetIds) {
        // Check cache first
        const cached = await get<CardSet>(`${SET_CACHE_PREFIX}${setId}`);
        if (cached) {
            metadata.push(setToMetadata(cached));
            continue;
        }

        // Otherwise we'd need to load the file - for lazy loading, 
        // we'll need metadata stored in structure.json
        // For now, create a placeholder
        metadata.push({
            id: setId,
            name: 'Loading...',
            cardCount: 0,
            lastPlayed: 0,
            elapsedTime: 0,
            topStreak: 0,
            isSessionActive: false
        });
    }

    return metadata;
};

// ============================================================================
// SESSION OPERATIONS
// ============================================================================

/**
 * Read an in-progress session
 */
export const readSession = async (sessionId: string): Promise<SessionFile | null> => {
    const user = await getUser();
    if (!user) return null;

    try {
        const folderId = await ensureDriveFolder();
        const sessionsFolderId = await ensureSessionsFolder(folderId);
        const content = await googleDrive.readFile(sessionsFolderId, `${sessionId}.json`);

        if (content === null) return null;

        const { data, hadError } = safeParseJSON<SessionFile>(content, null as any);
        return hadError ? null : data;
    } catch (error) {
        console.error(`[StorageV2] Failed to read session ${sessionId}:`, error);
        return null;
    }
};

/**
 * Write an in-progress session
 */
export const writeSession = async (session: SessionFile, sessionId: string): Promise<void> => {
    session.version = CURRENT_VERSION;

    const user = await getUser();
    if (!user) return;

    try {
        const folderId = await ensureDriveFolder();
        const sessionsFolderId = await ensureSessionsFolder(folderId);
        await googleDrive.writeFile(sessionsFolderId, `${sessionId}.json`, JSON.stringify(session, null, 2));
    } catch (error) {
        console.error(`[StorageV2] Failed to write session ${sessionId}:`, error);
    }
};

/**
 * Delete an in-progress session (when completed)
 */
export const deleteSession = async (sessionId: string): Promise<void> => {
    const user = await getUser();
    if (!user) return;

    try {
        const folderId = await ensureDriveFolder();
        const sessionsFolderId = await ensureSessionsFolder(folderId);
        await googleDrive.deleteFile(sessionsFolderId, `${sessionId}.json`);
    } catch (error) {
        console.error(`[StorageV2] Failed to delete session ${sessionId}:`, error);
    }
};

// ============================================================================
// MIGRATION FROM V1
// ============================================================================

/**
 * Check if legacy data exists and needs migration
 */
export const needsMigration = async (): Promise<boolean> => {
    const user = await getUser();
    if (!user) return false;

    try {
        const folderId = await ensureDriveFolder();
        const legacyContent = await googleDrive.readFile(folderId, 'flashcardsish_data.json');
        const newConfig = await googleDrive.readFile(folderId, 'config.json');

        // Need migration if legacy exists and new format doesn't
        return legacyContent !== null && newConfig === null;
    } catch (error) {
        console.error('[StorageV2] Failed to check migration status:', error);
        return false;
    }
};

/**
 * Migrate from legacy single-file format to distributed format
 */
export const migrateFromV1 = async (): Promise<{ success: boolean; error?: string }> => {
    const user = await getUser();
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
        const folderId = await ensureDriveFolder();
        const legacyContent = await googleDrive.readFile(folderId, 'flashcardsish_data.json');

        if (!legacyContent) {
            return { success: false, error: 'No legacy data found' };
        }

        const { data: legacyData, hadError } = safeParseJSON<any>(legacyContent, null);
        if (hadError || !legacyData) {
            return { success: false, error: 'Legacy data is corrupted' };
        }

        console.log('[StorageV2] Starting migration from V1...');

        // 1. Create config.json
        const config = createDefaultConfig();
        if (legacyData.settings) {
            config.settings = deepMerge(DEFAULT_SETTINGS, legacyData.settings);
        }
        await writeConfig(config);
        console.log('[StorageV2] Created config.json');

        // 2. Create structure.json
        const structure = createDefaultStructure();
        if (legacyData.folders) {
            structure.folders = legacyData.folders;
        }
        if (legacyData.badges) {
            structure.badges = legacyData.badges;
        }

        // 3. Create individual .flashcards files
        const setsFolderId = await ensureSetsFolder(folderId);
        if (legacyData.library_sets && Array.isArray(legacyData.library_sets)) {
            for (const set of legacyData.library_sets) {
                await writeFlashcardSet(set);

                // Track in structure
                let inFolder = false;
                for (const folder of structure.folders) {
                    if (folder.setIds.includes(set.id)) {
                        inFolder = true;
                        break;
                    }
                }
                if (!inFolder) {
                    structure.rootSets.push(set.id);
                }
            }
            console.log(`[StorageV2] Migrated ${legacyData.library_sets.length} sets`);
        }

        await writeStructure(structure);
        console.log('[StorageV2] Created structure.json');

        // 4. Backup and delete legacy file
        await googleDrive.renameFile(folderId, 'flashcardsish_data.json', 'flashcardsish_data.json.backup');
        console.log('[StorageV2] Backed up legacy file');

        return { success: true };
    } catch (error) {
        console.error('[StorageV2] Migration failed:', error);
        return { success: false, error: (error as Error).message };
    }
};

// ============================================================================
// FULL DATA OPERATIONS
// ============================================================================

/**
 * Load all data on app boot (config, structure, and last 3 used sets)
 */
export const loadBootData = async (): Promise<{
    settings: Settings;
    folders: Folder[];
    badges: any[];
    stats: { lifetimeCorrect: number };
    preloadedSets: CardSet[];
    allSetMetadata: SetMetadata[];
    corruptions: CorruptionReport[];
}> => {
    const corruptions: CorruptionReport[] = [];

    // Load config
    const { config, wasCorrupted: configCorrupted } = await readConfig();
    if (configCorrupted) {
        corruptions.push({
            type: 'config',
            fileName: 'config.json',
            error: 'Settings were reset to defaults'
        });
    }

    // Load structure
    const { structure, wasCorrupted: structureCorrupted } = await readStructure();
    if (structureCorrupted) {
        corruptions.push({
            type: 'structure',
            fileName: 'structure.json',
            error: 'Folder structure was reset'
        });
    }

    // Preload last 3 used sets
    const preloadedSets: CardSet[] = [];
    for (const setId of config.lastUsedSets.slice(0, 3)) {
        const { set, wasCorrupted, recoveredCards, totalCards } = await readFlashcardSet(setId);
        if (set) {
            preloadedSets.push(set);
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

    // Get metadata for all sets
    const allSetMetadata = await listFlashcardSetMetadata();

    return {
        settings: config.settings,
        folders: structure.folders,
        badges: structure.badges,
        stats: structure.stats,
        preloadedSets,
        allSetMetadata,
        corruptions
    };
};

/**
 * Delete all user data (GDPR compliance)
 */
export const deleteAllDataV2 = async (): Promise<{ success: boolean; error?: string }> => {
    try {
        const user = await getUser();

        // Clear local caches
        localStorage.removeItem(CONFIG_CACHE_KEY);
        localStorage.removeItem(STRUCTURE_CACHE_KEY);
        localStorage.removeItem(DRIVE_FOLDER_ID_KEY);

        // Clear IndexedDB caches
        const keys = await import('idb-keyval').then(m => m.keys());
        for (const key of keys) {
            if (typeof key === 'string' && key.startsWith(SET_CACHE_PREFIX)) {
                await del(key);
            }
        }

        if (!user) return { success: true };

        // Delete Drive folder contents
        const folderId = getDriveFolderId();
        if (folderId) {
            await googleDrive.deleteFolderContents(folderId);
        }

        return { success: true };
    } catch (error) {
        console.error('[StorageV2] Failed to delete all data:', error);
        return { success: false, error: (error as Error).message };
    }
};

/**
 * Reset settings to default
 */
export const resetSettingsToDefault = async (): Promise<void> => {
    await updateSettings({ ...DEFAULT_SETTINGS });
};
