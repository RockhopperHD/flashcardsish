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

import { get, set, del, keys } from 'idb-keyval';
import { CardSet, Card, Folder, Settings, SetMetadata, Tag } from './types';
import { googleDrive, GoogleDriveUser } from './src/googleDriveClient';
import { normalizeCardMastery, normalizeCardStar } from './cardNormalization';

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
    reduceStreakMotion: false,
    starredOnly: false,
    answerWithDefinition: false,
    mode: 'standard',
    shuffleCards: true,
    brutalMode: false,
    autoCloseImageWindow: false,
    hideTooltips: false,
    darkMode: true,
    learnModeLeftKey1: 'a',
    learnModeLeftKey2: 'ArrowLeft',
    learnModeRightKey1: 'b',
    learnModeRightKey2: 'ArrowRight',
    autoAdvanceOnAnswer: true,
    tabSelectsEverythingInBuilder: false,
    flipCardKey1: ' ',
    flipCardKey2: 'Enter',
    submitAnswerKey1: 'Enter',
    nextFieldKey1: 'Tab'
};

const CURRENT_VERSION = 3;

// Local storage keys for caching
const CONFIG_CACHE_KEY = 'flashcardsish-config-v2';
const STRUCTURE_CACHE_KEY = 'flashcardsish-structure-v2';
const SET_CACHE_PREFIX = 'flashcardsish-set-';
const DRIVE_FOLDER_ID_KEY = 'flashcardsish-drive-folder-id';
const CLOUD_BACKUP_LAST_AT_KEY = 'flashcardsish-cloud-backup-last-at';
const CLOUD_BACKUP_INTERVAL_MS = 10 * 60 * 1000;
const CLOUD_BACKUP_MAX_FILES = 25;

// ============================================================================
// TYPES
// ============================================================================

export interface ConfigFile {
    _WARNING: string[];
    version: number;
    settings: Settings;
    lastUsedSets: string[]; // IDs of last 3 used sets for preloading
}

export interface SetManifestEntry {
    modifiedAt: number; // ms timestamp of last content change
}

export interface StructureFile {
    _WARNING: string[];
    version: number;
    folders: Folder[];
    rootSets: string[]; // Set IDs not in any folder
    badges: any[];
    tags: Tag[]; // Account-wide tags
    stats: {
        lifetimeCorrect: number;
    };
    setManifest: Record<string, SetManifestEntry>; // V3: per-set modification metadata
}

export interface FlashcardFile {
    version: number;
    id: string;
    name: string;
    cards: Card[];
    customFieldNames?: string[]; // Legacy V1 field names
    tags?: string[]; // Set-level tag IDs
    sourceId?: string; // Link to original library set
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
    sourceSetIds?: string[];
    isLocalOnly?: boolean;
    modifiedAt?: number; // V3: ms timestamp of last save
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

interface WriteOptions {
    ignoreConflicts?: boolean;
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
    tags: [],
    stats: {
        lifetimeCorrect: 0
    },
    setManifest: {}
});

/**
 * Deep merge two objects, preferring values from 'updates' but keeping
 * existing keys from 'base' if not present in 'updates'
 */
