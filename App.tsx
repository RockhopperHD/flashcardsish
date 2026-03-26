import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { CardSet, GameState, Settings, Folder, Tag } from './types';
import { fmtTime, generateId, sanitizeSet, syncMultistudySet, resetCardStudyProgress, resetSetStudyProgress } from './utils';
import { StartMenu, type UiAuditRequest } from './components/StartMenu';
import { Game } from './components/Game';
import { SetDetail } from './components/SetDetail';
import { Confetti } from './components/Confetti';
import { PrivacyPolicyModal } from './components/PrivacyPolicy';
import { TermsOfServiceModal } from './components/TermsOfService';
import { Documentation } from './components/Documentation';
import { FlashcardsMode } from './components/FlashcardsMode';
import { SRSMode } from './components/SRSMode';
import { KeybindsModal } from './components/KeybindsModal';
import { Clock, ArrowLeft, Settings as SettingsIcon, X, BookOpen, Heart, RotateCcw, FolderOpen, LayoutGrid, Trash2, LogIn, LogOut, Cloud, Download, Upload, FileText, Lock, Sparkles, Loader2, Globe, Tag as TagIcon, RefreshCw, CheckCircle2, XCircle, Keyboard, Star, ChevronDown, MessageSquare } from 'lucide-react';
import clsx from 'clsx';
import { saveLibrary, saveDirtySets, loadLibrary, saveFolders, loadFolders, loadAllUserData, saveSettings, loadSettings, loadStats, loadTags, saveStats, deleteAllUserData, CorruptionReport, resetSettingsToDefault, DEFAULT_SETTINGS, saveTags, CloudConflictDetail } from './storage';
import { normalizeCardSet, readFlashcardSet, readStructure } from './storageV2';
import { googleDrive, GoogleDriveUser } from './src/googleDriveClient';
import { normalizeCardMastery } from './cardNormalization';
import { normalizeSrsSessionStats } from './srs';
import { UserModal } from './components/UserModal';
import { ProfileCard } from './components/ProfileCard';
import { SignInCard } from './components/SignInCard';
import { CursorTooltip } from './components/CursorTooltip';
import { CorruptionNotification, CorruptionPopup } from './components/CorruptionNotification';
import { OnboardingTour } from './components/OnboardingTour';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { SharedSetView } from './components/SharedSetView';
import { SharedSetSnapshot } from './src/sharing';
// UI Audit panel disabled. Uncomment this import and the <UiAuditPanel /> block below to re-enable.
// import { UiAuditPanel } from './components/UiAuditPanel';

const LEGACY_MULTISTUDY_SUFFIX = ' (Legacy Snapshot)';
const ONBOARDING_TOUR_COMPLETED_KEY = 'flashcardsish-onboarding-tour-completed-v1';
const LIBRARY_LOCAL_FALLBACK_KEY = 'flashcard-library-v3';
const LIBRARY_LOCAL_FALLBACK_UPDATED_AT_KEY = 'flashcard-library-v3-updated-at';
const ALPHABET_SAMPLE_NAME = 'Fruits';
type AppToast = {
   id: number;
   type: 'success' | 'error';
   message: string;
};

const normalizeLoadedSet = (set: CardSet): CardSet => {
   const sanitized = sanitizeSet(normalizeCardSet(set));
   // Local-only sets should always live in the Local section at root.
   const normalizedBase = sanitized.isLocalOnly && sanitized.folderId
      ? { ...sanitized, folderId: undefined }
      : sanitized;
   const normalized = normalizedBase.srsSessionStats
      ? { ...normalizedBase, srsSessionStats: normalizeSrsSessionStats(normalizedBase.srsSessionStats) }
      : normalizedBase;
   const hasSourceSetIds = Array.isArray(normalized.sourceSetIds) && normalized.sourceSetIds.length > 0;

   if (!normalized.isMultistudy || hasSourceSetIds) return normalized;

   return {
      ...normalized,
      name: normalized.name.endsWith(LEGACY_MULTISTUDY_SUFFIX)
         ? normalized.name
         : `${normalized.name}${LEGACY_MULTISTUDY_SUFFIX}`,
      // Legacy multistudy sessions are preserved as regular snapshots to avoid sync collisions.
      isMultistudy: false,
      isSessionActive: false,
      sourceSetIds: undefined
   };
};

interface FlashcardsishExportFile {
   exportedAt: string;
   version: 'flashcardsish-export-v1';
   librarySets?: CardSet[];
   folders?: Folder[];
   settings?: Partial<Settings>;
   stats?: { lifetimeCorrect?: number };
   tags?: Tag[];
}

const parseExportData = (raw: string): FlashcardsishExportFile => {
   const parsed = JSON.parse(raw);
   if (!parsed || typeof parsed !== 'object') {
      throw new Error('Backup file is not valid JSON data.');
   }

   if (parsed.version !== 'flashcardsish-export-v1') {
      throw new Error('Unsupported backup version. Expected flashcardsish-export-v1.');
   }

   return parsed as FlashcardsishExportFile;
};

const formatConflictTimestamp = (value?: string): string => {
   if (!value) return 'Unknown';
   const date = new Date(value);
   if (Number.isNaN(date.getTime())) return value;
   return date.toLocaleString();
};

const dedupeStrings = (values: string[] = []): string[] => Array.from(new Set(values));

const normalizeStringArrayForSignature = (values: string[] = []): string[] =>
   Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));

const normalizeCustomFieldsForSignature = (fields: { name: string; value: string }[] = []) =>
   fields
      .map(field => ({ name: field.name || '', value: field.value || '' }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.value.localeCompare(b.value));

const cardContentSignature = (card: CardSet['cards'][number]): string => JSON.stringify({
   term: Array.isArray(card.term) ? card.term : [],
   content: card.content || '',
   year: card.year || '',
   image: card.image || '',
   termImage: card.termImage || '',
   customFields: normalizeCustomFieldsForSignature(card.customFields || []),
   tags: normalizeStringArrayForSignature(card.tags || [])
});

const stableHash = (value: string): string => {
   let hash = 0;
   for (let i = 0; i < value.length; i += 1) {
      hash = ((hash << 5) - hash) + value.charCodeAt(i);
      hash |= 0;
   }
   return Math.abs(hash).toString(36);
};

const createConflictCardId = (baseId: string, signature: string, usedIds: Set<string>): string => {
   const base = `${baseId}__merge_${stableHash(signature)}`;
   if (!usedIds.has(base)) return base;

   let counter = 2;
   let candidate = `${base}_${counter}`;
   while (usedIds.has(candidate)) {
      counter += 1;
      candidate = `${base}_${counter}`;
   }
   return candidate;
};

const mergeSetWithoutLosingCards = (localSet: CardSet, cloudSet: CardSet): CardSet => {
   const localCards = localSet.cards || [];
   const cloudCards = cloudSet.cards || [];
   const mergedCards = localCards.map(card => ({ ...card }));
   const usedIds = new Set(mergedCards.map(card => card.id));
   const localIndexById = new Map<string, number>();
   const signatureToIndex = new Map<string, number>();

   const mergeProgressFields = (
      preferredContent: CardSet['cards'][number],
      localCard: CardSet['cards'][number],
      cloudCard: CardSet['cards'][number]
   ): CardSet['cards'][number] => ({
      ...preferredContent,
      // Keep study state from whichever side progressed further.
      mastery: Math.max(normalizeCardMastery(localCard.mastery), normalizeCardMastery(cloudCard.mastery)),
      star: localCard.star === true || cloudCard.star === true,
      originalSetId: preferredContent.originalSetId || localCard.originalSetId || cloudCard.originalSetId,
      originalSetName: preferredContent.originalSetName || localCard.originalSetName || cloudCard.originalSetName
   });

   mergedCards.forEach((card, index) => {
      localIndexById.set(card.id, index);
      const signature = cardContentSignature(card);
      if (!signatureToIndex.has(signature)) {
         signatureToIndex.set(signature, index);
      }
   });

   for (const cloudCard of cloudCards) {
      const cloudSignature = cardContentSignature(cloudCard);
      const localIndex = localIndexById.get(cloudCard.id);

      if (localIndex !== undefined) {
         const localCard = mergedCards[localIndex];
         const localSignature = cardContentSignature(localCard);

         // Keep local card content for existing IDs to avoid accidental overwrite.
         mergedCards[localIndex] = mergeProgressFields(localCard, localCard, cloudCard);

         // If same ID has different content, preserve cloud variant as an extra card.
         if (localSignature !== cloudSignature && !signatureToIndex.has(cloudSignature)) {
            const conflictId = createConflictCardId(cloudCard.id, cloudSignature, usedIds);
            const conflictCard = mergeProgressFields(
               { ...cloudCard, id: conflictId },
               localCard,
               cloudCard
            );
            mergedCards.push(conflictCard);
            const newIndex = mergedCards.length - 1;
            usedIds.add(conflictId);
            localIndexById.set(conflictId, newIndex);
            signatureToIndex.set(cloudSignature, newIndex);
         }
         continue;
      }

      const existingBySignature = signatureToIndex.get(cloudSignature);
      if (existingBySignature !== undefined) {
         const existingCard = mergedCards[existingBySignature];
         mergedCards[existingBySignature] = mergeProgressFields(existingCard, existingCard, cloudCard);
         continue;
      }

      let nextId = cloudCard.id;
      if (usedIds.has(nextId)) {
         nextId = createConflictCardId(cloudCard.id, cloudSignature, usedIds);
      }
      const mergedCloudCard = { ...cloudCard, id: nextId };
      mergedCards.push(mergedCloudCard);
      const newIndex = mergedCards.length - 1;
      usedIds.add(nextId);
      localIndexById.set(nextId, newIndex);
      signatureToIndex.set(cloudSignature, newIndex);
   }

   const useLocalMetadata = (localSet.lastPlayed || 0) > (cloudSet.lastPlayed || 0);
   const metadataSource = useLocalMetadata ? localSet : cloudSet;

   return normalizeLoadedSet({
      ...cloudSet,
      name: metadataSource.name,
      sourceId: metadataSource.sourceId ?? cloudSet.sourceId,
      version: metadataSource.version ?? cloudSet.version,
      termLabel: metadataSource.termLabel ?? cloudSet.termLabel,
      definitionLabel: metadataSource.definitionLabel ?? cloudSet.definitionLabel,
      termSideFields: metadataSource.termSideFields ?? cloudSet.termSideFields,
      defSideFields: metadataSource.defSideFields ?? cloudSet.defSideFields,
      enableTermCards: metadataSource.enableTermCards ?? cloudSet.enableTermCards,
      customFieldNames: dedupeStrings([
         ...(cloudSet.customFieldNames || []),
         ...(localSet.customFieldNames || [])
      ]),
      tags: dedupeStrings([...(cloudSet.tags || []), ...(localSet.tags || [])]),
      isMultistudy: metadataSource.isMultistudy ?? cloudSet.isMultistudy,
      sourceSetIds: metadataSource.sourceSetIds ?? cloudSet.sourceSetIds,
      lastPlayed: Math.max(localSet.lastPlayed || 0, cloudSet.lastPlayed || 0),
      elapsedTime: Math.max(localSet.elapsedTime || 0, cloudSet.elapsedTime || 0),
      topStreak: Math.max(localSet.topStreak || 0, cloudSet.topStreak || 0),
      isSessionActive: Boolean(localSet.isSessionActive || cloudSet.isSessionActive),
      learnSessionStats: metadataSource.learnSessionStats ?? cloudSet.learnSessionStats ?? localSet.learnSessionStats,
      isLocalOnly: false,
      folderId: cloudSet.folderId ?? (localSet.isLocalOnly ? undefined : localSet.folderId),
      cards: mergedCards
   });
};

const WiggleInput: React.FC<{ value: number; onChange: (val: number) => void }> = ({ value, onChange }) => {
   const [localVal, setLocalVal] = useState(value.toString());
   const [error, setError] = useState<string | null>(null);
   const [rect, setRect] = useState<DOMRect | null>(null);
   const inputRef = useRef<HTMLInputElement>(null);

   useEffect(() => {
      setLocalVal(value.toString());
   }, [value]);

   const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setLocalVal(val);
      if (val === '') {
         setError("Cannot be empty");
         return;
      }
      const num = parseInt(val);
      if (isNaN(num) || num < 1 || num > 6) {
         setError("Must be between 1 and 6");
         if (inputRef.current) setRect(inputRef.current.getBoundingClientRect());
      } else {
         setError(null);
         onChange(num);
      }
   };

   return (
      <div className="relative" onMouseEnter={(e) => setRect(e.currentTarget.getBoundingClientRect())}>
         <input
            ref={inputRef}
            type="text"
            value={localVal}
            onChange={handleChange}
            className={clsx(
               "w-12 py-1 px-2 text-center bg-panel border rounded-lg text-sm font-bold outline-none ring-offset-bg focus:ring-2 transition-all",
               error ? "border-red text-red focus:ring-red/50" : "border-outline text-text focus:ring-accent"
            )}
         />
         {error && rect && (
            <div
               className="fixed z-[100] px-3 py-2 rounded-lg text-xs font-bold shadow-xl animate-in fade-in zoom-in-95 pointer-events-none w-max max-w-[200px] text-center bg-red text-white border border-red-700 shadow-red/20"
               style={{
                  top: rect.top - 10,
                  left: rect.left + (rect.width / 2),
                  transform: 'translate(-50%, -100%)'
               }}
            >
               {error}
               <div className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bottom-[-5px] bg-red border-r border-b border-red-700"></div>
            </div>
         )}
      </div>
   );
};

// Tooltip Wrapper Component for custom sections
const TooltipWrapper: React.FC<{
   id: string;
   tooltip: string;
   hideWhenSetting?: boolean;
   settings: Settings;
   children: React.ReactElement;
}> = ({ id, tooltip, hideWhenSetting = true, settings, children }) => {
   return (
      <CursorTooltip
         content={tooltip}
         isEnabled={hideWhenSetting ? !settings.hideTooltips : true}
         tooltipClassName="w-80 max-w-[90vw]"
      >
         {children}
      </CursorTooltip>
   );
};

// SettingRow Component with tooltip support
const SettingRow: React.FC<{
   id: string;
   label: string;
   settingKey: keyof Settings;
   alwaysShowTooltip?: boolean;
   settings: Settings;
   tooltips: Record<string, string>;
   onUpdate: (s: Settings) => void;
}> = ({ id, label, settingKey, alwaysShowTooltip, settings, tooltips, onUpdate }) => {
   const toggle = () => {
      onUpdate({ ...settings, [settingKey]: !settings[settingKey] });
   };

   return (
      <CursorTooltip
         content={tooltips[id]}
         isEnabled={alwaysShowTooltip || !settings.hideTooltips}
         tooltipClassName="w-80 max-w-[90vw]"
      >
         <label
            onClick={toggle}
            className="flex items-center justify-between p-3 bg-panel-2 rounded-xl cursor-pointer hover:border-accent border border-transparent transition-all"
         >
            <span className="font-medium text-text">{label}</span>
            <div
               className={clsx("w-12 h-6 rounded-full p-1 transition-colors", settings[settingKey] ? "bg-accent" : "bg-outline")}
            >
               <div className={clsx("bg-bg w-4 h-4 rounded-full shadow-sm transition-transform", settings[settingKey] ? "translate-x-6" : "translate-x-0")} />
            </div>
         </label>
      </CursorTooltip>
   );
};

// Settings Modal Component - Three Tab Sidebar Layout
const SettingsModal: React.FC<{
   isOpen: boolean;
   onClose: () => void;
   settings: Settings;
   onUpdate: (s: Settings) => void;
   onOpenKeybinds: () => void;
   onDeleteData: () => void;
   onExportData: () => void;
   onImportData: (file: File) => Promise<void>;
   onResetSettings: () => void;
   onStartOnboarding: () => void;
   onCreateAlphabetSet: () => void;
   librarySets: CardSet[];
   // User props for "You" tab
   user: GoogleDriveUser | null;
   lifetimeCorrect: number;
   onLogin: (keepSignedIn: boolean) => void;
   onLogout: () => void;
   initialTab?: 'set' | 'global' | 'you' | 'tags';
   tags: Tag[];
   onUpdateTags: (tags: Tag[]) => void;
   onOpenPrivacy?: () => void;
}> = ({ isOpen, onClose, settings, onUpdate, onOpenKeybinds, onDeleteData, onExportData, onImportData, onResetSettings, onStartOnboarding, onCreateAlphabetSet, librarySets, user, lifetimeCorrect, onLogin, onLogout, initialTab = 'set', tags, onUpdateTags, onOpenPrivacy }) => {
   const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
   const [showResetConfirm, setShowResetConfirm] = useState(false);
   const [activeTab, setActiveTab] = useState<'set' | 'global' | 'you' | 'builder' | 'tags'>(initialTab);
   const [activeTooltip, setActiveTooltip] = useState<string | null>(null);
   const [isImportingBackup, setIsImportingBackup] = useState(false);
   const [isBuilderShiftHeld, setIsBuilderShiftHeld] = useState(false);
   const backupImportInputRef = useRef<HTMLInputElement>(null);

   const [deleteConfirmTagId, setDeleteConfirmTagId] = useState<string | null>(null);
   const [isAnswerWithOpen, setIsAnswerWithOpen] = useState(false);
   const [isAnswerStyleOpen, setIsAnswerStyleOpen] = useState(false);
   const answerWithRef = useRef<HTMLDivElement>(null);
   const answerStyleRef = useRef<HTMLDivElement>(null);

   const TAG_COLORS: string[] = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose', 'slate', 'gray', 'zinc', 'neutral', 'stone'];

   const handleImportBackupFile = async (file: File | null) => {
      if (!file) return;

      setIsImportingBackup(true);
      try {
         await onImportData(file);
      } catch (error) {
         console.error('[SettingsModal] Backup import failed:', error);
      } finally {
         setIsImportingBackup(false);
         if (backupImportInputRef.current) {
            backupImportInputRef.current.value = '';
         }
      }
   };

   // Reset activeTab when initialTab changes (e.g., opening from different triggers)
   React.useEffect(() => {
      if (isOpen) {
         setActiveTab(initialTab);
      }
   }, [isOpen, initialTab]);

   React.useEffect(() => {
      if (!isOpen) return;
      const handleKeyDown = (e: KeyboardEvent) => {
         if (e.key === 'Shift') {
            setIsBuilderShiftHeld(true);
         }
         if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
         }
      };
      const handleKeyUp = (e: KeyboardEvent) => {
         if (e.key === 'Shift') {
            setIsBuilderShiftHeld(false);
         }
      };
      const handleWindowBlur = () => setIsBuilderShiftHeld(false);

      window.addEventListener('keydown', handleKeyDown);
      window.addEventListener('keyup', handleKeyUp);
      window.addEventListener('blur', handleWindowBlur);
      return () => {
         window.removeEventListener('keydown', handleKeyDown);
         window.removeEventListener('keyup', handleKeyUp);
         window.removeEventListener('blur', handleWindowBlur);
      };
   }, [isOpen, onClose]);

   React.useEffect(() => {
      if (!isOpen || activeTab !== 'builder') {
         setIsBuilderShiftHeld(false);
      }
   }, [activeTab, isOpen]);

   React.useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
         if (answerWithRef.current && !answerWithRef.current.contains(event.target as Node)) {
            setIsAnswerWithOpen(false);
         }
         if (answerStyleRef.current && !answerStyleRef.current.contains(event.target as Node)) {
            setIsAnswerStyleOpen(false);
         }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
   }, []);

   if (!isOpen) return null;

   const toggle = (key: keyof Settings) => {
      onUpdate({ ...settings, [key]: !settings[key] });
   };

   // Tooltip definitions
   const tooltips: Record<string, string> = {
      forgiveSpellingErrors: "Allow minor typos and capitalization errors. Configure specific rules below.",
      ignoreDiacritics: "Treat accented characters as their base letters (for example, accented e matches e).",
      ignoreCapitalization: "Mark answers as correct regardless of uppercase or lowercase usage.",
      forgiveThe: "Ignore the word 'the' at the beginning of terms (e.g., 'The Apple' matches 'Apple').",
      wiggleRoom: "How many letters can be wrong while still counting the answer as correct (1-6 letters).",
      retypeOnMistake: "When you get an answer wrong, you'll need to retype the correct answer before moving on.",
      starredOnly: "Only study cards you've starred. Great for focusing on tricky terms.",
      answerWithDefinition: `Change what you're expected to enter and what you're prompted with. Right now, you will be presented with the ${settings.answerWithDefinition ? 'Term' : 'Definition'} and have to think about, choose, or type the ${settings.answerWithDefinition ? 'Definition' : 'Term'}.`,
      learnMode: "Choose how you want to answer: type your answer (Standard), pick from options (Multiple Choice).",
      hideTooltips: "Turns on or off Helper Tooltips, like this one. This tooltip appears regardless of if this setting is on or not.",
      darkMode: "Toggle between dark and light themes for the app.",
      cloudSync: "Sign in to sync your flashcard sets across all your devices for free.",
      exportData: "Download all your flashcard sets, folders, and settings as a JSON file for backup or transfer.",
      dangerZone: "Permanently delete all your data from this device and the cloud. This cannot be undone.",
      shuffleCards: "When in Learn mode, shuffle terms so they don't appear in the same order as they are listed in the set.",
      brutalMode: "When enabled, if you get a term incorrect and mastery is at 1 of 2, its mastery is set to 0 of 2. Only affects Zen.",
      importAppend: "When importing raw text, append new cards to the existing list instead of replacing them. If this setting is disabled, then importing raw text can delete your whole set -- be careful!",
      importOverride: "Choose how Flashcardsish handles duplicates when pasting raw text. If a card in your raw text matches the term or definition of one already in the set...\n\n- Keep Old: the one already in the set will be kept and the one in the raw text will be ignored.\n- Add Duplicate: the new one in the raw text will be added anyway, creating a duplicate card.\n- Override Old: the new card in the raw text will replace the old card that already exists.",
      autoCloseImageWindow: "When enabled, pasting any text in the image URL space instantly closes the window and attempts to use that image. If it fails, it will upload a broken image, but you can always re-attempt the upload.",
      learnModeLeftKey1: "Primary key for Option A / True.",
      learnModeLeftKey2: "Secondary key for Option A / True.",
      learnModeRightKey1: "Primary key for Option B / False.",
      learnModeRightKey2: "Secondary key for Option B / False.",
      autoAdvanceOnAnswer: "If enabled, selecting an A / B or True / False option will automatically advance to the next field or the Submit button. If disabled, you must press Tab or Enter to continue.",
      reduceStreakMotion: "Control whether or not the streak star spins or not.",
      alphabetSampleSet: "Create a sample library set of 15 fruits and their colors.",
      tabSelectsEverythingInBuilder: "When enabled, pressing tab in the Visual Editor will skip you to the next button on the screen instead of to the next text field."
   };



   return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onMouseDown={onClose}>
         <div
            className="bg-panel border border-outline rounded-2xl shadow-2xl animate-in zoom-in-95 w-full max-w-lg md:max-w-5xl lg:max-w-6xl h-[700px] md:h-[850px] max-h-[90vh] flex flex-col"
            onMouseDown={(e) => e.stopPropagation()}
         >
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-outline shrink-0">
               <h2
                  className="text-3xl text-text"
                  style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}
               >
                  Settings
               </h2>
               <button onClick={onClose} className="text-muted hover:text-text p-2 rounded-lg hover:bg-panel-2 transition-colors">
                  <X size={24} />
               </button>
            </div>

            {/* Content with Sidebar */}
            <div className="flex flex-col md:flex-row flex-1 min-h-0">
               {/* Sidebar Navigation */}
               <div className="w-48 shrink-0 border-r border-outline p-4 hidden md:flex md:flex-col">
                  <h3 className="text-xs font-bold text-muted uppercase tracking-widest mb-4 px-2">
                     Settings
                  </h3>
                  <nav className="space-y-1">
                     <button
                        onClick={() => setActiveTab('set')}
                        className={clsx(
                           "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all text-sm",
                           activeTab === 'set'
                              ? "bg-accent/10 text-accent border border-accent/20"
                              : "text-muted hover:text-text hover:bg-panel-2"
                        )}
                     >
                        <LayoutGrid size={18} className={activeTab === 'set' ? "text-accent" : "text-muted"} />
                        <span className="font-medium">Study Settings</span>
                     </button>
                     <button
                        onClick={() => setActiveTab('builder')}
                        className={clsx(
                           "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all text-sm",
                           activeTab === 'builder'
                              ? "bg-accent/10 text-accent border border-accent/20"
                              : "text-muted hover:text-text hover:bg-panel-2"
                        )}
                     >
                        <FileText size={18} className={activeTab === 'builder' ? "text-accent" : "text-muted"} />
                        <span className="font-medium">Builder Settings</span>
                     </button>
                     <button
                        onClick={() => setActiveTab('global')}
                        className={clsx(
                           "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all text-sm",
                           activeTab === 'global'
                              ? "bg-accent/10 text-accent border border-accent/20"
                              : "text-muted hover:text-text hover:bg-panel-2"
                        )}
                     >
                        <Globe size={18} className={activeTab === 'global' ? "text-accent" : "text-muted"} />
                        <span className="font-medium">Global Settings</span>
                     </button>
                     <button
                        onClick={() => setActiveTab('tags')}
                        className={clsx(
                           "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all text-sm",
                           activeTab === 'tags'
                              ? "bg-accent/10 text-accent border border-accent/20"
                              : "text-muted hover:text-text hover:bg-panel-2"
                        )}
                     >
                        <TagIcon size={18} className={activeTab === 'tags' ? "text-accent" : "text-muted"} />
                        <span className="font-medium">Tags</span>
                     </button>
                  </nav>


                  {/* Spacer to push You to bottom */}
                  <div className="flex-1" />

                  {/* You Section */}
                  <nav className="mt-4 pt-4 border-t border-outline">
                     <button
                        onClick={() => setActiveTab('you')}
                        className={clsx(
                           "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all text-sm",
                           activeTab === 'you'
                              ? "bg-accent/10 text-accent border border-accent/20"
                              : "text-muted hover:text-text hover:bg-panel-2"
                        )}
                     >
                        <Cloud size={18} className={activeTab === 'you' ? "text-accent" : "text-muted"} />
                        <span className="font-medium">You</span>
                     </button>
                  </nav>

                  {!settings.hideTooltips && (
                     <div className="mt-6 px-2">
                        <p className="text-[10px] text-muted text-center opacity-60">
                           Hover over a setting to learn what it does.
                        </p>
                     </div>
                  )}
               </div>

               {/* Mobile Tab Selector */}
               <div className="md:hidden p-4 border-b border-outline w-full shrink-0">
                  <div className="grid grid-cols-5 gap-2">
                     <button
                        onClick={() => setActiveTab('set')}
                        className={clsx(
                           "py-2 px-4 rounded-lg text-sm font-bold transition-all",
                           activeTab === 'set'
                              ? "bg-accent text-bg"
                              : "bg-panel-2 text-muted hover:text-text"
                        )}
                     >
                        Set
                     </button>
                     <button
                        onClick={() => setActiveTab('builder')}
                        className={clsx(
                           "py-2 px-4 rounded-lg text-sm font-bold transition-all",
                           activeTab === 'builder'
                              ? "bg-accent text-bg"
                              : "bg-panel-2 text-muted hover:text-text"
                        )}
                     >
                        Builder
                     </button>
                     <button
                        onClick={() => setActiveTab('global')}
                        className={clsx(
                           "py-2 px-4 rounded-lg text-sm font-bold transition-all",
                           activeTab === 'global'
                              ? "bg-accent text-bg"
                              : "bg-panel-2 text-muted hover:text-text"
                        )}
                     >
                        Global
                     </button>
                     <button
                        onClick={() => setActiveTab('tags')}
                        className={clsx(
                           "py-2 px-4 rounded-lg text-sm font-bold transition-all",
                           activeTab === 'tags'
                              ? "bg-accent text-bg"
                              : "bg-panel-2 text-muted hover:text-text"
                        )}
                     >
                        Tags
                     </button>
                     <button
                        onClick={() => setActiveTab('you')}
                        className={clsx(
                           "py-2 px-4 rounded-lg text-sm font-bold transition-all",
                           activeTab === 'you'
                              ? "bg-accent text-bg"
                              : "bg-panel-2 text-muted hover:text-text"
                        )}
                     >
                        You
                     </button>
                  </div>
               </div>

               {/* Main Content Area */}
               <div className="flex-1 p-6 overflow-y-auto overflow-x-visible">
                  {activeTab === 'set' && (
                     <div className="space-y-4">

                        {/* General */}
                        <h4 className="text-xs font-bold text-muted uppercase tracking-widest pt-1">General</h4>

                        {/* Answer With Toggle */}
                        <TooltipWrapper id="answerWithDefinition" tooltip={tooltips.answerWithDefinition} settings={settings}>
                           <div className="p-3 bg-panel-2 rounded-xl border border-transparent hover:border-accent transition-all">
                              <span className="font-medium text-text block mb-3">Answer With</span>
                              <div className="relative" ref={answerWithRef}>
                                 <button
                                    onClick={() => setIsAnswerWithOpen(!isAnswerWithOpen)}
                                    className="w-full bg-panel border border-outline rounded-lg px-3 py-2 text-sm font-bold focus:border-accent outline-none transition-colors flex items-center justify-between gap-2"
                                 >
                                    <span className="truncate">
                                       {settings.answerWithDefinition ? "Definition" : "Term"}
                                    </span>
                                    <ChevronDown size={14} className="opacity-50 flex-shrink-0" />
                                 </button>

                                 {isAnswerWithOpen && (
                                    <div className="absolute top-full left-0 mt-2 w-full bg-panel border border-outline rounded-xl shadow-xl z-50 overflow-hidden animate-in zoom-in-95">
                                       {[
                                          { value: false, label: "Term" },
                                          { value: true, label: "Definition" },
                                       ].map((opt) => (
                                          <button
                                             key={opt.label}
                                             onClick={() => {
                                                onUpdate({ ...settings, answerWithDefinition: opt.value });
                                                setIsAnswerWithOpen(false);
                                             }}
                                             className={clsx(
                                                "w-full text-left px-3 py-2 text-sm hover:bg-panel-2 transition-colors",
                                                settings.answerWithDefinition === opt.value
                                                   ? "text-accent font-bold bg-accent/5"
                                                   : "text-text"
                                             )}
                                          >
                                             {opt.label}
                                          </button>
                                       ))}
                                    </div>
                                 )}
                              </div>
                           </div>
                        </TooltipWrapper>

                        {/* Shuffle Cards */}
                        <SettingRow id="shuffleCards" label="Shuffle Cards" settingKey="shuffleCards" settings={settings} tooltips={tooltips} onUpdate={onUpdate} />

                        {/* Study Starred Only */}
                        <SettingRow id="starredOnly" label="Study Starred Only" settingKey="starredOnly" settings={settings} tooltips={tooltips} onUpdate={onUpdate} />

                        {/* Keybinds */}
                        <div
                           onClick={onOpenKeybinds}
                           className="flex items-center justify-between p-3 bg-panel-2 rounded-xl cursor-pointer hover:border-accent border border-transparent transition-all"
                        >
                           <span className="font-medium text-text">Keybinds</span>
                           <button
                              className="flex items-center gap-2 px-3 py-1.5 text-sm font-bold text-muted hover:text-text bg-panel border border-outline rounded-lg transition-all hover:border-accent/50"
                           >
                              <Keyboard size={14} />
                              Open
                           </button>
                        </div>

                        {/* Learn Mode */}
                        <h4 className="text-xs font-bold text-muted uppercase tracking-widest pt-3">Learn Mode</h4>

                        {/* Answer Style (was: Learn Mode Style) */}
                        <TooltipWrapper id="learnMode" tooltip={tooltips.learnMode} settings={settings}>
                           <div className="p-3 bg-panel-2 rounded-xl border border-transparent hover:border-accent transition-all">
                              <span className="font-medium text-text block mb-3">Answer Style</span>
                              <div className="relative" ref={answerStyleRef}>
                                 <button
                                    onClick={() => setIsAnswerStyleOpen(!isAnswerStyleOpen)}
                                    className="w-full bg-panel border border-outline rounded-lg px-3 py-2 text-sm font-bold focus:border-accent outline-none transition-colors flex items-center justify-between gap-2"
                                 >
                                    <span className="truncate">
                                       {settings.mode === "standard"
                                          ? "Standard"
                                          : settings.mode === "multiple_choice"
                                             ? "Multiple Choice"
                                             : "Random Choice"}
                                    </span>
                                    <ChevronDown size={14} className="opacity-50 flex-shrink-0" />
                                 </button>

                                 {isAnswerStyleOpen && (
                                    <div className="absolute top-full left-0 mt-2 w-full bg-panel border border-outline rounded-xl shadow-xl z-50 overflow-hidden animate-in zoom-in-95">
                                       {[
                                          { value: "standard", label: "Standard" },
                                          { value: "multiple_choice", label: "Multiple Choice" },
                                       ].map((opt) => (
                                          <button
                                             key={opt.value}
                                             onClick={() => {
                                                onUpdate({ ...settings, mode: opt.value as Settings["mode"] });
                                                setIsAnswerStyleOpen(false);
                                             }}
                                             className={clsx(
                                                "w-full text-left px-3 py-2 text-sm hover:bg-panel-2 transition-colors",
                                                settings.mode === opt.value
                                                   ? "text-accent font-bold bg-accent/5"
                                                   : "text-text"
                                             )}
                                          >
                                             {opt.label}
                                          </button>
                                       ))}
                                    </div>
                                 )}
                              </div>
                           </div>
                        </TooltipWrapper>

                        {/* Forgive Spelling Errors & Sub-options */}
                        <div className="bg-panel-2/50 rounded-xl overflow-hidden border border-transparent transition-all hover:border-outline/50">
                           <SettingRow
                              id="forgiveSpellingErrors"
                              label="Forgive Minor Spelling Errors"
                              settingKey="forgiveSpellingErrors"
                              settings={settings}
                              tooltips={tooltips}
                              onUpdate={onUpdate}
                           />

                           {settings.forgiveSpellingErrors && (
                              <div className="space-y-1 pb-3 pt-1 px-3">
                                 {/* Sub-options */}
                                 <div className="pl-6 border-l-2 border-outline/30 space-y-3 ml-2">
                                    {/* Ignore Diacritics */}
                                    <div className="flex items-center justify-between">
                                       <TooltipWrapper id="ignoreDiacritics" tooltip={tooltips.ignoreDiacritics} settings={settings}>
                                          <label className="text-sm text-text cursor-pointer hover:text-text transition-colors">Ignore diacritics (accents)</label>
                                       </TooltipWrapper>
                                       <div
                                          onClick={(e) => { e.stopPropagation(); toggle('ignoreDiacritics'); }}
                                          className={clsx("w-8 h-4 rounded-full p-0.5 transition-colors cursor-default shrink-0", settings.ignoreDiacritics ? "bg-accent" : "bg-outline")}
                                       >
                                          <div className={clsx("bg-bg w-3 h-3 rounded-full shadow-sm transition-transform", settings.ignoreDiacritics ? "translate-x-4" : "translate-x-0")} />
                                       </div>
                                    </div>

                                    {/* Ignore Capitalization */}
                                    <div className="flex items-center justify-between">
                                       <TooltipWrapper id="ignoreCapitalization" tooltip={tooltips.ignoreCapitalization} settings={settings}>
                                          <label className="text-sm text-text cursor-pointer hover:text-text transition-colors">Ignore capitalization</label>
                                       </TooltipWrapper>
                                       <div
                                          onClick={(e) => { e.stopPropagation(); toggle('ignoreCapitalization'); }}
                                          className={clsx("w-8 h-4 rounded-full p-0.5 transition-colors cursor-default shrink-0", settings.ignoreCapitalization ? "bg-accent" : "bg-outline")}
                                       >
                                          <div className={clsx("bg-bg w-3 h-3 rounded-full shadow-sm transition-transform", settings.ignoreCapitalization ? "translate-x-4" : "translate-x-0")} />
                                       </div>
                                    </div>

                                    {/* Forgive "the" */}
                                    <div className="flex items-center justify-between">
                                       <TooltipWrapper id="forgiveThe" tooltip={tooltips.forgiveThe} settings={settings}>
                                          <label className="text-sm text-text cursor-pointer hover:text-text transition-colors">Forgive "the"</label>
                                       </TooltipWrapper>
                                       <div
                                          onClick={(e) => { e.stopPropagation(); toggle('forgiveThe'); }}
                                          className={clsx("w-8 h-4 rounded-full p-0.5 transition-colors cursor-default shrink-0", settings.forgiveThe ? "bg-accent" : "bg-outline")}
                                       >
                                          <div className={clsx("bg-bg w-3 h-3 rounded-full shadow-sm transition-transform", settings.forgiveThe ? "translate-x-4" : "translate-x-0")} />
                                       </div>
                                    </div>

                                    {/* Wiggle Room */}
                                    <div className="flex items-center justify-between">
                                       <TooltipWrapper id="wiggleRoom" tooltip={tooltips.wiggleRoom} settings={settings}>
                                          <label className="text-sm text-text cursor-pointer hover:text-text transition-colors">Wiggle room (letters)</label>
                                       </TooltipWrapper>
                                       <WiggleInput
                                          value={settings.wiggleRoom}
                                          onChange={(val) => onUpdate({ ...settings, wiggleRoom: val })}
                                       />
                                    </div>
                                 </div>
                              </div>
                           )}
                        </div>

                        {/* Retype Mistakes */}
                        <SettingRow id="retypeOnMistake" label="Retype Mistakes" settingKey="retypeOnMistake" settings={settings} tooltips={tooltips} onUpdate={onUpdate} />

                        {/* Auto Advance */}
                        <SettingRow id="autoAdvanceOnAnswer" label="Auto-Advance on Answer" settingKey="autoAdvanceOnAnswer" settings={settings} tooltips={tooltips} onUpdate={onUpdate} />

                        {/* Reduce Streak Motion */}
                        <SettingRow id="reduceStreakMotion" label="Reduce Streak Motion" settingKey="reduceStreakMotion" settings={settings} tooltips={tooltips} onUpdate={onUpdate} />

                        {/* Brutal Mode */}
                        <SettingRow id="brutalMode" label="Brutal Mode" settingKey="brutalMode" settings={settings} tooltips={tooltips} onUpdate={onUpdate} />

                     </div>
                  )}

                  {activeTab === 'builder' && (
                     <div className="space-y-4">
                        <SettingRow
                           id="tabSelectsEverythingInBuilder"
                           label="Tab Selects Everything in the Builder"
                           settingKey="tabSelectsEverythingInBuilder"
                           settings={settings}
                           tooltips={tooltips}
                           onUpdate={onUpdate}
                        />
                        <TooltipWrapper id="autoCloseImageWindow" tooltip={tooltips.autoCloseImageWindow} settings={settings}>
                           <label
                              onClick={() => toggle('autoCloseImageWindow')}
                              className="flex items-center justify-between p-3 bg-panel-2 rounded-xl cursor-pointer hover:border-accent border border-transparent transition-all"
                           >
                              <span className="font-medium text-text">Automatically Close Image Window</span>
                              <div
                                 onClick={(e) => { e.stopPropagation(); toggle('autoCloseImageWindow'); }}
                                 className={clsx("w-12 h-6 rounded-full p-1 transition-colors cursor-default", settings.autoCloseImageWindow ? "bg-accent" : "bg-outline")}
                              >
                                 <div className={clsx("bg-bg w-4 h-4 rounded-full shadow-sm transition-transform", settings.autoCloseImageWindow ? "translate-x-6" : "translate-x-0")} />
                              </div>
                           </label>
                        </TooltipWrapper>
                        {isBuilderShiftHeld && (
                           <TooltipWrapper id="alphabetSampleSet" tooltip={tooltips.alphabetSampleSet} settings={settings}>
                              <div className="p-3 bg-panel-2 rounded-xl border border-transparent hover:border-accent transition-all">
                                 <div className="flex items-center justify-between gap-4">
                                    <div className="font-medium text-text">Add Fruits</div>
                                    <button
                                       onClick={onCreateAlphabetSet}
                                       className="shrink-0 px-3 py-2 rounded-lg bg-accent text-bg text-sm font-bold hover:opacity-90 transition-opacity"
                                    >
                                       Add Set
                                    </button>
                                 </div>
                              </div>
                           </TooltipWrapper>
                        )}
                     </div>
                  )}

                  {activeTab === 'tags' && (
                     <div className="space-y-4">
                        {/* Add New Tag */}
                        <div className="p-4 bg-panel-2 rounded-xl border border-outline/50 space-y-4">
                           <h4 className="text-xs font-bold text-muted uppercase tracking-widest">Create New Tag</h4>
                           <div className="flex gap-2">
                              <input
                                 id="new-tag-name"
                                 placeholder="Tag Name"
                                 className="flex-1 bg-panel border border-outline rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none"
                                 onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                       const input = e.currentTarget;
                                       const name = input.value.trim();
                                       if (name) {
                                          const newTag: Tag = {
                                             id: generateId(),
                                             name,
                                             color: 'blue' // Default
                                          };
                                          if (tags.length < 99) {
                                             onUpdateTags([...tags, newTag]);
                                             input.value = '';
                                          } else {
                                             alert("You can only have 99 tags.");
                                          }
                                       }
                                    }
                                 }}
                              />
                              <button
                                 onClick={() => {
                                    const input = document.getElementById('new-tag-name') as HTMLInputElement;
                                    const name = input.value.trim();
                                    if (name) {
                                       const newTag: Tag = {
                                          id: generateId(),
                                          name,
                                          color: 'blue' // Default
                                       };
                                       if (tags.length < 99) {
                                          onUpdateTags([...tags, newTag]);
                                          input.value = '';
                                       } else {
                                          alert("You can only have 99 tags.");
                                       }
                                    }
                                 }}
                                 className="px-4 py-2 bg-accent text-bg rounded-lg font-bold text-sm hover:bg-accent/90 transition-colors"
                              >
                                 Add
                              </button>
                           </div>
                        </div>

                        {/* List of Tags */}
                        <div className="space-y-2">
                           {tags.map(tag => {
                              // Color map for preset colors (Tailwind 500 shades)
                              const COLOR_MAP: Record<string, string> = {
                                 red: '#ef4444',
                                 orange: '#f97316',
                                 amber: '#f59e0b',
                                 yellow: '#eab308',
                                 lime: '#84cc16',
                                 green: '#22c55e',
                                 emerald: '#10b981',
                                 teal: '#14b8a6',
                                 cyan: '#06b6d4',
                                 sky: '#0ea5e9',
                                 blue: '#3b82f6',
                                 indigo: '#6366f1',
                                 violet: '#8b5cf6',
                                 purple: '#a855f7',
                                 fuchsia: '#d946ef',
                                 pink: '#ec4899',
                                 rose: '#f43f5e',
                                 slate: '#64748b',
                                 gray: '#6b7280',
                                 zinc: '#71717a',
                                 neutral: '#737373',
                                 stone: '#78716c',
                              };
                              const getTagColor = (color: string) => color.startsWith('#') ? color : (COLOR_MAP[color] || '#3b82f6');

                              return (
                                 <div key={tag.id} className="flex items-center gap-3 p-3 bg-panel-2 rounded-xl border border-outline group">
                                    {/* Color Picker */}
                                    <div className="relative group/color">
                                       <div
                                          className="w-6 h-6 rounded-full cursor-pointer border border-outline"
                                          style={{ backgroundColor: getTagColor(tag.color) }}
                                       />
                                       {/* Color Popover */}
                                       {/* Color Popover */}
                                       <div className="absolute top-full left-0 pt-4 z-20 hidden group-hover/color:block w-56">
                                          <div className="p-3 bg-panel border border-outline rounded-xl shadow-xl">
                                             <div className="grid grid-cols-6 gap-2 mb-3">
                                                {TAG_COLORS.map(c => (
                                                   <button
                                                      key={c}
                                                      onClick={() => onUpdateTags(tags.map(t => t.id === tag.id ? { ...t, color: c } : t))}
                                                      className={`w-6 h-6 rounded-full hover:scale-110 transition-transform ${tag.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-panel' : ''}`}
                                                      style={{ backgroundColor: COLOR_MAP[c] }}
                                                      title={c}
                                                   />
                                                ))}
                                             </div>
                                             {/* Custom Color */}
                                             <div className="pt-2 border-t border-outline flex items-center gap-2">
                                                <label className="text-xs font-bold text-muted uppercase shrink-0">Custom</label>
                                                <div className="relative flex-1 h-8">
                                                   <input
                                                      type="color"
                                                      value={tag.color.startsWith('#') ? tag.color : '#3b82f6'}
                                                      onChange={(e) => onUpdateTags(tags.map(t => t.id === tag.id ? { ...t, color: e.target.value } : t))}
                                                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                                                   />
                                                   <div
                                                      className="w-full h-full rounded-lg border border-outline flex items-center justify-center text-[10px] font-mono"
                                                      style={{
                                                         backgroundColor: tag.color.startsWith('#') ? tag.color : '#1a1a1a',
                                                         color: tag.color.startsWith('#') ? '#fff' : '#666'
                                                      }}
                                                   >
                                                      {tag.color.startsWith('#') ? tag.color : 'Pick...'}
                                                   </div>
                                                </div>
                                             </div>
                                          </div>
                                       </div>
                                    </div>

                                    <input
                                       value={tag.name}
                                       onChange={(e) => onUpdateTags(tags.map(t => t.id === tag.id ? { ...t, name: e.target.value } : t))}
                                       className="flex-1 bg-transparent border border-transparent rounded px-2 hover:border-outline focus:border-accent focus:bg-panel focus:outline-none font-medium text-text transition-all"
                                       placeholder="Tag Name"
                                    />

                                    <button
                                       onClick={() => {
                                          if (deleteConfirmTagId === tag.id) {
                                             onUpdateTags(tags.filter(t => t.id !== tag.id));
                                             setDeleteConfirmTagId(null);
                                          } else {
                                             setDeleteConfirmTagId(tag.id);
                                             setTimeout(() => setDeleteConfirmTagId(null), 3000);
                                          }
                                       }}
                                       className={clsx(
                                          "p-2 rounded-lg transition-all flex items-center justify-center",
                                          deleteConfirmTagId === tag.id
                                             ? "bg-red text-bg w-16 opacity-100" // Visible and red when confirming
                                             : "text-muted hover:text-red hover:bg-red/10 opacity-0 group-hover:opacity-100" // Hidden otherwise
                                       )}
                                       title="Delete Tag"
                                    >
                                       {deleteConfirmTagId === tag.id ? (
                                          <span className="text-[10px] font-bold uppercase">Sure?</span>
                                       ) : (
                                          <Trash2 size={16} />
                                       )}
                                    </button>
                                 </div>
                              );
                           })}
                           {tags.length === 0 && (
                              <div className="text-center py-8 text-muted italic">
                                 No tags created yet.
                              </div>
                           )}
                        </div>
                     </div>
                  )}

                  {activeTab === 'global' && (
                     <div className="space-y-4">
                        {/* Hide Helper Tooltips - Always shows its own tooltip */}
                        <SettingRow id="hideTooltips" label="Hide Helper Tooltips" settingKey="hideTooltips" alwaysShowTooltip settings={settings} tooltips={tooltips} onUpdate={onUpdate} />

                        {/* Dark Mode */}
                        <SettingRow id="darkMode" label="Dark Mode" settingKey="darkMode" settings={settings} tooltips={tooltips} onUpdate={onUpdate} />

                        <div className="p-4 bg-green/5 rounded-xl border border-green/20 hover:border-green/40 transition-all">
                           <span className="font-medium text-green block mb-3 flex items-center gap-2">
                              <BookOpen size={18} /> Onboarding Tour
                           </span>
                           <p className="text-sm text-muted mb-3">
                              Walk through creating and studying a set with highlighted in-app directions.
                           </p>
                           <button
                              onClick={onStartOnboarding}
                              className="w-full flex items-center justify-center gap-2 py-2 text-green border border-green/30 rounded-lg font-bold hover:bg-green/20 transition-colors text-sm"
                           >
                              Start Guided Tour
                           </button>
                        </div>



                        {/* Export Data Box */}
                        <div className="p-4 bg-blue/5 rounded-xl border border-blue/20 hover:border-blue/40 transition-all">
                           <span className="font-medium text-blue block mb-3 flex items-center gap-2">
                              <Download size={18} /> Export Data
                           </span>
                           <div className="space-y-2">
                              <button
                                 onClick={onExportData}
                                 className="w-full flex items-center justify-center gap-2 py-2 text-blue border border-blue/30 rounded-lg font-bold hover:bg-blue/20 transition-colors text-sm"
                              >
                                 Export All My Data (JSON)
                              </button>
                              <button
                                 onClick={() => backupImportInputRef.current?.click()}
                                 disabled={isImportingBackup}
                                 className={clsx(
                                    "w-full flex items-center justify-center gap-2 py-2 border rounded-lg font-bold transition-colors text-sm",
                                    isImportingBackup
                                       ? "text-muted border-outline cursor-wait"
                                       : "text-blue border-blue/30 hover:bg-blue/20"
                                 )}
                              >
                                 {isImportingBackup ? (
                                    <>
                                       <Loader2 size={15} className="animate-spin" />
                                       Restoring Backup...
                                    </>
                                 ) : (
                                    <>
                                       <Upload size={15} />
                                       Restore Backup (JSON)
                                    </>
                                 )}
                              </button>
                              <input
                                 ref={backupImportInputRef}
                                 type="file"
                                 accept=".json,application/json"
                                 className="hidden"
                                 onChange={(e) => {
                                    const file = e.target.files?.[0] || null;
                                    void handleImportBackupFile(file);
                                 }}
                              />
                           </div>
                        </div>

                        {/* Danger Zone */}
                        <div className="p-4 bg-red/5 rounded-xl border border-red/20 hover:border-red/40 transition-all">
                           <span className="font-medium text-red block mb-3 flex items-center gap-2">
                              <Trash2 size={18} /> Danger Zone
                           </span>
                           {!showDeleteConfirm ? (
                              <button
                                 onClick={() => setShowDeleteConfirm(true)}
                                 className="w-full flex items-center justify-center gap-2 py-2 text-red border border-red/30 rounded-lg font-bold hover:bg-red/20 transition-colors text-sm"
                              >
                                 Delete All My Data
                              </button>
                           ) : (
                              <div className="space-y-3">
                                 <p className="text-sm text-muted">
                                    This will permanently delete all your flashcard sets, folders, and settings from both this device and the cloud. This action cannot be undone.
                                 </p>
                                 <div className="flex gap-2">
                                    <button
                                       onClick={() => setShowDeleteConfirm(false)}
                                       className="flex-1 py-2 text-muted border border-outline rounded-lg font-bold hover:bg-panel-2 transition-colors text-sm"
                                    >
                                       Cancel
                                    </button>
                                    <button
                                       onClick={() => {
                                          onDeleteData();
                                          setShowDeleteConfirm(false);
                                       }}
                                       className="flex-1 py-2 bg-red text-white rounded-lg font-bold hover:bg-red/90 transition-colors text-sm"
                                    >
                                       Yes, Delete Everything
                                    </button>
                                 </div>
                              </div>
                           )}
                        </div>
                     </div>
                  )}

                  {activeTab === 'you' && (
                     <div className="space-y-6">
                        {user ? (
                           <>
                              <ProfileCard
                                 user={user}
                                 lifetimeCorrect={lifetimeCorrect}
                                 librarySets={librarySets}
                                 className="shadow-sm"
                              />

                              {/* Logout Section */}
                              <div className="p-4 bg-panel-2 rounded-xl border border-outline/50">
                                 <h3 className="text-sm font-bold text-muted uppercase tracking-widest mb-3">Account Actions</h3>
                                 <button
                                    onClick={onLogout}
                                    className="w-full py-3 border-2 border-outline rounded-xl text-sm font-bold hover:bg-red/5 hover:text-red hover:border-red/30 transition-all shadow-sm flex items-center justify-center gap-2"
                                 >
                                    Sign Out
                                 </button>
                              </div>

                              {/* Reset Settings Section */}
                              <div className="p-4 bg-yellow/5 rounded-xl border border-yellow/20 hover:border-yellow/40 transition-all">
                                 <span className="font-medium text-yellow block mb-3 flex items-center gap-2">
                                    <RotateCcw size={18} /> Reset Settings
                                 </span>
                                 {!showResetConfirm ? (
                                    <button
                                       onClick={() => setShowResetConfirm(true)}
                                       className="w-full flex items-center justify-center gap-2 py-2 text-yellow border border-yellow/30 rounded-lg font-bold hover:bg-yellow/20 transition-colors text-sm"
                                    >
                                       Reset All Settings to Default
                                    </button>
                                 ) : (
                                    <div className="space-y-3">
                                       <p className="text-sm text-text">
                                          This will reset all your settings to their default values. Your flashcard sets will not be affected.
                                       </p>
                                       <div className="flex gap-2">
                                          <button
                                             onClick={() => setShowResetConfirm(false)}
                                             className="flex-1 py-2 text-muted border border-outline rounded-lg font-bold hover:bg-panel-2 transition-colors text-sm"
                                          >
                                             Cancel
                                          </button>
                                          <button
                                             onClick={() => {
                                                onResetSettings();
                                                setShowResetConfirm(false);
                                             }}
                                             className="flex-1 py-2 bg-yellow text-bg rounded-lg font-bold hover:bg-yellow/90 transition-colors text-sm"
                                          >
                                             Yes, Reset Settings
                                          </button>
                                       </div>
                                    </div>
                                 )}
                              </div>
                           </>
                        ) : (
                           <SignInCard onLogin={onLogin} onOpenPrivacy={onOpenPrivacy} />
                        )}
                     </div>
                  )}
               </div>
            </div>


         </div>
      </div >
   );
};


