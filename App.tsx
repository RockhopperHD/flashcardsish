import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { CardSet, GameState, Settings, Folder } from './types';
import { fmtTime, generateId } from './utils';
import { StartMenu } from './components/StartMenu';
import { Game } from './components/Game';
import { SetDetail } from './components/SetDetail';
import { Confetti } from './components/Confetti';
import { PrivacyPolicyModal } from './components/PrivacyPolicy';
import { TermsOfServiceModal } from './components/TermsOfService';
import { Documentation } from './components/Documentation';
import { FlashcardsMode } from './components/FlashcardsMode';
import { Clock, ArrowLeft, Settings as SettingsIcon, X, BookOpen, Heart, RotateCcw, FolderOpen, LayoutGrid, Type, Trash2, LogIn, LogOut, Cloud, Download, FileText, File } from 'lucide-react';
import clsx from 'clsx';
import { saveLibrary, loadLibrary, saveFolders, loadAllUserData, saveSettings, deleteAllUserData } from './storage';
import { supabase } from './src/supabaseClient';
import { User } from '@supabase/supabase-js';

const LIBRARY_KEY = 'flashcard-library-v3';
const FOLDERS_KEY = 'flashcard-folders-v1';
const SETTINGS_KEY = 'flashcard-settings-v2';
const STATS_KEY = 'flashcard-stats-v1';