const deepMerge = <T extends object>(base: T, updates: Partial<T>): T => {
    const result = { ...base };
    for (const key of Object.keys(updates) as (keyof T)[]) {
        // Keep settings schema clean by ignoring unknown keys from older configs.
        if (!(key in base)) continue;
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
                const normalizedCard = normalizeCard(card);
                if (normalizedCard) {
                    cards.push(normalizedCard);
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
                    const normalizedCard = normalizeCard(card);
                    if (normalizedCard) {
                        cards.push(normalizedCard);
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
 * Normalize a possibly malformed card object into the strict runtime schema.
 */
const normalizeCard = (rawCard: any): Card | null => {
    const card = sanitizeStrings(rawCard);

    if (typeof card !== 'object' || card === null) {
        return null;
    }
    if (typeof card.id !== 'string' || !Array.isArray(card.term)) {
        return null;
    }

    const normalizedCustomFields = Array.isArray(card.customFields)
        ? card.customFields
            .map((field: any) => ({
                name: String(field?.name ?? '').trim(),
                value: String(field?.value ?? '')
            }))
            .filter((field: { name: string; value: string }) => field.name.length > 0)
        : undefined;

    const normalizedTags = Array.isArray(card.tags)
        ? card.tags.map((tag: any) => String(tag).trim()).filter(Boolean)
        : undefined;

    return {
        id: card.id,
        term: card.term.map((term: any) => String(term ?? '')),
        content: Array.isArray(card.content)
            ? card.content.map((part: any) => String(part ?? '')).join('\n')
            : String(card.content ?? ''),
        year: card.year === undefined || card.year === null || card.year === '' ? undefined : String(card.year),
        image: card.image === undefined || card.image === null || card.image === '' ? undefined : String(card.image),
        termImage: card.termImage === undefined || card.termImage === null || card.termImage === '' ? undefined : String(card.termImage),
        customFields: normalizedCustomFields && normalizedCustomFields.length > 0 ? normalizedCustomFields : undefined,
        tags: normalizedTags && normalizedTags.length > 0 ? normalizedTags : undefined,
        mastery: normalizeCardMastery(card.mastery),
        star: normalizeCardStar(card.star),
        originalSetId: typeof card.originalSetId === 'string' ? card.originalSetId : undefined,
        originalSetName: typeof card.originalSetName === 'string' ? card.originalSetName : undefined
    };
};

/**
 * Fix mojibake / encoding-corrupted Unicode characters in a string.
 * Smart quotes, apostrophes, em/en dashes etc. that were double- or
 * triple-encoded as UTF-8 to Latin-1 produce garbled sequences.
 * This replaces all known patterns with their ASCII equivalents.
 */
const MOJIBAKE_REPLACEMENTS: [RegExp, string][] = [
    // Triple/quadruple-encoded patterns (fix widest first)
    [/(?:\u00c3\u0082|\u00c3\u00a2|\u00c3\u0083)+(?:\u00c2\u00a2)?(?:\u00c3\u0082|\u00c3\u00a2|\u00c3\u0083)*(?:\u00c2[\u0080-\u009c])+/g, '"'],
    // Double-encoded left double quote
    [/\u00c3\u00a2\u00c2\u0080\u00c2\u009c/g, '"'],
    // Double-encoded right double quote
    [/\u00c3\u00a2\u00c2\u0080\u00c2\u009d/g, '"'],
    // Double-encoded left single quote
    [/\u00c3\u00a2\u00c2\u0080\u00c2\u0098/g, "'"],
    // Double-encoded right single quote / apostrophe
    [/\u00c3\u00a2\u00c2\u0080\u00c2\u0099/g, "'"],
    // Double-encoded em dash
    [/\u00c3\u00a2\u00c2\u0080\u00c2\u0094/g, '-'],
    // Double-encoded en dash
    [/\u00c3\u00a2\u00c2\u0080\u00c2\u0093/g, '-'],
    // Double-encoded ellipsis
    [/\u00c3\u00a2\u00c2\u0080\u00c2\u00a6/g, '...'],
    // Single-pass Unicode smart chars to ASCII
    [/\u201c/g, '"'],
    [/\u201d/g, '"'],
    [/\u2018/g, "'"],
    [/\u2019/g, "'"],
    [/\u2014/g, '-'],
    [/\u2013/g, '-'],
    [/\u2026/g, '...'],
    // Catch remaining double-encoding debris
    [/(?:\u00c3[\u0080-\u00bf]\u00c2[\u0080-\u00bf])+/g, ''],
];

function fixMojibake(str: string): string {
    let result = str;
    for (const [pattern, replacement] of MOJIBAKE_REPLACEMENTS) {
        result = result.replace(pattern, replacement);
    }
    return result;
}

/**
 * Recursively sanitize all string values in a data structure to fix
 * encoding corruption (mojibake). Works on strings, arrays, and objects.
 */
export function sanitizeStrings<T>(data: T): T {
    if (typeof data === 'string') {
        return fixMojibake(data) as unknown as T;
    }
    if (Array.isArray(data)) {
        return data.map(item => sanitizeStrings(item)) as unknown as T;
    }
    if (data !== null && typeof data === 'object') {
        const result: any = {};
        for (const key of Object.keys(data as any)) {
            result[key] = sanitizeStrings((data as any)[key]);
        }
        return result as T;
    }
    return data;
}

const cardContentSignature = (card: Card): string => JSON.stringify({
    term: Array.isArray(card.term) ? card.term : [],
    content: card.content || '',
    year: card.year || '',
    image: card.image || '',
    termImage: card.termImage || '',
    customFields: Array.isArray(card.customFields) ? card.customFields : [],
    tags: Array.isArray(card.tags) ? card.tags : [],
    originalSetId: card.originalSetId || '',
    originalSetName: card.originalSetName || ''
});

const mergeDuplicateCards = (base: Card, duplicate: Card): Card => ({
    ...base,
    mastery: Math.max(base.mastery, duplicate.mastery),
    star: base.star === true || duplicate.star === true,
    originalSetId: base.originalSetId || duplicate.originalSetId,
    originalSetName: base.originalSetName || duplicate.originalSetName
});

const createDuplicateCardId = (baseId: string, usedIds: Set<string>): string => {
    let counter = 2;
    let candidate = `${baseId}__dup_${counter}`;
    while (usedIds.has(candidate)) {
        counter += 1;
        candidate = `${baseId}__dup_${counter}`;
    }
    return candidate;
};

const normalizeCards = (cards: Card[] = []): Card[] => {
    const normalizedCards: Card[] = [];
    const usedIds = new Set<string>();
    const indexById = new Map<string, number>();

    for (const rawCard of cards) {
        const card = normalizeCard(rawCard);
        if (!card) {
            continue;
        }

        const existingIndex = indexById.get(card.id);
        if (existingIndex === undefined) {
            normalizedCards.push(card);
            usedIds.add(card.id);
            indexById.set(card.id, normalizedCards.length - 1);
            continue;
        }

        const existingCard = normalizedCards[existingIndex];
        if (cardContentSignature(existingCard) === cardContentSignature(card)) {
            normalizedCards[existingIndex] = mergeDuplicateCards(existingCard, card);
            continue;
        }

        const dedupedCard = {
            ...card,
            id: createDuplicateCardId(card.id, usedIds)
        };

        normalizedCards.push(dedupedCard);
        usedIds.add(dedupedCard.id);
        indexById.set(dedupedCard.id, normalizedCards.length - 1);
    }

    return normalizedCards;
};

export const normalizeCardSet = (cardSet: CardSet): CardSet => {
    const cleanSet = sanitizeStrings(cardSet);
    return {
        ...cleanSet,
        cards: normalizeCards(cleanSet.cards || [])
    };
};

const normalizeFlashcardFile = (file: FlashcardFile): FlashcardFile => {
    const cleanFile = sanitizeStrings(file);
    return {
        ...cleanFile,
        cards: normalizeCards(cleanFile.cards || [])
    };
};

/**
 * Convert a CardSet to FlashcardFile format
 */
const setToFile = (set: CardSet, modifiedAt?: number): FlashcardFile => {
    const normalizedSet = normalizeCardSet(set);
    return {
        version: normalizedSet.version || CURRENT_VERSION,
        id: normalizedSet.id,
        name: normalizedSet.name,
        cards: normalizedSet.cards,
        customFieldNames: normalizedSet.customFieldNames,
        tags: normalizedSet.tags,
        sourceId: normalizedSet.sourceId,
        termLabel: normalizedSet.termLabel,
        definitionLabel: normalizedSet.definitionLabel,
        termSideFields: normalizedSet.termSideFields,
        defSideFields: normalizedSet.defSideFields,
        enableTermCards: normalizedSet.enableTermCards,
        lastPlayed: normalizedSet.lastPlayed,
        elapsedTime: normalizedSet.elapsedTime,
        topStreak: normalizedSet.topStreak,
        isSessionActive: normalizedSet.isSessionActive,
        isMultistudy: normalizedSet.isMultistudy,
        sourceSetIds: normalizedSet.sourceSetIds,
        isLocalOnly: normalizedSet.isLocalOnly,
        modifiedAt: modifiedAt ?? Date.now()
    };
};

/**
 * Convert a FlashcardFile to CardSet format
 */
const fileToSet = (file: FlashcardFile, folderId?: string): CardSet => {
    const cleanFile = normalizeFlashcardFile(file);
    return {
        id: cleanFile.id,
        name: cleanFile.name,
        cards: cleanFile.cards,
        customFieldNames: cleanFile.customFieldNames,
        tags: cleanFile.tags,
        sourceId: cleanFile.sourceId,
        version: cleanFile.version,
        termLabel: cleanFile.termLabel,
        definitionLabel: cleanFile.definitionLabel,
        termSideFields: cleanFile.termSideFields,
        defSideFields: cleanFile.defSideFields,
        enableTermCards: cleanFile.enableTermCards,
        lastPlayed: cleanFile.lastPlayed,
        elapsedTime: cleanFile.elapsedTime,
        topStreak: cleanFile.topStreak,
        isSessionActive: cleanFile.isSessionActive,
        isMultistudy: cleanFile.isMultistudy,
        sourceSetIds: cleanFile.sourceSetIds,
        isLocalOnly: cleanFile.isLocalOnly,
        folderId
    };
};

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

/**
 * Get or create the 'backups' subfolder
 */
const ensureBackupsFolder = async (parentFolderId: string): Promise<string> => {
    return await googleDrive.getOrCreateSubfolder(parentFolderId, 'backups');
};

// ============================================================================
// CONFIG FILE OPERATIONS
// ============================================================================

/**
 * Invalidate all local caches so next read goes to Google Drive.
 * Call this before cloud sync to ensure fresh data.
 */
/**
 * Invalidate all local caches so next read goes to Google Drive.
 * Call this before cloud sync to ensure fresh data.
 */
export const invalidateLocalCaches = async (): Promise<void> => {
    // console.log('[StorageV2] Invalidating all local caches');
    localStorage.removeItem(CONFIG_CACHE_KEY);
    localStorage.removeItem(STRUCTURE_CACHE_KEY);

    // Clear IndexedDB set caches
    try {
        const allKeys = await keys();
        for (const key of allKeys) {
            if (typeof key === 'string' && key.startsWith(SET_CACHE_PREFIX)) {
                await del(key);
            }
        }
    } catch (e) {
        console.warn('[StorageV2] Failed to clear IndexedDB caches:', e);
    }
};

/**
 * Read config.json from Google Drive
 * @param forceCloud - If true, skip local cache and read directly from Google Drive
 */
export const readConfig = async (forceCloud = false): Promise<{ config: ConfigFile; wasCorrupted: boolean }> => {
    const user = await getUser();

    // Try local cache first (unless forceCloud is set)
    if (!forceCloud) {
        const cached = localStorage.getItem(CONFIG_CACHE_KEY);
        if (cached) {
            const { data, hadError } = safeParseJSON<ConfigFile>(cached, createDefaultConfig());
            if (!hadError) {
                // Merge with defaults to add any new settings
                data.settings = deepMerge(DEFAULT_SETTINGS, data.settings);
                return { config: data, wasCorrupted: false };
            }
        }
    }

    if (!user) {
        return { config: createDefaultConfig(), wasCorrupted: false };
    }

    try {
        // console.log('[StorageV2] Reading config from Google Drive (forceCloud:', forceCloud, ')');
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
            // Non-destructive recovery: do not overwrite cloud config on parse failure.
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
 * @param forceCloud - If true, skip local cache and read directly from Google Drive
 */
export const readStructure = async (forceCloud = false): Promise<{ structure: StructureFile; wasCorrupted: boolean }> => {
    const user = await getUser();

    // Try local cache first (unless forceCloud is set)
    if (!forceCloud) {
        const cached = localStorage.getItem(STRUCTURE_CACHE_KEY);
        if (cached) {
            const { data, hadError } = safeParseJSON<StructureFile>(cached, createDefaultStructure());
            if (!hadError) {
                // Merge with defaults so newly-added fields are always present
                const defaults = createDefaultStructure();
                const merged: StructureFile = {
                    ...defaults,
                    ...data,
                    stats: { ...defaults.stats, ...(data.stats || {}) },
                    tags: data.tags ?? defaults.tags,
                    badges: data.badges ?? defaults.badges,
                    folders: data.folders ?? defaults.folders,
                    rootSets: data.rootSets ?? defaults.rootSets,
                    setManifest: data.setManifest ?? defaults.setManifest,
                };
                return { structure: merged, wasCorrupted: false };
            }
        }
    }

    if (!user) {
        return { structure: createDefaultStructure(), wasCorrupted: false };
    }

    try {
        // console.log('[StorageV2] Reading structure from Google Drive (forceCloud:', forceCloud, ')');
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
            // Non-destructive recovery: do not overwrite cloud structure on parse failure.
            return { structure: defaultStructure, wasCorrupted: true };
        }

        // Merge with defaults so newly-added fields are always present
        const defaults = createDefaultStructure();
        const merged: StructureFile = {
            ...defaults,
            ...data,
            stats: { ...defaults.stats, ...(data.stats || {}) },
            tags: data.tags ?? defaults.tags,
            badges: data.badges ?? defaults.badges,
            folders: data.folders ?? defaults.folders,
            rootSets: data.rootSets ?? defaults.rootSets,
            setManifest: data.setManifest ?? defaults.setManifest,
        };

        // Cache locally
        localStorage.setItem(STRUCTURE_CACHE_KEY, JSON.stringify(merged));

        return { structure: merged, wasCorrupted: false };
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
                // console.log('[StorageV2] Found orphaned set, adding to root:', setId);
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

/**
 * Update tags in structure
 */
export const updateTags = async (tags: Tag[]): Promise<void> => {
    const { structure } = await readStructure();
    structure.tags = tags;
    await writeStructure(structure);
};

// ============================================================================
// FLASHCARD SET OPERATIONS
// ============================================================================

/**
 * Read a single flashcard set file
 * @param forceCloud - If true, skip local cache and read directly from Google Drive
 */
export const readFlashcardSet = async (setId: string, forceCloud = false): Promise<{
    set: CardSet | null;
    wasCorrupted: boolean;
    recoveredCards?: number;
    totalCards?: number;
}> => {
    const user = await getUser();

    // Try local cache first (unless forceCloud is set)
    if (!forceCloud) {
        const cached = await get<CardSet>(`${SET_CACHE_PREFIX}${setId}`);
        if (cached) {
            return { set: normalizeCardSet(cached), wasCorrupted: false };
        }
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
                const recoveredSet = normalizeCardSet({
                    id: setId,
                    name: 'Recovered Set',
                    cards,
                    lastPlayed: Date.now(),
                    elapsedTime: 0,
                    topStreak: 0
                });

                // Non-destructive recovery: do not overwrite cloud set with partial recovery.
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

        // Find folder for this set (use cache for structure here — folder assignment is local concern)
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
export const writeFlashcardSet = async (cardSet: CardSet, options?: WriteOptions): Promise<void> => {
    const now = Date.now();
    const normalizedSet = normalizeCardSet(cardSet);
    const file = setToFile(normalizedSet, now);

    // Cache locally
    await set(`${SET_CACHE_PREFIX}${normalizedSet.id}`, normalizedSet);

    // If local only, stop here (do not upload to Drive)
    if (normalizedSet.isLocalOnly) {
        return;
    }

    const user = await getUser();
    if (!user) return;

    try {
        const folderId = await ensureDriveFolder();
        const setsFolderId = await ensureSetsFolder(folderId);
        await googleDrive.writeFile(
            setsFolderId,
            `${normalizedSet.id}.flashcards`,
            JSON.stringify(file, null, 2),
            { ignoreConflicts: options?.ignoreConflicts }
        );

        // V3: Update set manifest entry in local structure cache
        // (Full structure write happens in saveLibrary / saveDirtySets)
        try {
            const cached = localStorage.getItem(STRUCTURE_CACHE_KEY);
            if (cached) {
                const structure = JSON.parse(cached) as StructureFile;
                if (!structure.setManifest) structure.setManifest = {};
                structure.setManifest[cardSet.id] = { modifiedAt: now };
                localStorage.setItem(STRUCTURE_CACHE_KEY, JSON.stringify(structure));
            }
        } catch (_) { /* best effort */ }
    } catch (error) {
        console.error(`[StorageV2] Failed to write set ${cardSet.id}:`, error);
        throw error;
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
 * Delete a set JUST from the cloud (keep local cache).
 * Used when moving a set from Cloud to Local Only.
 */
export const deleteSetFromCloud = async (setId: string): Promise<void> => {
    const user = await getUser();
    if (!user) return;

    try {
        const folderId = await ensureDriveFolder();
        const setsFolderId = await ensureSetsFolder(folderId);
        await googleDrive.deleteFile(setsFolderId, `${setId}.flashcards`);
    } catch (error) {
        console.error(`[StorageV2] Failed to delete set ${setId} from cloud:`, error);
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

        // console.log('[StorageV2] Starting migration from V1...');

        // 1. Create config.json
        const config = createDefaultConfig();
        if (legacyData.settings) {
            config.settings = deepMerge(DEFAULT_SETTINGS, legacyData.settings);
        }
        await writeConfig(config);
        // console.log('[StorageV2] Created config.json');

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
            // console.log(`[StorageV2] Migrated ${legacyData.library_sets.length} sets`);
        }

        await writeStructure(structure);
        // console.log('[StorageV2] Created structure.json');

        // 4. Backup and delete legacy file
        await googleDrive.renameFile(folderId, 'flashcardsish_data.json', 'flashcardsish_data.json.backup');
        // console.log('[StorageV2] Backed up legacy file');

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
 * @param forceCloud - If true, bypass all local caches and read directly from Google Drive
 */
export const loadBootData = async (forceCloud = true): Promise<{
    settings: Settings;
    folders: Folder[];
    badges: any[];
    tags: Tag[];
    stats: { lifetimeCorrect: number };
    preloadedSets: CardSet[];
    allSetMetadata: SetMetadata[];
    corruptions: CorruptionReport[];
}> => {
    const corruptions: CorruptionReport[] = [];

    // console.log('[StorageV2] Loading boot data (forceCloud:', forceCloud, ')');

    // Load config (from cloud when forceCloud is true)
    const { config, wasCorrupted: configCorrupted } = await readConfig(forceCloud);
    if (configCorrupted) {
        corruptions.push({
            type: 'config',
            fileName: 'config.json',
            error: 'Settings were reset to defaults'
        });
    }

    // Load structure (from cloud when forceCloud is true)
    const { structure, wasCorrupted: structureCorrupted } = await readStructure(forceCloud);
    if (structureCorrupted) {
        corruptions.push({
            type: 'structure',
            fileName: 'structure.json',
            error: 'Folder structure was reset'
        });
    }

    // Preload last 3 used sets (from cloud when forceCloud is true)
    const preloadedSets: CardSet[] = [];
    for (const setId of config.lastUsedSets.slice(0, 3)) {
        const { set, wasCorrupted, recoveredCards, totalCards } = await readFlashcardSet(setId, forceCloud);
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
        tags: structure.tags || [], // Ensure tags is at least empty array if missing in file
        stats: structure.stats,
        preloadedSets,
        allSetMetadata,
        corruptions
    };
};

/**
 * Create a timestamped cloud snapshot backup before writes.
 * Best-effort only: failures are logged but never block normal saves.
 */
export const createCloudSafetyBackupIfNeeded = async (): Promise<void> => {
    const user = await getUser();
    if (!user) return;

    const lastBackupAtRaw = localStorage.getItem(CLOUD_BACKUP_LAST_AT_KEY);
    const lastBackupAt = lastBackupAtRaw ? Number(lastBackupAtRaw) : 0;
    if (Number.isFinite(lastBackupAt) && Date.now() - lastBackupAt < CLOUD_BACKUP_INTERVAL_MS) {
        return;
    }

    try {
        const folderId = await ensureDriveFolder();
        const backupsFolderId = await ensureBackupsFolder(folderId);
        const [{ config }, { structure }] = await Promise.all([
            readConfig(true),
            readStructure(true)
        ]);

        const allSetIds = new Set<string>();
        structure.rootSets.forEach(id => allSetIds.add(id));
        structure.folders.forEach(folder => folder.setIds.forEach(id => allSetIds.add(id)));

        const librarySets: CardSet[] = [];
        for (const setId of allSetIds) {
            const { set: cloudSet } = await readFlashcardSet(setId, true);
            if (cloudSet) {
                librarySets.push(cloudSet);
            }
        }

        const nowIso = new Date().toISOString();
        const backupPayload = {
            version: 'flashcardsish-cloud-backup-v1',
            createdAt: nowIso,
            config,
            structure,
            library_sets: librarySets
        };
        const filename = `cloud-backup-${nowIso.replace(/[:.]/g, '-')}.json`;
        await googleDrive.writeFile(backupsFolderId, filename, JSON.stringify(backupPayload, null, 2), { ignoreConflicts: true });
        localStorage.setItem(CLOUD_BACKUP_LAST_AT_KEY, Date.now().toString());

        // Keep only the newest N backups.
        const backupFiles = await googleDrive.listFilesInFolder(backupsFolderId, 'cloud-backup-');
        if (backupFiles.length > CLOUD_BACKUP_MAX_FILES) {
            const sorted = [...backupFiles].sort((a, b) => a.name.localeCompare(b.name));
            const stale = sorted.slice(0, sorted.length - CLOUD_BACKUP_MAX_FILES);
            for (const file of stale) {
                try {
                    await googleDrive.deleteFile(backupsFolderId, file.name);
                } catch (error) {
                    console.warn(`[StorageV2] Failed to prune backup ${file.name}:`, error);
                }
            }
        }
    } catch (error) {
        console.warn('[StorageV2] Failed to create cloud safety backup:', error);
    }
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
        localStorage.removeItem(CLOUD_BACKUP_LAST_AT_KEY);

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
