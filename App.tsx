import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { CardSet, GameState, Settings, Folder, Tag } from './types';
import { fmtTime, generateId, sanitizeSet } from './utils';
import { StartMenu } from './components/StartMenu';
import { Game } from './components/Game';
import { SetDetail } from './components/SetDetail';
import { Confetti } from './components/Confetti';
import { PrivacyPolicyModal } from './components/PrivacyPolicy';
import { TermsOfServiceModal } from './components/TermsOfService';
import { Documentation } from './components/Documentation';
import { FlashcardsMode } from './components/FlashcardsMode';
import { KeybindsModal } from './components/KeybindsModal';
import { Clock, ArrowLeft, Settings as SettingsIcon, X, BookOpen, Heart, RotateCcw, FolderOpen, LayoutGrid, Type, Trash2, LogIn, LogOut, Cloud, Download, FileText, File, Lock, Sparkles, Loader2, Globe, Tag as TagIcon, Terminal, RefreshCw, CheckCircle2, XCircle, Keyboard } from 'lucide-react';
import { testApiKey, setSessionApiKey, clearSessionApiKey, getSessionApiKey } from './src/aiService';
import clsx from 'clsx';
import { saveLibrary, loadLibrary, saveFolders, loadAllUserData, saveSettings, deleteAllUserData, CorruptionReport, resetSettingsToDefault, DEFAULT_SETTINGS, saveTags } from './storage';
import { sanitizeStrings } from './storageV2';
import { googleDrive, GoogleDriveUser } from './src/googleDriveClient';
import { UserModal } from './components/UserModal';
import { ProfileCard } from './components/ProfileCard';
import { SignInCard } from './components/SignInCard';
import { CursorTooltip } from './components/CursorTooltip';
import { CorruptionNotification } from './components/CorruptionNotification';
import { AiSetupModal } from './components/AiSetupModal';

