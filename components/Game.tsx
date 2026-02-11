import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Card, CardSet, FeedbackState, Settings, CustomFieldDefinition } from '../types';
import { checkAnswer, checkDefinitionAnswer, renderMarkdown, renderInline, downloadFile, findMixup, sanitizeImageUrl, applyMarkdownFormat } from '../utils';
import { ChevronLeft, Pencil, X, Download, Info, Minus, ExternalLink, Zap, Layers, Star, CloudLightning, Wind, Lock, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { generateIncorrectAnswers, isAiAvailable } from '../src/aiService';
import { FloatingToolbar } from './FloatingToolbar';
import { RichInput, RichInputRef } from './RichInput';

interface GameProps {
   set: CardSet;
   onUpdateSet: (updatedSet: CardSet) => void;
   onFinish: () => void;
   settings: Settings;
   onExit: () => void;
   onCorrect: () => void;
   onStartGame: () => void;
}

// Learn Sub-Mode Types
type LearnSubMode = 'zen' | 'batch';

// Batch mode card tracking
interface BatchCardState {
   cardId: string;
   trickyCount: number; // How many times this card has been gotten wrong in a row
   repeatedMistakes: number; // For cards at 1/2 mastery when reintroduced
   firstTry: boolean; // True if never gotten wrong
   mistakeCount: number; // Total number of mistakes ever
   mixupCount: number; // Number of mixup alerts triggered
}

// Encouraging messages for batch mode
const BATCH_MESSAGES_PERFECT = [
   "Perfect round!",
   "Flawless!",
   "Amazing work!",
   "You nailed it!",
   "100% accuracy!",
   "Incredible!",
   "Outstanding!"
];

const BATCH_MESSAGES_GOOD = [
   "You're doing great!",
   "Nice progress!",
   "Keep it up!",
   "Well done!",
   "Good job!",
   "Solid work!",
   "Making strides!"
];

const BATCH_MESSAGES_NEEDS_WORK = [
   "Keep practicing!",
   "You've got this!",
   "Don't give up!",
   "Practice makes perfect!",
   "Stay focused!",
   "Almost there!",
   "Keep pushing!"
];

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

export const Game: React.FC<GameProps> = ({ set, onUpdateSet, onFinish, settings, onExit, onCorrect, onStartGame }) => {
   // Learn Sub-Mode Selection
   const [subMode, setSubMode] = useState<LearnSubMode | null>(null);

   // Game State
   const [currentId, setCurrentId] = useState<string | null>(null);
   const [inputTerm, setInputTerm] = useState('');
   const [inputYear, setInputYear] = useState('');
   const [inputCustom, setInputCustom] = useState<Record<string, string>>({});
   const [feedback, setFeedback] = useState<FeedbackState>({ type: 'idle' });
   const [isEditOpen, setIsEditOpen] = useState(false);
   const [isShaking, setIsShaking] = useState(false);

   // Toolbar State
   const [toolbarVisible, setToolbarVisible] = useState(false);
   const [toolbarPos, setToolbarPos] = useState({ top: 0, left: 0 });
   const [toolbarAnchor, setToolbarAnchor] = useState<'top' | 'bottom'>('bottom');
   const activeToolbarRef = useRef<{
      field: "term" | "def";
   } | null>(null);
   const modalTermRef = useRef<RichInputRef>(null);
   const modalDefRef = useRef<RichInputRef>(null);

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
   const [isLoadingAiOptions, setIsLoadingAiOptions] = useState(false);
   const [aiOptionsError, setAiOptionsError] = useState<string | null>(null);

   // Multistudy Edit Warning
   const [showEditWarning, setShowEditWarning] = useState(false);
   const [suppressEditWarning, setSuppressEditWarning] = useState(false);

   // Batch Mode State
   const [batchCards, setBatchCards] = useState<Card[]>([]);
   const [batchIndex, setBatchIndex] = useState(0);
   const [batchCardStates, setBatchCardStates] = useState<Map<string, BatchCardState>>(new Map());
   const [batchProgress, setBatchProgress] = useState(0); // Cards completed correctly in current batch
   const [batchCorrectInBatch, setBatchCorrectInBatch] = useState<Set<string>>(new Set()); // Cards marked correct this batch
   const [batchPerfectInBatch, setBatchPerfectInBatch] = useState<Set<string>>(new Set()); // Cards got correct on first try in batch
   const [showBatchBreak, setShowBatchBreak] = useState(false);
   const [seenCardIds, setSeenCardIds] = useState<Set<string>>(new Set()); // All cards ever shown
   const [batchProgressBarWidth, setBatchProgressBarWidth] = useState(0);

   // Refs
   const termInputRef = useRef<HTMLInputElement>(null);
   const yearInputRef = useRef<HTMLInputElement>(null);

   // Base cards (respecting starred only setting)
   const baseCards = useMemo(() => {
      let candidates = [...set.cards];
      if (settings.starredOnly) {
         candidates = candidates.filter(c => c.star);
      }
      return candidates;
   }, [set.cards, settings.starredOnly]);

   // Calculate effective batch size
   const effectiveBatchSize = useMemo(() => {
      const halfDeck = Math.floor(baseCards.length / 2);
      return Math.min(settings.batchLength, halfDeck, baseCards.length);
   }, [settings.batchLength, baseCards.length]);

   // Derived Order (for Zen mode)
   const activeQueue = useMemo(() => {
      let candidates = [...baseCards];
      const unmastered = candidates.filter(c => c.mastery < 2);

      // Shuffle if setting is on
      if (settings.shuffleCards) {
         for (let i = unmastered.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [unmastered[i], unmastered[j]] = [unmastered[j], unmastered[i]];
         }
      }
      return unmastered;
   }, [baseCards, settings.shuffleCards]);

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

   // Initialize & Stable Card Selection (for Zen mode)
   useEffect(() => {
      // Only applies to Zen mode
      if (subMode !== 'zen') return;

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
   }, [activeQueue, currentId, set.cards, onFinish, settings.starredOnly, subMode, feedback.type]);

   // Initialize Batch Mode
   useEffect(() => {
      if (subMode !== 'batch' || batchCards.length > 0) return;

      // Get unmastered cards
      let candidates = [...baseCards].filter(c => c.mastery < 2);

      // Shuffle if setting is on
      if (settings.shuffleCards) {
         for (let i = candidates.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
         }
      }

      // Take first batch
      const firstBatch = candidates.slice(0, effectiveBatchSize);
      setBatchCards(firstBatch);
      setBatchIndex(0);
      setSeenCardIds(new Set(firstBatch.map(c => c.id)));
      setBatchCorrectInBatch(new Set());
      setBatchPerfectInBatch(new Set());
      setBatchProgress(0);

      // Initialize card states
      const newStates = new Map<string, BatchCardState>();
      firstBatch.forEach(card => {
         newStates.set(card.id, {
            cardId: card.id,
            trickyCount: 0,
            repeatedMistakes: 0,
            firstTry: true,
            mistakeCount: 0,
            mixupCount: 0
         });
      });
      setBatchCardStates(newStates);

      if (firstBatch.length > 0) {
         setCurrentId(firstBatch[0].id);
      }
   }, [subMode, batchCards.length, baseCards, settings.shuffleCards, effectiveBatchSize]);

   // Generate Options for Multiple Choice
   useEffect(() => {
      let isMounted = true;
      if ((settings.mode === 'multiple_choice' || settings.mode === 'ai_random_choice') && currentCard) {
         // In definition mode, options are definitions. Otherwise, options are terms.
         const correctAnswer = settings.answerWithDefinition
            ? currentCard.content
            : currentCard.term[0]; // Use primary term

         const fallbackToRegularMultipleChoice = () => {
            if (!isMounted) return;
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
         };

         if (settings.mode === 'ai_random_choice' && isAiAvailable()) {
            // AI Random Choice Mode
            setIsLoadingAiOptions(true);
            setAiOptionsError(null);

            const term = settings.answerWithDefinition
               ? currentCard.term[0]
               : currentCard.content;

            generateIncorrectAnswers(term, correctAnswer)
               .then(result => {
                  if (!isMounted) return;

                  if (result && result.answers.length === 3) {
                     // Combine correct answer with AI-generated distractors and shuffle
                     const newOptions = [correctAnswer, ...result.answers].sort(() => 0.5 - Math.random());
                     setOptions(newOptions);
                     setAiOptionsError(null);
                  } else {
                     // Fallback to regular multiple choice if AI fails
                     setAiOptionsError(result?.error || 'Failed to generate AI options');
                     fallbackToRegularMultipleChoice();
                  }
                  setIsLoadingAiOptions(false);
               })
               .catch(err => {
                  if (!isMounted) return;
                  console.error('AI generation error:', err);
                  setAiOptionsError('AI service error');
                  fallbackToRegularMultipleChoice();
                  setIsLoadingAiOptions(false);
               });
         } else {
            // Regular Multiple Choice Mode
            fallbackToRegularMultipleChoice();
         }
      }
      return () => { isMounted = false; };
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

      if (subMode === 'zen') {
         const next = activeQueue.find(c => c.id !== currentId);
         if (next) {
            setCurrentId(next.id);
         } else if (activeQueue.length > 0) {
            setCurrentId(activeQueue[0].id);
         } else {
            onFinish();
            return;
         }
      } else if (subMode === 'batch') {
         // Check if batch is complete
         if (batchProgress >= effectiveBatchSize) {
            setShowBatchBreak(true);
            return;
         }

         // Move to next card in batch
         const nextIndex = batchIndex + 1;
         if (nextIndex < batchCards.length) {
            setBatchIndex(nextIndex);
            setCurrentId(batchCards[nextIndex].id);
         } else {
            // Should not happen if logic is correct, but safe fallback
            // Maybe we just finished the last card and it was correct?
            if (batchProgress >= effectiveBatchSize) {
               setShowBatchBreak(true);
            } else {
               // Loop back or Error? 
               // If we ran out of cards but progress < size, it means something is wrong or 
               // we should have re-added cards. 
               // However, re-added cards are appended, so length grows.
               // If we are here, means nextIndex >= cards.length.
               // It's possible if we just answered the last card correctly.
               setShowBatchBreak(true); // Treat as break if end of queue reached
            }
         }
      }

      setFeedback({ type: 'idle' });
      setInputTerm('');
      setInputYear('');
      setInputCustom({});
   };

   const handleDownloadSession = () => {
      const exportSet = {
         ...set,
         cards: set.cards.map(c => ({ ...c, mastery: 0 }))
      };
      downloadFile(`${set.name}.flashcards`, JSON.stringify(exportSet, null, 2), 'json');
   };

   const handleAttempt = () => {
      if (!currentCard) return;
      // Check if any input is provided
      const hasCustomInput = Object.values(inputCustom).some(v => v.trim());
      if (!inputTerm.trim() && (!currentCard.year || !inputYear.trim()) && !hasCustomInput) return;

      // Determine active definitions
      const activeFieldDefs = set.version && set.version >= 2
         ? (settings.answerWithDefinition ? set.defSideFields : set.termSideFields)?.map(f =>
            typeof f === 'string' ? { name: f, type: 'text' as const } : f
         )
         : set.customFieldNames?.map(name => ({ name, type: 'text' as const }));

      // Use appropriate check function based on answerWithDefinition setting
      const result = settings.answerWithDefinition
         ? checkDefinitionAnswer(inputTerm, inputYear, inputCustom, currentCard, !settings.forgiveSpellingErrors, activeFieldDefs)
         : checkAnswer(inputTerm, inputYear, inputCustom, currentCard, !settings.forgiveSpellingErrors, activeFieldDefs);

      // Normalize result - in definition mode, isDefinitionMatch maps to isTermMatch conceptually
      const isMainAnswerMatch = settings.answerWithDefinition
         ? (result as ReturnType<typeof checkDefinitionAnswer>).isDefinitionMatch
         : (result as ReturnType<typeof checkAnswer>).isTermMatch;

      if (result.isMatch) {
         // CORRECT
         const wasRetyping = feedback.type === 'retype_needed';

         if (!wasRetyping) {
            // Logic for Mastery and Streak
            if (subMode === 'zen') {
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
            } else if (subMode === 'batch') {
               // BATCH MODE CORRECT LOGIC
               const cardState = batchCardStates.get(currentCard.id);
               const isFirstCorrectInBatch = !batchCorrectInBatch.has(currentCard.id);

               if (isFirstCorrectInBatch) {
                  const newCorrectSet = new Set(batchCorrectInBatch);
                  newCorrectSet.add(currentCard.id);
                  setBatchCorrectInBatch(newCorrectSet);
                  setBatchProgress(prev => prev + 1);

                  // Only award mastery if it's the first try (no previous mistakes in this batch)
                  if (cardState?.firstTry) {
                     const newMastery = Math.min(2, currentCard.mastery + 1);
                     const newCards = set.cards.map(c => c.id === currentCard.id ? { ...c, mastery: newMastery } : c);
                     onUpdateSet({ ...set, cards: newCards });

                     const newPerfectSet = new Set(batchPerfectInBatch);
                     newPerfectSet.add(currentCard.id);
                     setBatchPerfectInBatch(newPerfectSet);
                  }
               }

               // Reduce tricky count and reset repeated mistakes
               if (cardState) {
                  const newStates = new Map(batchCardStates);
                  newStates.set(currentCard.id, {
                     ...cardState,
                     trickyCount: Math.max(0, cardState.trickyCount - 1),
                     repeatedMistakes: 0 // Reset on correct
                  });
                  setBatchCardStates(newStates);
               }

               // Check for batch completion happens in nextCard or useEffect
               setPendingStreakBreak(false);
            }
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
            return;
         } else {
            // Standard Incorrect Feedback
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

            // LOGIC FOR INCORRECT ANSWER
            if (subMode === 'zen') {
               // Brutal Mode: In Zen mode, if card is at mastery 1 and user gets it wrong, demote to 0
               if (settings.brutalMode && currentCard.mastery === 1) {
                  const newCards = set.cards.map(c => c.id === currentCard.id ? { ...c, mastery: 0 } : c);
                  onUpdateSet({ ...set, cards: newCards });
               }
            } else if (subMode === 'batch') {
               // BATCH MODE INCORRECT LOGIC
               const cardState = batchCardStates.get(currentCard.id);
               if (cardState) {
                  const newRepeated = cardState.repeatedMistakes + 1;
                  const newStates = new Map(batchCardStates);
                  newStates.set(currentCard.id, {
                     ...cardState,
                     firstTry: false, // Mark as failed first try
                     mistakeCount: cardState.mistakeCount + 1,
                     trickyCount: cardState.trickyCount + 1,
                     repeatedMistakes: newRepeated
                  });
                  setBatchCardStates(newStates);

                  // Re-queue card to end of batch
                  const newBatchCalls = [...batchCards];
                  newBatchCalls.push(currentCard);
                  setBatchCards(newBatchCalls);

                  // Reset Mastery if "tricky" or repeated mistakes >= 2
                  if (currentCard.mastery === 1 && newRepeated >= 2) {
                     const newCards = set.cards.map(c => c.id === currentCard.id ? { ...c, mastery: 0 } : c);
                     onUpdateSet({ ...set, cards: newCards });
                  }
               }
            }
         }
         // Don't break streak YET. Wait for continue.
         setPendingStreakBreak(true);
      }
   };

   const handleMouseUp = (
      e: React.MouseEvent,
      field: "term" | "def",
   ) => {
      // For ContentEditable, we use Window Selection
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {

         // Ensure the selection is actually inside OUR input
         activeToolbarRef.current = { field };

         // Calculate position based on selection range
         const range = selection.getRangeAt(0);
         const rect = range.getBoundingClientRect();

         setToolbarPos({
            top: rect.top - 10, // Adjusted padding
            left: rect.left + (rect.width / 2),
         });
         setToolbarAnchor('bottom');
         setToolbarVisible(true);
      } else {
         activeToolbarRef.current = null;
         setToolbarVisible(false);
      }
   };

   const handleContextMenu = (
      e: React.MouseEvent,
      field: "term" | "def",
   ) => {
      e.preventDefault();
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {
         activeToolbarRef.current = { field };
         setToolbarPos({
            top: e.clientY,
            left: e.clientX,
         });
         setToolbarAnchor('top');
         setToolbarVisible(true);
      }
   };

   // Handle Scroll (Dismiss)
   useEffect(() => {
      const handleScroll = () => {
         if (toolbarVisible) {
            activeToolbarRef.current = null;
            setToolbarVisible(false);
         }
      };
      window.addEventListener('scroll', handleScroll, true);
      return () => window.removeEventListener('scroll', handleScroll, true);
   }, [toolbarVisible]);

   const updateTermFromValue = (val: string) => {
      if (!currentCard) return;
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
   };

   const applyFormat = (type: string, value?: string) => {
      if (!activeToolbarRef.current || !currentCard) return;

      const { field } = activeToolbarRef.current;
      const ref = field === 'term' ? modalTermRef.current : modalDefRef.current;

      if (ref) {
         ref.applyFormat(type, value);
      }

      activeToolbarRef.current = null;
      setToolbarVisible(false);
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

         // Brutal Mode: In Zen mode, if card is at mastery 1 and user gets it wrong, demote to 0
         if (subMode === 'zen' && settings.brutalMode && currentCard.mastery === 1) {
            const newCards = set.cards.map(c => c.id === currentCard.id ? { ...c, mastery: 0 } : c);
            onUpdateSet({ ...set, cards: newCards });
         }
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

   const startNextBatch = () => {
      // Determine composition of next batch
      const masteredCount = set.cards.filter(c => c.mastery > 0).length;
      const totalCards = set.cards.length;
      const isHalfMastered = masteredCount >= totalCards / 2;

      let nextBatch: Card[] = [];
      const unmastered = baseCards.filter(c => c.mastery === 0);
      const inProgress = baseCards.filter(c => c.mastery === 1);

      if (isHalfMastered && inProgress.length > 0) {
         // Mixed Batch (30% Review)
         const reviewCount = Math.max(1, Math.floor(effectiveBatchSize * 0.3));
         const newCount = effectiveBatchSize - reviewCount;

         const shuffledReview = [...inProgress].sort(() => 0.5 - Math.random());
         const reviewCards = shuffledReview.slice(0, reviewCount);

         // Prioritize unmastered for new slots
         const shuffledNew = [...unmastered].sort(() => 0.5 - Math.random());
         const newCards = shuffledNew.slice(0, newCount);

         // Fill gaps if needed
         if (newCards.length < newCount) {
            const moreReview = shuffledReview.slice(reviewCount, reviewCount + (newCount - newCards.length));
            nextBatch = [...newCards, ...reviewCards, ...moreReview];
         } else if (reviewCards.length < reviewCount) {
            const moreNew = shuffledNew.slice(newCount, newCount + (reviewCount - reviewCards.length));
            nextBatch = [...newCards, ...moreNew, ...reviewCards];
         } else {
            nextBatch = [...newCards, ...reviewCards];
         }
      } else {
         // Standard Batch
         if (unmastered.length > 0) {
            const shuffledNew = [...unmastered].sort(() => 0.5 - Math.random());
            nextBatch = shuffledNew.slice(0, effectiveBatchSize);
         } else if (inProgress.length > 0) {
            const shuffledReview = [...inProgress].sort(() => 0.5 - Math.random());
            nextBatch = shuffledReview.slice(0, effectiveBatchSize);
         }
      }

      if (nextBatch.length === 0) {
         onFinish();
         return;
      }

      if (settings.shuffleCards) {
         nextBatch.sort(() => 0.5 - Math.random());
      }

      setBatchCards(nextBatch);
      setBatchIndex(0);
      setSeenCardIds(prev => {
         const next = new Set(prev);
         nextBatch.forEach(c => next.add(c.id));
         return next;
      });
      setBatchCorrectInBatch(new Set());
      setBatchPerfectInBatch(new Set());
      setBatchProgress(0);
      setShowBatchBreak(false);

      setCurrentId(nextBatch[0].id);

      // Init states for new batch
      const newStates = new Map(batchCardStates);
      nextBatch.forEach(card => {
         if (!newStates.has(card.id)) {
            newStates.set(card.id, {
               cardId: card.id,
               trickyCount: 0,
               repeatedMistakes: 0,
               firstTry: true,
               mistakeCount: 0,
               mixupCount: 0
            });
         } else {
            const s = newStates.get(card.id)!;
            newStates.set(card.id, {
               ...s,
               firstTry: true,
               trickyCount: 0
            });
         }
      });
      setBatchCardStates(newStates);
   };

   const isInteractive = feedback.type === 'idle' || feedback.type === 'retype_needed';

   // BREAK SCREEN
   if (showBatchBreak && subMode === 'batch') {
      // Calculation for motivation
      // Calculate accuracy for this batch (unique cards perfect / total unique cards)
      // actually batchPerfectInBatch has the IDs of cards perfect in this batch
      const perfectCount = batchPerfectInBatch.size;
      const accuracy = perfectCount / effectiveBatchSize;

      let message = BATCH_MESSAGES_GOOD[Math.floor(Math.random() * BATCH_MESSAGES_GOOD.length)];
      if (accuracy === 1) message = BATCH_MESSAGES_PERFECT[Math.floor(Math.random() * BATCH_MESSAGES_PERFECT.length)];
      else if (accuracy < 0.5) message = BATCH_MESSAGES_NEEDS_WORK[Math.floor(Math.random() * BATCH_MESSAGES_NEEDS_WORK.length)];

      // List of cards in this batch (unique)
      // We want to show "All cards introduced so far" or just "Current Batch"?
      // Requirement: "Lists all cards introduced so far with "pill tags" indicating their status"
      const visibleCards = set.cards.filter(c => seenCardIds.has(c.id));

      return (
         <div className="w-full max-w-4xl mx-auto pb-20 pt-8 animate-in fade-in">
            <div className="text-center mb-10">
               <div className="inline-block px-4 py-1.5 rounded-full bg-accent/10 text-accent font-bold text-sm tracking-wider uppercase mb-4">
                  Batch Complete
               </div>
               <h2
                  className="text-4xl text-text mb-4"
                  style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}
               >
                  {message}
               </h2>
               <p className="text-muted">Take a breath. Here is how you are doing.</p>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
               <div className="bg-panel border border-outline rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-text mb-1">{perfectCount}/{effectiveBatchSize}</div>
                  <div className="text-xs font-bold text-muted uppercase tracking-wider">Perfect This Batch</div>
               </div>
               <div className="bg-panel border border-outline rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-text mb-1">{baseCards.filter(c => c.mastery === 2).length}</div>
                  <div className="text-xs font-bold text-muted uppercase tracking-wider">Mastered Total</div>
               </div>
               <div className="bg-panel border border-outline rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-text mb-1">{streak}</div>
                  <div className="text-xs font-bold text-muted uppercase tracking-wider">Current Streak</div>
               </div>
               <div className="bg-panel border border-outline rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-text mb-1">{baseCards.length - baseCards.filter(c => c.mastery === 2).length}</div>
                  <div className="text-xs font-bold text-muted uppercase tracking-wider">Remaining</div>
               </div>
            </div>

            {/* Card List */}
            <div className="bg-panel border border-outline rounded-2xl overflow-hidden mb-10">
               <div className="p-4 border-b border-outline bg-panel-2/50 flex justify-between items-center">
                  <h3 className="font-bold text-text">Session Progress</h3>
                  <span className="text-xs font-bold text-muted uppercase tracking-wider">{visibleCards.length} Cards Seen</span>
               </div>
               <div className="max-h-[400px] overflow-y-auto p-2 space-y-2">
                  {visibleCards.map(card => {
                     const state = batchCardStates.get(card.id);
                     const isPerfect = card.mastery === 2 && state?.mistakeCount === 0;
                     const isFocus = (state?.mistakeCount || 0) >= 3;
                     const isConfusing = (state?.mixupCount || 0) >= 2;

                     return (
                        <div key={card.id} className="flex items-center gap-4 p-3 rounded-xl hover:bg-panel-2 transition-colors border border-transparent hover:border-outline/50">
                           <div className="flex-1 min-w-0">
                              <div className="font-bold text-text truncate">{card.term.join(' / ')}</div>
                              <div className="text-xs text-muted truncate">{card.content}</div>
                           </div>

                           {/* Status Pills */}
                           <div className="flex gap-2 shrink-0">
                              {isPerfect && (
                                 <div className="px-2 py-1 rounded-lg bg-blue-500/10 text-blue-500 border border-blue-500/20 flex items-center gap-1.5" title="First Try: Mastered and never wrong">
                                    <Star size={12} fill="currentColor" />
                                    <span className="text-[10px] font-bold uppercase">First Try</span>
                                 </div>
                              )}
                              {isFocus && (
                                 <div className="px-2 py-1 rounded-lg bg-red/10 text-red border border-red/20 flex items-center gap-1.5" title="Focus: Got wrong 3+ times">
                                    <CloudLightning size={12} />
                                    <span className="text-[10px] font-bold uppercase">Focus</span>
                                 </div>
                              )}
                              {isConfusing && (
                                 <div className="px-2 py-1 rounded-lg bg-green/10 text-green border border-green/20 flex items-center gap-1.5" title="Confusing: Mixed up frequently">
                                    <Wind size={12} />
                                    <span className="text-[10px] font-bold uppercase">Confusing</span>
                                 </div>
                              )}

                              {/* Mastery Dots (Small) */}
                              <div className="flex gap-0.5 items-center px-2">
                                 <div className={clsx("w-1.5 h-1.5 rounded-full", card.mastery >= 1 ? "bg-green" : "bg-outline/50")} />
                                 <div className={clsx("w-1.5 h-1.5 rounded-full", card.mastery >= 2 ? "bg-green" : "bg-outline/50")} />
                              </div>
                           </div>
                        </div>
                     );
                  })}
               </div>
            </div>

            <div className="flex justify-center">
               <button
                  autoFocus
                  onClick={startNextBatch}
                  className="px-12 py-4 bg-text text-bg rounded-xl font-extrabold text-lg shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
               >
                  Continue to Next Batch
                  <ChevronLeft size={20} className="rotate-180" />
               </button>
            </div>
         </div>
      );
   }

   // Mode Selection Screen
   if (!subMode) {
      const isBatchDisabled = baseCards.length < 10;

      return (
         <div className="w-full max-w-4xl mx-auto pb-20 pt-0 animate-in fade-in">
            {/* Back Button */}
            <button
               onClick={onExit}
               className="mb-8 flex items-center gap-3 text-muted hover:text-text transition-colors font-bold uppercase text-xs tracking-wider group"
            >
               <div className="p-2 rounded-full border border-outline group-hover:bg-panel group-hover:border-accent transition-colors">
                  <ChevronLeft size={16} />
               </div>
               Back
            </button>

            <div className="text-center mb-12">
               <h1
                  className="text-4xl text-text mb-3"
                  style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}
               >
                  Learn Mode
               </h1>
               <p className="text-muted text-lg">Choose how you want to study</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
               {/* Zen Mode */}
               <button
                  onClick={() => { setSubMode('zen'); onStartGame(); }}
                  className="group relative bg-panel border-2 border-outline hover:border-accent rounded-2xl p-8 transition-all hover:scale-[1.02] hover:shadow-xl hover:shadow-accent/10 text-left"
               >
                  <div className="absolute top-4 right-4 p-2 rounded-lg bg-panel-2 text-muted group-hover:text-accent transition-colors">
                     <Zap size={24} />
                  </div>
                  <div>
                     <h3 className="text-2xl font-bold text-text mb-2">Zen</h3>
                     <p className="text-muted text-sm leading-relaxed">
                        Run through your cards quickly to refresh your memory. Presents cards in one heap with no interruptions or breaks. Best for short decks and quick prep.
                     </p>
                  </div>
                  <div className="mt-6 flex gap-2">
                     <span className="px-2 py-1 bg-panel-2 rounded text-xs font-mono text-muted">ENTER</span>
                     <span className="px-2 py-1 bg-panel-2 rounded text-xs font-mono text-muted">O</span>
                  </div>
               </button>

               {/* Batch Mode */}
               <button
                  onClick={() => { if (!isBatchDisabled) { setSubMode('batch'); onStartGame(); } }}
                  disabled={isBatchDisabled}
                  className={clsx(
                     "group relative bg-panel border-2 rounded-2xl p-8 transition-all text-left",
                     isBatchDisabled
                        ? "border-outline/50 opacity-60 cursor-not-allowed"
                        : "border-outline hover:border-accent hover:scale-[1.02] hover:shadow-xl hover:shadow-accent/10"
                  )}
               >
                  {isBatchDisabled && (
                     <div className="absolute top-4 left-4 p-1.5 rounded-lg bg-panel-2 text-muted">
                        <Lock size={14} />
                     </div>
                  )}
                  <div className={clsx(
                     "absolute top-4 right-4 p-2 rounded-lg bg-panel-2 transition-colors",
                     isBatchDisabled ? "text-muted/50" : "text-muted group-hover:text-accent"
                  )}>
                     <Layers size={24} />
                  </div>
                  <div>
                     <h3 className={clsx(
                        "text-2xl font-bold mb-2",
                        isBatchDisabled ? "text-text/50" : "text-text"
                     )}>Batch</h3>
                     <p className={clsx(
                        "text-sm leading-relaxed",
                        isBatchDisabled ? "text-muted/50" : "text-muted"
                     )}>
                        Run through your cards slower to build mastery. Chops your deck up into smaller pieces to focus on. Better for longer decks and deeper memorization.
                     </p>
                  </div>
                  <div className="mt-6 flex gap-2">
                     {isBatchDisabled ? (
                        <span className="px-2 py-1 bg-red/10 rounded text-xs font-bold text-red/70">
                           Requires 10+ cards
                        </span>
                     ) : (
                        <>
                           <span className="px-2 py-1 bg-accent/10 rounded text-xs font-mono text-accent">
                              Batch Size: {effectiveBatchSize}
                           </span>
                        </>
                     )}
                  </div>
               </button>
            </div>

            {/* Card count info */}
            <div className="text-center mt-8 text-muted text-sm">
               {settings.starredOnly ? (
                  <span>Studying {baseCards.length} starred cards</span>
               ) : (
                  <span>{baseCards.length} cards in this set</span>
               )}
            </div>
         </div>
      );
   }

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

            {/* Mastery Stats (Only show in Zen Mode) */}
            {subMode === 'zen' && (
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
            )}
         </div>

         {/* Batch Progress Bar */}
         {subMode === 'batch' && (
            <div className="w-full h-1.5 bg-panel-2 rounded-full mb-6 overflow-hidden">
               <div
                  className="h-full bg-accent transition-all duration-500 ease-out"
                  style={{ width: `${(batchProgress / effectiveBatchSize) * 100}%` }}
               />
            </div>
         )}


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

                           {sanitizeImageUrl(currentCard.image) && (
                              <div className="flex-shrink-0 mx-auto md:mx-0">
                                 <img
                                    src={sanitizeImageUrl(currentCard.image)}
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
               {(settings.mode === 'multiple_choice' || settings.mode === 'ai_random_choice') ? (
                  <div className="space-y-4">
                     {/* AI Loading/Error indicators */}
                     {settings.mode === 'ai_random_choice' && isLoadingAiOptions && (
                        <div className="flex items-center justify-center gap-2 p-4 bg-purple/10 border border-purple/20 rounded-xl">
                           <Loader2 className="animate-spin text-purple" size={20} />
                           <span className="text-purple font-medium">AI is generating options...</span>
                        </div>
                     )}

                     {settings.mode === 'ai_random_choice' && aiOptionsError && (
                        <div className="p-3 bg-yellow/10 border border-yellow/30 rounded-xl">
                           <p className="text-yellow text-sm">
                              AI generation issue: {aiOptionsError}. Using fallback options.
                           </p>
                        </div>
                     )}

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
                                 disabled={!isInteractive || isLoadingAiOptions}
                                 className={clsx(
                                    "p-6 rounded-xl text-lg font-bold text-left transition-all border-2",
                                    stateClass,
                                    (isInteractive && !isLoadingAiOptions) && "hover:scale-[1.02] active:scale-[0.98]",
                                    isLoadingAiOptions && "opacity-50 cursor-wait"
                                 )}
                              >
                                 {opt}
                              </button>
                           );
                        })}
                     </div>
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
                                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1 bg-[#7f1d1d] text-white text-xs font-bold rounded shadow-lg whitespace-nowrap z-20 animate-in fade-in slide-in-from-bottom-1 after:content-[''] after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-[#7f1d1d]">
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
               <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in">
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
                              <RichInput
                                 ref={modalTermRef}
                                 value={(currentCard.tags && currentCard.tags.length > 0 ? currentCard.tags.map(t => `(${t})`).join(' ') + ' ' : '') + currentCard.term.join(' / ')}
                                 onChange={(val) => updateTermFromValue(val)}
                                 onBlur={() => setToolbarVisible(false)}
                                 onMouseUp={(e) => handleMouseUp(e, 'term')}
                                 onContextMenu={(e) => handleContextMenu(e, 'term')}
                                 onKeyDown={(e) => e.stopPropagation()}
                                 className="w-full bg-panel-2 border border-outline rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none transition-colors"
                                 placeholder="Enter term..."
                                 maxLength={1000}
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
                              <RichInput
                                 ref={modalDefRef}
                                 value={currentCard.content}
                                 onChange={(val) => handleUpdateCard(currentCard.id, { content: val })}
                                 onBlur={() => setToolbarVisible(false)}
                                 onMouseUp={(e) => handleMouseUp(e, 'def')}
                                 onContextMenu={(e) => handleContextMenu(e, 'def')}
                                 onKeyDown={(e) => e.stopPropagation()}
                                 className="w-full bg-panel-2 border border-outline rounded-xl px-4 py-3 text-text focus:border-accent focus:outline-none transition-colors"
                                 placeholder="Enter definition..."
                                 maxLength={1000}
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
                  <FloatingToolbar visible={toolbarVisible} position={toolbarPos} anchor={toolbarAnchor} onFormat={applyFormat} />
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