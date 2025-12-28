import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { CardSet, GameState, Settings, Folder } from './types';
import { fmtTime, generateId } from './utils';
import { StartMenu } from './components/StartMenu';
import { Game } from './components/Game';
import { Confetti } from './components/Confetti';
import { Clock, ArrowLeft, Settings as SettingsIcon, X, HelpCircle, Heart, RotateCcw, FolderOpen, LayoutGrid, Type, Trash2, LogIn, LogOut, Cloud } from 'lucide-react';
import clsx from 'clsx';
import { saveLibrary, loadLibrary, saveFolders, loadAllUserData, saveSettings } from './storage';
import { supabase } from './src/supabaseClient';
import { User } from '@supabase/supabase-js';

const LIBRARY_KEY = 'flashcard-library-v3';
const FOLDERS_KEY = 'flashcard-folders-v1';
const SETTINGS_KEY = 'flashcard-settings-v2';
const STATS_KEY = 'flashcard-stats-v1';

// Settings Modal Component
const SettingsModal: React.FC<{
   isOpen: boolean;
   onClose: () => void;
   settings: Settings;
   onUpdate: (s: Settings) => void;
   user: User | null;
   onLogin: () => void;
   onLogout: () => void;
}> = ({ isOpen, onClose, settings, onUpdate, user, onLogin, onLogout }) => {
   if (!isOpen) return null;

   const toggle = (key: keyof Settings) => {
      onUpdate({ ...settings, [key]: !settings[key] });
   };

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
         <div className="bg-panel border border-outline rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
               <h2 className="text-xl font-bold text-text">Settings</h2>
               <button onClick={onClose} className="text-muted hover:text-text">
                  <X size={24} />
               </button>
            </div>

            <div className="space-y-4">
               {/* --- ACCOUNT SECTION --- */}
               <div className="p-4 bg-panel-2 rounded-xl border border-outline/50">
                  <span className="font-medium text-text block mb-3 flex items-center gap-2">
                     <Cloud size={18} className="text-accent" /> Cloud Sync
                  </span>
                  {user ? (
                     <div className="flex items-center justify-between">
                        <div className="text-sm">
                           <div className="text-muted">Logged in as</div>
                           <div className="font-bold text-text truncate max-w-[150px]">{user.email}</div>
                        </div>
                        <button
                           onClick={onLogout}
                           className="flex items-center gap-2 px-3 py-1.5 bg-red/10 text-red rounded-lg text-sm font-bold hover:bg-red/20 transition-colors"
                        >
                           <LogOut size={14} /> Log Out
                        </button>
                     </div>
                  ) : (
                     <button
                        onClick={onLogin}
                        className="w-full flex items-center justify-center gap-2 py-2 bg-text text-bg rounded-lg font-bold hover:opacity-90 transition-opacity"
                     >
                        <LogIn size={16} /> Log in with Google
                     </button>
                  )}
               </div>

               <div className="h-px bg-outline/50 my-2" />

               <label className="flex items-center justify-between p-3 bg-panel-2 rounded-xl cursor-pointer hover:border-accent border border-transparent transition-all">
                  <span className="font-medium text-text">Strict Spelling</span>
                  <div onClick={() => toggle('strictSpelling')} className={clsx("w-12 h-6 rounded-full p-1 transition-colors", settings.strictSpelling ? "bg-accent" : "bg-outline")}>
                     <div className={clsx("bg-bg w-4 h-4 rounded-full shadow-sm transition-transform", settings.strictSpelling ? "translate-x-6" : "translate-x-0")} />
                  </div>
               </label>

               <label className="flex items-center justify-between p-3 bg-panel-2 rounded-xl cursor-pointer hover:border-accent border border-transparent transition-all">
                  <span className="font-medium text-text">Retype Mistakes</span>
                  <div onClick={() => toggle('retypeOnMistake')} className={clsx("w-12 h-6 rounded-full p-1 transition-colors", settings.retypeOnMistake ? "bg-accent" : "bg-outline")}>
                     <div className={clsx("bg-bg w-4 h-4 rounded-full shadow-sm transition-transform", settings.retypeOnMistake ? "translate-x-6" : "translate-x-0")} />
                  </div>
               </label>

               <label className="flex items-center justify-between p-3 bg-panel-2 rounded-xl cursor-pointer hover:border-accent border border-transparent transition-all">
                  <span className="font-medium text-text">Dark Mode</span>
                  <div onClick={() => toggle('darkMode')} className={clsx("w-12 h-6 rounded-full p-1 transition-colors", settings.darkMode ? "bg-accent" : "bg-outline")}>
                     <div className={clsx("bg-bg w-4 h-4 rounded-full shadow-sm transition-transform", settings.darkMode ? "translate-x-6" : "translate-x-0")} />
                  </div>
               </label>

               <label className="flex items-center justify-between p-3 bg-panel-2 rounded-xl cursor-pointer hover:border-accent border border-transparent transition-all">
                  <span className="font-medium text-text">Study Starred Only</span>
                  <div onClick={() => toggle('starredOnly')} className={clsx("w-12 h-6 rounded-full p-1 transition-colors", settings.starredOnly ? "bg-accent" : "bg-outline")}>
                     <div className={clsx("bg-bg w-4 h-4 rounded-full shadow-sm transition-transform", settings.starredOnly ? "translate-x-6" : "translate-x-0")} />
                  </div>
               </label>

               <div className="p-3 bg-panel-2 rounded-xl border border-transparent">
                  <span className="font-medium text-text block mb-3">Game Mode</span>
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
            </div>
         </div>
      </div>
   );
};

