import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardSet, FeedbackState, Settings, CustomFieldDefinition } from '../types';
import { checkAnswer, checkDefinitionAnswer, renderMarkdown, renderInline, downloadFile, findMixup } from '../utils';
import { ChevronLeft, Pencil, X, Download, Info, Minus, ExternalLink } from 'lucide-react';
import clsx from 'clsx';

interface GameProps {
   set: CardSet;
   onUpdateSet: (updatedSet: CardSet) => void;
   onFinish: () => void;
   settings: Settings;
   onExit: () => void;
   onCorrect: () => void;
}

// Helper Component for Rendering Edit Fields
const renderEditField = (
   fieldDef: CustomFieldDefinition,
   currentCard: Card,
   handleUpdateCard: (id: string, updates: Partial<Card>) => void
) => {
   const fieldName = fieldDef.name;
   const val = currentCard.customFields?.find(f => f.name === fieldName)?.value || '';

   if (fieldDef.type === 'ab' || fieldDef.type === 'tf') {
      const isTF = fieldDef.type === 'tf';
      const optionA = isTF ? 'True' : fieldDef.options?.a || 'A';
      const optionB = isTF ? 'False' : fieldDef.options?.b || 'B';

      return (
         <div key={fieldName}>
            <label className="block text-xs font-bold text-muted uppercase mb-2 truncate" title={fieldName}>{fieldName}</label>
            <div className="flex w-full bg-panel-2 border border-outline rounded-xl p-1 relative h-[42px]">
               <div
                  className="absolute top-1 bottom-1 bg-accent rounded-lg transition-all duration-300 ease-out shadow-sm"
                  style={{
                     width: "calc((100% - 8px) / 3)",
                     left: `calc(4px + (100% - 8px) / 3 * ${val === optionA ? 0 : val === optionB ? 2 : 1})`,
                  }}
               />
               <button
                  onClick={() => {
                     const newFields = currentCard.customFields?.filter(f => f.name !== fieldName) || [];
                     newFields.push({ name: fieldName, value: optionA });
                     handleUpdateCard(currentCard.id, { customFields: newFields });
                  }}
                  className={clsx("flex-1 relative z-10 flex items-center justify-center font-bold text-xs transition-colors", val === optionA ? "text-bg" : "text-muted hover:text-text")}
               >
                  {isTF ? "T" : optionA}
               </button>
               <button
                  onClick={() => {
                     const newFields = currentCard.customFields?.filter(f => f.name !== fieldName) || [];
                     handleUpdateCard(currentCard.id, { customFields: newFields });
                  }}
                  className={clsx("flex-1 relative z-10 flex items-center justify-center font-bold text-xs transition-colors", (!val || (val !== optionA && val !== optionB)) ? "text-bg" : "text-muted hover:text-text")}
               >
                  <Minus size={14} strokeWidth={3} />
               </button>
               <button
                  onClick={() => {
                     const newFields = currentCard.customFields?.filter(f => f.name !== fieldName) || [];
                     newFields.push({ name: fieldName, value: optionB });
                     handleUpdateCard(currentCard.id, { customFields: newFields });
                  }}
                  className={clsx("flex-1 relative z-10 flex items-center justify-center font-bold text-xs transition-colors", val === optionB ? "text-bg" : "text-muted hover:text-text")}
               >
                  {isTF ? "F" : optionB}
               </button>
            </div>
         </div>
      );
   }

   return (
      <div key={fieldName}>
         <label className="block text-xs font-bold text-muted uppercase mb-2 truncate" title={fieldName}>{fieldName}</label>
         <input
            value={val}
            onChange={(e) => {
               const newFields = currentCard.customFields?.filter(f => f.name !== fieldName) || [];
               if (e.target.value) {
                  newFields.push({ name: fieldName, value: e.target.value });
               }
               handleUpdateCard(currentCard.id, { customFields: newFields });
            }}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder={`Enter ${fieldName}...`}
            className="w-full bg-panel-2 border border-outline rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none transition-colors"
         />
      </div>
   );
};

