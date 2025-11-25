
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { CardSet, GameState, Settings, Card } from './types';
import { fmtTime, generateId } from './utils';
import { StartMenu } from './components/StartMenu';
import { Game } from './components/Game';
import { Confetti } from './components/Confetti';
import { Clock, ArrowLeft, Settings as SettingsIcon, X, HelpCircle, Heart, RotateCcw, FolderOpen } from 'lucide-react';
import clsx from 'clsx';

const LIBRARY_KEY = 'flashcard-library-v3';
const SESSIONS_KEY = 'flashcard-sessions-v3';
const SETTINGS_KEY = 'flashcard-settings-v2';

// Settings Modal Component
const SettingsModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onUpdate: (s: Settings) => void;
}> = ({ isOpen, onClose, settings, onUpdate }) => {
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
                    <div className="text-xs font-mono text-muted pt-1 w-6">{i+1}</div>
                    <div className="flex-1">
                        <div className="font-bold text-text mb-1">{card.term.join(' / ')}</div>
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
              <h3 className="text-lg font-bold text-accent mb-2">About</h3>
              <ul className="list-disc pl-5 space-y-2 text-muted">
                 <li>This project was made by <a href="https://www.owenwhelan.com" target="_blank" rel="noreferrer" className="text-accent hover:underline">Owen Whelan</a>.</li>
                 <li>You can modify, hack, and check out the code at the <a href="https://github.com/RockhopperHD/flashcardsish" target="_blank" rel="noreferrer" className="text-accent hover:underline">GitHub repo</a>.</li>
              </ul>
           </div>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  
  const [librarySets, setLibrarySets] = useState<CardSet[]>([]);
  const [activeSessions, setActiveSessions] = useState<CardSet[]>([]);
  const [activeSession, setActiveSession] = useState<CardSet | null>(null);

  const [settings, setSettings] = useState<Settings>({ 
    strictSpelling: false, 
    retypeOnMistake: false,
    darkMode: true,
    starredOnly: false
  });
  
  // Modals
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  const [previewSet, setPreviewSet] = useState<{set: CardSet, mode: 'library' | 'session'} | null>(null);
  
  // Timer State
  const [timerStart, setTimerStart] = useState<number>(0);
  const [timerNow, setTimerNow] = useState<number>(0);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [lastPauseTime, setLastPauseTime] = useState(0);

  // Renaming State
  const [isRenaming, setIsRenaming] = useState(false);

  // Load from local storage
  useEffect(() => {
    const savedLibrary = localStorage.getItem(LIBRARY_KEY);
    const savedSessions = localStorage.getItem(SESSIONS_KEY);

    if (savedLibrary) {
      try {
        setLibrarySets(JSON.parse(savedLibrary));
      } catch (e) { console.error(e); }
    }
    if (savedSessions) {
      try {
        setActiveSessions(JSON.parse(savedSessions));
      } catch (e) { console.error(e); }
    }

    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
      try {
         const s = JSON.parse(savedSettings);
         setSettings({
            strictSpelling: s.strictSpelling ?? false,
            retypeOnMistake: s.retypeOnMistake ?? false,
            darkMode: s.darkMode ?? true,
            starredOnly: s.starredOnly ?? false
         });
      } catch (e) {}
    }
  }, []);

  // Save Effects
  useEffect(() => {
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(librarySets));
  }, [librarySets]);

  useEffect(() => {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(activeSessions));
  }, [activeSessions]);

  useEffect(() => {
    if (settings.darkMode) {
       document.body.classList.remove('light-mode');
    } else {
       document.body.classList.add('light-mode');
    }
  }, [settings.darkMode]);

  const updateSettings = (newSettings: Settings) => {
     setSettings(newSettings);
     localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
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
    // Create a new session based on the library set
    const newSession: CardSet = {
        ...libSet,
        id: generateId(), // New ID for session
        name: libSet.name,
        cards: libSet.cards.map(c => ({ ...c, mastery: 0 })), // Reset mastery
        elapsedTime: 0,
        topStreak: 0,
        lastPlayed: Date.now()
    };
    
    setActiveSessions(prev => [newSession, ...prev]);
    setActiveSession(newSession);
    
    setTimerStart(Date.now());
    setTimerNow(Date.now());
    setIsTimerPaused(false);
    setGameState(GameState.PLAYING);
  };

  const handleResumeSession = (session: CardSet) => {
      setActiveSession(session);
      // Move to top of list
      setActiveSessions(prev => [session, ...prev.filter(s => s.id !== session.id)]);
      
      setTimerStart(Date.now());
      setTimerNow(Date.now());
      setIsTimerPaused(false);
      setGameState(GameState.PLAYING);
  };

  const handleSaveToLibrary = (set: CardSet) => {
     // Check if updating existing
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
     setActiveSessions(prev => prev.filter(s => s.id !== id));
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

    setActiveSession(newSessionData);
    setActiveSessions(prev => prev.map(s => s.id === updatedSession.id ? newSessionData : s));
  };
  
  const handleUpdatePreview = (updatedSet: CardSet) => {
      if (!previewSet) return;
      setPreviewSet({ ...previewSet, set: updatedSet });
      if (previewSet.mode === 'library') {
          handleUpdateLibrarySet(updatedSet);
      } else {
          setActiveSessions(prev => prev.map(s => s.id === updatedSet.id ? updatedSet : s));
      }
  };

  const handleRenameSession = (newName: string) => {
     if (activeSession) {
        const updated = { ...activeSession, name: newName };
        setActiveSession(updated);
        setActiveSessions(prev => prev.map(s => s.id === activeSession.id ? updated : s));
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
         setActiveSession(finalSet);
         setActiveSessions(prev => prev.map(s => s.id === finalSet.id ? finalSet : s));
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
         setActiveSessions(prev => prev.map(s => s.id === finalSet.id ? finalSet : s));
     }
     setGameState(GameState.MENU);
     setActiveSession(null);
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
      
      setActiveSession(resetSession);
      setActiveSessions(prev => prev.map(s => s.id === resetSession.id ? resetSession : s));
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
      cards: starred.map(c => ({...c, mastery: 0})),
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
                  <div className="font-bold text-lg tracking-tight text-text opacity-80">Flashcard Trainer</div>
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

               {gameState === GameState.PLAYING && (
                    <button 
                        onClick={() => setIsSettingsOpen(true)}
                        className="p-2 text-muted hover:text-text transition-colors"
                    >
                        <SettingsIcon size={20} />
                    </button>
               )}
            </div>
         </div>
       </header>

       <main className="flex-grow p-6 md:p-8 max-w-5xl mx-auto w-full">
          {gameState === GameState.MENU && (
             <StartMenu 
               librarySets={librarySets}
               activeSessions={activeSessions}
               onStartFromLibrary={handleStartFromLibrary}
               onResumeSession={handleResumeSession}
               onSaveToLibrary={handleSaveToLibrary}
               onDeleteLibrarySet={handleDeleteLibrarySet}
               onDeleteSession={handleDeleteSession}
               onViewPreview={setPreviewSet}
               settings={settings}
               onUpdateSettings={updateSettings}
             />
          )}

          {gameState === GameState.PLAYING && activeSession && (
             <Game 
               set={activeSession} 
               onUpdateSet={handleUpdateActiveSession}
               onFinish={handleFinish}
               settings={settings}
               onExit={handleBackToMenu}
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
root.render(<App />);
