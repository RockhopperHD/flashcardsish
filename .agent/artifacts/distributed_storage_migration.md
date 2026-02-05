# Distributed Storage Migration Plan

## Overview

This document outlines the migration from Flashcardsish's current single-file storage (`flashcardsish_data.json`) to a distributed multi-file storage system for improved resilience and lazy loading.

## Current Architecture

### Storage Structure (Before)
```
/Flashcardsish/
  └── flashcardsish_data.json    # Contains ALL user data
```

### Data Contents
```json
{
  "library_sets": [...],        // All CardSet objects
  "folders": [...],             // Folder structure
  "settings": {...},            // User settings
  "badges": [...],              // User badges
  "updated_at": "..."           // Timestamp
}
```

---

## New Architecture

### Storage Structure (After)
```
/Flashcardsish/
  ├── config.json                      # User settings + version
  ├── structure.json                   # Folder hierarchy + set references
  ├── sets/
  │   ├── [set-id-1].flashcards        # Individual set files
  │   ├── [set-id-2].flashcards
  │   └── ...
  └── sessions/
      ├── [session-id-1].json          # In-progress sessions
      └── ...
```

### File Schemas

#### config.json
```json
{
  "_WARNING": [
    "DO NOT EDIT THESE FILES! YOU WILL BREAK YOUR SAVE DATA!",
    "Flashcardsish is designed to read this data in a very specific way. If you change data here, such as deleting things randomly, you could corrupt and ruin your sets.",
    "You modify anything here at your own risk!"
  ],
  "version": 1,
  "settings": {
    "forgiveSpellingErrors": true,
    "ignoreDiacritics": false,
    "ignoreCapitalization": true,
    "forgiveThe": true,
    "wiggleRoom": 3,
    "retypeOnMistake": false,
    "starredOnly": false,
    "answerWithDefinition": false,
    "mode": "standard",
    "batchLength": 10,
    "shuffleCards": true,
    "brutalMode": false,
    "importAppend": true,
    "importOverride": "duplicate",
    "autoCloseImageWindow": false,
    "hideTooltips": false,
    "darkMode": true
  },
  "lastUsedSets": ["set-id-1", "set-id-2", "set-id-3"]  // For preloading
}
```

#### structure.json
```json
{
  "_WARNING": [
    "DO NOT EDIT THESE FILES! YOU WILL BREAK YOUR SAVE DATA!",
    "Flashcardsish is designed to read this data in a very specific way. If you change data here, such as deleting things randomly, you could corrupt and ruin your sets.",
    "You modify anything here at your own risk!"
  ],
  "version": 1,
  "folders": [
    {
      "id": "folder-1",
      "name": "Spanish",
      "color": "red",
      "setIds": ["set-id-1", "set-id-2"]
    }
  ],
  "rootSets": ["set-id-3", "set-id-4"],  // Sets not in any folder
  "badges": [...],                        // User badges
  "stats": {
    "lifetimeCorrect": 1234
  }
}
```

#### [id].flashcards
```json
{
  "version": 1,
  "id": "set-id-1",
  "name": "Spanish Vocab Chapter 1",
  "cards": [...],
  "termLabel": "Term",
  "definitionLabel": "Definition",
  "termSideFields": [...],
  "defSideFields": [...],
  "enableTermCards": false,
  "lastPlayed": 1738711200000,
  "elapsedTime": 3600000,
  "topStreak": 15,
  "isSessionActive": false
}
```

#### sessions/[id].json (In-Progress Sessions)
```json
{
  "version": 1,
  "sourceSetId": "set-id-1",
  "startedAt": 1738711200000,
  "masteryProgress": {
    "card-id-1": 2,
    "card-id-2": 1
  },
  "currentStreak": 5,
  "elapsedTime": 300000
}
```

---

## Implementation Tasks

### Phase 1: New Storage Layer (`storageV2.ts`)

1. **Create new storage module** with distributed file handling
2. **Implement warning text constant** for JSON headers
3. **Create file reading/writing functions**:
   - `readConfig()` / `writeConfig()` 
   - `readStructure()` / `writeStructure()`
   - `readFlashcardSet(id)` / `writeFlashcardSet(set)`
   - `listFlashcardFiles()` - discover all .flashcards files
   - `readSession(id)` / `writeSession()` / `deleteSession()`

### Phase 2: Lazy Loading System

1. **SetMetadata type** - lightweight reference (id, name, cardCount, lastPlayed)
2. **Set loading states**: `unloaded` | `loading` | `loaded` | `error`
3. **Preload last 3 used sets** on app boot
4. **Load set on demand** when user selects it

### Phase 3: Failsafe/Recovery Logic

1. **Config recovery**: If config.json is missing/corrupted, reset to defaults
2. **Structure auto-discovery**: Scan for orphaned .flashcards files and add to root
3. **Set corruption handling**:
   - Try to parse valid JSON and extract readable cards
   - Discard corrupted card entries
   - Show popup notification to user
4. **Deep merge for settings** - add new defaults without overwriting existing

### Phase 4: Migration Path

1. **Detect legacy data** (flashcardsish_data.json exists)
2. **Run migration**:
   - Create config.json from settings
   - Create structure.json from folders
   - Create individual .flashcards files for each set
   - Backup original file as flashcardsish_data.json.backup
   - Delete original after successful migration
3. **Migration popup** - inform user of the change

### Phase 5: UI Changes

1. **Loading states** for sets that aren't fully loaded yet
2. **Error popups** for corruption notifications
3. **"Reset Settings to Default"** button in You menu
4. **Loading spinners** on set tiles until data is fetched

---

## Default Settings Reference

```typescript
const DEFAULT_SETTINGS: Settings = {
  forgiveSpellingErrors: true,
  ignoreDiacritics: false,
  ignoreCapitalization: true,
  forgiveThe: true,
  wiggleRoom: 3,
  retypeOnMistake: false,
  starredOnly: false,
  answerWithDefinition: false,  // Answer with TERM
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
```

---

## Risk Mitigation

- **Backup before migration**: Always keep `flashcardsish_data.json.backup`
- **Atomic writes**: Write to temp file, then rename
- **Validate JSON before writing**: Ensure parseable
- **Graceful degradation**: If new system fails, fall back to legacy

---

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `storageV2.ts` | CREATE | New distributed storage module |
| `types.ts` | MODIFY | Add SetMetadata, LoadingState types |
| `storage.ts` | MODIFY | Add migration detection and bridge |
| `googleDriveClient.ts` | MODIFY | Add multi-file operations |
| `App.tsx` | MODIFY | Integrate lazy loading, loading states |
| `components/StartMenu.tsx` | MODIFY | Show loading states for sets |

---

## Testing Checklist

- [ ] Fresh user (no data) - creates correct file structure
- [ ] Legacy user - migration runs successfully
- [ ] Corrupted config.json - resets to defaults with popup
- [ ] Corrupted .flashcards file - recovers valid cards
- [ ] Orphaned .flashcards file - auto-discovered and added to structure
- [ ] Lazy loading - set loads when selected
- [ ] Preloading - last 3 sets load on boot
- [ ] Reset settings button works correctly