// Settings Modal Component - Two Tab Sidebar Layout
const SettingsModal: React.FC<{
   isOpen: boolean;
   onClose: () => void;
   settings: Settings;
   onUpdate: (s: Settings) => void;
   user: User | null;
   onLogin: () => void;
   onLogout: () => void;
   onDeleteData: () => void;
   onExportData: () => void;
}> = ({ isOpen, onClose, settings, onUpdate, user, onLogin, onLogout, onDeleteData, onExportData }) => {
   const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
   const [activeTab, setActiveTab] = useState<'set' | 'global'>('set');
   const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

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
      answerWithDefinition: "Flip the cards—you'll see the term and type the definition instead.",
      learnMode: "Choose how you want to answer: type your answer (Standard) or pick from options (Multiple Choice).",
      hideTooltips: "Turns on or off Helper Tooltips, like this one. This tooltip appears regardless of if this setting is on or not.",
      darkMode: "Toggle between dark and light themes for the app.",
      cloudSync: "Sign in to sync your flashcard sets across all your devices for free.",
      exportData: "Download all your flashcard sets, folders, and settings as a JSON file for backup or transfer.",
      dangerZone: "Permanently delete all your data from this device and the cloud. This cannot be undone."
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

         // Allow empty string while typing
         if (val === '') {
            setError("Cannot be empty");
            return;
         }

         const num = parseInt(val);
         if (isNaN(num) || num < 1 || num > 6) {
            setError("Must be between 1 and 6");
            // Update rect immediately to ensure tooltip shows in right place
            if (inputRef.current) setRect(inputRef.current.getBoundingClientRect());
         } else {
            setError(null);
            onChange(num);
         }
      };

      const handleMouseEnter = (e: React.MouseEvent) => {
         setRect(e.currentTarget.getBoundingClientRect());
      };

      return (
         <div className="relative" onMouseEnter={handleMouseEnter}>
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

   // Setting Row Component with tooltip support
   const SettingRow: React.FC<{
      id: string;
      label: string;
      settingKey: keyof Settings;
      alwaysShowTooltip?: boolean;
   }> = ({ id, label, settingKey, alwaysShowTooltip }) => {
      const [hovered, setHovered] = useState(false);
      const [rect, setRect] = useState<DOMRect | null>(null);
      const showTooltip = alwaysShowTooltip ? hovered : (hovered && !settings.hideTooltips);

      const updateRect = (e: React.MouseEvent) => {
         setRect(e.currentTarget.getBoundingClientRect());
      };

      return (
         <div className="relative">
            <label
               className="flex items-center justify-between p-3 bg-panel-2 rounded-xl cursor-pointer hover:border-accent border border-transparent transition-all"
               onMouseEnter={(e) => { setHovered(true); updateRect(e); }}
               onMouseLeave={() => setHovered(false)}
            >
               <span className="font-medium text-text">{label}</span>
               <div
                  onClick={(e) => { e.stopPropagation(); toggle(settingKey); }}
                  className={clsx("w-12 h-6 rounded-full p-1 transition-colors", settings[settingKey] ? "bg-accent" : "bg-outline")}
               >
                  <div className={clsx("bg-bg w-4 h-4 rounded-full shadow-sm transition-transform", settings[settingKey] ? "translate-x-6" : "translate-x-0")} />
               </div>
            </label>
            {showTooltip && tooltips[id] && rect && (
               <div
                  className="fixed z-[100] px-4 py-3 rounded-lg text-xs font-medium shadow-xl animate-in fade-in zoom-in-95 pointer-events-none w-64 text-center bg-[#422006] text-[#FEF3C7] border border-[#78350F]"
                  style={{
                     top: rect.top - 12,
                     left: rect.left + (rect.width / 2),
                     transform: 'translate(-50%, -100%)'
                  }}
               >
                  {tooltips[id]}
                  <div className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bottom-[-5px] bg-[#422006] border-r border-b border-[#78350F]"></div>
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
      children: React.ReactNode;
   }> = ({ id, tooltip, hideWhenSetting = true, children }) => {
      const [hovered, setHovered] = useState(false);
      const [rect, setRect] = useState<DOMRect | null>(null);
      const showTooltip = hideWhenSetting ? (hovered && !settings.hideTooltips) : hovered;

      const updateRect = (e: React.MouseEvent) => {
         setRect(e.currentTarget.getBoundingClientRect());
      };

      return (
         <div
            className="relative"
            onMouseEnter={(e) => { setHovered(true); updateRect(e); }}
            onMouseLeave={() => setHovered(false)}
         >
            {children}
            {showTooltip && rect && (
               <div
                  className="fixed z-[100] px-4 py-3 rounded-lg text-xs font-medium shadow-xl animate-in fade-in zoom-in-95 pointer-events-none w-64 text-center bg-[#422006] text-[#FEF3C7] border border-[#78350F]"
                  style={{
                     top: rect.top - 12,
                     left: rect.left + (rect.width / 2),
                     transform: 'translate(-50%, -100%)'
                  }}
               >
                  {tooltip}
                  <div className="absolute left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bottom-[-5px] bg-[#422006] border-r border-b border-[#78350F]"></div>
               </div>
            )}
         </div>
      );
   };

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onMouseDown={onClose}>
         <div
            className="bg-panel border border-outline rounded-2xl shadow-2xl animate-in zoom-in-95 w-full max-w-md md:max-w-3xl lg:max-w-4xl h-[600px] md:h-[750px] max-h-[90vh] flex flex-col"
            onMouseDown={(e) => e.stopPropagation()}
         >
            {/* Header */}
            <div className="flex justify-between items-center p-6 border-b border-outline shrink-0">
               <h2 className="text-3xl font-extrabold text-text">Settings</h2>
               <button onClick={onClose} className="text-muted hover:text-text p-2 rounded-lg hover:bg-panel-2 transition-colors">
                  <X size={24} />
               </button>
            </div>

            {/* Content with Sidebar */}
            <div className="flex flex-1 min-h-0">
               {/* Sidebar Navigation */}
               <div className="w-48 shrink-0 border-r border-outline p-4 hidden md:block">
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
                        <span className="font-medium">Set Settings</span>
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
                        <SettingsIcon size={18} className={activeTab === 'global' ? "text-accent" : "text-muted"} />
                        <span className="font-medium">Global Settings</span>
                     </button>
                  </nav>
               </div>

               {/* Mobile Tab Selector */}
               <div className="md:hidden p-4 border-b border-outline w-full shrink-0">
                  <div className="grid grid-cols-2 gap-2">
                     <button
                        onClick={() => setActiveTab('set')}
                        className={clsx(
                           "py-2 px-4 rounded-lg text-sm font-bold transition-all",
                           activeTab === 'set'
                              ? "bg-accent text-bg"
                              : "bg-panel-2 text-muted hover:text-text"
                        )}
                     >
                        Set Settings
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
                        Global Settings
                     </button>
                  </div>
               </div>

               {/* Main Content Area */}
               <div className="flex-1 p-6 overflow-y-auto overflow-x-visible">
                  {activeTab === 'set' && (
                     <div className="space-y-4">
                        {/* Forgive Spelling Errors & Sub-options */}
                        <div className="bg-panel-2/50 rounded-xl overflow-hidden border border-transparent transition-all hover:border-outline/50">
                           <SettingRow
                              id="forgiveSpellingErrors"
                              label="Forgive Minor Spelling Errors"
                              settingKey="forgiveSpellingErrors"
                           />

                           {settings.forgiveSpellingErrors && (
                              <div className="space-y-1 pb-3 pt-1 px-3">
                                 {/* Sub-options */}
                                 <div className="pl-6 border-l-2 border-outline/30 space-y-3 ml-2">
                                    {/* Ignore Diacritics */}
                                    <div className="flex items-center justify-between">
                                       <TooltipWrapper id="ignoreDiacritics" tooltip={tooltips.ignoreDiacritics}>
                                          <label className="text-sm text-text/80 cursor-pointer hover:text-text transition-colors">Ignore diacritics (é, ñ)</label>
                                       </TooltipWrapper>
                                       <div
                                          onClick={() => toggle('ignoreDiacritics')}
                                          className={clsx("w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer shrink-0", settings.ignoreDiacritics ? "bg-accent" : "bg-outline")}
                                       >
                                          <div className={clsx("bg-bg w-3 h-3 rounded-full shadow-sm transition-transform", settings.ignoreDiacritics ? "translate-x-4" : "translate-x-0")} />
                                       </div>
                                    </div>

                                    {/* Ignore Capitalization */}
                                    <div className="flex items-center justify-between">
                                       <TooltipWrapper id="ignoreCapitalization" tooltip={tooltips.ignoreCapitalization}>
                                          <label className="text-sm text-text/80 cursor-pointer hover:text-text transition-colors">Ignore capitalization</label>
                                       </TooltipWrapper>
                                       <div
                                          onClick={() => toggle('ignoreCapitalization')}
                                          className={clsx("w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer shrink-0", settings.ignoreCapitalization ? "bg-accent" : "bg-outline")}
                                       >
                                          <div className={clsx("bg-bg w-3 h-3 rounded-full shadow-sm transition-transform", settings.ignoreCapitalization ? "translate-x-4" : "translate-x-0")} />
                                       </div>
                                    </div>

                                    {/* Forgive "the" */}
                                    <div className="flex items-center justify-between">
                                       <TooltipWrapper id="forgiveThe" tooltip={tooltips.forgiveThe}>
                                          <label className="text-sm text-text/80 cursor-pointer hover:text-text transition-colors">Forgive "the"</label>
                                       </TooltipWrapper>
                                       <div
                                          onClick={() => toggle('forgiveThe')}
                                          className={clsx("w-8 h-4 rounded-full p-0.5 transition-colors cursor-pointer shrink-0", settings.forgiveThe ? "bg-accent" : "bg-outline")}
                                       >
                                          <div className={clsx("bg-bg w-3 h-3 rounded-full shadow-sm transition-transform", settings.forgiveThe ? "translate-x-4" : "translate-x-0")} />
                                       </div>
                                    </div>

                                    {/* Wiggle Room */}
                                    <div className="flex items-center justify-between">
                                       <TooltipWrapper id="wiggleRoom" tooltip={tooltips.wiggleRoom}>
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

                        <SettingRow id="retypeOnMistake" label="Retype Mistakes" settingKey="retypeOnMistake" />
                        <SettingRow id="starredOnly" label="Study Starred Only" settingKey="starredOnly" />

                        {/* Answer With Toggle */}
                        <TooltipWrapper id="answerWithDefinition" tooltip={tooltips.answerWithDefinition}>
                           <div className="p-3 bg-panel-2 rounded-xl border border-transparent hover:border-accent transition-all">
                              <span className="font-medium text-text block mb-3">Answer With</span>
                              <div className="grid grid-cols-2 gap-2">
                                 <button
                                    onClick={() => onUpdate({ ...settings, answerWithDefinition: false })}
                                    className={clsx(
                                       "flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all border",
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
                                       "flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all border",
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

                        {/* Learn Game Mode */}
                        <TooltipWrapper id="learnMode" tooltip={tooltips.learnMode}>
                           <div className="p-3 bg-panel-2 rounded-xl border border-transparent hover:border-accent transition-all">
                              <span className="font-medium text-text block mb-3">Learn Game Mode</span>
                              <div className="grid grid-cols-2 gap-2">
                                 <button
                                    onClick={() => onUpdate({ ...settings, mode: 'standard' })}
                                    className={clsx(
                                       "flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all border",
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
                                       "flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-bold transition-all border",
                                       settings.mode === 'multiple_choice'
                                          ? "bg-accent text-bg border-accent"
                                          : "bg-panel border-outline text-muted hover:text-text hover:border-accent/50"
                                    )}
                                 >
                                    <LayoutGrid size={16} /> Multiple Choice
                                 </button>
                              </div>
                           </div>
                        </TooltipWrapper>
                     </div>
                  )}

                  {activeTab === 'global' && (
                     <div className="space-y-4">
                        {/* Cloud Sync Box */}
                        <TooltipWrapper id="cloudSync" tooltip={tooltips.cloudSync}>
                           <div className="p-6 bg-panel-2 rounded-2xl border border-outline/50 hover:border-accent transition-all relative overflow-hidden">
                              <span className="font-medium text-text block mb-4 flex items-center gap-2">
                                 <Cloud size={18} className="text-accent" /> Cloud Sync
                              </span>
                              {user ? (
                                 <div className="flex items-center gap-6">
                                    <img
                                       src={user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || 'U')}&background=random&size=128`}
                                       alt="Profile"
                                       className="w-24 h-24 rounded-full border-4 border-bg shadow-lg object-cover bg-panel"
                                    />
                                    <div className="flex flex-col items-start min-w-0">
                                       <span className="text-sm text-muted font-medium mb-0.5">You're signed in as</span>
                                       <div className="text-2xl font-bold text-text truncate w-full max-w-[200px] md:max-w-[300px] mb-3" title={user.email}>
                                          {user.user_metadata?.full_name || user.email?.split('@')[0]}
                                       </div>
                                       <button
                                          onClick={onLogout}
                                          className="px-6 py-2 border-2 border-outline rounded-xl text-sm font-bold hover:bg-red/5 hover:text-red hover:border-red/30 transition-all shadow-sm flex items-center gap-2"
                                       >
                                          Sign Out
                                       </button>
                                    </div>
                                 </div>
                              ) : (
                                 <button
                                    onClick={onLogin}
                                    className="w-full flex items-center justify-center gap-2 py-3 bg-text text-bg rounded-xl font-bold hover:opacity-90 transition-opacity shadow-lg"
                                 >
                                    <LogIn size={18} /> Log in with Google
                                 </button>
                              )}
                           </div>
                        </TooltipWrapper>

                        {/* Hide Helper Tooltips - Always shows its own tooltip */}
                        <SettingRow id="hideTooltips" label="Hide Helper Tooltips" settingKey="hideTooltips" alwaysShowTooltip />

                        {/* Dark Mode */}
                        <SettingRow id="darkMode" label="Dark Mode" settingKey="darkMode" />

                        {/* Export Data Box */}
                        <TooltipWrapper id="exportData" tooltip={tooltips.exportData}>
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
                        </TooltipWrapper>

                        {/* Danger Zone */}
                        <TooltipWrapper id="dangerZone" tooltip={tooltips.dangerZone}>
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
                        </TooltipWrapper>
                     </div>
                  )}
               </div>
            </div>
         </div>
      </div>
   );
};


const App: React.FC = () => {
   const [gameState, setGameState] = useState<GameState>(GameState.MENU);
   const [previousGameState, setPreviousGameState] = useState<GameState>(GameState.MENU);

   const [user, setUser] = useState<User | null>(null);
   const [librarySets, setLibrarySets] = useState<CardSet[]>([]);
   const [isLibraryLoaded, setIsLibraryLoaded] = useState(false);
   const [folders, setFolders] = useState<Folder[]>([]);
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
      hideTooltips: false
   });

   // Modals
   const [isSettingsOpen, setIsSettingsOpen] = useState(false);

   const [isPrivacyOpen, setIsPrivacyOpen] = useState(false);
   const [isTermsOpen, setIsTermsOpen] = useState(false);

   // Set Detail View
   const [detailSetId, setDetailSetId] = useState<string | null>(null);
   const detailSet = librarySets.find(s => s.id === detailSetId) || null;

   // Edit Request (from SetDetail to StartMenu)
   const [editRequestSetId, setEditRequestSetId] = useState<string | null>(null);

   // Timer State
   const [timerStart, setTimerStart] = useState<number>(0);
   const [timerNow, setTimerNow] = useState<number>(0);
   const [isTimerPaused, setIsTimerPaused] = useState(false);
   const [lastPauseTime, setLastPauseTime] = useState(0);

   // Renaming State
   const [isRenaming, setIsRenaming] = useState(false);

   // Stats
   const [lifetimeCorrect, setLifetimeCorrect] = useState(0);

   // --- AUTH & CLOUD SYNC ---

   const handleLogin = async () => {
      await supabase.auth.signInWithOAuth({
         provider: 'google',
         options: { redirectTo: window.location.origin } // or your specific supabase callback URL
      });
   };

   const handleLogout = async () => {
      await supabase.auth.signOut();
      setUser(null);
      // Optional: clear local state or reload to reset
      window.location.reload();
   };

   const handleDeleteData = async () => {
      const result = await deleteAllUserData();
      if (result.success) {
         // Sign out and reload
         await supabase.auth.signOut();
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

   // Listen for Auth Changes
   useEffect(() => {
      // Check initial session
      supabase.auth.getSession().then(({ data: { session } }) => {
         setUser(session?.user ?? null);
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
         setUser(session?.user ?? null);
         if (session?.user) {
            // User just logged in (or session refreshed), fetch cloud data
            loadAllUserData().then(data => {
               if (data) {
                  if (data.library_sets && data.library_sets.length > 0) setLibrarySets(data.library_sets);
                  if (data.folders && data.folders.length > 0) setFolders(data.folders);
                  if (data.settings && Object.keys(data.settings).length > 0) setSettings(data.settings);
               }
            });
         }
      });

      return () => subscription.unsubscribe();
   }, []);


   // Load Initial Data (Local Only - Cloud handled by Auth Effect)
   useEffect(() => {
      const loadData = async () => {
         // Only load local if we aren't waiting for cloud auth? 
         // Actually, standard pattern: Load local first for speed, then overwrite with cloud if auth.

         const idbSets = await loadLibrary(); // This now intelligently checks auth internally too

         let setsToUse = idbSets;

         // Rescue Strategy for LocalStorage
         if (!setsToUse || setsToUse.length === 0) {
            const localLibrary = localStorage.getItem(LIBRARY_KEY);
            if (localLibrary) {
               try {
                  const parsed = JSON.parse(localLibrary);
                  if (Array.isArray(parsed) && parsed.length > 0) {
                     setsToUse = parsed;
                     // Only save back if we are sure?
                     // await saveLibrary(parsed); 
                  }
               } catch (e) { console.error("Error parsing local library:", e); }
            }
         }

         if (setsToUse) {
            setLibrarySets(setsToUse);
         }
         setIsLibraryLoaded(true);

         // Folders
         const savedFolders = localStorage.getItem(FOLDERS_KEY);
         if (savedFolders) {
            try { setFolders(JSON.parse(savedFolders)); } catch (e) { }
         }

         // Settings
         const savedSettings = localStorage.getItem(SETTINGS_KEY);
         if (savedSettings) {
            try {
               const s = JSON.parse(savedSettings);
               setSettings({ ...settings, ...s });
            } catch (e) { }
         }

         const savedStats = localStorage.getItem(STATS_KEY);
         if (savedStats) {
            try { setLifetimeCorrect(JSON.parse(savedStats).lifetimeCorrect || 0); } catch (e) { }
         }
      };

      loadData();
   }, []);

   // Save Effects
   useEffect(() => {
      if (isLibraryLoaded) {
         saveLibrary(librarySets);
      }
   }, [librarySets, isLibraryLoaded]);

   useEffect(() => {
      if (isLibraryLoaded) {
         saveFolders(folders);
      }
   }, [folders, isLibraryLoaded]);

   useEffect(() => {
      if (isLibraryLoaded) {
         saveSettings(settings);
      }
   }, [settings, isLibraryLoaded]);

   useEffect(() => {
      localStorage.setItem(STATS_KEY, JSON.stringify({ lifetimeCorrect }));
   }, [lifetimeCorrect]);

   useEffect(() => {
      if (settings.darkMode) {
         document.body.classList.remove('light-mode');
      } else {
         document.body.classList.add('light-mode');
      }
   }, [settings.darkMode]);

   const updateSettings = (newSettings: Settings) => {
      setSettings(newSettings);
      // Saved via effect
   };

   // Timer Logic
   useEffect(() => {
      let interval: number;
      if (gameState === GameState.PLAYING && !isTimerPaused) {
         if (timerStart === 0) setTimerStart(Date.now());

         interval = window.setInterval(() => {
            setTimerNow(Date.now());
         }, 500);
      }
      return () => clearInterval(interval);
   }, [gameState, isTimerPaused, timerStart]);

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
      const updatedSet = { ...libSet, isSessionActive: true, lastPlayed: Date.now() };

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

   return (
      <div className="min-h-screen flex flex-col bg-bg text-text font-sans selection:bg-accent selection:text-bg transition-colors duration-300">
         {gameState === GameState.WIN && <Confetti />}

         <SettingsModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            settings={settings}
            onUpdate={updateSettings}
            user={user}
            onLogin={handleLogin}
            onLogout={handleLogout}
            onDeleteData={handleDeleteData}
            onExportData={handleExportData}
         />


         <PrivacyPolicyModal
            isOpen={isPrivacyOpen}
            onClose={() => setIsPrivacyOpen(false)}
         />

         <TermsOfServiceModal
            isOpen={isTermsOpen}
            onClose={() => setIsTermsOpen(false)}
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
                     title="Documentation"
                  >
                     <BookOpen size={20} />
                  </button>
               </div>

               <div className="w-1/3 flex justify-center">
                  {gameState === GameState.PLAYING && activeSession ? (
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
                  ) : (
                     <div className="font-bold text-lg tracking-tight text-text opacity-80">Flashcardsish</div>
                  )}
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
                  {user ? (
                     <button
                        onClick={() => setIsSettingsOpen(true)}
                        className="flex items-center gap-2 px-2 py-1 rounded-lg bg-panel-2 border border-outline hover:border-accent transition-all"
                        title={`Logged in as ${user.email}`}
                     >
                        <div className="relative">
                           <img
                              src={user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || 'U')}&background=random&size=32`}
                              alt="Profile"
                              className="w-6 h-6 rounded-full"
                           />
                           <Cloud size={10} className="absolute -bottom-0.5 -right-0.5 text-green bg-panel rounded-full" />
                        </div>
                        <span className="text-xs text-muted hidden sm:block max-w-[80px] truncate">{user.user_metadata?.full_name?.split(' ')[0] || user.email?.split('@')[0]}</span>
                     </button>
                  ) : (
                     <button
                        onClick={handleLogin}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-muted hover:text-text border border-outline hover:border-accent rounded-lg transition-all"
                     >
                        <LogIn size={14} /> Sign In
                     </button>
                  )}

                  <button
                     onClick={() => setIsSettingsOpen(true)}
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
                  onExit={handleBackToMenu}
                  onCorrect={() => setLifetimeCorrect(p => p + 1)}
               />
            )}

            {gameState === GameState.FLASHCARDS && activeSession && (
               <FlashcardsMode
                  set={activeSession}
                  settings={settings}
                  onExit={() => {
                     setGameState(GameState.SET_DETAIL);
                     setActiveSetId(null);
                  }}
                  onUpdateSet={handleUpdateLibrarySet}
               />
            )}

            {gameState === GameState.WIN && (
               <div className="fixed inset-0 z-20 flex flex-col items-center justify-center bg-bg/95 backdrop-blur-xl animate-in fade-in duration-500">
                  <div className="text-center mb-10">
                     <h2 className="text-5xl font-bold text-accent mb-4 drop-shadow-[0_0_35px_rgba(208,164,94,0.4)]">
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