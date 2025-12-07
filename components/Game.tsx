import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardSet, FeedbackState, Settings } from '../types';
import { checkAnswer, renderMarkdown, renderInline, downloadFile } from '../utils';
import { ArrowLeft, Pencil, X, Download } from 'lucide-react';
import clsx from 'clsx';

interface GameProps {
   set: CardSet;
   onUpdateSet: (updatedSet: CardSet) => void;
   onFinish: () => void;
   settings: Settings;
   onExit: () => void;
   onCorrect: () => void;
}

export const Game: React.FC<GameProps> = ({ set, onUpdateSet, onFinish, settings, onExit, onCorrect }) => {
   // Game State
   const [currentId, setCurrentId] = useState<string | null>(null);
   const [inputTerm, setInputTerm] = useState('');
   const [inputYear, setInputYear] = useState('');
   const [inputCustom, setInputCustom] = useState<Record<string, string>>({});
   const [feedback, setFeedback] = useState<FeedbackState>({ type: 'idle' });
   const [isEditOpen, setIsEditOpen] = useState(false);
   const [isShaking, setIsShaking] = useState(false);

   // Streak state needs to track if it's "pending break"
   const [streak, setStreak] = useState(0);
   const [pendingStreakBreak, setPendingStreakBreak] = useState(false);
   const [topStreak, setTopStreak] = useState(set.topStreak || 0);

   // Mastery Reset Confirmation State
   const [confirmResetLevel, setConfirmResetLevel] = useState<number | null>(null);

   // Multiple Choice State
   const [options, setOptions] = useState<string[]>([]);

   // Multistudy Edit Warning
   const [showEditWarning, setShowEditWarning] = useState(false);
   const [suppressEditWarning, setSuppressEditWarning] = useState(false);

   // Refs
   const termInputRef = useRef<HTMLInputElement>(null);
   const yearInputRef = useRef<HTMLInputElement>(null);

   // Derived Order
   const activeQueue = useMemo(() => {
      let candidates = set.cards;

      // Settings Filter: Starred Only
      if (settings.starredOnly) {
         candidates = candidates.filter(c => c.star);
      }

      const unmastered = candidates.filter(c => c.mastery < 2);

      // Simple shuffle
      for (let i = unmastered.length - 1; i > 0; i--) {
         const j = Math.floor(Math.random() * (i + 1));
         [unmastered[i], unmastered[j]] = [unmastered[j], unmastered[i]];
      }
      return unmastered;
   }, [set.cards, settings.starredOnly]);

   const currentCard = useMemo(() => {
      if (!currentId) return activeQueue[0] || null;
      return set.cards.find(c => c.id === currentId) || activeQueue[0] || null;
   }, [currentId, set.cards, activeQueue]);

   // Counts for header
   const counts = useMemo(() => {
      const c = [0, 0, 0];
      set.cards.forEach(card => c[card.mastery]++);
      return c;
   }, [set.cards]);

   // Initialize & Stable Card Selection
   useEffect(() => {
      // FIX: Do not switch card if we are showing feedback (correct/incorrect/reveal)
      if (feedback.type === 'correct' || feedback.type === 'incorrect' || feedback.type === 'reveal') return;

      const currentInQueue = activeQueue.find(c => c.id === currentId);

      if (!currentInQueue) {
         if (activeQueue.length > 0) {
            setCurrentId(activeQueue[0].id);
         } else {
            const hasCards = set.cards.length > 0;
            if (hasCards) {
               const candidates = settings.starredOnly ? set.cards.filter(c => c.star) : set.cards;
               if (candidates.length > 0 && candidates.every(c => c.mastery === 2)) {
                  onFinish();
               } else if (candidates.length === 0 && settings.starredOnly) {
                  alert("No starred cards found!");
                  onFinish();
               }
            }
         }
      }
   }, [activeQueue, currentId, set.cards, onFinish, settings.starredOnly]);

   // Generate Options for Multiple Choice
   useEffect(() => {
      if (settings.mode === 'multiple_choice' && currentCard) {
         const correctTerm = currentCard.term[0]; // Use primary term

         // Get all other terms from the set
         const allOtherCards = set.cards.filter(c => c.id !== currentCard.id);

         // Shuffle and pick 3
         const distractors: string[] = [];
         const shuffledOthers = [...allOtherCards].sort(() => 0.5 - Math.random());

         for (let i = 0; i < Math.min(3, shuffledOthers.length); i++) {
            distractors.push(shuffledOthers[i].term[0]);
         }

         // Combine and shuffle
         const newOptions = [correctTerm, ...distractors].sort(() => 0.5 - Math.random());
         setOptions(newOptions);
      }
   }, [currentCard, settings.mode, set.cards]);

   // Focus Management
   useEffect(() => {
      if (feedback.type === 'idle' || feedback.type === 'retype_needed') {
         termInputRef.current?.focus();
      }
   }, [feedback.type, currentId]);

   // Handlers
   const handleUpdateCard = (id: string, updates: Partial<Card>) => {
      const newCards = set.cards.map(c => (c.id === id ? { ...c, ...updates } : c));
      onUpdateSet({ ...set, cards: newCards, topStreak });
   };

   const demoteLevel = (level: number) => {
      const newCards = set.cards.map(c => {
         if (c.mastery === level) {
            return { ...c, mastery: Math.max(0, level - 1) };
         }
         return c;
      });
      onUpdateSet({ ...set, cards: newCards, topStreak });
      setConfirmResetLevel(null);
   };

   const nextCard = (keepStreak = false) => {
      if (pendingStreakBreak && !keepStreak) {
         setStreak(0);
      }
      setPendingStreakBreak(false);

      const next = activeQueue.find(c => c.id !== currentId);
      if (next) {
         setCurrentId(next.id);
      } else if (activeQueue.length > 0) {
         setCurrentId(activeQueue[0].id);
      } else {
         onFinish();
         return;
      }
      setFeedback({ type: 'idle' });
      setInputTerm('');
      setInputYear('');
      setInputCustom({});
   };

   const handleAttempt = () => {
      if (!currentCard) return;
      // Check if any input is provided
      const hasCustomInput = Object.values(inputCustom).some(v => v.trim());
      if (!inputTerm.trim() && (!currentCard.year || !inputYear.trim()) && !hasCustomInput) return;

      const result = checkAnswer(inputTerm, inputYear, inputCustom, currentCard, settings.strictSpelling);

      if (result.isMatch) {
         // CORRECT
         const wasRetyping = feedback.type === 'retype_needed';

         if (!wasRetyping) {
            const newMastery = Math.min(2, currentCard.mastery + 1);

            // Consolidate updates to prevent race condition
            const newStreak = streak + 1;
            setStreak(newStreak);

            let newTopStreak = topStreak;
            if (newStreak > topStreak) {
               setTopStreak(newStreak);
               newTopStreak = newStreak;
            }

            const newCards = set.cards.map(c => c.id === currentCard.id ? { ...c, mastery: newMastery } : c);

            // Single atomic update
            onUpdateSet({
               ...set,
               cards: newCards,
               topStreak: newTopStreak
            });

            setPendingStreakBreak(false);
         } else {
            setPendingStreakBreak(true);
         }

         onCorrect(); // Update lifetime stats
         setFeedback({
            type: 'correct',
            correction: (!settings.strictSpelling && result.bestDist > 0) ? result.bestTerm : undefined
         });
      } else {
         // INCORRECT
         if (feedback.type === 'retype_needed') {
            // Shake if still wrong
            setIsShaking(true);
            setTimeout(() => setIsShaking(false), 500);
            return;
         }

         if (settings.retypeOnMistake) {
            setFeedback({
               type: 'retype_needed',
               results: {
                  isTermMatch: result.isTermMatch,
                  isYearMatch: result.isYearMatch,
                  isCustomMatch: result.isCustomMatch,
                  customResults: result.customResults
               }
            });
            // Clear ONLY wrong fields
            if (!result.isTermMatch) setInputTerm('');
            if (!result.isYearMatch) setInputYear('');
            if (!result.isCustomMatch) {
               const newCustom = { ...inputCustom };
               Object.keys(result.customResults).forEach(key => {
                  if (!result.customResults[key]) newCustom[key] = '';
               });
               setInputCustom(newCustom);
            }
         } else {
            let msg = `Answer: ${currentCard.term.join(' / ')}`;
            if (currentCard.year && !result.isYearMatch && result.isTermMatch) {
               msg = `Term correct, but year is ${currentCard.year}`;
            } else if (result.isTermMatch && result.isYearMatch && !result.isCustomMatch) {
               // Find which custom field is wrong
               const wrongField = Object.keys(result.customResults || {}).find(k => !result.customResults[k]);
               if (wrongField) {
                  const correctVal = currentCard.customFields?.find(f => f.name === wrongField)?.value;
                  msg = `Term/Year correct, but ${wrongField} is ${correctVal}`;
               }
            }
            setFeedback({
               type: 'incorrect',
               message: msg,
               customResults: { year: !result.isYearMatch, custom: result.customResults }
            });
         }
         // Don't break streak YET. Wait for continue.
         setPendingStreakBreak(true);
      }
   };

   const handleOptionClick = (option: string) => {
      if (!currentCard) return;

      // Check if option matches any of the valid terms
      const isCorrect = currentCard.term.some(t => t.toLowerCase() === option.toLowerCase());

      if (isCorrect) {
         // Correct
         const newMastery = Math.min(2, currentCard.mastery + 1);
         const newStreak = streak + 1;
         setStreak(newStreak);

         let newTopStreak = topStreak;
         if (newStreak > topStreak) {
            setTopStreak(newStreak);
            newTopStreak = newStreak;
         }

         const newCards = set.cards.map(c => c.id === currentCard.id ? { ...c, mastery: newMastery } : c);

         onUpdateSet({ ...set, cards: newCards, topStreak: newTopStreak });
         setPendingStreakBreak(false);

         onCorrect(); // Update lifetime stats
         setFeedback({ type: 'correct' });

         // Auto advance after short delay if correct? Or wait for user?
         // Let's wait for user to hit Continue or Enter, same as standard mode
      } else {
         // Incorrect
         setFeedback({ type: 'incorrect', message: `Correct Answer: ${currentCard.term.join(' / ')}` });
         setPendingStreakBreak(true);
      }
   };

   const handleReveal = () => {
      if (!currentCard) return;
      setPendingStreakBreak(true); // Will break on continue

      if (settings.retypeOnMistake && feedback.type !== 'retype_needed') {
         setFeedback({
            type: 'retype_needed',
            results: {
               isTermMatch: false,
               isYearMatch: false,
               isCustomMatch: false,
               customResults: {}
            }
         });
         return;
      }
      setFeedback({ type: 'reveal', message: `Answer: ${currentCard.term.join(' / ')}` });
   };

   const handleOverride = (wasActuallyCorrect: boolean) => {
      if (!currentCard) return;

      if (wasActuallyCorrect) {
         setPendingStreakBreak(false);

         // Calculate new streak
         const newStreak = streak + 1;
         setStreak(newStreak);

         let newTopStreak = topStreak;
         if (newStreak > topStreak) {
            setTopStreak(newStreak);
            newTopStreak = newStreak;
         }

         const newMastery = Math.min(2, currentCard.mastery + 1);
         const newCards = set.cards.map(c => c.id === currentCard.id ? { ...c, mastery: newMastery } : c);

         onUpdateSet({
            ...set,
            cards: newCards,
            topStreak: newTopStreak
         });
      } else {
         const newMastery = Math.max(0, currentCard.mastery - 1);
         const newCards = set.cards.map(c => c.id === currentCard.id ? { ...c, mastery: newMastery } : c);

         setStreak(0);
         setPendingStreakBreak(false);

         onUpdateSet({
            ...set,
            cards: newCards
            // topStreak unchanged
         });
      }
      nextCard(wasActuallyCorrect);
   };

   const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
         e.preventDefault();
         e.stopPropagation();
         if (isInteractive) handleAttempt();
      }
   };

   // Keyboard Shortcuts
   useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
         if (isEditOpen) return;

         // 'O' for Override
         if (e.key.toLowerCase() === 'o') {
            const isFeedbackActive = feedback.type !== 'idle';
            if (!isFeedbackActive) return;

            // Retype Mode constraint: Disable shortcut entirely to prevent accidental triggers while typing
            if (feedback.type === 'retype_needed') return;

            e.preventDefault();
            if (feedback.type === 'incorrect' || feedback.type === 'reveal') {
               handleOverride(true);
            } else if (feedback.type === 'correct') {
               handleOverride(false);
            }
         }

         // Enter to Continue
         if (e.key === 'Enter') {
            const isInteractive = feedback.type === 'idle' || feedback.type === 'retype_needed';
            if (!isInteractive) {
               e.preventDefault();
               nextCard();
            }
         }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
   }, [feedback, currentCard, nextCard, handleOverride, isEditOpen]);


   const toggleStar = () => {
      if (currentCard) handleUpdateCard(currentCard.id, { star: !currentCard.star });
   };

   const handleDownloadSession = () => {
      const exportSet = {
         ...set,
         cards: set.cards.map(c => ({
            ...c,
            mastery: 0
         }))
      };
      downloadFile(`${set.name}.flashcards`, JSON.stringify(exportSet, null, 2), 'json');
   };

   const isInteractive = feedback.type === 'idle' || feedback.type === 'retype_needed';

   if (!currentCard) return null;

   return (
      <div className="w-full max-w-5xl mx-auto pb-20 pt-0">

         {/* Top Controls Row */}
         <div className="flex justify-between items-end mb-4 select-none">
            <div className="flex items-center gap-4 mb-2">
               {/* Back Button (Flashcards Mode) */}
               <button
                  onClick={onExit}
                  className="flex items-center gap-2 text-muted hover:text-text font-bold text-sm uppercase tracking-wider transition-colors"
               >
                  <div className="p-2 rounded-full border border-outline hover:bg-panel transition-colors">
                     <ArrowLeft size={16} />
                  </div>
                  Back
               </button>

               {/* Download Button (Multistudy Only) */}
               {set.isMultistudy && (
                  <button
                     onClick={handleDownloadSession}
                     className="flex items-center gap-2 text-muted hover:text-text font-bold text-sm uppercase tracking-wider transition-colors"
                     title="Download Session as Set"
                  >
                     <div className="p-2 rounded-full border border-outline hover:bg-panel transition-colors">
                        <Download size={16} />
                     </div>
                     Save Set
                  </button>
               )}
            </div>

            {/* Mastery Stats */}
            <div className="flex gap-3">
               {[0, 1, 2].map(level => (
                  <div key={level} className="relative">
                     {confirmResetLevel === level && (
                        <div className="absolute -top-5 left-0 w-full text-center text-[10px] font-bold text-red animate-pulse">
                           CONFIRM?
                        </div>
                     )}
                     <div
                        onClick={() => {
                           if (confirmResetLevel === level) demoteLevel(level);
                           else if (counts[level] > 0) {
                              setConfirmResetLevel(level);
                              setTimeout(() => setConfirmResetLevel(null), 3000);
                           }
                        }}
                        className={clsx(
                           "flex flex-col items-center justify-center w-16 py-2 rounded-xl border transition-all cursor-pointer active:scale-95",
                           "bg-panel border-outline",
                           counts[level] > 0 && "hover:border-accent"
                        )}
                     >
                        <span className="text-lg font-bold leading-none mb-1 text-text">{counts[level]}</span>
                        <div className="flex gap-1">
                           {level >= 1 && <div className={clsx("w-2 h-2 rounded-full", level >= 1 ? "bg-green" : "bg-outline")} />}
                           {level >= 2 && <div className={clsx("w-2 h-2 rounded-full", level >= 2 ? "bg-green" : "bg-outline")} />}
                           {level === 0 && <div className="w-2 h-2 rounded-full border border-outline" />}
                        </div>
                     </div>
                  </div>
               ))}
            </div>
         </div>

         {/* Main Card Area */}
         <div className={clsx(
            "bg-panel border rounded-[24px] shadow-2xl p-10 relative overflow-hidden transition-all duration-500",
            feedback.type === 'correct' ? "border-green/50 shadow-[0_0_30px_rgba(147,210,108,0.1)]" : "border-outline",
            feedback.type === 'retype_needed' && "border-red/50"
         )}>

            {/* Top Controls */}
            <div className="flex justify-between items-start mb-8">
               <div className="flex items-center gap-2">
                  <button
                     onClick={() => toggleStar()}
                     className={clsx(
                        "transition-all hover:scale-110 active:scale-95",
                        currentCard.star ? "text-yellow" : "text-muted hover:text-yellow"
                     )}
                  >
                     <svg width="24" height="24" viewBox="0 0 24 24" fill={currentCard.star ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                     </svg>
                  </button>
                  {/* Tags */}
                  {currentCard.tags && currentCard.tags.length > 0 && (
                     <div className="flex gap-1 ml-2">
                        {currentCard.tags.map(tag => (
                           <span key={tag} className="px-2 py-0.5 bg-accent/10 border border-accent rounded-full text-xs font-bold text-accent uppercase tracking-wider">
                              {tag}
                           </span>
                        ))}
                     </div>
                  )}
               </div>

               {/* Mastery Dots (Top Right) - Larger */}
               <div className="flex gap-3 items-center">
                  <button
                     onClick={() => {
                        if (set.isMultistudy && !suppressEditWarning) {
                           setShowEditWarning(true);
                        } else {
                           setIsEditOpen(true);
                        }
                     }}
                     className="p-2 text-muted hover:text-text hover:bg-panel-2 rounded-lg transition-colors mr-2"
                     title="Edit Card"
                  >
                     <Pencil size={18} />
                  </button>
                  <div className={clsx("w-5 h-5 rounded-full border-2 transition-all", currentCard.mastery >= 1 ? "bg-green border-green shadow-[0_0_10px_var(--green)]" : "bg-transparent border-outline/50")} />
                  <div className={clsx("w-5 h-5 rounded-full border-2 transition-all", currentCard.mastery >= 2 ? "bg-green border-green shadow-[0_0_10px_var(--green)]" : "bg-transparent border-outline/50")} />
               </div>
            </div>

            {/* Card Header (Empty now but keeping div for spacing if needed, or remove) */}
            <div className="mb-6"></div>

            {/* Content Area - WIDE + SIDE-BY-SIDE MODE */}
            <div className="min-h-[200px] mb-10 flex items-center">
               {currentCard.image ? (
                  <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                     <div className="flex justify-center md:justify-center">
                        <img
                           src={currentCard.image}
                           alt="Card visual"
                           className="rounded-xl max-h-[400px] w-auto object-contain border border-outline shadow-sm max-w-full"
                        />
                     </div>
                     <div className="text-3xl font-medium leading-normal text-text font-sans text-left">
                        {renderMarkdown(currentCard.content)}
                     </div>
                  </div>
               ) : (
                  <div className="w-full text-3xl font-medium leading-normal text-text font-sans text-left">
                     {renderMarkdown(currentCard.content)}
                  </div>
               )}
            </div>

            {/* Interactive Area */}
            <div className="space-y-6">

               {feedback.type === 'retype_needed' && (
                  <div className="flex justify-between items-center mb-2">
                     <div className="text-red font-bold flex items-center gap-2">
                        Retype the incorrect fields.
                     </div>
                     <button onClick={() => handleOverride(true)} className="text-xs text-muted hover:text-text underline">
                        Actually, I was right
                     </button>
                  </div>
               )}

               {/* Input Area or Multiple Choice Grid */}
               {settings.mode === 'multiple_choice' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     {options.map((opt, i) => {
                        const isSelected = false; // Could track selected for styling
                        let stateClass = "border-outline hover:border-accent bg-panel-2";

                        if (feedback.type === 'correct' && currentCard.term.includes(opt)) {
                           stateClass = "border-green bg-green/10 text-green";
                        } else if (feedback.type === 'incorrect' && currentCard.term.includes(opt)) {
                           stateClass = "border-green bg-green/10 text-green"; // Show correct answer
                        } else if (feedback.type !== 'idle' && !currentCard.term.includes(opt)) {
                           stateClass = "opacity-50 border-transparent bg-panel-2";
                        }

                        return (
                           <button
                              key={i}
                              onClick={() => isInteractive && handleOptionClick(opt)}
                              disabled={!isInteractive}
                              className={clsx(
                                 "p-6 rounded-xl text-lg font-bold text-left transition-all border-2",
                                 stateClass,
                                 isInteractive && "hover:scale-[1.02] active:scale-[0.98]"
                              )}
                           >
                              {opt}
                           </button>
                        );
                     })}
                  </div>
               ) : (
                  <div className={clsx("flex gap-4 items-stretch", isShaking && "animate-shake")}>
                     <div className="flex-1 relative">
                        {feedback.type === 'retype_needed' && !feedback.results?.isTermMatch && (
                           <div className="absolute -top-6 left-0 text-xs font-bold text-accent animate-in fade-in">
                              Answer: {currentCard.term[0]}
                           </div>
                        )}
                        <input
                           ref={termInputRef}
                           type="text"
                           value={inputTerm}
                           onChange={(e) => setInputTerm(e.target.value)}
                           onKeyDown={handleInputKeyDown}
                           disabled={!isInteractive || (feedback.type === 'retype_needed' && feedback.results?.isTermMatch)}
                           placeholder={feedback.type === 'retype_needed' ? "Retype term..." : "Type the term..."}
                           className={clsx(
                              "w-full bg-panel-2 border rounded-xl px-6 py-5 text-xl focus:outline-none focus:border-accent disabled:opacity-50 transition-colors placeholder-text/20",
                              feedback.type === 'retype_needed' && !feedback.results?.isTermMatch ? "border-red text-red" : "border-outline text-text",
                              feedback.type === 'retype_needed' && feedback.results?.isTermMatch && "border-green text-green bg-green/5"
                           )}
                           autoComplete="off"
                        />
                     </div>

                     {/* Year Input */}
                     {currentCard.year && (
                        <div className="relative">
                           {feedback.type === 'retype_needed' && !feedback.results?.isYearMatch && (
                              <div className="absolute -top-6 left-0 w-full text-center text-xs font-bold text-accent animate-in fade-in">
                                 {currentCard.year}
                              </div>
                           )}
                           <input
                              ref={yearInputRef}
                              type="text"
                              value={inputYear}
                              onChange={(e) => setInputYear(e.target.value)}
                              onKeyDown={handleInputKeyDown}
                              placeholder="Year"
                              disabled={!isInteractive || (feedback.type === 'retype_needed' && feedback.results?.isYearMatch)}
                              className={clsx(
                                 "w-32 bg-panel-2 border rounded-xl px-4 py-5 text-xl focus:outline-none focus:border-accent disabled:opacity-50 text-center placeholder-text/20 text-text",
                                 (feedback.type === 'incorrect' || (feedback.type === 'retype_needed' && !feedback.results?.isYearMatch)) ? "border-red text-red" : "border-outline text-text",
                                 feedback.type === 'retype_needed' && feedback.results?.isYearMatch && "border-green text-green bg-green/5"
                              )}
                              autoComplete="off"
                           />
                        </div>
                     )}

                     {/* Custom Fields Inputs */}
                     {set.customFieldNames?.map(fieldName => {
                        const field = currentCard.customFields?.find(f => f.name === fieldName);
                        if (!field) return null; // Only render if the card actually has this custom field
                        const isCorrect = feedback.type === 'retype_needed' && feedback.results?.customResults?.[fieldName];

                        return (
                           <div key={fieldName} className="relative">
                              {feedback.type === 'retype_needed' && !isCorrect && (
                                 <div className="absolute -top-6 left-0 w-full text-center text-xs font-bold text-accent animate-in fade-in">
                                    {field.value}
                                 </div>
                              )}
                              <input
                                 type="text"
                                 value={inputCustom[fieldName] || ''}
                                 onChange={(e) => setInputCustom(prev => ({ ...prev, [fieldName]: e.target.value }))}
                                 onKeyDown={handleInputKeyDown}
                                 placeholder={fieldName}
                                 disabled={!isInteractive || (feedback.type === 'retype_needed' && isCorrect)}
                                 className={clsx(
                                    "flex-1 bg-panel-2 border rounded-xl px-4 py-5 text-xl focus:outline-none focus:border-accent disabled:opacity-50 text-center placeholder-text/20 text-text min-w-[120px]",
                                    (feedback.type === 'incorrect' || (feedback.type === 'retype_needed' && !isCorrect)) ? "border-red text-red" : "border-outline text-text",
                                    feedback.type === 'retype_needed' && isCorrect && "border-green text-green bg-green/5"
                                 )}
                                 autoComplete="off"
                              />
                           </div>
                        );
                     })}
                  </div>
               )}

               {/* Action Bar */}
               <div className="flex justify-end items-center pt-2 h-16">
                  <div className="flex gap-4">
                     {isInteractive ? (
                        <>
                           <button
                              onClick={handleReveal}
                              className="text-muted hover:text-text font-bold px-6 py-3 rounded-xl hover:bg-panel-2 transition-colors"
                           >
                              Skip
                           </button>
                           <button
                              onClick={handleAttempt}
                              className="bg-accent text-bg font-extrabold px-10 py-3 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg"
                           >
                              Submit
                           </button>
                        </>
                     ) : (
                        <button
                           autoFocus
                           onClick={() => nextCard()}
                           className="bg-text text-bg font-extrabold px-12 py-4 rounded-xl animate-in zoom-in duration-200 shadow-lg hover:scale-105 transition-transform"
                        >
                           Continue
                        </button>
                     )}
                  </div>
               </div>

               {/* Messages */}
               <div className="min-h-[40px]">
                  {feedback.type === 'correct' && (
                     <div className="flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 bg-green/10 border border-green/20 p-3 rounded-lg">
                        <div className="text-green font-bold flex items-center gap-2">
                           Correct!
                           {feedback.correction && <span className="text-muted font-normal text-sm">(Accepted: {feedback.correction})</span>}
                        </div>
                        <button onClick={() => handleOverride(false)} className="text-xs text-muted hover:text-text underline">
                           Actually, I was wrong (O)
                        </button>
                     </div>
                  )}

                  {(feedback.type === 'incorrect' || feedback.type === 'reveal') && (
                     <div className="flex items-center justify-between animate-in fade-in slide-in-from-bottom-2 bg-red/10 border border-red/20 p-3 rounded-lg">
                        <div className="text-red font-bold flex flex-col">
                           <span>{feedback.message}</span>
                           {currentCard.year && <span className="text-sm opacity-80">Year: {currentCard.year}</span>}
                           {currentCard.customFields?.map(f => (
                              <span key={f.name} className="text-sm opacity-80">{f.name}: {f.value}</span>
                           ))}
                        </div>
                        <button onClick={() => handleOverride(true)} className="text-xs text-muted hover:text-text underline">
                           Actually, I was right (O)
                        </button>
                     </div>
                  )}
               </div>

            </div>

            {/* Original Set Name Display (Multistudy) */}
            {currentCard.originalSetName && (
               <div className="absolute bottom-4 left-10 text-[10px] font-bold text-muted uppercase tracking-widest opacity-40">
                  {currentCard.originalSetName}
               </div>
            )}
         </div>

         {/* Streak Footer */}
         {
            streak >= 2 && (
               <div className="text-center mt-8 animate-in fade-in duration-500">
                  <span className="px-6 py-2 rounded-full font-bold tracking-widest transition-colors text-accent bg-bg border border-accent/50 shadow-[0_0_15px_rgba(208,164,94,0.2)]">
                     {streak} CARD STREAK
                  </span>
               </div>
            )
         }
         {/* Edit Modal */}
         {
            isEditOpen && (
               <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={() => setIsEditOpen(false)}>
                  <div className="bg-panel border border-outline rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                     <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-text">Edit Card</h2>
                        <button onClick={() => setIsEditOpen(false)}><X size={24} className="text-muted hover:text-text" /></button>
                     </div>
                     <div className="space-y-4">
                        <div>
                           <label className="block text-xs font-bold text-muted uppercase mb-1">Term</label>
                           <input
                              value={(currentCard.tags && currentCard.tags.length > 0 ? currentCard.tags.map(t => `(${t})`).join(' ') + ' ' : '') + currentCard.term.join(' / ')}
                              onChange={(e) => {
                                 const val = e.target.value;
                                 let text = val;
                                 let tags: string[] = [];
                                 const tagRegex = /^(\s*\([^)]+\)\s*)+/;
                                 const match = text.match(tagRegex);
                                 if (match) {
                                    const fullTagString = match[0];
                                    tags = fullTagString.match(/\(([^)]+)\)/g)?.map(t => t.slice(1, -1).trim()) || [];
                                    text = text.replace(tagRegex, '');
                                 }
                                 handleUpdateCard(currentCard.id, {
                                    term: text.split('/').map(t => t.trim()),
                                    tags: tags
                                 });
                              }}
                              className="w-full bg-panel-2 border border-outline rounded-lg px-3 py-2 text-text focus:border-accent focus:outline-none"
                           />
                        </div>
                        <div>
                           <label className="block text-xs font-bold text-muted uppercase mb-1">Definition</label>
                           <textarea
                              value={currentCard.content}
                              onChange={(e) => handleUpdateCard(currentCard.id, { content: e.target.value })}
                              rows={3}
                              className="w-full bg-panel-2 border border-outline rounded-lg px-3 py-2 text-text focus:border-accent focus:outline-none resize-none"
                           />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className="block text-xs font-bold text-muted uppercase mb-1">Year</label>
                              <input
                                 value={currentCard.year || ''}
                                 onChange={(e) => handleUpdateCard(currentCard.id, { year: e.target.value })}
                                 className="w-full bg-panel-2 border border-outline rounded-lg px-3 py-2 text-text focus:border-accent focus:outline-none"
                              />
                           </div>
                           <div>
                              <label className="block text-xs font-bold text-muted uppercase mb-1">Image URL</label>
                              <input
                                 value={currentCard.image || ''}
                                 onChange={(e) => handleUpdateCard(currentCard.id, { image: e.target.value })}
                                 className="w-full bg-panel-2 border border-outline rounded-lg px-3 py-2 text-text focus:border-accent focus:outline-none"
                              />
                           </div>
                        </div>
                        {/* Custom Fields Editing */}
                        {set.customFieldNames?.map(fieldName => {
                           const val = currentCard.customFields?.find(f => f.name === fieldName)?.value || '';
                           return (
                              <div key={fieldName}>
                                 <label className="block text-xs font-bold text-muted uppercase mb-1">{fieldName}</label>
                                 <input
                                    value={val}
                                    onChange={(e) => {
                                       const newFields = currentCard.customFields?.filter(f => f.name !== fieldName) || [];
                                       if (e.target.value) {
                                          newFields.push({ name: fieldName, value: e.target.value });
                                       }
                                       handleUpdateCard(currentCard.id, { customFields: newFields });
                                    }}
                                    className="w-full bg-panel-2 border border-outline rounded-lg px-3 py-2 text-text focus:border-accent focus:outline-none"
                                 />
                              </div>
                           );
                        })}
                        <button
                           onClick={() => setIsEditOpen(false)}
                           className="w-full py-3 bg-accent text-bg rounded-xl font-bold mt-4 hover:scale-105 transition-transform"
                        >
                           Save Changes
                        </button>
                     </div>
                  </div>
               </div>
            )
         }

         {/* Multistudy Edit Warning Modal */}
         {showEditWarning && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
               <div className="bg-panel border border-outline rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
                  <h3 className="text-lg font-bold text-text mb-2">Edit Original Card?</h3>
                  <p className="text-sm text-muted mb-6 leading-relaxed">
                     You are editing a card in a Multistudy session. This will update the card in the <span className="text-accent font-bold">original set</span> as well.
                  </p>

                  <div className="flex items-center gap-2 mb-6">
                     <input
                        type="checkbox"
                        id="suppress"
                        className="rounded border-outline bg-panel-2 text-accent focus:ring-accent"
                        onChange={(e) => {
                           if (e.target.checked) setSuppressEditWarning(true);
                           else setSuppressEditWarning(false);
                        }}
                     />
                     <label htmlFor="suppress" className="text-xs text-muted cursor-pointer select-none">Don't warn me again this session</label>
                  </div>

                  <div className="flex gap-3">
                     <button
                        onClick={() => setShowEditWarning(false)}
                        className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-panel-2 border border-outline hover:bg-panel-3 transition-colors text-text"
                     >
                        Cancel
                     </button>
                     <button
                        onClick={() => {
                           setShowEditWarning(false);
                           setIsEditOpen(true);
                        }}
                        className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-accent text-bg hover:scale-105 transition-transform"
                     >
                        Edit Anyway
                     </button>
                  </div>
               </div>
            </div>
         )}
      </div >
   );
};