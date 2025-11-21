
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { CardSet, GameState, Settings } from './types';
import { fmtTime, generateId } from './utils';
import { StartMenu } from './components/StartMenu';
import { Game } from './components/Game';
import { Confetti } from './components/Confetti';
import { Clock, ArrowLeft, Settings as SettingsIcon, X, HelpCircle } from 'lucide-react';
import clsx from 'clsx';

const STORAGE_KEY = 'flashcard-sessions-v2';
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-panel border border-outline rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95">
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

// Info Modal Component
const InfoModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-panel border border-outline rounded-2xl p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 max-h-[80vh] overflow-y-auto custom-scrollbar">
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
                 <li>You can write your cards on a word processor (like Google Docs) and paste them in, or use the list builder.</li>
                 <li>Manually typed cards follow this format: <code>Term / Definition /// Year</code>.</li>
                 <li>The year field is optional.</li>
                 <li>Cards support importing, if you'd like to change devices.</li>
              </ul>
           </div>

           <div>
              <h3 className="text-lg font-bold text-accent mb-2">Study Mode</h3>
              <ul className="list-disc pl-5 space-y-2 text-muted">
                 <li>Type your answer and hit <b>Enter</b>, or click the button.</li>
                 <li>If you disagree with how you were evaluated, you can click the override button to have it marked the opposite way.</li>
                 <li>Cards move up in mastery levels, maximum mastery being getting it right twice.</li>
              </ul>
           </div>

           <div>
              <h3 className="text-lg font-bold text-accent mb-2">Shortcuts & Gestures</h3>
              <ul className="list-disc pl-5 space-y-2 text-muted">
                 <li><kbd className="bg-panel-2 border border-outline px-2 py-0.5 rounded text-xs">Enter</kbd> : Submit / Continue</li>
                 <li><kbd className="bg-panel-2 border border-outline px-2 py-0.5 rounded text-xs">O</kbd> : Override Result</li>
                 <li>Click a mastery counter (top right) twice to move all cards in that category to the category before it.</li>
                 <li>You can name sets by clicking the title on the top. You can also click the timer to hide it.</li>
              </ul>
           </div>
        </div>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [savedSets, setSavedSets] = useState<CardSet[]>([]);
  const [activeSet, setActiveSet] = useState<CardSet | null>(null);
  const [settings, setSettings] = useState<Settings>({ 
    strictSpelling: false, 
    retypeOnMistake: false,
    darkMode: true,
    starredOnly: false
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isInfoOpen, setIsInfoOpen] = useState(false);
  
  // Timer State
  const [timerStart, setTimerStart] = useState<number>(0);
  const [timerNow, setTimerNow] = useState<number>(0);
  const [isTimerPaused, setIsTimerPaused] = useState(false);
  const [lastPauseTime, setLastPauseTime] = useState(0);

  // Renaming State
  const [isRenaming, setIsRenaming] = useState(false);

  // Load from local storage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setSavedSets(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load saves", e);
      }
    }
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSettings) {
      try {
         const s = JSON.parse(savedSettings);
         // Ensure defaults for new settings
         setSettings({
            strictSpelling: s.strictSpelling ?? false,
            retypeOnMistake: s.retypeOnMistake ?? false,
            darkMode: s.darkMode ?? true,
            starredOnly: s.starredOnly ?? false
         });
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    if (savedSets.length > 0) {
       localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSets));
    }
  }, [savedSets]);

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

  const handleStartSet = (set: CardSet) => {
    if (!savedSets.find(s => s.id === set.id)) {
      setSavedSets(prev => [set, ...prev]);
    } else {
      // Move to top
      setSavedSets(prev => [set, ...prev.filter(s => s.id !== set.id)]);
    }
    setActiveSet(set);
    setTimerStart(Date.now());
    setTimerNow(Date.now());
    setIsTimerPaused(false);
    setGameState(GameState.PLAYING);
  };

  const handleDeleteSet = (id: string) => {
     const newSets = savedSets.filter(s => s.id !== id);
     setSavedSets(newSets);
     if (newSets.length === 0) localStorage.removeItem(STORAGE_KEY);
     else localStorage.setItem(STORAGE_KEY, JSON.stringify(newSets));
  };

  const handleUpdateSet = (updatedSet: CardSet) => {
    const now = Date.now();
    let newElapsedTime = updatedSet.elapsedTime;

    if (!isTimerPaused) {
        const delta = now - timerStart;
        setTimerStart(now);
        newElapsedTime += delta;
    }

    const newSetData = {
       ...updatedSet,
       elapsedTime: newElapsedTime,
       lastPlayed: now
    };

    setActiveSet(newSetData);
    setSavedSets(prev => prev.map(s => s.id === updatedSet.id ? newSetData : s));
  };

  const handleRenameSet = (newName: string) => {
     if (activeSet) {
        const updated = { ...activeSet, name: newName };
        setActiveSet(updated);
        setSavedSets(prev => prev.map(s => s.id === activeSet.id ? updated : s));
     }
     setIsRenaming(false);
  };

  const handleFinish = () => {
    setGameState(GameState.WIN);
  };

  const handleBackToMenu = () => {
     // Critical: Save current progress including time before leaving
     if (activeSet && gameState === GameState.PLAYING) {
         const now = Date.now();
         const delta = isTimerPaused ? 0 : (now - timerStart);
         const finalSet = {
             ...activeSet,
             elapsedTime: activeSet.elapsedTime + delta,
             lastPlayed: now
         };
         
         // Update saved sets immediately
         setSavedSets(prev => prev.map(s => s.id === finalSet.id ? finalSet : s));
     }

     setGameState(GameState.MENU);
     setActiveSet(null);
     setIsRenaming(false);
  };

  const handleSaveStarred = () => {
      if (!activeSet) return;
      const starred = activeSet.cards.filter(c => c.star);
      
      if (starred.length === 0) return;

      const newSet: CardSet = {
        id: generateId(),
        name: `${activeSet.name} (Starred)`,
        cards: starred.map(c => ({
          ...c,
          id: generateId(), // New ID for the card copy
          mastery: 0 // Reset mastery
        })),
        lastPlayed: Date.now(),
        elapsedTime: 0,
        topStreak: 0
      };

      setSavedSets(prev => [newSet, ...prev]);
      alert(`Saved new set "${newSet.name}" with ${starred.length} cards!`);
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

       <InfoModal
          isOpen={isInfoOpen}
          onClose={() => setIsInfoOpen(false)}
       />

       {/* Top Bar */}
       <header className="sticky top-0 z-30 bg-bg/95 backdrop-blur border-b border-outline px-6 py-4">
         <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4 w-1/3">
               <button
                  onClick={() => setIsInfoOpen(true)}
                  className="p-2 text-muted hover:text-text transition-colors"
                  title="Help"
               >
                  <HelpCircle size={20} />
               </button>
               {gameState !== GameState.MENU && (
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
               {gameState === GameState.PLAYING && activeSet ? (
                  isRenaming ? (
                     <input 
                        autoFocus
                        defaultValue={activeSet.name}
                        onBlur={(e) => handleRenameSet(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRenameSet(e.currentTarget.value)}
                        className="bg-transparent border-b border-accent text-center font-bold text-text focus:outline-none pb-1 min-w-[200px]"
                     />
                  ) : (
                     <span 
                        onClick={() => setIsRenaming(true)}
                        className="font-bold text-text opacity-50 hover:opacity-100 cursor-pointer hover:text-accent transition-all truncate max-w-[250px]"
                        title="Click to rename"
                     >
                        {activeSet.name}
                     </span>
                  )
               ) : (
                  <div className="font-bold text-lg tracking-tight text-text opacity-80">Flashcard Trainer</div>
               )}
            </div>

            <div className="flex justify-end w-1/3 items-center gap-4">
               {gameState === GameState.PLAYING && activeSet && (
                  <button 
                    onClick={toggleTimer}
                    className={clsx(
                       "flex items-center gap-2 font-mono transition-all mr-2",
                       isTimerPaused ? "text-muted opacity-30" : "text-accent"
                    )}
                  >
                     <Clock size={18} />
                     <span className="hidden sm:inline">{isTimerPaused ? "PAUSED" : fmtTime(activeSet.elapsedTime + (timerNow - timerStart))}</span>
                  </button>
               )}

               <button 
                 onClick={() => setIsSettingsOpen(true)}
                 className="p-2 text-muted hover:text-text transition-colors"
               >
                  <SettingsIcon size={20} />
               </button>
            </div>
         </div>
       </header>

       <main className="flex-grow p-6 md:p-10 max-w-5xl mx-auto w-full">
          {gameState === GameState.MENU && (
             <StartMenu 
               savedSets={savedSets} 
               onStartSet={handleStartSet} 
               onDeleteSet={handleDeleteSet}
               settings={settings}
               onUpdateSettings={updateSettings}
             />
          )}

          {gameState === GameState.PLAYING && activeSet && (
             <Game 
               set={activeSet} 
               onUpdateSet={handleUpdateSet}
               onFinish={handleFinish}
               settings={settings}
             />
          )}

          {gameState === GameState.WIN && (
             <div className="fixed inset-0 z-20 flex flex-col items-center justify-center bg-bg/95 backdrop-blur-xl animate-in fade-in duration-500">
                <h2 className="text-5xl font-bold text-accent mb-4 drop-shadow-[0_0_35px_rgba(208,164,94,0.4)]">
                   Session Complete
                </h2>
                <p className="text-xl text-muted mb-12">Excellent work.</p>
                
                <div className="flex gap-4">
                  <button 
                    onClick={handleBackToMenu}
                    className="bg-text text-bg px-8 py-4 rounded-xl font-bold text-lg hover:scale-105 transition-transform shadow-2xl"
                  >
                    Back to Menu
                  </button>

                  {activeSet && activeSet.cards.some(c => c.star) && (
                      <button 
                          onClick={handleSaveStarred}
                          className="bg-panel-2 border border-outline text-text px-8 py-4 rounded-xl font-bold text-lg hover:border-accent transition-colors shadow-lg flex items-center gap-2"
                      >
                          <div className="text-yellow">★</div> Save Starred
                      </button>
                  )}
                </div>
             </div>
          )}
       </main>

       <footer className="py-8 text-center text-muted opacity-60 text-sm border-t border-outline bg-panel-2/50">
          <p>&copy; {new Date().getFullYear()} Flashcard Trainer Pro. Keep learning.</p>
       </footer>
    </div>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