// Set Preview Modal
const SetPreviewModal: React.FC<{
   set: CardSet | null;
   onClose: () => void;
   onUpdateSet: (s: CardSet) => void;
   mode: 'library' | 'session';
}> = ({ set, onClose, onUpdateSet, mode }) => {
   if (!set) return null;

   const toggleStar = (cardId: string) => {
      const newCards = set.cards.map(c => c.id === cardId ? { ...c, star: !c.star } : c);
      onUpdateSet({ ...set, cards: newCards });
   };

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
         <div className="bg-panel border border-outline rounded-2xl p-0 w-full max-w-2xl shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-outline flex justify-between items-center bg-panel-2 rounded-t-2xl">
               <div>
                  <h2 className="text-xl font-bold text-text">{set.name}</h2>
                  <div className="text-sm text-muted">{set.cards.length} cards &bull; {mode === 'library' ? 'Template' : 'Active Session'}</div>
               </div>
               <button onClick={onClose}><X size={20} className="text-muted hover:text-text" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-3">
               {set.cards.map((card, i) => (
                  <div key={card.id} className="flex gap-4 p-4 border border-outline rounded-xl bg-panel items-start">
                     <div className="text-xs font-mono text-muted pt-1 w-6">{i + 1}</div>

                     {card.image && (
                        <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-outline bg-panel-2 flex items-center justify-center">
                           <img src={card.image} alt="Thumbnail" className="w-full h-full object-cover" />
                        </div>
                     )}

                     <div className="flex-1 min-w-0">
                        <div className="font-bold text-text mb-1 truncate">{card.term.join(' / ')}</div>
                        <div className="text-sm text-muted line-clamp-2">{card.content}</div>
                        {card.year && <div className="text-xs text-accent mt-1">{card.year}</div>}
                     </div>
                     {mode === 'session' && (
                        <div className="pt-1 flex flex-col items-center gap-1">
                           <div className={clsx("w-2 h-2 rounded-full", card.mastery >= 1 ? "bg-green" : "bg-outline")}></div>
                           <div className={clsx("w-2 h-2 rounded-full", card.mastery >= 2 ? "bg-green" : "bg-outline")}></div>
                        </div>
                     )}
                     <button onClick={() => toggleStar(card.id)} className="pt-1">
                        {card.star ? <span className="text-yellow text-lg">★</span> : <span className="text-outline hover:text-muted text-lg">☆</span>}
                     </button>
                  </div>
               ))}
            </div>
         </div>
      </div>
   );
};