const LIBRARY_KEY = 'flashcard-library-v3';
const FOLDERS_KEY = 'flashcard-folders-v1';
const SETTINGS_KEY = 'flashcard-settings-v2';
const STATS_KEY = 'flashcard-stats-v1';

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
   onDeleteData: () => void;
   onExportData: () => void;
   onResetSettings: () => void;
   librarySets: CardSet[];
   // User props for "You" tab
   user: GoogleDriveUser | null;
   lifetimeCorrect: number;
   onLogin: () => void;
   onLogout: () => void;
   initialTab?: 'set' | 'global' | 'you' | 'tags';
   tags: Tag[];
   onUpdateTags: (tags: Tag[]) => void;
}> = ({ isOpen, onClose, settings, onUpdate, onDeleteData, onExportData, onResetSettings, librarySets, user, lifetimeCorrect, onLogin, onLogout, initialTab = 'set', tags, onUpdateTags }) => {
   const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
   const [showResetConfirm, setShowResetConfirm] = useState(false);
   const [activeTab, setActiveTab] = useState<'set' | 'global' | 'you' | 'builder' | 'tags'>(initialTab);
   const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

   // AI State
   const [apiKeyInput, setApiKeyInput] = useState('');
   const [isApiKeyLocked, setIsApiKeyLocked] = useState(!!getSessionApiKey());
   const [apiKeyTestResult, setApiKeyTestResult] = useState<{ success: boolean; error?: string } | null>(null);
   const [isTestingApiKey, setIsTestingApiKey] = useState(false);
   const [isAiSetupOpen, setIsAiSetupOpen] = useState(false);
   const [deleteConfirmTagId, setDeleteConfirmTagId] = useState<string | null>(null);
   const [isKeybindsOpen, setIsKeybindsOpen] = useState(false);

   const TAG_COLORS: string[] = ['red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose', 'slate', 'gray', 'zinc', 'neutral', 'stone'];

   // Reset activeTab when initialTab changes (e.g., opening from different triggers)
   React.useEffect(() => {
      if (isOpen) {
         setActiveTab(initialTab);
      }
   }, [isOpen, initialTab]);

   if (!isOpen) return null;

   const toggle = (key: keyof Settings) => {
      onUpdate({ ...settings, [key]: !settings[key] });
   };

   // Tooltip definitions
   const tooltips: Record<string, string> = {
      forgiveSpellingErrors: "Allow minor typos and capitalization errors. Configure specific rules below.",
      ignoreDiacritics: "Treat accented characters as their base letters (e.g., 'é' matches 'e').",
      ignoreCapitalization: "Mark answers as correct regardless of uppercase or lowercase usage.",
      forgiveThe: "Ignore the word 'the' at the beginning of terms (e.g., 'The Apple' matches 'Apple').",
      wiggleRoom: "How many letters can be wrong while still counting the answer as correct (1-6 letters).",
      retypeOnMistake: "When you get an answer wrong, you'll need to retype the correct answer before moving on.",
      starredOnly: "Only study cards you've starred. Great for focusing on tricky terms.",
      answerWithDefinition: `Change what you're expected to enter and what you're prompted with. Right now, you will be presented with the ${settings.answerWithDefinition ? 'Term' : 'Definition'} and have to think about, choose, or type the ${settings.answerWithDefinition ? 'Definition' : 'Term'}.`,
      learnMode: "Choose how you want to answer: type your answer (Standard), pick from options (Multiple Choice), or use AI-powered multiple choice (Random Choice - requires AI).",
      aiEnabled: "Enable or disable Developer API features. These are experimental tools for developers and require a valid Google Cloud/Vertex AI key.",
      aiApiKey: "Enter your Google AI Studio API key to enable experimental features. Your key is stored only for this session and will be cleared when you close or refresh this tab.",
      hideTooltips: "Turns on or off Helper Tooltips, like this one. This tooltip appears regardless of if this setting is on or not.",
      darkMode: "Toggle between dark and light themes for the app.",
      cloudSync: "Sign in to sync your flashcard sets across all your devices for free.",
      exportData: "Download all your flashcard sets, folders, and settings as a JSON file for backup or transfer.",
      dangerZone: "Permanently delete all your data from this device and the cloud. This cannot be undone.",
      batchLength: "Set the number of cards in a batch, which is a repeated round, before new cards are introduced. If this number exceeds half the number of cards in your set, this is overridden by half the number of cards in your set.",
      shuffleCards: "When in Learn mode, shuffle terms so they don't appear in the same order as they are listed in the set.",
      brutalMode: "When enabled, if you get a term incorrect and mastery is at 1 of 2, its mastery is set to 0 of 2. Only affects Zen.",
      importAppend: "When importing raw text, append new cards to the existing list instead of replacing them. If this setting is disabled, then importing raw text can delete your whole set -- be careful!",
      importOverride: "Choose how Flashcardsish handles duplicates when pasting raw text. If a card in your raw text matches the term or definition of one already in the set…\n\n• Keep Old: …the one already in the set will be kept and the one in the raw text will be ignored.\n• Add Duplicate: …the new one in the raw text will be added anyway, creating a duplicate card.\n• Override Old: …the new card in the raw text will replace the old card that already exists.",
      autoCloseImageWindow: "When enabled, pasting any text in the image URL space instantly closes the window and attempts to use that image. If it fails, it will upload a broken image, but you can always re-attempt the upload.",
      learnModeLeftKey1: "Primary key for Option A / True.",
      learnModeLeftKey2: "Secondary key for Option A / True.",
      learnModeRightKey1: "Primary key for Option B / False.",
      learnModeRightKey2: "Secondary key for Option B / False.",
      autoAdvanceOnAnswer: "If enabled, selecting an A / B or True / False option will automatically advance to the next field or the Submit button. If disabled, you must press Tab or Enter to continue."
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

                        {/* ── General ─────────────────────────── */}
                        <h4 className="text-xs font-bold text-muted uppercase tracking-widest pt-1">General</h4>

                        {/* Answer With Toggle */}
                        <TooltipWrapper id="answerWithDefinition" tooltip={tooltips.answerWithDefinition} settings={settings}>
                           <div className="p-3 bg-panel-2 rounded-xl border border-transparent hover:border-accent transition-all">
                              <span className="font-medium text-text block mb-3">Answer With</span>
                              <div className="grid grid-cols-2 gap-2">
                                 <button
                                    onClick={() => onUpdate({ ...settings, answerWithDefinition: false })}
                                    className={clsx(
                                       "flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all border cursor-default",
                                       !settings.answerWithDefinition
                                          ? "bg-accent text-bg border-accent"
                                          : "bg-panel border-outline text-muted hover:text-text hover:border-accent/50"
                                    )}
                                 >
                                    <File size={16} /> Term
                                 </button>
                                 <button
                                    onClick={() => onUpdate({ ...settings, answerWithDefinition: true })}
                                    className={clsx(
                                       "flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all border cursor-default",
                                       settings.answerWithDefinition
                                          ? "bg-accent text-bg border-accent"
                                          : "bg-panel border-outline text-muted hover:text-text hover:border-accent/50"
                                    )}
                                 >
                                    <FileText size={16} /> Definition
                                 </button>
                              </div>
                           </div>
                        </TooltipWrapper>

                        {/* Shuffle Cards */}
                        <SettingRow id="shuffleCards" label="Shuffle Cards" settingKey="shuffleCards" settings={settings} tooltips={tooltips} onUpdate={onUpdate} />

                        {/* Study Starred Only */}
                        <SettingRow id="starredOnly" label="Study Starred Only" settingKey="starredOnly" settings={settings} tooltips={tooltips} onUpdate={onUpdate} />

                        {/* Keybinds */}
                        <div
                           onClick={() => setIsKeybindsOpen(true)}
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

                        {/* ── Learn Mode ──────────────────────── */}
                        <h4 className="text-xs font-bold text-muted uppercase tracking-widest pt-3">Learn Mode</h4>

                        {/* Answer Style (was: Learn Mode Style) */}
                        <TooltipWrapper id="learnMode" tooltip={tooltips.learnMode} settings={settings}>
                           <div className="p-3 bg-panel-2 rounded-xl border border-transparent hover:border-accent transition-all">
                              <span className="font-medium text-text block mb-3">Answer Style</span>
                              <div className={clsx("grid gap-2", settings.aiEnabled && isApiKeyLocked ? "grid-cols-3" : "grid-cols-2")}>
                                 <button
                                    onClick={() => onUpdate({ ...settings, mode: 'standard' })}
                                    className={clsx(
                                       "flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all border cursor-default",
                                       settings.mode === 'standard'
                                          ? "bg-accent text-bg border-accent"
                                          : "bg-panel border-outline text-muted hover:text-text hover:border-accent/50"
                                    )}
                                 >
                                    <Type size={16} /> Standard
                                 </button>
                                 <button
                                    onClick={() => onUpdate({ ...settings, mode: 'multiple_choice' })}
                                    className={clsx(
                                       "flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all border cursor-default",
                                       settings.mode === 'multiple_choice'
                                          ? "bg-accent text-bg border-accent"
                                          : "bg-panel border-outline text-muted hover:text-text hover:border-accent/50"
                                    )}
                                 >
                                    <LayoutGrid size={16} /> Multiple Choice
                                 </button>
                                 {settings.aiEnabled && isApiKeyLocked && (
                                    <button
                                       onClick={() => onUpdate({ ...settings, mode: 'ai_random_choice' })}
                                       className={clsx(
                                          "flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all border cursor-default",
                                          settings.mode === 'ai_random_choice'
                                             ? "bg-accent text-bg border-accent"
                                             : "bg-panel border-outline text-muted hover:text-text hover:border-accent/50"
                                       )}
                                    >
                                       <Terminal size={16} /> Random Choice
                                    </button>
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
                                          <label className="text-sm text-text/80 cursor-pointer hover:text-text transition-colors">Ignore diacritics (é, ñ)</label>
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
                                          <label className="text-sm text-text/80 cursor-pointer hover:text-text transition-colors">Ignore capitalization</label>
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
                                          <label className="text-sm text-text/80 cursor-pointer hover:text-text transition-colors">Forgive "the"</label>
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
                                          <label className="text-sm text-text/80 cursor-pointer hover:text-text transition-colors">Wiggle room (letters)</label>
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

                        {/* Batch Length */}
                        <TooltipWrapper id="batchLength" tooltip={tooltips.batchLength} settings={settings}>
                           <div className="p-3 bg-panel-2 rounded-xl border border-transparent hover:border-accent transition-all">
                              <div className="flex items-center justify-between">
                                 <span className="font-medium text-text">Batch Length</span>
                                 <input
                                    type="number"
                                    min={3}
                                    max={50}
                                    value={settings.batchLength}
                                    onChange={(e) => {
                                       const val = parseInt(e.target.value);
                                       if (!isNaN(val) && val >= 3 && val <= 50) {
                                          onUpdate({ ...settings, batchLength: val });
                                       }
                                    }}
                                    className="w-16 py-1 px-2 text-center bg-panel border border-outline rounded-lg text-sm font-bold text-text focus:border-accent focus:outline-none"
                                 />
                              </div>
                           </div>
                        </TooltipWrapper>

                        {/* Brutal Mode */}
                        <SettingRow id="brutalMode" label="Brutal Mode" settingKey="brutalMode" settings={settings} tooltips={tooltips} onUpdate={onUpdate} />

                     </div>
                  )}

                  {/* Keybinds Modal */}
                  <KeybindsModal
                     isOpen={isKeybindsOpen}
                     onClose={() => setIsKeybindsOpen(false)}
                     settings={settings}
                     onUpdate={onUpdate}
                  />

                  {activeTab === 'builder' && (
                     <div className="space-y-4">
                        <TooltipWrapper id="importAppend" tooltip={tooltips.importAppend} settings={settings}>
                           <label
                              onClick={() => toggle('importAppend')}
                              className="flex items-center justify-between p-3 bg-panel-2 rounded-xl cursor-pointer hover:border-accent border border-transparent transition-all"
                           >
                              <span className="font-medium text-text">Append Import</span>
                              <div
                                 onClick={(e) => { e.stopPropagation(); toggle('importAppend'); }}
                                 className={clsx("w-12 h-6 rounded-full p-1 transition-colors cursor-default", settings.importAppend ? "bg-accent" : "bg-outline")}
                              >
                                 <div className={clsx("bg-bg w-4 h-4 rounded-full shadow-sm transition-transform", settings.importAppend ? "translate-x-6" : "translate-x-0")} />
                              </div>
                           </label>
                        </TooltipWrapper>

                        <TooltipWrapper id="importOverride" tooltip={tooltips.importOverride} settings={settings}>
                           <div className="p-3 bg-panel-2 rounded-xl border border-transparent hover:border-accent transition-all">
                              <span className="font-medium text-text block mb-3">Duplicate Strategy</span>
                              <div className="grid grid-cols-3 gap-2">
                                 {[
                                    { value: 'keep', label: 'Keep Old' },
                                    { value: 'duplicate', label: 'Add Duplicate' },
                                    { value: 'override', label: 'Override Old' }
                                 ].map((opt) => (
                                    <button
                                       key={opt.value}
                                       onClick={() => onUpdate({ ...settings, importOverride: opt.value as any })}
                                       className={clsx(
                                          "flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all border cursor-default",
                                          settings.importOverride === opt.value
                                             ? "bg-accent text-bg border-accent"
                                             : "bg-panel border-outline text-muted hover:text-text hover:border-accent/50"
                                       )}
                                    >
                                       {opt.label}
                                    </button>
                                 ))}
                              </div>
                           </div>
                        </TooltipWrapper>

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

                        {/* AI Enabled Features */}
                        <div className="p-4 bg-purple/5 rounded-xl border border-purple/20 hover:border-purple/40 transition-all">
                           <span className="font-medium text-purple block mb-3 flex items-center gap-2">
                              <Sparkles size={18} /> AI Enabled Features
                           </span>

                           {/* AI Master Killswitch */}
                           <TooltipWrapper id="aiEnabled" tooltip={tooltips.aiEnabled} settings={settings}>
                              <label
                                 onClick={() => {
                                    if (settings.aiEnabled) {
                                       // Disabling
                                       onUpdate({ ...settings, aiEnabled: false });
                                       clearSessionApiKey();
                                       setIsApiKeyLocked(false);
                                       setApiKeyInput('');
                                       setApiKeyTestResult(null);
                                       if (settings.mode === 'ai_random_choice') {
                                          onUpdate({ ...settings, aiEnabled: false, mode: 'standard' });
                                       }
                                    } else {
                                       // Enabling - Prompt for Developer Agreement first
                                       setIsAiSetupOpen(true);
                                    }
                                 }}
                                 className="flex items-center justify-between p-3 bg-panel-2 rounded-xl cursor-pointer hover:border-accent border border-transparent transition-all mb-3"
                              >
                                 <span className="font-medium text-text">Enable Developer API Access</span>
                                 <div
                                    className={clsx("w-12 h-6 rounded-full p-1 transition-colors", settings.aiEnabled ? "bg-accent" : "bg-outline")}
                                 >
                                    <div className={clsx("bg-bg w-4 h-4 rounded-full shadow-sm transition-transform", settings.aiEnabled ? "translate-x-6" : "translate-x-0")} />
                                 </div>
                              </label>
                           </TooltipWrapper>

                           {settings.aiEnabled && (
                              <>
                                 {/* API Key Input */}
                                 <TooltipWrapper id="aiApiKey" tooltip={tooltips.aiApiKey} settings={settings}>
                                    <div className="space-y-2">
                                       <label className="block text-xs font-bold text-muted uppercase">Google AI Studio API Key</label>
                                       <div className="flex gap-2">
                                          <input
                                             type="password"
                                             value={apiKeyInput}
                                             onChange={(e) => setApiKeyInput(e.target.value)}
                                             disabled={isApiKeyLocked}
                                             placeholder="Enter your API key..."
                                             className="flex-1 bg-panel border border-outline rounded-lg px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                          />
                                          <button
                                             onClick={async () => {
                                                if (isApiKeyLocked) {
                                                   // Unlock
                                                   clearSessionApiKey();
                                                   setIsApiKeyLocked(false);
                                                   setApiKeyInput('');
                                                   setApiKeyTestResult(null);
                                                   // Reset mode if it was AI mode
                                                   if (settings.mode === 'ai_random_choice') {
                                                      onUpdate({ ...settings, mode: 'standard' });
                                                   }
                                                } else {
                                                   // Test and lock
                                                   if (!apiKeyInput.trim()) {
                                                      alert('Please enter an API key');
                                                      return;
                                                   }

                                                   setIsTestingApiKey(true);
                                                   setApiKeyTestResult(null);

                                                   try {
                                                      const result = await testApiKey(apiKeyInput);
                                                      setApiKeyTestResult(result);

                                                      if (result.success) {
                                                         setSessionApiKey(apiKeyInput);
                                                         setIsApiKeyLocked(true);
                                                         setApiKeyInput('••••••••••••');
                                                      }
                                                   } catch (e) {
                                                      setApiKeyTestResult({ success: false, error: 'Unknown error occurred' });
                                                   } finally {
                                                      setIsTestingApiKey(false);
                                                   }
                                                }
                                             }}
                                             disabled={isTestingApiKey}
                                             className={clsx(
                                                "px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors min-w-[100px] justify-center",
                                                isApiKeyLocked
                                                   ? "bg-red/10 text-red border border-red/30 hover:bg-red/20"
                                                   : "bg-accent text-bg hover:bg-accent/90",
                                                isTestingApiKey && "opacity-70 cursor-wait"
                                             )}
                                          >
                                             {isTestingApiKey ? (
                                                <Loader2 className="animate-spin" size={16} />
                                             ) : isApiKeyLocked ? (
                                                <>
                                                   <Lock size={16} /> Unlock
                                                </>
                                             ) : (
                                                <>
                                                   <Lock size={16} /> Submit
                                                </>
                                             )}
                                          </button>
                                       </div>
                                       {apiKeyTestResult && !apiKeyTestResult.success && (
                                          <p className="text-xs text-red mt-1">{apiKeyTestResult.error}</p>
                                       )}
                                       {isApiKeyLocked && (
                                          <p className="text-xs text-green mt-1 flex items-center gap-1">
                                             <span className="w-2 h-2 bg-green rounded-full" />
                                             API Key Active
                                          </p>
                                       )}
                                       <p className="text-xs text-muted mt-2">
                                          Your API key is stored only in this session and will be cleared when you refresh or close this tab. <button onClick={() => setIsAiSetupOpen(true)} className="text-accent hover:underline font-bold">Review Developer Terms</button>
                                       </p>
                                    </div>
                                 </TooltipWrapper>
                              </>
                           )}
                        </div>

                        {/* Export Data Box */}
                        <div className="p-4 bg-blue/5 rounded-xl border border-blue/20 hover:border-blue/40 transition-all">
                           <span className="font-medium text-blue block mb-3 flex items-center gap-2">
                              <Download size={18} /> Export Data
                           </span>
                           <button
                              onClick={onExportData}
                              className="w-full flex items-center justify-center gap-2 py-2 text-blue border border-blue/30 rounded-lg font-bold hover:bg-blue/20 transition-colors text-sm"
                           >
                              Export All My Data (JSON)
                           </button>
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
                                       <p className="text-sm text-muted">
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
                           <SignInCard onLogin={onLogin} />
                        )}
                     </div>
                  )}
               </div>
            </div>

            {/* AI Setup Modal - Stacked on top */}
            <AiSetupModal
               isOpen={isAiSetupOpen}
               onClose={() => setIsAiSetupOpen(false)}
               onConfirm={() => {
                  onUpdate({ ...settings, aiEnabled: true });
                  setIsAiSetupOpen(false);
               }}
            />
         </div>
      </div >
   );
};