const App: React.FC = () => {
   const [incomingShareId, setIncomingShareId] = useState<string | null>(
      () => new URLSearchParams(window.location.search).get('share')
   );
   const [gameState, setGameState] = useState<GameState>(GameState.MENU);
   const [previousGameState, setPreviousGameState] = useState<GameState>(GameState.MENU);

   const [user, setUser] = useState<GoogleDriveUser | null>(null);
   const [librarySets, setLibrarySets] = useState<CardSet[]>([]);
   const latestLibrarySetsRef = useRef<CardSet[]>([]);
   const [isLibraryLoaded, setIsLibraryLoaded] = useState(false);
   const [folders, setFolders] = useState<Folder[]>([]);
   const [tags, setTags] = useState<Tag[]>([]);
   const [activeSetId, setActiveSetId] = useState<string | null>(null);
   const [completedSession, setCompletedSession] = useState<CardSet | null>(null);
   const [menuHomeClickNonce, setMenuHomeClickNonce] = useState(0);

   const effectiveLibrarySets = React.useMemo(() => {
      return librarySets.map(set => set.isMultistudy ? syncMultistudySet(set, librarySets) : set);
   }, [librarySets]);

   const activeSession = effectiveLibrarySets.find(s => s.id === activeSetId) || null;
   const winSession = completedSession ?? activeSession;
   const [isHomeScreenActive, setIsHomeScreenActive] = useState(true);
   const shouldHighlightSignIn = !user && gameState === GameState.MENU && isHomeScreenActive;

   const [settings, setSettings] = useState<Settings>({
      forgiveSpellingErrors: true,
      ignoreDiacritics: false,
      ignoreCapitalization: true,
      forgiveThe: false,
      wiggleRoom: 1,
      retypeOnMistake: false,
      reduceStreakMotion: false,
      darkMode: true,
      starredOnly: false,
      mode: 'standard',
      answerWithDefinition: false,
      hideTooltips: false,
      shuffleCards: true,
      brutalMode: false,
      autoCloseImageWindow: false,
      tabSelectsEverythingInBuilder: false
   });

   // Modals
   const [isSettingsOpen, setIsSettingsOpen] = useState(false);
   const [isOnboardingTourOpen, setIsOnboardingTourOpen] = useState(false);
   const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(() => {
      return localStorage.getItem(ONBOARDING_TOUR_COMPLETED_KEY) === 'true';
   });
   const [settingsInitialTab, setSettingsInitialTab] = useState<'set' | 'global' | 'you' | 'tags'>('set');
   const [isUserModalOpen, setIsUserModalOpen] = useState(false);

   const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
   const [isTermsOpen, setIsTermsOpen] = useState(false);
   const [isKeybindsModalOpen, setIsKeybindsModalOpen] = useState(false);
   const [appToast, setAppToast] = useState<AppToast | null>(null);

   const [uiAuditRequest, setUiAuditRequest] = useState<UiAuditRequest | null>(null);
   const [uiAuditToastReports, setUiAuditToastReports] = useState<CorruptionReport[]>([]);
   const [uiAuditPopupReports, setUiAuditPopupReports] = useState<CorruptionReport[]>([]);
   const [uiAuditCorruptionPopupOpen, setUiAuditCorruptionPopupOpen] = useState(false);

   useEffect(() => {
      const handleKeybindsShortcut = (e: KeyboardEvent) => {
         const isModifier = e.metaKey || e.ctrlKey;
         const isQuestionKey = e.key === '?' || e.key === '/' || e.code === 'Slash';
         if (isModifier && isQuestionKey) {
            e.preventDefault();
            setIsKeybindsModalOpen(true);
         }
      };

      window.addEventListener('keydown', handleKeybindsShortcut, true);
      return () => window.removeEventListener('keydown', handleKeybindsShortcut, true);
   }, []);

   useEffect(() => {
      if (!appToast) return;

      const timer = window.setTimeout(() => {
         setAppToast(current => current?.id === appToast.id ? null : current);
      }, 3200);

      return () => window.clearTimeout(timer);
   }, [appToast]);

   // Set Detail View
   const [detailSetId, setDetailSetId] = useState<string | null>(null);
   const detailSet = effectiveLibrarySets.find(s => s.id === detailSetId) || null;

   // Edit Request (from SetDetail to StartMenu)
   const [editRequestSetId, setEditRequestSetId] = useState<string | null>(null);

   // New states for filtering/display
   const [showYear, setShowYear] = useState(true);
   const [enableTermCards, setEnableTermCards] = useState(false);
   const [appliedTags, setAppliedTags] = useState<string[]>([]);

   // Import options
   const [importAppend, setImportAppend] = useState(false);
   const [importOverride, setImportOverride] = useState<'keep' | 'duplicate' | 'override'>('keep');

   // Timer State
   const [timerStart, setTimerStart] = useState<number>(0);
   const [timerNow, setTimerNow] = useState<number>(0);
   const [isTimerPaused, setIsTimerPaused] = useState(false);
   const [isGameActive, setIsGameActive] = useState(false); // New state to hold timer until mode selection
   const [lastPauseTime, setLastPauseTime] = useState(0);

   // Renaming State
   const [isRenaming, setIsRenaming] = useState(false);

   // Stats
   const [lifetimeCorrect, setLifetimeCorrect] = useState(0);

   // Corruption Reports (from V2 storage)
   const [corruptionReports, setCorruptionReports] = useState<CorruptionReport[]>([]);

   // Cloud sync status: 'idle' | 'saving' | 'saved' | 'saved_faded' | 'error'
   const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'saved_faded' | 'error'>('idle');
   const [cloudConflicts, setCloudConflicts] = useState<CloudConflictDetail[]>([]);
   const [isConflictDetailsOpen, setIsConflictDetailsOpen] = useState(false);
   const [conflictResolutionAction, setConflictResolutionAction] = useState<'idle' | 'keeping' | 'overwriting'>('idle');
   const cloudSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
   const cloudSaveInFlightRef = useRef(false);
   const hasPendingLocalLibraryChangesRef = useRef(false);
   const pendingLibrarySaveRef = useRef<{
      sets: CardSet[];
      folders: Folder[];
      ignoreConflicts?: boolean;
      skipCloud?: boolean;
   } | null>(null);

   // V3: Per-set dirty tracking
   const dirtySetIdsRef = useRef<Set<string>>(new Set());
   const structureChangedRef = useRef(false);
   const saveDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

   // Cloud loading state (pulling sets from Drive)
   const [isCloudLoading, setIsCloudLoading] = useState(false);
   const syncInProgressRef = useRef(false);
   const hasSyncedOnceRef = useRef(false);
   const latestCloudConflictsRef = useRef<CloudConflictDetail[]>([]);

   useEffect(() => {
      latestCloudConflictsRef.current = cloudConflicts;
   }, [cloudConflicts]);

   const waitForBackgroundSyncIdle = async () => {
      while (cloudSaveInFlightRef.current || syncInProgressRef.current) {
         await new Promise(resolve => setTimeout(resolve, 50));
      }
   };

   const flushPendingLibrarySave = async () => {
      if (cloudSaveInFlightRef.current) return;
      const payload = pendingLibrarySaveRef.current;
      if (!payload) return;

      pendingLibrarySaveRef.current = null;
      cloudSaveInFlightRef.current = true;
      const syncLocked = syncInProgressRef.current || isCloudLoading;
      const skipCloudWrite = Boolean(
         payload.skipCloud ||
         syncLocked ||
         (user && !hasSyncedOnceRef.current && !payload.ignoreConflicts)
      );

      if (user && !skipCloudWrite) setCloudSyncStatus('saving');

      try {
         // V3: Use dirty-set save for targeted writes, fall back to full save for ignoreConflicts (overwrite)
         let result: { success: boolean; savedToCloud: boolean; savedSetIds?: string[]; error?: string; conflicts?: string[]; conflictDetails?: CloudConflictDetail[] };

         if (payload.ignoreConflicts) {
            // Full save path - used for conflict overwrite resolution
            result = await saveLibrary(payload.sets, {
               ignoreConflicts: true,
               folders: payload.folders,
               skipCloud: skipCloudWrite
            });
         } else {
            // V3 targeted save - only write dirty sets
            const dirtyIds = new Set(dirtySetIdsRef.current);
            const shouldWriteStructure = structureChangedRef.current;

            result = await saveDirtySets(payload.sets, dirtyIds, {
               ignoreConflicts: false,
               folders: payload.folders,
               skipCloud: skipCloudWrite,
               structureChanged: shouldWriteStructure
            });

            // Clear the dirty sets that were successfully saved
            if (result.savedSetIds) {
               for (const id of result.savedSetIds) {
                  dirtySetIdsRef.current.delete(id);
               }
            }
            if (shouldWriteStructure && result.savedToCloud) {
               structureChangedRef.current = false;
            }
         }

         if (result.conflicts && result.conflicts.length > 0 && !payload.ignoreConflicts) {
            setCloudConflicts(result.conflictDetails || result.conflicts.map((setName, idx) => ({
               setId: `unknown-${idx}`,
               setName,
               localCardCount: 0,
               cloudCardCount: 0,
               cardsAddedLocally: 0,
               cardsDeletedLocally: 0,
               cardsEditedLocally: 0,
               addedCardLabels: [],
               deletedCardLabels: [],
               editedCardLabels: []
            })));
            setIsConflictDetailsOpen(true);
            setCloudSyncStatus('error');
            if (cloudSyncTimeoutRef.current) clearTimeout(cloudSyncTimeoutRef.current);
            return;
         }

         if (result.savedToCloud) {
            setCloudConflicts([]);
            setIsConflictDetailsOpen(false);
            setCloudSyncStatus('saved');
            if (cloudSyncTimeoutRef.current) clearTimeout(cloudSyncTimeoutRef.current);
            cloudSyncTimeoutRef.current = setTimeout(() => setCloudSyncStatus('saved_faded'), 3000);
         } else if (skipCloudWrite) {
            setCloudSyncStatus('idle');
         } else if (result.error) {
            setCloudSyncStatus('error');
            if (cloudSyncTimeoutRef.current) clearTimeout(cloudSyncTimeoutRef.current);
            cloudSyncTimeoutRef.current = setTimeout(() => setCloudSyncStatus('idle'), 5000);
         } else {
            setCloudConflicts([]);
            setIsConflictDetailsOpen(false);
            setCloudSyncStatus('idle');
         }
      } finally {
         cloudSaveInFlightRef.current = false;
         if (pendingLibrarySaveRef.current) {
            void flushPendingLibrarySave();
         } else {
            hasPendingLocalLibraryChangesRef.current = false;
         }
      }
   };

   const cloneSetsForSave = (setsSnapshot: CardSet[]): CardSet[] => {
      const sc = (globalThis as any).structuredClone;
      if (typeof sc === 'function') {
         return sc(setsSnapshot) as CardSet[];
      }
      return JSON.parse(JSON.stringify(setsSnapshot)) as CardSet[];
   };

   /**
    * V3: Mark specific sets as dirty so they get saved to cloud on next flush.
    */
   const markSetDirty = (setId: string) => {
      dirtySetIdsRef.current.add(setId);
   };

   /**
    * V3: Mark all sets dirty (used for full overwrite scenarios).
    */
   const markAllSetsDirty = (sets: CardSet[]) => {
      for (const s of sets) {
         dirtySetIdsRef.current.add(s.id);
      }
   };

   const queueLibrarySave = (
      setsSnapshot: CardSet[],
      foldersSnapshot: Folder[],
      options?: { ignoreConflicts?: boolean; skipCloud?: boolean; changedSetIds?: string[] }
   ) => {
      hasPendingLocalLibraryChangesRef.current = true;

      // V3: If specific set IDs are provided, only mark those dirty
      if (options?.changedSetIds) {
         for (const id of options.changedSetIds) {
            dirtySetIdsRef.current.add(id);
         }
      }

      pendingLibrarySaveRef.current = {
         sets: cloneSetsForSave(setsSnapshot),
         folders: foldersSnapshot.map(folder => ({ ...folder, setIds: [...folder.setIds] })),
         ignoreConflicts: options?.ignoreConflicts,
         skipCloud: options?.skipCloud
      };
      void flushPendingLibrarySave();
   };

   // --- AUTH & CLOUD SYNC ---

   const syncCloudData = async () => {
      // Prevent re-entrant / concurrent calls
      if (syncInProgressRef.current) {
         console.log('[Sync] Already in progress, skipping');
         return;
      }
      syncInProgressRef.current = true;
      setIsCloudLoading(true);
      try {
         const data = await loadAllUserData();
         if (!data) {
            return;
         }

         console.log("[Sync] Starting smart merge with cloud data...");

         // 1. SMART MERGE LIBRARY SETS
         if (data.library_sets && data.library_sets.length > 0) {
            const cloudSets = data.library_sets.map((s: CardSet) => normalizeLoadedSet(s));

            setLibrarySets(prevLocalSets => {
               const merged = [...prevLocalSets];

               cloudSets.forEach(cloudSet => {
                  const localIndex = merged.findIndex(s => s.id === cloudSet.id);
                  if (localIndex === -1) {
                     // Set only exists in cloud, add it
                     merged.push(cloudSet);
                  } else {
                     // Set exists in both: merge cards with no-loss strategy.
                     const localSet = merged[localIndex];
                     merged[localIndex] = mergeSetWithoutLosingCards(localSet, cloudSet);
                  }
               });

               // V3: Rebuild the snapshot so auto-save doesn't see merged sets as dirty.
               // The merge result IS the correct state - no need to re-upload to cloud.
               const freshSnapshot = new Map<string, string>();
               for (const s of merged) {
                  freshSnapshot.set(s.id, JSON.stringify(s));
               }
               prevLibrarySnapshotRef.current = freshSnapshot;

               return merged;
            });
         }

         // 2. MERGE FOLDERS
         if (data.folders && data.folders.length > 0) {
            setFolders(prev => {
               const merged = [...prev];
               data.folders!.forEach(cf => {
                  if (!merged.some(lf => lf.id === cf.id)) merged.push(cf);
               });
               return merged;
            });
         }

         // 3. MERGE TAGS
         if (data.tags && data.tags.length > 0) {
            setTags(prev => {
               const merged = [...prev];
               data.tags!.forEach(ct => {
                  if (!merged.some(lt => lt.id === ct.id)) merged.push(ct);
               });
               return merged;
            });
         }

         // 4. MERGE SETTINGS
         if (data.settings && Object.keys(data.settings).length > 0) {
            setSettings(prev => ({ ...prev, ...data.settings }));
         }

         // 5. CORRUPTION REPORTS
         if (data.corruptions && data.corruptions.length > 0) {
            setCorruptionReports(data.corruptions);
         }

         console.log("[Sync] Smart merge complete");
         hasSyncedOnceRef.current = true;
      } finally {
         syncInProgressRef.current = false;
         setIsCloudLoading(false);
      }
   };

   const handleKeepCloudVersion = async () => {
      if (!user) return;
      if (conflictResolutionAction !== 'idle') return;

      const conflictsToResolve = latestCloudConflictsRef.current;
      if (conflictsToResolve.length === 0) return;

      setConflictResolutionAction('keeping');
      pendingLibrarySaveRef.current = null;
      await waitForBackgroundSyncIdle();

      try {
         setCloudSyncStatus('saving');
         const conflictIds = new Set(conflictsToResolve.map(conflict => conflict.setId));
         const cloudById = new Map<string, CardSet>();

         const { structure } = await readStructure(true);
         const cloudFolderBySetId = new Map<string, string | undefined>();
         structure.rootSets.forEach(setId => cloudFolderBySetId.set(setId, undefined));
         structure.folders.forEach(folder => {
            folder.setIds.forEach(setId => cloudFolderBySetId.set(setId, folder.id));
         });

         for (const conflictId of conflictIds) {
            const { set } = await readFlashcardSet(conflictId, true);
            if (!set) continue;
            const normalized = normalizeLoadedSet({
               ...set,
               folderId: cloudFolderBySetId.get(conflictId)
            });
            cloudById.set(conflictId, normalized);
         }

         setLibrarySets(prev => {
            const resolved = prev.map(localSet => {
               if (!conflictIds.has(localSet.id)) return localSet;
               return cloudById.get(localSet.id) ?? localSet;
            });

            // V3: Rebuild snapshot so cloud-sourced data isn't re-uploaded
            const freshSnapshot = new Map<string, string>();
            for (const s of resolved) {
               freshSnapshot.set(s.id, JSON.stringify(s));
            }
            prevLibrarySnapshotRef.current = freshSnapshot;

            return resolved;
         });

         setFolders(structure.folders);

         setCloudConflicts([]);
         setIsConflictDetailsOpen(false);
         setCloudSyncStatus('saved');
         if (cloudSyncTimeoutRef.current) clearTimeout(cloudSyncTimeoutRef.current);
         cloudSyncTimeoutRef.current = setTimeout(() => setCloudSyncStatus('saved_faded'), 3000);
      } finally {
         setConflictResolutionAction('idle');
      }
   };

   const handleOverwriteCloudVersion = async () => {
      if (!user) return;
      if (conflictResolutionAction !== 'idle') return;

      setConflictResolutionAction('overwriting');
      pendingLibrarySaveRef.current = null;
      await waitForBackgroundSyncIdle();

      try {
         setCloudSyncStatus('saving');
         const result = await saveLibrary(librarySets, { ignoreConflicts: true, folders });
         if (result.savedToCloud) {
            setCloudConflicts([]);
            setIsConflictDetailsOpen(false);
            setCloudSyncStatus('saved');
            if (cloudSyncTimeoutRef.current) clearTimeout(cloudSyncTimeoutRef.current);
            cloudSyncTimeoutRef.current = setTimeout(() => setCloudSyncStatus('saved_faded'), 3000);
         } else {
            setCloudSyncStatus('error');
         }
      } finally {
         setConflictResolutionAction('idle');
      }
   };

   const handleLogin = async (keepSignedIn: boolean = true) => {
      try {
         await googleDrive.signIn(keepSignedIn);
      } catch (error) {
         console.error('Failed to sign in:', error);
         alert('Failed to sign in. Please try again.');
      }
   };

   const handleManualCloudSync = async () => {
      if (!user) return;
      if (syncInProgressRef.current || cloudSaveInFlightRef.current || conflictResolutionAction !== 'idle') {
         return;
      }

      if (saveDebounceTimerRef.current && dirtySetIdsRef.current.size > 0) {
         clearTimeout(saveDebounceTimerRef.current);
         saveDebounceTimerRef.current = null;
         queueLibrarySave(latestLibrarySetsRef.current, folders, {
            skipCloud: false,
            changedSetIds: Array.from(dirtySetIdsRef.current)
         });
      }

      await waitForBackgroundSyncIdle();
      await syncCloudData();
   };

   const handleLogout = async () => {
      await googleDrive.signOut();
      setUser(null);
      setCloudConflicts([]);
      setIsConflictDetailsOpen(false);
      window.location.reload();
   };

   // --- IMAGE UPLOAD HELPERS ---

   // Compress and resize image before upload
   const compressImage = (file: File): Promise<Blob> => {
      return new Promise((resolve, reject) => {
         const img = new Image();
         const url = URL.createObjectURL(file);

         img.onload = () => {
            URL.revokeObjectURL(url);

            const MAX_WIDTH = 1280;
            const QUALITY = 0.7;

            let width = img.width;
            let height = img.height;

            // Scale down if wider than MAX_WIDTH
            if (width > MAX_WIDTH) {
               height = (height * MAX_WIDTH) / width;
               width = MAX_WIDTH;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
               reject(new Error('Could not get canvas context'));
               return;
            }

            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(
               (blob) => {
                  if (blob) {
                     resolve(blob);
                  } else {
                     reject(new Error('Failed to compress image'));
                  }
               },
               'image/jpeg',
               QUALITY
            );
         };

         img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image'));
         };

         img.src = url;
      });
   };

   // Upload image to Google Drive and return file ID
   const handleImageUpload = async (file: File): Promise<string> => {
      if (!user) {
         throw new Error('You must be logged in to upload images');
      }

      // Compress the image
      const compressedBlob = await compressImage(file);

      // Get the app folder ID
      const folderId = localStorage.getItem('flashcardsish-drive-folder-id');
      if (!folderId) {
         throw new Error('Drive folder not initialized');
      }

      // Generate unique filename: timestamp.jpg
      const timestamp = Date.now();
      const filename = `${timestamp}.jpg`;

      // Upload to Google Drive and get file ID
      const fileId = await googleDrive.uploadImage(folderId, compressedBlob, filename);

      return fileId; // Return the Drive file ID instead of URL
   };

   const handleDeleteData = async () => {
      const result = await deleteAllUserData();
      if (result.success) {
         // Sign out and reload
         await googleDrive.signOut();
         setUser(null);
         window.location.reload();
      } else {
         alert('Failed to delete data: ' + (result.error || 'Unknown error'));
      }
   };

   const handleImportData = async (file: File): Promise<void> => {
      const shouldReplace = window.confirm(
         'Restore this backup and replace your current local data? This will overwrite sets, folders, tags, settings, and stats on this device.'
      );
      if (!shouldReplace) return;

      try {
         const content = await file.text();
         const parsed = parseExportData(content);

         const importedSets = Array.isArray(parsed.librarySets)
            ? parsed.librarySets.map(set => normalizeLoadedSet(set))
            : [];
         const importedFolders = Array.isArray(parsed.folders) ? parsed.folders : [];
         const importedTags = Array.isArray(parsed.tags) ? parsed.tags : [];
         const importedSettings = parsed.settings ? { ...DEFAULT_SETTINGS, ...parsed.settings } : { ...DEFAULT_SETTINGS };
         const importedStats = typeof parsed.stats?.lifetimeCorrect === 'number'
            ? parsed.stats.lifetimeCorrect
            : 0;

         setLibrarySets(importedSets);
         setFolders(importedFolders);
         setTags(importedTags);
         setSettings(importedSettings);
         setLifetimeCorrect(importedStats);
         setCloudConflicts([]);
         setIsConflictDetailsOpen(false);
         setGameState(GameState.MENU);
         setDetailSetId(null);
         setActiveSetId(null);

         alert(`Backup restored: ${importedSets.length} set${importedSets.length === 1 ? '' : 's'} imported.`);
      } catch (error) {
         const message = error instanceof Error ? error.message : 'Unknown backup import failure.';
         alert(`Could not restore backup: ${message}`);
         throw error;
      }
   };

   const handleExportData = () => {
      const exportData = {
         exportedAt: new Date().toISOString(),
         version: 'flashcardsish-export-v1',
         librarySets: librarySets,
         folders: folders,
         tags: tags,
         settings: settings,
         stats: { lifetimeCorrect }
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `flashcardsish-export-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
   };

   // Listen for Auth Changes and Initialize Google Drive
   useEffect(() => {
      const initializeAuth = async () => {
         try {
            await googleDrive.init();
            const currentUser = await googleDrive.getSession();
            setUser(currentUser);
         } catch (error) {
            console.error('Failed to initialize Google Drive:', error);
         }
      };

      initializeAuth();

      // Listen for sign-in state changes (e.g. user signs in via popup)
      const unsubscribe = googleDrive.onAuthStateChange(async (newUser) => {
         if (newUser) {
            // Reset so sync triggers for this sign-in (handles sign-out → sign-in within same session)
            hasSyncedOnceRef.current = false;
         }
         setUser(newUser);
      });

      return () => unsubscribe();
   }, []);

   useEffect(() => {
      if (!user || !isLibraryLoaded || hasSyncedOnceRef.current) return;
      void syncCloudData();
   }, [user, isLibraryLoaded]);

   // Browser closing protection
   useEffect(() => {
      const writeLibraryLocalFallbackSnapshot = () => {
         if (!isLibraryLoaded) return;
         try {
            localStorage.setItem(LIBRARY_LOCAL_FALLBACK_KEY, JSON.stringify(latestLibrarySetsRef.current));
            localStorage.setItem(LIBRARY_LOCAL_FALLBACK_UPDATED_AT_KEY, String(Date.now()));
         } catch (error) {
            console.warn('[App] Failed to write local fallback snapshot during unload safety check:', error);
         }
      };

      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
         writeLibraryLocalFallbackSnapshot();

         // V3: If there's a debounced cloud save pending, flush it now
         if (saveDebounceTimerRef.current && dirtySetIdsRef.current.size > 0) {
            clearTimeout(saveDebounceTimerRef.current);
            saveDebounceTimerRef.current = null;
            // Queue the save immediately (it won't complete before unload, but the local fallback is safe)
            queueLibrarySave(latestLibrarySetsRef.current, folders, {
               skipCloud: false,
               changedSetIds: Array.from(dirtySetIdsRef.current)
            });
         }

         const hasPendingSave = (
            cloudSyncStatus === 'saving' ||
            cloudSaveInFlightRef.current ||
            pendingLibrarySaveRef.current !== null ||
            hasPendingLocalLibraryChangesRef.current ||
            dirtySetIdsRef.current.size > 0
         );

         if (hasPendingSave) {
            e.preventDefault();
            e.returnValue = '';
            return '';
         }
      };

      const handleVisibilityChange = () => {
         if (document.visibilityState === 'hidden') {
            writeLibraryLocalFallbackSnapshot();
         }
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      return () => {
         window.removeEventListener('beforeunload', handleBeforeUnload);
         document.removeEventListener('visibilitychange', handleVisibilityChange);
      };
   }, [cloudSyncStatus, isLibraryLoaded]);






   // Load Initial Data (Local Only - Cloud handled by Auth Effect)
   useEffect(() => {
      const loadData = async () => {
         try {
            console.log("[App] Starting initial data load...");

            const [
               loadedSets,
               loadedFoldersData,
               loadedSettingsData,
               loadedStatsData,
               loadedTagsData
            ] = await Promise.all([
               loadLibrary(),
               loadFolders(),
               loadSettings(),
               loadStats(),
               loadTags()
            ]);

            const setsToUse = Array.isArray(loadedSets) ? loadedSets : [];
            const sanitizedSets = setsToUse.map(s => normalizeLoadedSet(s));
            setLibrarySets(sanitizedSets);
            setFolders(Array.isArray(loadedFoldersData) ? loadedFoldersData : []);
            setTags(Array.isArray(loadedTagsData) ? loadedTagsData : []);
            setSettings(prev => ({ ...prev, ...loadedSettingsData }));
            setLifetimeCorrect(typeof loadedStatsData?.lifetimeCorrect === 'number' ? loadedStatsData.lifetimeCorrect : 0);

            if (sanitizedSets.length > 0) {
               console.log("[App] Loaded", sanitizedSets.length, "sets from storage");
            } else {
               console.warn("[App] No sets found in storage - starting with empty library");
            }

            console.log("[App] Initial data load complete.");
         } catch (error) {
            console.error("[App] CRITICAL ERROR during loadData:", error);
            console.error("[App] Stack:", error instanceof Error ? error.stack : 'No stack trace');
         } finally {
            // CRITICAL: Always mark as loaded, even if there was an error
            // Otherwise the storage system is permanently broken
            console.log("[App] Setting isLibraryLoaded = true");
            setIsLibraryLoaded(true);
         }
      };

      loadData();
   }, []);

   // Save Effects - WITH AGGRESSIVE PROTECTION AGAINST BOOT WIPES
   // CRITICAL: We need to ensure the save effects don't fire during initial load OR hot reloads
   const hasCompletedInitialLoad = useRef(false);
   const mountTime = useRef(Date.now());
   // V3: Snapshot of previous library state for dirty detection
   const prevLibrarySnapshotRef = useRef<Map<string, string>>(new Map());

   useEffect(() => {
      if (!isLibraryLoaded) return;

      const cloudWriteBlocked = Boolean(
         syncInProgressRef.current ||
         isCloudLoading ||
         (user && !hasSyncedOnceRef.current)
      );

      if (!hasCompletedInitialLoad.current) {
         hasCompletedInitialLoad.current = true;
         // V3: Build initial snapshot for dirty detection
         const snapshot = new Map<string, string>();
         for (const s of librarySets) {
            snapshot.set(s.id, JSON.stringify(s));
         }
         prevLibrarySnapshotRef.current = snapshot;
         console.log('[App] Initial load complete, library has', librarySets.length, 'sets. Auto-save is now enabled.');
         return;
      }

      // V3: Detect which sets actually changed
      const prevSnapshot = prevLibrarySnapshotRef.current;
      const changedSetIds: string[] = [];
      const newSnapshot = new Map<string, string>();
      let setsAdded = false;
      let setsRemoved = false;

      for (const s of librarySets) {
         const serialized = JSON.stringify(s);
         newSnapshot.set(s.id, serialized);
         const prev = prevSnapshot.get(s.id);
         if (prev !== serialized) {
            changedSetIds.push(s.id);
         }
         if (!prev) {
            setsAdded = true;
         }
      }

      // Check for removed sets
      for (const prevId of prevSnapshot.keys()) {
         if (!newSnapshot.has(prevId)) {
            setsRemoved = true;
            break;
         }
      }

      prevLibrarySnapshotRef.current = newSnapshot;

      // If sets were added or removed, mark structure as changed
      if (setsAdded || setsRemoved) {
         structureChangedRef.current = true;
      }

      if (changedSetIds.length === 0 && !setsAdded && !setsRemoved) {
         return; // Nothing actually changed, skip save entirely
      }

      hasPendingLocalLibraryChangesRef.current = true;

      // Keep track of changed sets even when Drive writes are temporarily blocked.
      // We flush these once cloud reconciliation finishes.
      for (const setId of changedSetIds) {
         dirtySetIdsRef.current.add(setId);
      }

      // V3: Debounce cloud saves (2s) but save locally immediately
      if (saveDebounceTimerRef.current) {
         clearTimeout(saveDebounceTimerRef.current);
      }

      console.log(`[App V3] ${changedSetIds.length} set(s) changed, debouncing cloud save...`);

      // Save locally right away
      const localOnlyPayload = {
         sets: cloneSetsForSave(librarySets),
         folders: folders.map(folder => ({ ...folder, setIds: [...folder.setIds] })),
         skipCloud: true
      };
      pendingLibrarySaveRef.current = localOnlyPayload;
      void flushPendingLibrarySave();

      // Debounce the cloud save
      if (!cloudWriteBlocked) {
         saveDebounceTimerRef.current = setTimeout(() => {
            console.log(`[App V3] Flushing ${changedSetIds.length} dirty set(s) to cloud`);
            queueLibrarySave(latestLibrarySetsRef.current, folders, {
               skipCloud: false,
               changedSetIds
            });
         }, 2000);
      }
   }, [librarySets, isLibraryLoaded, isCloudLoading, user]);

   useEffect(() => {
      if (!isLibraryLoaded || !user) return;

      const cloudWriteBlocked = Boolean(
         syncInProgressRef.current ||
         isCloudLoading ||
         !hasSyncedOnceRef.current
      );

      if (cloudWriteBlocked) return;

      if (dirtySetIdsRef.current.size === 0 && !structureChangedRef.current) {
         return;
      }

      if (cloudSaveInFlightRef.current) {
         return;
      }

      if (pendingLibrarySaveRef.current && !pendingLibrarySaveRef.current.skipCloud) {
         return;
      }

      console.log('[App V3] Resuming deferred cloud save after sync unlock');
      queueLibrarySave(latestLibrarySetsRef.current, folders, {
         skipCloud: false,
         changedSetIds: Array.from(dirtySetIdsRef.current)
      });
   }, [folders, isCloudLoading, isLibraryLoaded, user]);

   useEffect(() => {
      latestLibrarySetsRef.current = librarySets;
   }, [librarySets]);

   useEffect(() => {
      if (!isLibraryLoaded) return;
      try {
         localStorage.setItem(LIBRARY_LOCAL_FALLBACK_KEY, JSON.stringify(librarySets));
         localStorage.setItem(LIBRARY_LOCAL_FALLBACK_UPDATED_AT_KEY, String(Date.now()));
      } catch (error) {
         console.warn('[App] Failed to write local fallback library cache:', error);
      }
   }, [librarySets, isLibraryLoaded]);

   useEffect(() => {
      const timeSinceMount = Date.now() - mountTime.current;
      if (timeSinceMount < 3000) return;

      const cloudWriteBlocked = Boolean(
         syncInProgressRef.current ||
         isCloudLoading ||
         (user && !hasSyncedOnceRef.current)
      );

      if (isLibraryLoaded && hasCompletedInitialLoad.current) {
         console.log('[App] AUTO-SAVING folders');
         structureChangedRef.current = true;
         saveFolders(folders, { skipCloud: true });
         queueLibrarySave(latestLibrarySetsRef.current, folders, { skipCloud: cloudWriteBlocked });
      }
   }, [folders, isLibraryLoaded, isCloudLoading, user]);

   useEffect(() => {
      const timeSinceMount = Date.now() - mountTime.current;
      if (timeSinceMount < 3000) return;

      const skipCloud = Boolean(
         syncInProgressRef.current ||
         isCloudLoading ||
         (user && !hasSyncedOnceRef.current)
      );

      if (isLibraryLoaded && hasCompletedInitialLoad.current) {
         console.log('[App] AUTO-SAVING settings');
         saveSettings(settings, { skipCloud });
      }
   }, [settings, isLibraryLoaded, isCloudLoading, user]);

   useEffect(() => {
      const skipCloud = Boolean(
         syncInProgressRef.current ||
         isCloudLoading ||
         (user && !hasSyncedOnceRef.current)
      );
      saveStats({ lifetimeCorrect }, { skipCloud });
   }, [lifetimeCorrect, isCloudLoading, user]);

   useEffect(() => {
      console.log('App: settings.darkMode is now:', settings.darkMode);
      const isLight = !settings.darkMode;

      // Use documentElement (html) instead of body for more reliable theme switching
      if (isLight) {
         document.documentElement.classList.add('light-mode');
         document.body.classList.add('light-mode');
      } else {
         document.documentElement.classList.remove('light-mode');
         document.body.classList.remove('light-mode');
      }

      console.log('App: light-mode class on html:', document.documentElement.classList.contains('light-mode'));
      console.log('App: light-mode class on body:', document.body.classList.contains('light-mode'));
   }, [settings.darkMode]);

   const updateSettings = (newSettings: Settings) => {
      console.log('DEBUG: updateSettings called with darkMode:', newSettings.darkMode);
      setSettings(newSettings);
      // Saved via effect
   };

   // Reset isGameActive when game state changes
   useEffect(() => {
      if (gameState !== GameState.PLAYING && gameState !== GameState.FLASHCARDS) {
         setIsGameActive(false);
      }
      // For Flashcards mode, auto-start timer since there's no submode selection
      // For Learn mode (PLAYING), timer starts when user selects submode via onStartGame callback
      else if (gameState === GameState.FLASHCARDS) {
         setIsGameActive(true);
      }
   }, [gameState]);

   // Timer Logic
   useEffect(() => {
      let interval: number;
      // Only run timer if game is active (submode selected in Learn Mode, or standard mode)
      if (gameState === GameState.PLAYING && isGameActive && !isTimerPaused) {
         if (timerStart === 0) setTimerStart(Date.now());

         interval = window.setInterval(() => {
            setTimerNow(Date.now());
         }, 500);
      }
      return () => clearInterval(interval);
   }, [gameState, isGameActive, isTimerPaused, timerStart]);

   const toggleTimer = () => {
      if (isTimerPaused) {
         const pauseDuration = Date.now() - lastPauseTime;
         setTimerStart(prev => prev + pauseDuration);
         setIsTimerPaused(false);
      } else {
         setLastPauseTime(Date.now());
         setIsTimerPaused(true);
      }
   };

   // --- ACTIONS ---

   // Open Set Detail View
   const handleOpenSet = (set: CardSet) => {
      setDetailSetId(set.id);
      setGameState(GameState.SET_DETAIL);
   };

   // Go back from Set Detail to Menu
   const handleBackFromDetail = () => {
      setDetailSetId(null);
      setGameState(GameState.MENU);
   };

   // Start Learn mode from Set Detail
   const handleStartLearnFromDetail = () => {
      if (!detailSet) return;
      handleStartFromLibrary(detailSet);
   };

   // Start Flashcards mode from Set Detail
   const handleStartFlashcardsFromDetail = () => {
      if (!detailSet) return;
      setActiveSetId(detailSet.id);
      setGameState(GameState.FLASHCARDS);
   };

   const handleStartSRSFromDetail = () => {
      if (!detailSet) return;
      setActiveSetId(detailSet.id);
      setGameState(GameState.SRS);
   };

   const handleStartFromLibrary = (libSet: CardSet) => {
      // Sanitize and normalize before entering session flow.
      const sanitized = normalizeLoadedSet(libSet);
      const updatedSet = { ...sanitized, isSessionActive: true, lastPlayed: Date.now() };
      setCompletedSession(null);

      setLibrarySets(prev => {
         const exists = prev.some(s => s.id === libSet.id);
         if (exists) {
            return prev.map(s => s.id === libSet.id ? updatedSet : s);
         } else {
            return [updatedSet, ...prev];
         }
      });

      setActiveSetId(libSet.id);
      setTimerStart(Date.now());
      setTimerNow(Date.now());
      setIsTimerPaused(false);
      setGameState(GameState.PLAYING);
   };

   const handleResumeSession = (session: CardSet) => {
      // Sanitize and normalize before entering session flow.
      const sanitized = normalizeLoadedSet(session);
      const resumedSession = {
         ...sanitized,
         isSessionActive: true,
         lastPlayed: Date.now()
      };
      setCompletedSession(null);

      // Update in library with sanitized version
      setLibrarySets(prev => {
         const exists = prev.some(s => s.id === session.id);
         if (exists) {
            return prev.map(s => s.id === session.id ? resumedSession : s);
         }
         return [resumedSession, ...prev];
      });

      setActiveSetId(session.id);
      setTimerStart(Date.now());
      setTimerNow(Date.now());
      setIsTimerPaused(false);
      // Check session type and route accordingly
      if (session.srsSessionStats) {
         setGameState(GameState.SRS);
      } else if (session.flashcardsSessionStats) {
         setGameState(GameState.FLASHCARDS);
      } else {
         setGameState(GameState.PLAYING);
      }
   };

   const handleSaveToLibrary = (set: CardSet) => {
      const sanitized = normalizeLoadedSet(set);
      const existingIdx = librarySets.findIndex(s => s.id === sanitized.id);
      if (existingIdx !== -1) {
         setLibrarySets(prev => prev.map(s => s.id === sanitized.id ? sanitized : s));
      } else {
         setLibrarySets(prev => [sanitized, ...prev]);
      }
   };

   const handleUpdateLibrarySet = (updatedSet: CardSet) => {
      const sanitized = normalizeLoadedSet(updatedSet);
      setLibrarySets(prev => prev.map(s => s.id === sanitized.id ? sanitized : s));
   };

   const handleDeleteLibrarySet = (id: string) => {
      setLibrarySets(prev => prev.filter(s => s.id !== id));
   };

   const handleDeleteSession = (id: string) => {
      setLibrarySets(prev => prev.map(s => s.id === id ? { ...s, isSessionActive: false } : s));
   };

   const handleDuplicateLibrarySet = (id: string) => {
      const set = librarySets.find(s => s.id === id);
      if (set) {
        const newSet: CardSet = {
            ...set,
            id: generateId(),
            name: `${set.name} (Copy)`,
            lastPlayed: Date.now(),
            elapsedTime: 0,
            topStreak: 0,
            learnSessionStats: undefined,
            srsSessionStats: undefined,
            cards: set.cards.map(resetCardStudyProgress)
         };
         setLibrarySets(prev => [newSet, ...prev]);
      }
   };

   const handleUpdateActiveSession = (updatedSession: CardSet) => {
      const now = Date.now();
      let newElapsedTime = updatedSession.elapsedTime;

      if (!isTimerPaused) {
         const delta = now - timerStart;
         setTimerStart(now);
         newElapsedTime += delta;
      }

      const newSessionData = {
         ...updatedSession,
         isSessionActive: true,
         elapsedTime: newElapsedTime,
         lastPlayed: now
      };

      setLibrarySets(prev => {
         const exists = prev.some(s => s.id === updatedSession.id);
         let nextLibrary = exists
            ? prev.map(s => s.id === updatedSession.id ? newSessionData : s)
            : [newSessionData, ...prev];

         if (updatedSession.isMultistudy) {
            const updatedCardsByScopedId = new Map<string, typeof updatedSession.cards[number]>();
            const fallbackUpdatedCardsById = new Map<string, typeof updatedSession.cards[number]>();
            const fallbackUpdatedCardCounts = new Map<string, number>();

            updatedSession.cards.forEach(card => {
               if (card.originalSetId) {
                  updatedCardsByScopedId.set(`${card.originalSetId}::${card.id}`, card);
                  return;
               }

               fallbackUpdatedCardsById.set(card.id, card);
               fallbackUpdatedCardCounts.set(card.id, (fallbackUpdatedCardCounts.get(card.id) || 0) + 1);
            });

            nextLibrary = nextLibrary.map(set => {
               if (set.id === updatedSession.id) return set;
               let didUpdateAnyCard = false;

               const nextCards = set.cards.map(c => {
                  const scopedKey = `${set.id}::${c.id}`;
                  let updated = updatedCardsByScopedId.get(scopedKey);

                  if (!updated) {
                     const fallbackCount = fallbackUpdatedCardCounts.get(c.id) || 0;
                     if (fallbackCount === 1) {
                        updated = fallbackUpdatedCardsById.get(c.id);
                     }
                  }

                  if (!updated) return c;

                  didUpdateAnyCard = true;
                  const { id, mastery, originalSetId, originalSetName, ...fieldsToUpdate } = updated;
                  return { ...c, ...fieldsToUpdate };
               });

               if (!didUpdateAnyCard) return set;

               return {
                  ...set,
                  cards: nextCards
               };
            });
         }
         return nextLibrary;
      });
   };

   const handleForkActiveSession = (newSession: CardSet) => {
      const now = Date.now();
      const nextSession = {
         ...newSession,
         isSessionActive: true,
         lastPlayed: now,
         elapsedTime: 0
      };

      setLibrarySets(prev => {
         const exists = prev.some(s => s.id === nextSession.id);
         if (exists) {
            return prev.map(s => s.id === nextSession.id ? nextSession : s);
         }
         return [nextSession, ...prev];
      });

      setActiveSetId(nextSession.id);
      setTimerStart(now);
      setTimerNow(now);
      setIsTimerPaused(false);
   };



   const handleRenameSession = (newName: string) => {
      if (activeSetId) {
         setLibrarySets(prev => prev.map(s => s.id === activeSetId ? { ...s, name: newName } : s));
      }
      setIsRenaming(false);
   };

   const handleFinish = () => {
      if (activeSession) {
         const now = Date.now();
         const delta = isTimerPaused ? 0 : (now - timerStart);
         const finishedSession: CardSet = {
            ...activeSession,
            elapsedTime: activeSession.elapsedTime + delta,
            lastPlayed: now,
            isSessionActive: false
         };

         setCompletedSession(finishedSession);
         setLibrarySets(prev => {
            if (finishedSession.isMultistudy) {
               return prev.filter(s => s.id !== finishedSession.id);
            }

            return prev.map(s => s.id === finishedSession.id ? finishedSession : s);
         });
      }
      setGameState(GameState.WIN);
   };

   const handleBackToMenu = () => {
      if (activeSetId && gameState === GameState.PLAYING) {
         const now = Date.now();
         const delta = isTimerPaused ? 0 : (now - timerStart);
         setLibrarySets(prev => prev.map(s => s.id === activeSetId
            ? {
               ...s,
               elapsedTime: s.elapsedTime + delta,
               lastPlayed: now
            }
            : s));
      }
      setGameState(GameState.MENU);
      setActiveSetId(null);
      setCompletedSession(null);
      setIsRenaming(false);
      setMenuHomeClickNonce(prev => prev + 1);
   };

   // Handle back from Learn mode to Set Detail
   const handleBackFromLearnToDetail = () => {
      if (activeSetId && gameState === GameState.PLAYING) {
         const now = Date.now();
         const delta = isTimerPaused ? 0 : (now - timerStart);
         setLibrarySets(prev => prev.map(s => s.id === activeSetId
            ? {
               ...s,
               elapsedTime: s.elapsedTime + delta,
               lastPlayed: now
            }
            : s));
         setDetailSetId(activeSetId);
      }
      setGameState(GameState.SET_DETAIL);
      setActiveSetId(null);
      setIsRenaming(false);
   };

   const handleRestart = () => {
      const sessionToRestart = winSession;
      if (!sessionToRestart) return;

      const resetSession = {
         ...resetSetStudyProgress(sessionToRestart),
         elapsedTime: 0,
         topStreak: 0,
         isSessionActive: true
      };

      setLibrarySets(prev => {
         const exists = prev.some(s => s.id === resetSession.id);
         if (exists) {
            return prev.map(s => s.id === resetSession.id ? resetSession : s);
         }
         return [resetSession, ...prev];
      });
      setCompletedSession(null);
      setActiveSetId(resetSession.id);
      setTimerStart(Date.now());
      setTimerNow(Date.now());
      setIsTimerPaused(false);
      setGameState(GameState.PLAYING);
   };

   const handleStudyStarred = () => {
      const sessionToRestart = winSession;
      if (!sessionToRestart) return;

      const hasStarredCards = sessionToRestart.cards.some(c => c.star);
      if (!hasStarredCards) return;

      const restartedSession: CardSet = {
         ...sessionToRestart,
         lastPlayed: Date.now(),
         elapsedTime: 0,
         topStreak: 0,
         isSessionActive: true,
         learnSessionStats: undefined,
         cards: sessionToRestart.cards.map(c => c.star ? { ...c, mastery: 0 } : c)
      };

      updateSettings({ ...settings, starredOnly: true });
      setLibrarySets(prev => {
         const exists = prev.some(s => s.id === restartedSession.id);
         if (exists) {
            return prev.map(s => s.id === restartedSession.id ? restartedSession : s);
         }
         return [restartedSession, ...prev];
      });
      setCompletedSession(null);
      setActiveSetId(restartedSession.id);
      setTimerStart(Date.now());
      setTimerNow(Date.now());
      setIsTimerPaused(false);
      setGameState(GameState.PLAYING);
   };

   const handleResetSettings = async () => {
      setSettings({ ...DEFAULT_SETTINGS });
      await resetSettingsToDefault();
   };

   const handleStartOnboarding = () => {
      setIsSettingsOpen(false);
      setIsSettingsOpen(false);
      handleBackToMenu();
      setIsOnboardingTourOpen(true);
   };

   const handleCreateAlphabetSet = () => {
      const normalizedSampleName = ALPHABET_SAMPLE_NAME.trim().toLocaleLowerCase();
      const existingAlphabetSet = librarySets.find(
         set => set.name.trim().toLocaleLowerCase() === normalizedSampleName
      );

      const fruits = [
         { name: 'apple', desc: 'A red fruit' },
         { name: 'banana', desc: 'A yellow fruit' },
         { name: 'orange', desc: 'An orange citrus fruit' },
         { name: 'grape', desc: 'A small purple or green fruit' },
         { name: 'strawberry', desc: 'A red berry with seeds on the outside' },
         { name: 'blueberry', desc: 'A small blue berry' },
         { name: 'watermelon', desc: 'A large green fruit with red flesh' },
         { name: 'pineapple', desc: 'A spiky tropical fruit' },
         { name: 'mango', desc: 'A sweet tropical fruit with a large pit' },
         { name: 'peach', desc: 'A fuzzy fruit with a pit' },
         { name: 'pear', desc: 'A light green or yellow fruit' },
         { name: 'cherry', desc: 'A small red stone fruit' },
         { name: 'kiwi', desc: 'A small brown fuzzy fruit with green flesh' },
         { name: 'lemon', desc: 'A sour yellow citrus fruit' },
         { name: 'lime', desc: 'A sour green citrus fruit' }
      ];
      const alphabetSet: CardSet = {
         id: existingAlphabetSet?.id || generateId(),
         name: ALPHABET_SAMPLE_NAME,
         cards: fruits.map(fruit => ({
            id: generateId(),
            term: [fruit.name],
            content: fruit.desc,
            year: '',
            customFields: [],
            mastery: 0,
            star: false,
            tags: []
         })),
         lastPlayed: Date.now(),
         elapsedTime: 0,
         topStreak: 0,
         version: 2,
         termLabel: 'Term',
         definitionLabel: 'Definition',
         termSideFields: [],
         defSideFields: [],
         enableTermCards: false,
         tags: [],
         folderId: existingAlphabetSet?.folderId
      };

      handleSaveToLibrary(alphabetSet);
      setAppToast({
         id: Date.now(),
         type: 'success',
         message: existingAlphabetSet
            ? `Updated "${ALPHABET_SAMPLE_NAME}" in your library.`
            : `Added "${ALPHABET_SAMPLE_NAME}" to your library.`
      });
   };

   const handleOnboardingComplete = () => {
      setHasCompletedOnboarding(true);
      localStorage.setItem(ONBOARDING_TOUR_COMPLETED_KEY, 'true');
   };

   const handleImportSharedSet = (snapshot: SharedSetSnapshot) => {
      const existingNames = new Set(librarySets.map(s => s.name));
      let name = snapshot.name;
      if (existingNames.has(name)) {
         let i = 1;
         while (existingNames.has(`${snapshot.name} (${i})`)) i++;
         name = `${snapshot.name} (${i})`;
      }

      const newSet: CardSet = {
         id: generateId(),
         name,
         cards: snapshot.cards.map(c => ({ ...c, mastery: 0 as const, star: false as const })),
         termLabel: snapshot.termLabel,
         definitionLabel: snapshot.definitionLabel,
         termSideFields: snapshot.termSideFields,
         defSideFields: snapshot.defSideFields,
         lastPlayed: Date.now(),
         elapsedTime: 0,
         topStreak: 0,
      };
      setLibrarySets(prev => [newSet, ...prev]);
      history.replaceState(null, '', window.location.pathname);
      setIncomingShareId(null);
      setDetailSetId(newSet.id);
      setGameState(GameState.SET_DETAIL);
   };

   const handleDismissSharedSet = () => {
      history.replaceState(null, '', window.location.pathname);
      setIncomingShareId(null);
   };

   return (
      <div className="min-h-screen flex flex-col bg-bg text-text font-sans selection:bg-accent selection:text-bg transition-colors duration-300">
         {gameState === GameState.WIN && <Confetti />}

         <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => {
               setIsSettingsOpen(false);
               setIsSettingsOpen(false);
            }}
            settings={settings}
            onUpdate={updateSettings}
            onOpenKeybinds={() => setIsKeybindsModalOpen(true)}
            onDeleteData={handleDeleteData}
            onExportData={handleExportData}
            onImportData={handleImportData}
            onResetSettings={handleResetSettings}
            onStartOnboarding={handleStartOnboarding}
            onCreateAlphabetSet={handleCreateAlphabetSet}
            librarySets={librarySets}
            user={user}
            lifetimeCorrect={lifetimeCorrect}
            onLogin={handleLogin}
            onLogout={handleLogout}
            initialTab={settingsInitialTab}
            tags={tags}
            onUpdateTags={(newTags) => {
               setTags(newTags);
               saveTags(newTags, {
                  skipCloud: Boolean(
                     syncInProgressRef.current ||
                     isCloudLoading ||
                     (user && !hasSyncedOnceRef.current)
                  )
               });
            }}
            onOpenPrivacy={() => setIsPrivacyOpen(true)}
         />

         <OnboardingTour
            isOpen={isOnboardingTourOpen}
            onClose={() => setIsOnboardingTourOpen(false)}
            onComplete={handleOnboardingComplete}
         />
         <UserModal
            isOpen={isUserModalOpen}
            onClose={() => setIsUserModalOpen(false)}
            user={user}
            lifetimeCorrect={lifetimeCorrect}
            onLogin={handleLogin}
            onLogout={handleLogout}
            librarySets={librarySets}
            onOpenSettings={() => {
               setIsUserModalOpen(false);
               setIsSettingsOpen(true);
            }}
            onOpenPrivacy={() => setIsPrivacyOpen(true)}
         />

         <PrivacyPolicyModal
            isOpen={isPrivacyOpen}
            onClose={() => setIsPrivacyOpen(false)}
         />

         <TermsOfServiceModal
            isOpen={isTermsOpen}
            onClose={() => setIsTermsOpen(false)}
         />

         <KeybindsModal
            isOpen={isKeybindsModalOpen}
            onClose={() => setIsKeybindsModalOpen(false)}
            settings={settings}
            onUpdate={updateSettings}
         />

         {/* Corruption Notification */}
         <CorruptionNotification
            reports={corruptionReports}
            onDismiss={() => setCorruptionReports([])}
         />
         {appToast && (
            <div className="fixed bottom-4 right-4 z-[120] max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
               <div className="bg-panel rounded-xl border border-outline shadow-2xl px-4 py-3 flex items-start gap-3">
                  {appToast.type === 'success' ? (
                     <CheckCircle2 className="w-5 h-5 text-green shrink-0 mt-0.5" />
                  ) : (
                     <XCircle className="w-5 h-5 text-red shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 text-sm text-text">{appToast.message}</div>
                  <button
                     onClick={() => setAppToast(null)}
                     className="text-muted hover:text-text transition-colors"
                     aria-label="Dismiss notification"
                  >
                     <X size={16} />
                  </button>
               </div>
            </div>
         )}
         {/* UI Audit disabled. Uncomment these and the UiAuditPanel block below to re-enable. */}
         {/*
         <CorruptionNotification
            reports={uiAuditToastReports}
            onDismiss={() => setUiAuditToastReports([])}
         />
         <CorruptionPopup
            isOpen={uiAuditCorruptionPopupOpen}
            onClose={() => {
               setUiAuditCorruptionPopupOpen(false);
               setUiAuditPopupReports([]);
            }}
            reports={uiAuditPopupReports}
         />
         */}

         {/* Top Bar */}
         <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-outline px-6 py-4">
            <div className="max-w-5xl mx-auto flex items-center justify-between">
               <div className="flex items-center gap-4 w-1/3">
                  <button
                     onClick={() => {
                        if (gameState !== GameState.DOCUMENTATION) {
                           setPreviousGameState(gameState);
                        }
                        setGameState(GameState.DOCUMENTATION);
                     }}
                     className="p-2 text-muted hover:text-text transition-colors"
                     title="How-To Brochure"
                  >
                     <BookOpen size={20} />
                  </button>
               </div>

               <div className="w-1/3 flex flex-col items-center justify-center relative h-14">
                  {/* Flashcardsish Title - Always rendered but animated */}
                  <button
                     onClick={handleBackToMenu}
                     className={clsx(
                        "transition-all duration-500 ease-in-out cursor-pointer hover:text-accent font-extrabold tracking-tight flex flex-col items-center justify-center z-10",
                        gameState === GameState.PLAYING && activeSession
                           ? "text-[10px] transform -translate-y-3 opacity-60"
                           : "text-lg transform translate-y-0 opacity-80"
                     )}
                     style={{ fontFamily: "'Red Hat Display', sans-serif" }}
                     title="Go to Home"
                  >
                     <span>Flashcardsish</span>
                     <span
                        className={clsx(
                           "italic transition-all duration-300 origin-top",
                           gameState === GameState.PLAYING && activeSession
                              ? "opacity-0 scale-0 h-0 overflow-hidden"
                              : "opacity-70 scale-100 h-auto text-[10px] animate-pop-in mt-[-2px]"
                        )}
                     >
                        alpha
                     </span>
                  </button>

                  {/* Session Name Area - Only visible when playing */}
                  <div
                     className={clsx(
                        "absolute transition-all duration-500 ease-in-out flex items-center justify-center w-full",
                        gameState === GameState.PLAYING && activeSession
                           ? "opacity-100 transform translate-y-2 scale-100 pointer-events-auto"
                           : "opacity-0 transform translate-y-6 scale-95 pointer-events-none"
                     )}
                  >
                     {activeSession && (
                        isRenaming ? (
                           <input
                              autoFocus
                              defaultValue={activeSession.name}
                              onBlur={(e) => handleRenameSession(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && handleRenameSession(e.currentTarget.value)}
                              className="bg-transparent border-b border-accent text-center font-bold text-text focus:outline-none pb-1 min-w-[200px]"
                           />
                        ) : (
                           <span
                              onClick={() => setIsRenaming(true)}
                              className="font-bold text-text opacity-50 hover:opacity-100 cursor-pointer hover:text-accent transition-all truncate max-w-[250px]"
                              title="Click to rename"
                           >
                              {activeSession.name}
                           </span>
                        )
                     )}
                  </div>
               </div>

               <div className="flex justify-end w-1/3 items-center gap-4">
                  {gameState === GameState.PLAYING && activeSession && (
                     <button
                        onClick={toggleTimer}
                        className={clsx(
                           "flex items-center gap-2 font-mono transition-all mr-2",
                           isTimerPaused ? "text-muted opacity-30" : "text-accent"
                        )}
                     >
                        <Clock size={18} />
                        <span className="hidden sm:inline">{isTimerPaused ? "PAUSED" : fmtTime(activeSession.elapsedTime + (timerNow - timerStart))}</span>
                     </button>
                  )}

                  {/* Profile Indicator */}
                  <button
                     onClick={() => {
                        setSettingsInitialTab('you');
                        setIsSettingsOpen(true);
                     }}
                     className={clsx(
                        "flex items-center gap-2 px-3 py-2 rounded-xl bg-panel-2 border transition-all relative overflow-visible",
                        shouldHighlightSignIn ? "border-outline signin-cta" : "border-outline hover:border-accent"
                     )}
                     title={user ? `Logged in as ${user.email}` : "Account"}
                  >
                     {shouldHighlightSignIn && (
                        <svg
                           className="signin-cta-outline"
                           viewBox="0 0 100 40"
                           preserveAspectRatio="none"
                           aria-hidden="true"
                        >
                           <rect x="2" y="2" width="96" height="36" rx="10" ry="10" />
                        </svg>
                     )}
                     {user ? (
                        <img
                           src={user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || 'U')}&background=random&size=32`}
                           alt="Profile"
                           className="w-7 h-7 rounded-full"
                        />
                     ) : (
                        <div className="w-7 h-7 rounded-full bg-outline/20 flex items-center justify-center">
                           <Cloud size={16} className="text-muted" />
                        </div>
                     )}
                     <span className="text-sm text-muted hidden sm:block max-w-[90px] truncate">{user?.name?.split(' ')[0] || user?.email?.split('@')[0] || "Sign In"}</span>
                  </button>

                  {/* Cloud Sync Status Indicator */}
                  {user && (isCloudLoading || cloudSyncStatus === 'saving') && (
                     <div
                        className={clsx(
                           "flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all",
                           "text-amber-400"
                        )}
                        title="Flashcardsish is currently syncing your data with Google Drive."
                     >
                        <RefreshCw size={14} className="animate-spin" />
                     </div>
                  )}

                  {user && !(isCloudLoading || cloudSyncStatus === 'saving') && (
                     <button
                        onClick={() => void handleManualCloudSync()}
                        disabled={conflictResolutionAction !== 'idle'}
                        className={clsx(
                           "flex items-center justify-center p-2 rounded-lg border transition-all",
                           cloudSyncStatus === 'error'
                              ? "border-red/40 text-red hover:border-red"
                              : cloudSyncStatus === 'saved'
                                 ? "border-emerald-400/40 text-emerald-400 hover:border-emerald-300"
                                 : "border-outline text-muted hover:text-text hover:border-accent",
                           conflictResolutionAction !== 'idle' && "opacity-50 cursor-not-allowed"
                        )}
                        title="Sync with Google Drive now"
                        aria-label="Sync with Google Drive now"
                     >
                        <RefreshCw size={14} />
                     </button>
                  )}

                  <button
                     onClick={() => {
                        setSettingsInitialTab('set');
                        setIsSettingsOpen(true);
                     }}
                     className={clsx(
                        "p-2 transition-colors",
                        isSettingsOpen ? "text-accent" : "text-muted hover:text-text"
                     )}
                  >
                     <SettingsIcon size={20} />
                  </button>
               </div>
            </div>
         </header>

         {user && cloudConflicts.length > 0 && (
            <div className="px-6 pt-4">
               <div className="max-w-5xl mx-auto bg-yellow/10 border border-yellow/40 rounded-2xl p-4 space-y-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                     <div className="text-sm text-text">
                        <span className="font-bold text-yellow">Cloud conflict detected.</span>{' '}
                        {cloudConflicts.length === 1
                           ? `Set "${cloudConflicts[0].setName}" differs between local and cloud.`
                           : `${cloudConflicts.length} sets differ between local and cloud.`}
                     </div>
                     <div className="flex items-center gap-2 flex-wrap">
                        <button
                           onClick={() => setIsConflictDetailsOpen(prev => !prev)}
                           className="px-3 py-2 text-xs font-bold border border-outline rounded-lg hover:border-accent hover:text-accent transition-colors"
                        >
                           {isConflictDetailsOpen ? 'Hide Differences' : 'View Differences'}
                        </button>
                        <button
                           onClick={handleKeepCloudVersion}
                           disabled={conflictResolutionAction !== 'idle'}
                           className="px-3 py-2 text-xs font-bold border border-outline rounded-lg hover:border-accent hover:text-accent transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                           {conflictResolutionAction === 'keeping' ? 'Applying Cloud...' : 'Keep Cloud Version'}
                        </button>
                        <button
                           onClick={handleOverwriteCloudVersion}
                           disabled={conflictResolutionAction !== 'idle'}
                           className="px-3 py-2 text-xs font-bold bg-yellow text-bg rounded-lg hover:bg-yellow/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                           {conflictResolutionAction === 'overwriting' ? 'Overwriting Cloud...' : 'Overwrite Cloud'}
                        </button>
                     </div>
                  </div>

                  {isConflictDetailsOpen && (
                     <div className="space-y-2 pt-1">
                        {cloudConflicts.map((conflict) => (
                           <div key={conflict.setId} className="rounded-xl border border-yellow/30 bg-panel/40 p-3 text-xs text-text space-y-1.5">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                 <span className="font-bold text-sm text-yellow">{conflict.setName}</span>
                                 <span className="text-muted">
                                    Local {conflict.localCardCount} cards | Cloud {conflict.cloudCardCount} cards
                                 </span>
                              </div>
                              <div className="flex flex-wrap gap-3">
                                 <span className="text-emerald-300">+{conflict.cardsAddedLocally} added locally</span>
                                 <span className="text-red-300">-{conflict.cardsDeletedLocally} deleted locally</span>
                                 <span className="text-blue-300">~{conflict.cardsEditedLocally} edited locally</span>
                              </div>
                              {conflict.addedCardLabels.length > 0 && (
                                 <div className="text-muted">Added locally: {conflict.addedCardLabels.join(', ')}</div>
                              )}
                              {conflict.deletedCardLabels.length > 0 && (
                                 <div className="text-muted">Deleted locally: {conflict.deletedCardLabels.join(', ')}</div>
                              )}
                              {conflict.editedCardLabels.length > 0 && (
                                 <div className="text-muted">Edited locally: {conflict.editedCardLabels.join(', ')}</div>
                              )}
                              <div className="text-muted">
                                 Local version: {formatConflictTimestamp(conflict.localModifiedAt)} | Cloud version: {formatConflictTimestamp(conflict.cloudModifiedAt)}
                              </div>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            </div>
         )}

         <main className="flex-grow p-6 md:p-8 max-w-5xl mx-auto w-full">
            {incomingShareId && (
               <SharedSetView
                  shareId={incomingShareId}
                  onImport={handleImportSharedSet}
                  onDismiss={handleDismissSharedSet}
               />
            )}
            {!incomingShareId && gameState === GameState.MENU && (
               <StartMenu
                  isCloudLoading={isCloudLoading || !isLibraryLoaded}
                  librarySets={effectiveLibrarySets}
                  setLibrarySets={setLibrarySets}
                  folders={folders}
                  setFolders={setFolders}
                  onStartFromLibrary={handleStartFromLibrary}
                  onResumeSession={handleResumeSession}
                  onDeleteLibrarySet={handleDeleteLibrarySet}
                  onDuplicateLibrarySet={handleDuplicateLibrarySet}
                  onOpenSet={handleOpenSet}
                  onSaveToLibrary={handleSaveToLibrary}
                  onDeleteSession={handleDeleteSession}
                  settings={settings}
                  onUpdateSettings={updateSettings}
                  lifetimeCorrect={lifetimeCorrect}
                  initialEditSetId={editRequestSetId}
                  onClearEditRequest={() => setEditRequestSetId(null)}
                  onUploadImage={handleImageUpload}
                  tags={tags}
                  onUpdateTags={(newTags) => {
                     setTags(newTags);
                     saveTags(newTags, {
                        skipCloud: Boolean(
                           syncInProgressRef.current ||
                           isCloudLoading ||
                           (user && !hasSyncedOnceRef.current)
                        )
                     });
                  }}
                  appliedTags={appliedTags}
                  onOpenSettings={() => {
                     setSettingsInitialTab('tags');
                     setIsSettingsOpen(true);
                  }}
                  setAppliedTags={setAppliedTags}
                  uiAuditRequest={uiAuditRequest}
                  onUiAuditHandled={() => setUiAuditRequest(null)}
                  onHomeScreenActiveChange={setIsHomeScreenActive}
                  homeNavigationNonce={menuHomeClickNonce}
                  hasCompletedOnboarding={hasCompletedOnboarding}
                  onStartOnboardingTour={handleStartOnboarding}
                  signedInUserName={user?.name || user?.email?.split('@')[0] || null}
               />
            )}

            {gameState === GameState.SET_DETAIL && detailSet && (
               <SetDetail
                  set={detailSet}
                  settings={settings}
                  onBack={handleBackFromDetail}
                  onStartLearn={handleStartLearnFromDetail}
                  onStartFlashcards={handleStartFlashcardsFromDetail}
                  onStartSRS={handleStartSRSFromDetail}
                  onUpdateSet={handleUpdateLibrarySet}
                  tags={tags}
                  onEdit={() => {
                     // Set the edit request and go back to menu
                     setEditRequestSetId(detailSet.id);
                     handleBackFromDetail();
                  }}
                  onDuplicate={() => {
                     handleDuplicateLibrarySet(detailSet.id);
                     // Update detailSetId to the new duplicate
                     const newSet = librarySets.find(s => s.name === `${detailSet.name} (Copy)`);
                     if (newSet) setDetailSetId(newSet.id);
                  }}
                  onDelete={() => {
                     handleDeleteLibrarySet(detailSet.id);
                     handleBackFromDetail();
                  }}
               />
            )}

            {gameState === GameState.PLAYING && activeSession && (
               <Game
                  set={activeSession}
                  onUpdateSet={handleUpdateActiveSession}
                  onForkSession={handleForkActiveSession}
                  onFinish={handleFinish}
                  settings={settings}
                  onExit={handleBackFromLearnToDetail}
                  onCorrect={() => setLifetimeCorrect(p => p + 1)}
                  onStartGame={() => setIsGameActive(true)}
               />
            )}

            {gameState === GameState.FLASHCARDS && activeSession && (
               <FlashcardsMode
                  set={activeSession}
                  settings={settings}
                  onExit={() => {
                     setDetailSetId(activeSession.id);
                     setGameState(GameState.SET_DETAIL);
                     setActiveSetId(null);
                  }}
                  onUpdateSet={handleUpdateLibrarySet}
               />
            )}

            {gameState === GameState.SRS && activeSession && (
               <SRSMode
                  set={activeSession}
                  settings={settings}
                  onExit={() => {
                     setDetailSetId(activeSession.id);
                     setGameState(GameState.SET_DETAIL);
                     setActiveSetId(null);
                  }}
                  onUpdateSet={handleUpdateLibrarySet}
                  onUseLearnInstead={() => handleStartFromLibrary(activeSession)}
               />
            )}

            {gameState === GameState.WIN && (
               <div className="fixed inset-0 z-20 flex flex-col items-center justify-center bg-bg/95 backdrop-blur-xl animate-in fade-in duration-500">
                  <div className="text-center mb-10">
                     <h2
                        className="text-5xl text-accent mb-4 drop-shadow-[0_0_35px_rgba(208,164,94,0.4)]"
                        style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}
                     >
                        Session Complete
                     </h2>
                     <p className="text-xl text-muted">Excellent work.</p>
                  </div>

                  <div className="flex w-full max-w-lg flex-col gap-4 px-6">
                     <button
                        onClick={handleRestart}
                        className="w-full bg-panel-2 border border-outline text-text px-6 py-4 rounded-xl font-bold text-lg hover:border-accent transition-all shadow-sm flex items-center justify-center gap-2"
                     >
                        <RotateCcw size={20} /> Restart Session
                     </button>

                     <button
                        onClick={handleStudyStarred}
                        disabled={!winSession?.cards.some(c => c.star)}
                        className={clsx(
                           "w-full border px-6 py-4 rounded-xl font-bold text-lg transition-colors shadow-sm flex items-center justify-center gap-2",
                           winSession?.cards.some(c => c.star)
                              ? "bg-panel-2 border-outline text-text hover:border-accent"
                              : "bg-panel border-outline/70 text-muted cursor-not-allowed opacity-60"
                        )}
                     >
                        <Star size={20} className="text-accent" fill="currentColor" /> Study Starred Terms
                     </button>

                     <button
                        onClick={handleBackToMenu}
                        className="w-full bg-panel-2 border border-outline text-text px-6 py-4 rounded-xl font-bold text-lg hover:border-accent transition-colors shadow-sm flex items-center justify-center gap-2"
                     >
                        <FolderOpen size={20} /> Back to Menu
                     </button>
                  </div>
               </div>
            )}

            {gameState === GameState.DOCUMENTATION && (
               <Documentation onBack={() => setGameState(previousGameState)} />
            )}
         </main>

         <button
            type="button"
            data-tally-open="A7dV60"
            data-tally-auto-close="1000"
            className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-outline bg-panel px-4 py-3 text-sm font-bold text-text shadow-2xl transition-all hover:-translate-y-0.5 hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/60"
            aria-label="Open feedback form"
            title="Send feedback"
         >
            <MessageSquare size={16} />
            <span>Feedback</span>
         </button>

         <footer className="py-6 text-center text-muted text-sm border-t border-outline bg-panel-2/50">
            <div className="flex items-center justify-center gap-1.5 mb-3">
               Made with <Heart size={14} className="text-red fill-red" /> and vibe coding by Owen Whelan.
            </div>
            <div className="flex items-center justify-center gap-4 text-xs opacity-60">
               <button
                  onClick={() => setIsPrivacyOpen(true)}
                  className="hover:text-accent hover:opacity-100 transition-all underline-offset-2 hover:underline"
               >
                  Privacy Policy
               </button>
               <span className="text-outline">&bull;</span>
               <button
                  onClick={() => setIsTermsOpen(true)}
                  className="hover:text-accent hover:opacity-100 transition-all underline-offset-2 hover:underline"
               >
                  Terms of Service
               </button>
            </div>
         </footer>

         {/* UI Audit disabled. Uncomment this block to re-enable the UI audit panel. */}
         {/*
         <UiAuditPanel
            isMenuActive={gameState === GameState.MENU}
            onOpenSettings={() => {
               setSettingsInitialTab('set');
               setIsSettingsOpen(true);
            }}
            onOpenUser={() => setIsUserModalOpen(true)}
            onOpenPrivacy={() => setIsPrivacyOpen(true)}
            onOpenTerms={() => setIsTermsOpen(true)}
            onOpenKeybinds={() => {
               setIsKeybindsModalOpen(true);
            }}
            onOpenCorruptionPopup={() => {
               const sample = [
                  {
                     type: 'config',
                     fileName: 'settings.json',
                     error: 'Sample recovery notice for UI audit.',
                  },
               ];
               setUiAuditPopupReports(sample);
               setUiAuditCorruptionPopupOpen(true);
            }}
            onRequestMenuModal={(request) => setUiAuditRequest(request)}
            onShowToast={() => {
               const sample = [
                  {
                     type: 'config',
                     fileName: 'settings.json',
                     error: 'Sample recovery notice for UI audit.',
                  },
               ];
               setUiAuditToastReports(sample);
            }}
            sampleTag={tags[0] || null}
         />
         */}
      </div>
   );
};

const root = createRoot(document.getElementById('root')!);
root.render(
   <AppErrorBoundary>
      <App />
   </AppErrorBoundary>
)