export const Game: React.FC<GameProps> = ({ set, onUpdateSet, onFinish, settings, onExit, onCorrect }) => {
   // Game State
   const [currentId, setCurrentId] = useState<string | null>(null);
   const [inputTerm, setInputTerm] = useState('');
   const [inputYear, setInputYear] = useState('');
   const [inputCustom, setInputCustom] = useState<Record<string, string>>({});
   const [feedback, setFeedback] = useState<FeedbackState>({ type: 'idle' });
   const [isEditOpen, setIsEditOpen] = useState(false);
   const [isShaking, setIsShaking] = useState(false);

   // Mixup Modal
   const [isMixupModalOpen, setIsMixupModalOpen] = useState(false);

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
      const cardsToCount = settings.starredOnly ? set.cards.filter(c => c.star) : set.cards;
      cardsToCount.forEach(card => c[card.mastery]++);
      return c;
   }, [set.cards, settings.starredOnly]);

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
         // In definition mode, options are definitions. Otherwise, options are terms.
         const correctAnswer = settings.answerWithDefinition
            ? currentCard.content
            : currentCard.term[0]; // Use primary term

         // Get all other cards from the set
         const allOtherCards = set.cards.filter(c => c.id !== currentCard.id);

         // Shuffle and pick 3
         const distractors: string[] = [];
         const shuffledOthers = [...allOtherCards].sort(() => 0.5 - Math.random());

         for (let i = 0; i < Math.min(3, shuffledOthers.length); i++) {
            distractors.push(settings.answerWithDefinition
               ? shuffledOthers[i].content
               : shuffledOthers[i].term[0]);
         }

         // Combine and shuffle
         const newOptions = [correctAnswer, ...distractors].sort(() => 0.5 - Math.random());
         setOptions(newOptions);
      }
   }, [currentCard, settings.mode, settings.answerWithDefinition, set.cards]);

   // Focus Management
   useEffect(() => {
      if (isEditOpen) return; // Don't steal focus when edit modal is open
      if (feedback.type === 'idle' || feedback.type === 'retype_needed') {
         termInputRef.current?.focus();
      }
   }, [feedback.type, currentId, isEditOpen]);

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

      // Use appropriate check function based on answerWithDefinition setting
      const result = settings.answerWithDefinition
         ? checkDefinitionAnswer(inputTerm, inputYear, inputCustom, currentCard, !settings.forgiveSpellingErrors)
         : checkAnswer(inputTerm, inputYear, inputCustom, currentCard, !settings.forgiveSpellingErrors);

      // Normalize result - in definition mode, isDefinitionMatch maps to isTermMatch conceptually
      const isMainAnswerMatch = settings.answerWithDefinition
         ? (result as ReturnType<typeof checkDefinitionAnswer>).isDefinitionMatch
         : (result as ReturnType<typeof checkAnswer>).isTermMatch;

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
            correction: (settings.forgiveSpellingErrors && result.bestDist > 0)
               ? (settings.answerWithDefinition ? currentCard.content.substring(0, 50) + '...' : (result as ReturnType<typeof checkAnswer>).bestTerm)
               : undefined
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
                  isTermMatch: isMainAnswerMatch,
                  isYearMatch: result.isYearMatch,
                  isCustomMatch: result.isCustomMatch,
                  customResults: result.customResults
               }
            });
            // Clear ONLY wrong fields
            if (!isMainAnswerMatch) setInputTerm('');
            if (!result.isYearMatch) setInputYear('');
            if (!result.isCustomMatch) {
               const newCustom = { ...inputCustom };
               Object.keys(result.customResults).forEach(key => {
                  if (!result.customResults[key]) newCustom[key] = '';
               });
               setInputCustom(newCustom);
            }
         } else {
            let msg = settings.answerWithDefinition
               ? `Answer: ${currentCard.content.length > 100 ? currentCard.content.substring(0, 100) + '...' : currentCard.content}`
               : `Answer: ${currentCard.term.join(' / ')}`;
            if (currentCard.year && !result.isYearMatch && isMainAnswerMatch) {
               msg = `${settings.answerWithDefinition ? 'Definition' : 'Term'} correct, but year is ${currentCard.year}`;
            } else if (isMainAnswerMatch && result.isYearMatch && !result.isCustomMatch) {
               // Find which custom field is wrong
               const wrongField = Object.keys(result.customResults || {}).find(k => !result.customResults[k]);
               if (wrongField) {
                  const correctVal = currentCard.customFields?.find(f => f.name === wrongField)?.value;
                  msg = `${settings.answerWithDefinition ? 'Definition' : 'Term'}/Year correct, but ${wrongField} is ${correctVal}`;
               }
            }

            // Detect mixups with other cards
            const customFieldDefs = set.version && set.version >= 2
               ? (settings.answerWithDefinition ? set.defSideFields : set.termSideFields)?.map(f =>
                  typeof f === 'string' ? { name: f, type: 'text' as const } : f
               )
               : set.customFieldNames?.map(name => ({ name, type: 'text' as const }));

            const mixupItems = findMixup(
               inputTerm,
               inputYear,
               inputCustom,
               currentCard,
               set.cards,
               settings.answerWithDefinition,
               customFieldDefs
            );

            setFeedback({
               type: 'incorrect',
               message: msg,
               customResults: { year: !result.isYearMatch, custom: result.customResults },
               mixupInfo: mixupItems.length > 0 ? { mixups: mixupItems } : undefined
            });
         }
         // Don't break streak YET. Wait for continue.
         setPendingStreakBreak(true);
      }
   };

   const handleOptionClick = (option: string) => {
      if (!currentCard) return;

      // Check if option matches either the term (normal) or definition (answerWithDefinition mode)
      const isCorrect = settings.answerWithDefinition
         ? option.toLowerCase() === currentCard.content.toLowerCase()
         : currentCard.term.some(t => t.toLowerCase() === option.toLowerCase());

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
         const correctAnswer = settings.answerWithDefinition
            ? currentCard.content
            : currentCard.term.join(' / ');
         setFeedback({ type: 'incorrect', message: `Correct Answer: ${correctAnswer}` });
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
      const answer = settings.answerWithDefinition
         ? currentCard.content
         : currentCard.term.join(' / ');
      setFeedback({ type: 'reveal', message: `Answer: ${answer}` });
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
               {/* Back Button */}
               <button
                  onClick={onExit}
                  className="flex items-center gap-3 text-muted hover:text-text font-bold uppercase text-xs tracking-wider transition-colors group"
               >
                  <div className="p-2 rounded-full border border-outline group-hover:bg-panel group-hover:border-accent transition-colors">
                     <ChevronLeft size={16} />
                  </div>
                  Back
               </button>

               {/* Download Button (Multistudy Only) */}
               {set.isMultistudy && (
                  <button
                     onClick={handleDownloadSession}
                     className="flex items-center gap-3 text-muted hover:text-text font-bold uppercase text-xs tracking-wider transition-colors group"
                     title="Download Session as Set"
                  >
                     <div className="p-2 rounded-full border border-outline group-hover:bg-panel group-hover:border-accent transition-colors">
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
            <div className="min-h-[200px] mb-10 flex flex-col justify-center">
               {(() => {
                  const isAnsweringWithDef = settings.answerWithDefinition;
                  // If answering with Def, Question is Term.
                  const questionSideFields = isAnsweringWithDef ? (set.termSideFields || []) : (set.defSideFields || []);
                  const questionContent = isAnsweringWithDef
                     ? (currentCard.term[0] || '')
                     : (currentCard.content || '');

                  // Dynamic Text Sizing
                  const len = questionContent.length;
                  let textSizeClass = "text-4xl";
                  if (len > 50) textSizeClass = "text-3xl";
                  if (len > 100) textSizeClass = "text-2xl";
                  if (len > 200) textSizeClass = "text-xl";

                  return (
                     <div className="w-full gap-8 items-center">
                        <div className={clsx("flex flex-col gap-4", currentCard.image ? "md:flex-row md:items-center" : "")}>

                           {currentCard.image && (
                              <div className="flex-shrink-0 mx-auto md:mx-0">
                                 <img
                                    src={currentCard.image}
                                    alt="Card visual"
                                    className="rounded-xl max-h-[300px] w-auto object-contain border border-outline shadow-sm bg-bg/50"
                                 />
                              </div>
                           )}

                           <div className="flex-1 min-w-0">
                              {/* Metadata/Context Fields (Question Side) */}
                              {questionSideFields.length > 0 && (
                                 <div className="flex flex-wrap gap-3 mb-4 opacity-80">
                                    {questionSideFields.map(field => {
                                       // Normalize field to object if string (legacy)
                                       const fieldName = typeof field === 'string' ? field : field.name;
                                       const val = currentCard.customFields?.find(f => f.name === fieldName)?.value;
                                       if (!val) return null;
                                       return (
                                          <div key={fieldName} className="px-3 py-1 bg-panel-2 border border-outline rounded-lg text-sm font-medium text-muted">
                                             <span className="text-xs font-bold uppercase tracking-wider opacity-70 mr-2">{fieldName}:</span>
                                             <span className="text-text">{val}</span>
                                          </div>
                                       );
                                    })}
                                 </div>
                              )}

                              {/* Main Question Text */}
                              <div className={clsx("font-medium leading-tight text-text font-sans text-left transition-all", textSizeClass)}>
                                 {isAnsweringWithDef
                                    ? <div>{currentCard.term.map((t, i) => <div key={i}>{renderInline(t, `term-${i}`)}</div>)}</div>
                                    : renderMarkdown(currentCard.content)}
                              </div>
                           </div>
                        </div>
                     </div>
                  );
               })()}
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
                  <div className={clsx("grid grid-cols-1 md:grid-cols-12 gap-4", isShaking && "animate-shake")}>
                     {(() => {
                        const isAnsweringWithDef = settings.answerWithDefinition;
                        const inputLabel = isAnsweringWithDef ? (set.definitionLabel || 'Definition') : (set.termLabel || 'Term');

                        // Determine input fields based on side
                        let relevantFields: CustomFieldDefinition[] = [];

                        const normalize = (f: any[] | undefined): CustomFieldDefinition[] => {
                           if (!f) return [];
                           return f.map(item => typeof item === 'string' ? { name: item, type: 'text' } : item);
                        };

                        if (set.version && set.version >= 2) {
                           relevantFields = isAnsweringWithDef ? normalize(set.defSideFields) : normalize(set.termSideFields);
                        } else {
                           relevantFields = normalize(set.customFieldNames);
                        }

                        const activeCustomFields = relevantFields.filter(fDef => currentCard.customFields?.some(f => f.name === fDef.name));
                        const hasYear = !!currentCard.year;
                        const totalFields = 1 + (hasYear ? 1 : 0) + activeCustomFields.length;

                        let termClass = "md:col-span-12";
                        let yearClass = "md:col-span-12";
                        let customClasses: string[] = activeCustomFields.map(() => "md:col-span-12");

                        // Always Term first
                        const fieldOrder: ('term' | 'year' | 'custom')[] = ['term', 'year', 'custom'];

                        if (totalFields === 2) {
                           if (hasYear) {
                              termClass = "md:col-span-9";
                              yearClass = "md:col-span-3";
                           } else {
                              termClass = "md:col-span-8";
                              customClasses = ["md:col-span-4"];
                           }
                        } else if (totalFields === 3) {
                           if (hasYear) {
                              termClass = "md:col-span-7";
                              yearClass = "md:col-span-2";
                              customClasses = ["md:col-span-3"];
                           } else {
                              termClass = "md:col-span-12";
                              customClasses = ["md:col-span-6", "md:col-span-6"];
                           }
                        } else if (totalFields === 4) {
                           if (hasYear) {
                              termClass = "md:col-span-9";
                              yearClass = "md:col-span-3";
                              customClasses = ["md:col-span-6", "md:col-span-6"];
                           } else {
                              termClass = "md:col-span-9";
                              customClasses = ["md:col-span-3", "md:col-span-6", "md:col-span-6"];
                           }
                        } else if (totalFields >= 5) {
                           termClass = "md:col-span-7";
                           yearClass = "md:col-span-2";
                           customClasses = activeCustomFields.map((_, i) => i === 0 ? "md:col-span-3" : "md:col-span-6");
                        }

                        const renderTerm = () => (
                           <div key="term" className={clsx("relative flex flex-col", termClass)}>
                              {feedback.type === 'retype_needed' && !feedback.results?.isTermMatch && (
                                 <div className="absolute -top-6 left-0 text-xs font-bold text-accent animate-in fade-in">
                                    Answer: {settings.answerWithDefinition
                                       ? (currentCard.content.length > 50 ? currentCard.content.substring(0, 50) + '...' : currentCard.content)
                                       : currentCard.term[0]}
                                 </div>
                              )}
                              <input
                                 ref={termInputRef}
                                 type="text"
                                 value={inputTerm}
                                 onChange={(e) => setInputTerm(e.target.value)}
                                 onKeyDown={handleInputKeyDown}
                                 disabled={!isInteractive || (feedback.type === 'retype_needed' && feedback.results?.isTermMatch)}
                                 placeholder={feedback.type === 'retype_needed'
                                    ? `Retype ${inputLabel.toLowerCase()}...`
                                    : `Type the ${inputLabel.toLowerCase()}...`}
                                 className={clsx(
                                    "w-full h-full bg-panel-2 border rounded-xl px-6 py-5 text-xl focus:outline-none focus:border-accent disabled:opacity-50 transition-colors placeholder-text/20",
                                    feedback.type === 'retype_needed' && !feedback.results?.isTermMatch ? "border-red text-red" : "border-outline text-text",
                                    feedback.type === 'retype_needed' && feedback.results?.isTermMatch && "border-green text-green bg-green/5"
                                 )}
                                 autoComplete="off"
                              />
                           </div>
                        );

                        const renderYear = () => (
                           <div key="year" className={clsx("relative flex flex-col", yearClass)}>
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
                                    "w-full h-full bg-panel-2 border rounded-xl px-4 py-5 text-xl focus:outline-none focus:border-accent disabled:opacity-50 text-center placeholder-text/20 text-text",
                                    (feedback.type === 'incorrect' || (feedback.type === 'retype_needed' && !feedback.results?.isYearMatch)) ? "border-red text-red" : "border-outline text-text",
                                    feedback.type === 'retype_needed' && feedback.results?.isYearMatch && "border-green text-green bg-green/5"
                                 )}
                                 autoComplete="off"
                              />
                           </div>
                        );

                        const renderCustoms = () => (
                           <>
                              {activeCustomFields.map((fieldDef, i) => {
                                 // fieldDef is CustomFieldDefinition
                                 const fieldName = fieldDef.name;
                                 const field = currentCard.customFields?.find(f => f.name === fieldName);
                                 const isCorrect = feedback.type === 'retype_needed' && feedback.results?.customResults?.[fieldName];
                                 const val = inputCustom[fieldName] || '';

                                 // Number Tooltip State (using local vars for render calc, or we rely on transient tooltip on hover/focus/input)
                                 // Since we are inside a map and don't have per-field state hooks easily without subcomponent,
                                 // we will show the tooltip if the value is non-numeric AND not empty.
                                 const isInvalidNumber = fieldDef.type === 'number' && val !== '' && /[^0-9.]/.test(val);


                                 if (fieldDef.type === 'ab' || fieldDef.type === 'tf') {
                                    const isTF = fieldDef.type === 'tf';
                                    const optionA = isTF ? 'True' : fieldDef.options?.a || 'A';
                                    const optionB = isTF ? 'False' : fieldDef.options?.b || 'B';
                                    const isB = val === optionB;

                                    return (
                                       <div key={fieldName} className={clsx("relative flex flex-col items-center justify-center p-4 bg-panel-2 border rounded-xl h-full", customClasses[i],
                                          (feedback.type === 'incorrect' || (feedback.type === 'retype_needed' && !isCorrect)) ? "border-red" : "border-outline",
                                          feedback.type === 'retype_needed' && isCorrect && "border-green bg-green/5"
                                       )}>
                                          <div className="text-xs font-bold text-muted uppercase mb-2">{fieldName}</div>
                                          {feedback.type === 'retype_needed' && !isCorrect && (
                                             <div className="absolute -top-3 left-0 w-full text-center text-xs font-bold text-accent animate-in fade-in bg-bg px-2 border border-outline rounded-full mx-auto w-max max-w-[90%] truncate shadow-sm z-10">
                                                {field?.value}
                                             </div>
                                          )}
                                          <div className="flex w-full max-w-[200px] h-10 bg-bg border border-outline rounded-lg relative p-1">
                                             <div className={clsx(
                                                "absolute top-1 bottom-1 w-[calc(50%-4px)] bg-accent rounded-md transition-all duration-200",
                                                isB ? "left-[calc(50%)]" : "left-1",
                                                !val && "opacity-0" // Hide slider if no value selected yet?
                                             )} />
                                             <button
                                                onClick={() => {
                                                   const isDisabled = !isInteractive || (feedback.type === 'retype_needed' && isCorrect);
                                                   if (isDisabled) return;
                                                   setInputCustom(prev => ({ ...prev, [fieldName]: optionA }));
                                                }}
                                                className={clsx("flex-1 relative z-10 text-xs font-bold transition-colors", (val === optionA) ? "text-bg" : "text-muted")}
                                             >
                                                {isTF ? "T" : optionA}
                                             </button>
                                             <button
                                                onClick={() => {
                                                   const isDisabled = !isInteractive || (feedback.type === 'retype_needed' && isCorrect);
                                                   if (isDisabled) return;
                                                   setInputCustom(prev => ({ ...prev, [fieldName]: optionB }));
                                                }}
                                                className={clsx("flex-1 relative z-10 text-xs font-bold transition-colors", (val === optionB) ? "text-bg" : "text-muted")}
                                             >
                                                {isTF ? "F" : optionB}
                                             </button>
                                          </div>
                                       </div>
                                    );
                                 }

                                 return (
                                    <div key={fieldName} className={clsx("relative flex flex-col", customClasses[i])}>
                                       {feedback.type === 'retype_needed' && !isCorrect && (
                                          <div className="absolute -top-6 left-0 w-full text-center text-xs font-bold text-accent animate-in fade-in">
                                             {field?.value}
                                          </div>
                                       )}
                                       {isInvalidNumber && (
                                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-red text-white text-xs font-bold rounded shadow-lg whitespace-nowrap z-20 animate-in fade-in slide-in-from-bottom-1 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-red">
                                             Numbers Only
                                          </div>
                                       )}
                                       <input
                                          type="text"
                                          value={val}
                                          onChange={(e) => setInputCustom(prev => ({ ...prev, [fieldName]: e.target.value }))}
                                          onKeyDown={handleInputKeyDown}
                                          placeholder={fieldName}
                                          disabled={!isInteractive || (feedback.type === 'retype_needed' && isCorrect)}
                                          className={clsx(
                                             "w-full h-full bg-panel-2 border rounded-xl px-4 py-5 text-xl focus:outline-none focus:border-accent disabled:opacity-50 text-center placeholder-text/20 text-text transition-colors",
                                             (feedback.type === 'incorrect' || (feedback.type === 'retype_needed' && !isCorrect) || isInvalidNumber) ? "border-red text-red" : "border-outline text-text",
                                             feedback.type === 'retype_needed' && isCorrect && "border-green text-green bg-green/5"
                                          )}
                                          autoComplete="off"
                                       />
                                    </div>
                                 );
                              })}
                           </>
                        );

                        return fieldOrder.map(type => {
                           if (type === 'term') return renderTerm();
                           if (type === 'year' && hasYear) return renderYear();
                           if (type === 'custom') return renderCustoms();
                           return null;
                        });
                     })()}
                  </div>
               )}

               {/* Mixup Alert Trigger */}
               {feedback.type === 'incorrect' && feedback.mixupInfo && feedback.mixupInfo.mixups.length > 0 && (
                  <div className="flex justify-start -mt-4 mb-2 animate-in fade-in slide-in-from-top-1">
                     <button
                        onClick={() => setIsMixupModalOpen(true)}
                        className="flex items-center gap-2 text-accent hover:text-accent/80 transition-colors group"
                     >
                        <Info size={16} className="text-accent" />
                        <span className="text-xs font-extrabold uppercase tracking-widest group-hover:underline decoration-2 underline-offset-4">
                           Mixup Alert
                        </span>
                     </button>
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
                     <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-2">
                        <div className="flex items-center justify-between bg-red/10 border border-red/20 p-3 rounded-lg">
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

         {/* Edit Modal (Redesigned) */}
         {
            isEditOpen && (
               <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={() => setIsEditOpen(false)}>
                  <div className="bg-panel border border-outline rounded-2xl p-8 w-full max-w-5xl shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>

                     {/* Header */}
                     <div className="flex justify-between items-center mb-8 border-b border-outline/50 pb-4">
                        <div className="flex items-center gap-4">
                           <h2 className="text-2xl font-bold text-text">Edit Card</h2>
                           <div className="h-6 w-px bg-outline/50"></div>
                           <button
                              onClick={onExit}
                              className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-accent hover:text-accent/80 transition-colors group"
                              title="Exit Learn Mode and open this set in the full editor. Your session progress will be saved."
                           >
                              <ExternalLink size={14} />
                              Open Full Editor
                           </button>
                        </div>
                        <button onClick={() => setIsEditOpen(false)}><X size={24} className="text-muted hover:text-text" /></button>
                     </div>

                     <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
                        {/* LEFT COLUMN: TERM SIDE */}
                        <div className="space-y-6">
                           <div className="uppercase text-xs font-bold text-muted tracking-widest mb-4">Terms Side</div>

                           {/* Main Term Input */}
                           <div>
                              <label className="block text-xs font-bold text-muted uppercase mb-2">{set.termLabel || "Term"}</label>
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
                                 onKeyDown={(e) => e.stopPropagation()}
                                 className="w-full bg-panel-2 border border-outline rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none transition-colors"
                                 placeholder="Enter term..."
                              />
                           </div>

                           {/* Year */}
                           <div>
                              <label className="block text-xs font-bold text-muted uppercase mb-2">Year</label>
                              <input
                                 value={currentCard.year || ''}
                                 onChange={(e) => handleUpdateCard(currentCard.id, { year: e.target.value })}
                                 onKeyDown={(e) => e.stopPropagation()}
                                 className="w-full bg-panel-2 border border-outline rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none transition-colors"
                                 placeholder="Year..."
                              />
                           </div>

                           {/* Term Side Custom Fields */}
                           <div className="space-y-4">
                              {(() => {
                                 // Safely get term side fields. If V1, customFieldNames are generic, so we'll just put them all on Term side or split? 
                                 // Let's put V1 all here if structure unknown, but V2 is prefered.
                                 const fields = (set.version && set.version >= 2)
                                    ? (set.termSideFields || [])
                                    : (set.customFieldNames || []).map(n => ({ name: n, type: 'text' as const }));

                                 return fields.map(fieldDef => renderEditField(fieldDef, currentCard, handleUpdateCard));
                              })()}
                           </div>
                        </div>

                        {/* RIGHT COLUMN: DEFINITION SIDE */}
                        <div className="space-y-6">
                           <div className="uppercase text-xs font-bold text-muted tracking-widest mb-4 lg:text-right">Definitions Side</div>

                           {/* Main Definition Input */}
                           <div>
                              <label className="block text-xs font-bold text-muted uppercase mb-2">{set.definitionLabel || "Definition"}</label>
                              <input
                                 value={currentCard.content}
                                 onChange={(e) => handleUpdateCard(currentCard.id, { content: e.target.value })}
                                 onKeyDown={(e) => e.stopPropagation()}
                                 className="w-full bg-panel-2 border border-outline rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none transition-colors"
                                 placeholder="Enter definition..."
                              />
                           </div>

                           {/* Image URL */}
                           <div>
                              <label className="block text-xs font-bold text-muted uppercase mb-2">Image URL</label>
                              <input
                                 value={currentCard.image || ''}
                                 onChange={(e) => handleUpdateCard(currentCard.id, { image: e.target.value })}
                                 onKeyDown={(e) => e.stopPropagation()}
                                 className="w-full bg-panel-2 border border-outline rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none transition-colors"
                                 placeholder="https://..."
                              />
                           </div>

                           {/* Definition Side Custom Fields */}
                           <div className="space-y-4">
                              {(() => {
                                 const fields = (set.version && set.version >= 2)
                                    ? (set.defSideFields || [])
                                    : []; // If V1, we put them on Left, or we can just render nothing here. 

                                 return fields.map(fieldDef => renderEditField(fieldDef, currentCard, handleUpdateCard));
                              })()}
                           </div>
                        </div>
                     </div>

                     <button
                        onClick={() => setIsEditOpen(false)}
                        className="w-full py-4 bg-accent text-bg rounded-xl font-bold mt-8 hover:scale-[1.01] active:scale-[0.99] transition-all shadow-lg text-lg"
                     >
                        Save Changes
                     </button>
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
         {/* Mixup Details Modal */}
         {isMixupModalOpen && feedback.type === 'incorrect' && feedback.mixupInfo && feedback.mixupInfo.mixups.length > 0 && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={() => setIsMixupModalOpen(false)}>
               <div className="bg-panel border border-outline rounded-2xl p-6 w-full max-w-2xl shadow-2xl animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-between items-center mb-6 border-b border-outline pb-4">
                     <h2 className="text-xl font-bold text-accent flex items-center gap-2">
                        <Info size={24} />
                        Mixup Detected
                     </h2>
                     <button onClick={() => setIsMixupModalOpen(false)}><X size={24} className="text-muted hover:text-text" /></button>
                  </div>

                  <div className="grid grid-cols-2 gap-8 mb-8">
                     {/* Current Card */}
                     <div className="space-y-4">
                        <div className="text-sm font-bold text-muted uppercase tracking-widest border-b border-outline/50 pb-2">
                           Current Card
                        </div>
                        <div>
                           <div className="text-xs text-muted mb-1 uppercase">Term</div>
                           <div className="text-lg font-bold text-text">{currentCard.term.join(' / ')}</div>
                        </div>
                        {currentCard.content && (
                           <div>
                              <div className="text-xs text-muted mb-1 uppercase">Definition</div>
                              <div className="text-sm text-text/80 line-clamp-4">{currentCard.content}</div>
                           </div>
                        )}
                        {currentCard.year && (
                           <div>
                              <div className="text-xs text-muted mb-1 uppercase">Year</div>
                              <div className="text-base text-text">{currentCard.year}</div>
                           </div>
                        )}
                     </div>

                     {/* Mixed Up Card */}
                     <div className="space-y-4">
                        <div className="text-sm font-bold text-muted uppercase tracking-widest border-b border-outline/50 pb-2">
                           Confused With
                        </div>
                        {(() => {
                           const matchedCard = feedback.mixupInfo?.mixups[0]?.matchedCard;
                           if (!matchedCard) return null;
                           return (
                              <>
                                 <div>
                                    <div className="text-xs text-muted mb-1 uppercase">Term</div>
                                    <div className="text-lg font-bold text-accent">{matchedCard.term.join(' / ')}</div>
                                 </div>
                                 {matchedCard.content && (
                                    <div>
                                       <div className="text-xs text-muted mb-1 uppercase">Definition</div>
                                       <div className="text-sm text-text/80 line-clamp-4">{matchedCard.content}</div>
                                    </div>
                                 )}
                                 {matchedCard.year && (
                                    <div>
                                       <div className="text-xs text-muted mb-1 uppercase">Year</div>
                                       <div className="text-base text-text">{matchedCard.year}</div>
                                    </div>
                                 )}
                              </>
                           );
                        })()}
                     </div>
                  </div>

                  <button
                     onClick={() => setIsMixupModalOpen(false)}
                     className="w-full py-3 bg-accent text-bg rounded-xl font-bold hover:scale-[1.02] transition-transform shadow-lg"
                  >
                     OK
                  </button>
               </div>
            </div>
         )}
      </div >
   );
};