const App: React.FC = () => {
   const [gameState, setGameState] = useState<GameState>(GameState.MENU);
   const [previousGameState, setPreviousGameState] = useState<GameState>(GameState.MENU);

   const [user, setUser] = useState<GoogleDriveUser | null>(null);
   const [librarySets, setLibrarySets] = useState<CardSet[]>([]);
   const [isLibraryLoaded, setIsLibraryLoaded] = useState(false);
   const [folders, setFolders] = useState<Folder[]>([]);
   const [tags, setTags] = useState<Tag[]>([]);
   const [activeSetId, setActiveSetId] = useState<string | null>(null);

   const activeSession = librarySets.find(s => s.id === activeSetId) || null;

   const [settings, setSettings] = useState<Settings>({
      forgiveSpellingErrors: true,
      ignoreDiacritics: false,
      ignoreCapitalization: true,
      forgiveThe: false,
      wiggleRoom: 1,
      retypeOnMistake: false,
      darkMode: true,
      starredOnly: false,
      mode: 'standard',
      answerWithDefinition: false,
      hideTooltips: false,
      batchLength: 10,
      shuffleCards: true,
      brutalMode: false,
      importAppend: false,
      importOverride: 'keep',
      autoCloseImageWindow: false
   });

   // Modals
   const [isSettingsOpen, setIsSettingsOpen] = useState(false);
   const [settingsInitialTab, setSettingsInitialTab] = useState<'set' | 'global' | 'you' | 'tags'>('set');
   const [isUserModalOpen, setIsUserModalOpen] = useState(false);

   const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
   const [isTermsOpen, setIsTermsOpen] = useState(false);

   // Set Detail View
   const [detailSetId, setDetailSetId] = useState<string | null>(null);
   const detailSet = librarySets.find(s => s.id === detailSetId) || null;

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
   const cloudSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

   // Cloud loading state (pulling sets from Drive)
   const [isCloudLoading, setIsCloudLoading] = useState(false);
   const syncInProgressRef = useRef(false);
   const hasSyncedOnceRef = useRef(false);

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
            const cloudSets = data.library_sets.map((s: CardSet) => sanitizeSet(s));

            setLibrarySets(prevLocalSets => {
               const merged = [...prevLocalSets];

               cloudSets.forEach(cloudSet => {
                  const localIndex = merged.findIndex(s => s.id === cloudSet.id);
                  if (localIndex === -1) {
                     // Set only exists in cloud, add it
                     merged.push(cloudSet);
                  } else {
                     // Set exists in both, use the most recently played version
                     const localSet = merged[localIndex];
                     if (cloudSet.lastPlayed > localSet.lastPlayed) {
                        console.log(`[Sync] Updating set "${localSet.name}" with newer cloud version`);
                        merged[localIndex] = cloudSet;
                     } else {
                        console.log(`[Sync] Keeping local version of "${localSet.name}" (it's newer than cloud)`);
                     }
                  }
               });

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

         console.log("[Sync] ✅ Smart merge complete");
         hasSyncedOnceRef.current = true;
      } finally {
         syncInProgressRef.current = false;
         setIsCloudLoading(false);
      }
   };

   const handleLogin = async () => {
      try {
         await googleDrive.signIn();
      } catch (error) {
         console.error('Failed to sign in:', error);
         alert('Failed to sign in. Please try again.');
      }
   };

   const handleLogout = async () => {
      await googleDrive.signOut();
      setUser(null);
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

   const handleExportData = () => {
      const exportData = {
         exportedAt: new Date().toISOString(),
         version: 'flashcardsish-export-v1',
         librarySets: librarySets,
         folders: folders,
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

            if (currentUser && !hasSyncedOnceRef.current) {
               await syncCloudData();
            }
         } catch (error) {
            console.error('Failed to initialize Google Drive:', error);
         }
      };

      initializeAuth();

      // Listen for sign-in state changes (e.g. user signs in via popup)
      const unsubscribe = googleDrive.onAuthStateChange(async (newUser) => {
         setUser(newUser);
         if (newUser && !hasSyncedOnceRef.current) {
            await syncCloudData();
         }
      });

      return () => unsubscribe();
   }, []);

   // Browser closing protection
   useEffect(() => {
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
         if (cloudSyncStatus === 'saving') {
            e.preventDefault();
            e.returnValue = '';
            return '';
         }
      };

      window.addEventListener('beforeunload', handleBeforeUnload);
      return () => window.removeEventListener('beforeunload', handleBeforeUnload);
   }, [cloudSyncStatus]);






   // Load Initial Data (Local Only - Cloud handled by Auth Effect)
   useEffect(() => {
      const loadData = async () => {
         try {
            console.log("[App] Starting initial data load...");

            // 1. Load Sets
            const idbSets = await loadLibrary();
            let setsToUse = idbSets;

            // Rescue Strategy for LocalStorage
            if (!setsToUse || setsToUse.length === 0) {
               const localLibrary = localStorage.getItem(LIBRARY_KEY);
               if (localLibrary) {
                  try {
                     const parsed = JSON.parse(localLibrary);
                     if (Array.isArray(parsed) && parsed.length > 0) {
                        setsToUse = parsed;
                     }
                  } catch (e) { console.error("[App] Error parsing local library:", e); }
               }
            }

            if (setsToUse && setsToUse.length > 0) {
               const sanitizedSets = setsToUse.map(s => sanitizeSet(sanitizeStrings(s)));
               console.log("[App] Loaded", sanitizedSets.length, "sets from storage");
               setLibrarySets(sanitizedSets);
            } else {
               console.warn("[App] No sets found in storage - starting with empty library");
            }

            // 2. Load Folders
            const savedFolders = localStorage.getItem(FOLDERS_KEY);
            if (savedFolders) {
               try {
                  const parsedFolders = JSON.parse(savedFolders);
                  if (Array.isArray(parsedFolders)) setFolders(parsedFolders);
               } catch (e) { }
            }

            // 3. Load Settings
            const savedSettings = localStorage.getItem(SETTINGS_KEY);
            if (savedSettings) {
               try {
                  const s = JSON.parse(savedSettings);
                  setSettings(prev => ({ ...prev, ...s }));
               } catch (e) { }
            }

            // 4. Load Stats
            const savedStats = localStorage.getItem(STATS_KEY);
            if (savedStats) {
               try {
                  const parsedStats = JSON.parse(savedStats);
                  if (parsedStats && typeof parsedStats.lifetimeCorrect === 'number') {
                     setLifetimeCorrect(parsedStats.lifetimeCorrect);
                  }
               } catch (e) { }
            }

            console.log("[App] ✅ Initial data load complete.");
         } catch (error) {
            console.error("[App] ❌ CRITICAL ERROR during loadData:", error);
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

   useEffect(() => {
      const timeSinceMount = Date.now() - mountTime.current;

      // HARD RULE: No saves allowed for first 3 seconds after mount
      if (timeSinceMount < 3000) {
         console.log('[App] Save blocked - too soon after mount (', timeSinceMount, 'ms )');
         return;
      }

      if (isLibraryLoaded && hasCompletedInitialLoad.current) {
         console.log('[App] AUTO-SAVING library:', librarySets.length, 'sets');

         // Show saving indicator if logged in
         if (user) setCloudSyncStatus('saving');

         saveLibrary(librarySets).then(result => {
            if (result.savedToCloud) {
               setCloudSyncStatus('saved');
               // Transition to faded after 3 seconds, but DO NOT disappear (don't set to idle)
               if (cloudSyncTimeoutRef.current) clearTimeout(cloudSyncTimeoutRef.current);
               cloudSyncTimeoutRef.current = setTimeout(() => setCloudSyncStatus('saved_faded'), 3000);
            } else if (result.error) {
               setCloudSyncStatus('error');
               // Reset to idle after 5 seconds
               if (cloudSyncTimeoutRef.current) clearTimeout(cloudSyncTimeoutRef.current);
               cloudSyncTimeoutRef.current = setTimeout(() => setCloudSyncStatus('idle'), 5000);
            } else {
               // No user / saved locally only
               setCloudSyncStatus('idle');
            }
         });
      } else if (isLibraryLoaded && !hasCompletedInitialLoad.current) {
         console.log('[App] Initial load complete, library has', librarySets.length, 'sets. Auto-save will be enabled in', (3000 - timeSinceMount), 'ms');
         hasCompletedInitialLoad.current = true;
      }
   }, [librarySets, isLibraryLoaded]);

   useEffect(() => {
      const timeSinceMount = Date.now() - mountTime.current;
      if (timeSinceMount < 3000) return;

      if (isLibraryLoaded && hasCompletedInitialLoad.current) {
         console.log('[App] AUTO-SAVING folders');
         saveFolders(folders);
      }
   }, [folders, isLibraryLoaded]);

   useEffect(() => {
      const timeSinceMount = Date.now() - mountTime.current;
      if (timeSinceMount < 3000) return;

      if (isLibraryLoaded && hasCompletedInitialLoad.current) {
         console.log('[App] AUTO-SAVING settings');
         saveSettings(settings);
      }
   }, [settings, isLibraryLoaded]);

   useEffect(() => {
      localStorage.setItem(STATS_KEY, JSON.stringify({ lifetimeCorrect }));
   }, [lifetimeCorrect]);

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

   const handleStartFromLibrary = (libSet: CardSet) => {
      // Sanitize the set to remove any zombie custom field data
      const sanitized = sanitizeSet(libSet);
      const updatedSet = { ...sanitized, isSessionActive: true, lastPlayed: Date.now() };

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
      // Sanitize to remove any zombie custom field data
      const sanitized = sanitizeSet(session);

      // Update in library with sanitized version
      setLibrarySets(prev => prev.map(s => s.id === session.id ? sanitized : s));

      setActiveSetId(session.id);
      setTimerStart(Date.now());
      setTimerNow(Date.now());
      setIsTimerPaused(false);
      setGameState(GameState.PLAYING);
   };

   const handleSaveToLibrary = (set: CardSet) => {
      const existingIdx = librarySets.findIndex(s => s.id === set.id);
      if (existingIdx !== -1) {
         setLibrarySets(prev => prev.map(s => s.id === set.id ? set : s));
      } else {
         setLibrarySets(prev => [set, ...prev]);
      }
   };

   const handleUpdateLibrarySet = (updatedSet: CardSet) => {
      setLibrarySets(prev => prev.map(s => s.id === updatedSet.id ? updatedSet : s));
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
            cards: set.cards.map(c => ({ ...c, mastery: 0 }))
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
         elapsedTime: newElapsedTime,
         lastPlayed: now
      };

      setLibrarySets(prev => {
         let nextLibrary = prev.map(s => s.id === updatedSession.id ? newSessionData : s);

         if (updatedSession.isMultistudy) {
            const updatedCardsMap = new Map(updatedSession.cards.map(c => [c.id, c]));

            nextLibrary = nextLibrary.map(set => {
               if (set.id === updatedSession.id) return set;
               const hasUpdates = set.cards.some(c => updatedCardsMap.has(c.id));
               if (!hasUpdates) return set;

               return {
                  ...set,
                  cards: set.cards.map(c => {
                     const updated = updatedCardsMap.get(c.id);
                     if (updated) {
                        return { ...c, ...updated };
                     }
                     return c;
                  })
               };
            });
         }
         return nextLibrary;
      });
   };



   const handleRenameSession = (newName: string) => {
      if (activeSession) {
         const updated = { ...activeSession, name: newName };
         setLibrarySets(prev => prev.map(s => s.id === activeSession.id ? updated : s));
      }
      setIsRenaming(false);
   };

   const handleFinish = () => {
      if (activeSession) {
         const now = Date.now();
         const delta = isTimerPaused ? 0 : (now - timerStart);
         const finalSet = {
            ...activeSession,
            elapsedTime: activeSession.elapsedTime + delta,
            lastPlayed: now
         };
         setLibrarySets(prev => prev.map(s => s.id === finalSet.id ? finalSet : s));
      }
      setGameState(GameState.WIN);
   };

   const handleBackToMenu = () => {
      if (activeSession && gameState === GameState.PLAYING) {
         const now = Date.now();
         const delta = isTimerPaused ? 0 : (now - timerStart);
         const finalSet = {
            ...activeSession,
            elapsedTime: activeSession.elapsedTime + delta,
            lastPlayed: now
         };
         setLibrarySets(prev => prev.map(s => s.id === finalSet.id ? finalSet : s));
      }
      setGameState(GameState.MENU);
      setActiveSetId(null);
      setIsRenaming(false);
   };

   // Handle back from Learn mode to Set Detail
   const handleBackFromLearnToDetail = () => {
      if (activeSession && gameState === GameState.PLAYING) {
         const now = Date.now();
         const delta = isTimerPaused ? 0 : (now - timerStart);
         const finalSet = {
            ...activeSession,
            elapsedTime: activeSession.elapsedTime + delta,
            lastPlayed: now
         };
         setLibrarySets(prev => prev.map(s => s.id === finalSet.id ? finalSet : s));
         setDetailSetId(activeSession.id);
      }
      setGameState(GameState.SET_DETAIL);
      setActiveSetId(null);
      setIsRenaming(false);
   };

   const handleRestart = () => {
      if (!activeSession) return;

      const resetSession = {
         ...activeSession,
         elapsedTime: 0,
         topStreak: 0,
         cards: activeSession.cards.map(c => ({ ...c, mastery: 0 }))
      };

      setLibrarySets(prev => prev.map(s => s.id === resetSession.id ? resetSession : s));
      setTimerStart(Date.now());
      setTimerNow(Date.now());
      setIsTimerPaused(false);
      setGameState(GameState.PLAYING);
   };

   const handleSaveStarredToLibrary = () => {
      if (!activeSession) return;
      const starred = activeSession.cards.filter(c => c.star);
      if (starred.length === 0) return;

      const newSet: CardSet = {
         id: generateId(),
         name: `${activeSession.name} (Starred)`,
         cards: starred.map(c => ({ ...c, mastery: 0 })),
         lastPlayed: Date.now(),
         elapsedTime: 0,
         topStreak: 0
      };
      handleSaveToLibrary(newSet);
      alert("Saved starred cards as a new set in Library!");
   };

   const handleResetSettings = async () => {
      setSettings({ ...DEFAULT_SETTINGS });
      await resetSettingsToDefault();
   };

   return (
      <div className="min-h-screen flex flex-col bg-bg text-text font-sans selection:bg-accent selection:text-bg transition-colors duration-300">
         {gameState === GameState.WIN && <Confetti />}

         <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            settings={settings}
            onUpdate={updateSettings}
            onDeleteData={handleDeleteData}
            onExportData={handleExportData}
            onResetSettings={handleResetSettings}
            librarySets={librarySets}
            user={user}
            lifetimeCorrect={lifetimeCorrect}
            onLogin={handleLogin}
            onLogout={handleLogout}
            initialTab={settingsInitialTab}
            tags={tags}
            onUpdateTags={(newTags) => {
               setTags(newTags);
               saveTags(newTags);
            }}
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
         />




         <PrivacyPolicyModal
            isOpen={isPrivacyOpen}
            onClose={() => setIsPrivacyOpen(false)}
         />

         <TermsOfServiceModal
            isOpen={isTermsOpen}
            onClose={() => setIsTermsOpen(false)}
         />

         {/* Corruption Notification */}
         <CorruptionNotification
            reports={corruptionReports}
            onDismiss={() => setCorruptionReports([])}
         />

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
                     className="flex items-center gap-2 px-2 py-1 rounded-lg bg-panel-2 border border-outline hover:border-accent transition-all"
                     title={user ? `Logged in as ${user.email}` : "Account"}
                  >
                     {user ? (
                        <img
                           src={user.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || 'U')}&background=random&size=32`}
                           alt="Profile"
                           className="w-6 h-6 rounded-full"
                        />
                     ) : (
                        <div className="w-6 h-6 rounded-full bg-outline/20 flex items-center justify-center">
                           <Cloud size={14} className="text-muted" />
                        </div>
                     )}
                     <span className="text-xs text-muted hidden sm:block max-w-[80px] truncate">{user?.name?.split(' ')[0] || user?.email?.split('@')[0] || "Sign In"}</span>
                  </button>

                  {/* Cloud Sync Status Indicator */}
                  {user && cloudSyncStatus !== 'idle' && (
                     <div
                        className={clsx(
                           "flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-all",
                           cloudSyncStatus === 'saving' && "text-amber-400",
                           cloudSyncStatus === 'saved' && "text-emerald-400",
                           cloudSyncStatus === 'saved_faded' && "text-muted",
                           cloudSyncStatus === 'error' && "text-red-400"
                        )}
                        title={
                           cloudSyncStatus === 'saving' ? 'Flashcardsish is currently syncing your data with Google Drive.' :
                              (cloudSyncStatus === 'saved' || cloudSyncStatus === 'saved_faded') ? 'Flashcardsish has finished syncing your data with Google Drive.' :
                                 'Failed to save to cloud'
                        }
                     >

                        {cloudSyncStatus === 'saving' && (
                           <RefreshCw size={14} className="animate-spin" />
                        )}
                        {(cloudSyncStatus === 'saved' || cloudSyncStatus === 'saved_faded') && (
                           <CheckCircle2 size={14} />
                        )}
                        {cloudSyncStatus === 'error' && (
                           <XCircle size={14} />
                        )}
                     </div>
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

         <main className="flex-grow p-6 md:p-8 max-w-5xl mx-auto w-full">
            {gameState === GameState.MENU && (
               <StartMenu
                  isCloudLoading={isCloudLoading || !isLibraryLoaded}
                  librarySets={librarySets}
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
                     saveTags(newTags);
                  }}
                  appliedTags={appliedTags}
                  onOpenSettings={() => {
                     setSettingsInitialTab('tags');
                     setIsSettingsOpen(true);
                  }}
                  setAppliedTags={setAppliedTags}
               />
            )}

            {gameState === GameState.SET_DETAIL && detailSet && (
               <SetDetail
                  set={detailSet}
                  settings={settings}
                  onBack={handleBackFromDetail}
                  onStartLearn={handleStartLearnFromDetail}
                  onStartFlashcards={handleStartFlashcardsFromDetail}
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-lg px-6">
                     <button
                        onClick={handleRestart}
                        className="bg-panel-2 border border-outline text-text px-6 py-4 rounded-xl font-bold text-lg hover:border-accent transition-all shadow-sm flex items-center justify-center gap-2"
                     >
                        <RotateCcw size={20} /> Restart Session
                     </button>

                     {activeSession && activeSession.cards.some(c => c.star) && (
                        <button
                           onClick={handleSaveStarredToLibrary}
                           className="bg-panel-2 border border-outline text-text px-6 py-4 rounded-xl font-bold text-lg hover:border-accent transition-colors shadow-sm flex items-center justify-center gap-2"
                        >
                           <span className="text-yellow text-xl">★</span> Save Starred
                        </button>
                     )}

                     <button
                        onClick={handleBackToMenu}
                        className="bg-panel-2 border border-outline text-text px-6 py-4 rounded-xl font-bold text-lg hover:border-accent transition-colors shadow-sm flex items-center justify-center gap-2 md:col-span-2"
                     >
                        <FolderOpen size={20} /> Save & Back to Menu
                     </button>

                     <button
                        onClick={() => {
                           if (activeSession) handleDeleteSession(activeSession.id);
                           handleBackToMenu();
                        }}
                        className="bg-panel-2 border border-outline text-red px-6 py-4 rounded-xl font-bold text-lg hover:border-red hover:bg-red/10 transition-colors shadow-sm flex items-center justify-center gap-2 md:col-span-2"
                     >
                        <Trash2 size={20} /> Finish & Remove Session
                     </button>
                  </div>
               </div>
            )}

            {gameState === GameState.DOCUMENTATION && (
               <Documentation onBack={() => setGameState(previousGameState)} />
            )}
         </main>

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
               <span className="text-outline">•</span>
               <button
                  onClick={() => setIsTermsOpen(true)}
                  className="hover:text-accent hover:opacity-100 transition-all underline-offset-2 hover:underline"
               >
                  Terms of Service
               </button>
            </div>
         </footer>
      </div>
   );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />)