// Info Modal Component
const InfoModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
   if (!isOpen) return null;

   return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
         <div className="bg-panel border border-outline rounded-2xl p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 max-h-[80vh] overflow-y-auto custom-scrollbar" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
               <h2 className="text-2xl font-bold text-text">How to Use</h2>
               <button onClick={onClose} className="text-muted hover:text-text">
                  <X size={24} />
               </button>
            </div>

            <div className="space-y-6 text-text">
               <div>
                  <h3 className="text-lg font-bold text-accent mb-2">Getting Started</h3>
                  <ul className="list-disc pl-5 space-y-2 text-muted">
                     <li>Create a new set in the builder or import a file.</li>
                     <li>This saves it to your <b>Library</b>.</li>
                     <li>Raw text format: <code>Term / Definition /// Year</code>.</li>
                     <li>Separate cards with <code>&&&</code> on a new line.</li>
                  </ul>
               </div>

               <div>
                  <h3 className="text-lg font-bold text-accent mb-2">Study Mode</h3>
                  <ul className="list-disc pl-5 space-y-2 text-muted">
                     <li>Click "Play" on a set to start a new <b>Session</b>.</li>
                     <li>Sessions are saved separately from your Library templates.</li>
                     <li>Get it right twice to master a card.</li>
                  </ul>
               </div>

               <div>
                  <h3 className="text-lg font-bold text-accent mb-2">Cloud Sync</h3>
                  <ul className="list-disc pl-5 space-y-2 text-muted">
                     <li>Log in via Settings to sync your cards across devices.</li>
                     <li>Data is automatically saved to your account.</li>
                  </ul>
               </div>
            </div>
         </div>
      </div>
   );
};

const App: React.FC = () => {
   const [gameState, setGameState] = useState<GameState>(GameState.MENU);

   const [user, setUser] = useState<User | null>(null);
   const [librarySets, setLibrarySets] = useState<CardSet[]>([]);
   const [isLibraryLoaded, setIsLibraryLoaded] = useState(false);
   const [folders, setFolders] = useState<Folder[]>([]);
   const [activeSetId, setActiveSetId] = useState<string | null>(null);

   const activeSession = librarySets.find(s => s.id === activeSetId) || null;

   const [settings, setSettings] = useState<Settings>({
      strictSpelling: false,
      retypeOnMistake: false,
      darkMode: true,
      starredOnly: false,
      mode: 'standard'
   });

   // Modals
   const [isSettingsOpen, setIsSettingsOpen] = useState(false);
   const [isInfoOpen, setIsInfoOpen] = useState(false);
   const [previewSet, setPreviewSet] = useState<{ set: CardSet, mode: 'library' | 'session' } | null>(null);

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

   const handleUpdatePreview = (updatedSet: CardSet) => {
      if (!previewSet) return;
      setPreviewSet({ ...previewSet, set: updatedSet });
      handleUpdateLibrarySet(updatedSet);
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
         />

         <SetPreviewModal
            set={previewSet?.set || null}
            mode={previewSet?.mode || 'library'}
            onClose={() => setPreviewSet(null)}
            onUpdateSet={handleUpdatePreview}
         />

         <InfoModal
            isOpen={isInfoOpen}
            onClose={() => setIsInfoOpen(false)}
         />

         {/* Top Bar */}
         <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-outline px-6 py-4">
            <div className="max-w-5xl mx-auto flex items-center justify-between">
               <div className="flex items-center gap-4 w-1/3">
                  <button
                     onClick={() => setIsInfoOpen(true)}
                     className="p-2 text-muted hover:text-text transition-colors"
                     title="Help"
                  >
                     <HelpCircle size={20} />
                  </button>
                  {gameState !== GameState.MENU && gameState !== GameState.PLAYING && (
                     <button
                        onClick={handleBackToMenu}
                        className="group flex items-center gap-2 text-muted hover:text-text font-bold text-sm uppercase tracking-wider transition-colors"
                     >
                        <div className="p-2 rounded-full border border-outline group-hover:bg-panel transition-colors">
                           <ArrowLeft size={16} />
                        </div>
                        Back
                     </button>
                  )}
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
                  onViewPreview={({ set, mode }) => setPreviewSet({ set, mode })}
                  onSaveToLibrary={handleSaveToLibrary}
                  onDeleteSession={handleDeleteSession}
                  settings={settings}
                  onUpdateSettings={updateSettings}
                  lifetimeCorrect={lifetimeCorrect}
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
         </main>

         <footer className="py-8 text-center text-muted opacity-60 text-sm border-t border-outline bg-panel-2/50">
            <div className="flex items-center justify-center gap-1.5">
               Made with <Heart size={14} className="text-red fill-red" /> and vibe coding by Owen Whelan.
            </div>
         </footer>
      </div>
   );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />)