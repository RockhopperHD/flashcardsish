
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Trash2, Upload, Plus, Copy, AlertCircle, ArrowLeft, Bold, Italic, Underline, List, WrapText } from 'lucide-react';
import { CardSet, Card, Settings } from '../types';
import { parseInput, generateId } from '../utils';
import clsx from 'clsx';

interface StartMenuProps {
  savedSets: CardSet[];
  onStartSet: (set: CardSet) => void;
  onDeleteSet: (id: string) => void;
  settings: Settings;
  onUpdateSettings: (s: Settings) => void;
}

interface BuilderRow {
  id: string;
  term: string;
  def: string;
  year: string;
}

const BUILDER_STORAGE_KEY = 'flashcard-builder-rows';

const GREETINGS = [
  "What are we learning next?",
  "Who's excited to study?!",
  "You got this!",
  "Step 1 is studying.",
  "Lock in.",
  "One more set?",
  "What's up?",
  "All you."
];

// Tooltip Component
const RichTooltip: React.FC<{ children: React.ReactNode; content: React.ReactNode; align?: 'center' | 'right' }> = ({ children, content, align = 'center' }) => {
  return (
    <div className="relative group inline-block">
      {children}
      <div className={clsx(
        "absolute bottom-full mb-2 px-3 py-2 bg-panel-2 border border-outline rounded-lg text-xs text-text w-max max-w-[220px] shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50",
        align === 'center' && "left-1/2 -translate-x-1/2",
        align === 'right' && "right-0 translate-x-0"
      )}>
         {content}
         {/* Arrow */}
         <div className={clsx(
            "absolute top-full border-4 border-transparent border-t-outline",
            align === 'center' && "left-1/2 -translate-x-1/2",
            align === 'right' && "right-3"
         )}></div>
      </div>
    </div>
  );
};

export const StartMenu: React.FC<StartMenuProps> = ({ 
  savedSets, 
  onStartSet, 
  onDeleteSet,
  settings,
  onUpdateSettings
}) => {
  const [mode, setMode] = useState<'paste' | 'builder'>('paste');
  const [pasteValue, setPasteValue] = useState('');
  const [builderRows, setBuilderRows] = useState<BuilderRow[]>(() => {
    const saved = localStorage.getItem(BUILDER_STORAGE_KEY);
    try {
        return saved ? JSON.parse(saved) : [
            { id: '1', term: '', def: '', year: '' },
            { id: '2', term: '', def: '', year: '' },
            { id: '3', term: '', def: '', year: '' }
        ];
    } catch {
        return [
            { id: '1', term: '', def: '', year: '' },
            { id: '2', term: '', def: '', year: '' },
            { id: '3', term: '', def: '', year: '' }
        ];
    }
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  const greeting = useMemo(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)], []);

  // Persist builder rows
  useEffect(() => {
     localStorage.setItem(BUILDER_STORAGE_KEY, JSON.stringify(builderRows));
  }, [builderRows]);

  // --- PASTE MODE HANDLERS ---

  const handleStartPaste = () => {
    const cards = parseInput(pasteValue);
    if (cards.length > 0) {
      startNewSession('New Session', cards);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const text = await e.target.files[0].text();
      const cards = parseInput(text);
      let name = e.target.files[0].name.replace('.json', '');
      try {
         const json = JSON.parse(text);
         if (json.name) name = json.name;
      } catch {}

      if (cards.length > 0) {
         startNewSession(name, cards);
      }
    }
  };

  // --- BUILDER MODE HANDLERS ---

  const duplicateIds = useMemo(() => {
     const counts = new Map<string, number>();
     const ids = new Set<string>();
     builderRows.forEach(r => {
         const t = r.term.trim().toLowerCase();
         if (!t) return;
         counts.set(t, (counts.get(t) || 0) + 1);
     });
     builderRows.forEach(r => {
         const t = r.term.trim().toLowerCase();
         if (t && (counts.get(t) || 0) > 1) {
             ids.add(r.id);
         }
     });
     return ids;
  }, [builderRows]);

  const addRow = () => {
     setBuilderRows([...builderRows, { id: generateId(), term: '', def: '', year: '' }]);
  };

  const updateRow = (id: string, field: keyof BuilderRow, value: string) => {
     setBuilderRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const removeRow = (id: string) => {
     setBuilderRows(prev => prev.filter(r => r.id !== id));
  };

  const handleBuilderCopy = () => {
     const text = builderRows
         .filter(r => r.term.trim() || r.def.trim())
         .map(r => {
             let line = `${r.term.trim()} / ${r.def.trim()}`;
             if (r.year.trim()) line += ` /// ${r.year.trim()}`;
             return line;
         })
         .join('\n');
     navigator.clipboard.writeText(text);
     alert("Copied to clipboard!");
  };

  const handleBuilderStart = () => {
      const cards: Partial<Card>[] = builderRows
        .filter(r => r.term.trim() || r.def.trim())
        .map(r => ({
            term: [r.term.trim()],
            content: r.def.trim(),
            year: r.year.trim() || undefined,
            star: false,
            mastery: 0
        }));
      
      if (cards.length > 0) {
          startNewSession('Custom List', cards);
      }
  };

  // --- COMMON ---

  const startNewSession = (name: string, partialCards: Partial<Card>[]) => {
     const fullCards: Card[] = partialCards.map((c, i) => ({
        id: generateId() + i,
        term: c.term || ['?'],
        content: c.content || '',
        year: c.year,
        mastery: 0,
        star: c.star || false
     }));

     const newSet: CardSet = {
        id: generateId(),
        name,
        cards: fullCards,
        lastPlayed: Date.now(),
        elapsedTime: 0,
        topStreak: 0
     };
     onStartSet(newSet);
  };

  return (
    <div className="max-w-4xl mx-auto w-full pb-20 pt-8 animate-in fade-in duration-700">
      
      {/* Header */}
      <div className={clsx("mb-10", mode === 'builder' ? "text-center" : "text-left")}>
         {mode === 'paste' && (
             <div className="text-accent font-mono text-sm mb-1 tracking-widest uppercase opacity-80">{currentDate}</div>
         )}
         <h1 className="text-4xl font-bold text-text tracking-tight mb-2">
            {mode === 'paste' ? greeting : 'List Builder'}
         </h1>
         <p className="text-muted text-lg">
            {mode === 'paste' ? 'Paste your notes or pick up where you left off.' : 'Craft your deck manually.'}
         </p>
      </div>

      {mode === 'builder' && (
         <button 
           onClick={() => setMode('paste')}
           className="mb-6 flex items-center gap-3 text-muted hover:text-text transition-colors font-bold uppercase text-xs tracking-wider group"
         >
            <div className="p-2 rounded-full border border-outline group-hover:bg-panel group-hover:border-accent transition-colors">
               <ArrowLeft size={16} /> 
            </div>
            Back to Menu
         </button>
      )}

      <div className="space-y-8">
        
        {/* PASTE MODE UI */}
        {mode === 'paste' && (
            <>
                <div className="bg-panel border border-outline rounded-2xl p-1 overflow-hidden shadow-lg">
                   <textarea
                     value={pasteValue}
                     onChange={(e) => setPasteValue(e.target.value)}
                     placeholder={`Paste term / definition /// year here...\n\nPhotosynthesis / Process used by plants /// \nApollo 11 / Moon Landing /// 1969`}
                     className="w-full bg-panel-2 text-text border-none outline-none p-6 min-h-[160px] resize-y rounded-xl placeholder:text-muted/30 font-mono text-sm"
                   />
                   
                   {/* Action Bar */}
                   <div className="bg-panel px-6 py-4 flex items-center justify-end gap-3">
                         <button 
                           onClick={() => fileInputRef.current?.click()}
                           className="p-2 text-muted hover:text-accent transition-colors"
                           title="Upload JSON"
                         >
                            <Upload size={20} />
                         </button>
                         <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleFileUpload} />

                         <button 
                           onClick={handleStartPaste}
                           disabled={!pasteValue.trim()}
                           className="bg-text text-bg px-6 py-2.5 rounded-xl font-bold hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100"
                         >
                           Start Session
                         </button>
                   </div>
                </div>

                <div className="flex items-center gap-4 px-4 opacity-50">
                   <div className="h-px bg-outline flex-1" />
                   <span className="text-xs font-bold tracking-widest text-muted">OR</span>
                   <div className="h-px bg-outline flex-1" />
                </div>

                <div className="flex justify-center">
                    <button 
                       onClick={() => setMode('builder')}
                       className="bg-panel-2 border border-outline text-text px-8 py-3 rounded-xl font-bold hover:border-accent hover:scale-105 active:scale-95 transition-all shadow-sm"
                    >
                       Open List Builder
                    </button>
                </div>
            </>
        )}

        {/* BUILDER MODE UI */}
        {mode === 'builder' && (
            <div className="bg-panel border border-outline rounded-2xl p-6 shadow-lg animate-in zoom-in-95 duration-300">
                {/* Header with Card Count and Formatting Tools */}
                <div className="flex justify-between items-start mb-6">
                    <div className="flex gap-2 text-sm text-muted items-center h-8">
                       <span className="font-bold text-text">{builderRows.length}</span> cards
                       {duplicateIds.size > 0 && <span className="text-red flex items-center gap-1 ml-2"><AlertCircle size={12}/> {duplicateIds.size} duplicates</span>}
                    </div>

                    {/* Single Tooltip Bar */}
                    <div className="flex items-center justify-end gap-2 px-1">
                        <RichTooltip content={<span>To <span className="font-bold">bold</span> text, wrap with <span className="font-mono bg-bg px-1 rounded text-[10px]">&lt;b&gt;text&lt;/b&gt;</span></span>}>
                        <div className="w-8 h-8 rounded-full bg-panel-2 border border-outline flex items-center justify-center text-muted hover:text-text hover:border-accent cursor-help transition-all">
                            <Bold size={12} />
                        </div>
                        </RichTooltip>

                        <RichTooltip content={<span>To <span className="italic">italicize</span> text, wrap with <span className="font-mono bg-bg px-1 rounded text-[10px]">&lt;i&gt;text&lt;/i&gt;</span></span>}>
                        <div className="w-8 h-8 rounded-full bg-panel-2 border border-outline flex items-center justify-center text-muted hover:text-text hover:border-accent cursor-help transition-all">
                            <Italic size={12} />
                        </div>
                        </RichTooltip>

                        <RichTooltip content={<span>To <span className="underline">underline</span> text, wrap with <span className="font-mono bg-bg px-1 rounded text-[10px]">__text__</span></span>}>
                        <div className="w-8 h-8 rounded-full bg-panel-2 border border-outline flex items-center justify-center text-muted hover:text-text hover:border-accent cursor-help transition-all">
                            <Underline size={12} />
                        </div>
                        </RichTooltip>

                        <div className="w-px h-4 bg-outline/50 mx-1"></div>

                        <RichTooltip content={<span>To create a bulleted list, use <span className="font-mono bg-bg px-1 rounded text-[10px]">* Item 1 * Item 2</span></span>}>
                        <div className="w-8 h-8 rounded-full bg-panel-2 border border-outline flex items-center justify-center text-muted hover:text-text hover:border-accent cursor-help transition-all">
                            <List size={12} />
                        </div>
                        </RichTooltip>

                        <RichTooltip align="right" content={<span>To add a paragraph break (exit list), use <span className="font-mono bg-bg px-1 rounded text-[10px]">&lt;p&gt;</span></span>}>
                        <div className="w-8 h-8 rounded-full bg-panel-2 border border-outline flex items-center justify-center text-muted hover:text-text hover:border-accent cursor-help transition-all">
                            <WrapText size={12} />
                        </div>
                        </RichTooltip>
                    </div>
                </div>

                <div className="space-y-3 mb-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                   {builderRows.map((row, index) => (
                      <div key={row.id} className="flex gap-3 items-center group w-full">
                          <div className="text-xs text-muted font-mono w-6 text-right shrink-0">{index + 1}</div>
                          
                          <div className="flex-1 flex gap-2 items-center min-w-0">
                                  {/* Term - Left */}
                                  <div className="flex-[0.6] relative shrink-0">
                                      <input 
                                        value={row.term}
                                        onChange={(e) => updateRow(row.id, 'term', e.target.value)}
                                        placeholder="Term"
                                        className={clsx(
                                            "w-full bg-panel-2 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent transition-all h-[42px]",
                                            duplicateIds.has(row.id) ? "border-red" : "border-outline"
                                        )}
                                      />
                                      {duplicateIds.has(row.id) && <div className="absolute right-2 top-2 text-red"><AlertCircle size={14} /></div>}
                                  </div>

                                  {/* Year - Middle */}
                                  <input 
                                    value={row.year}
                                    onChange={(e) => updateRow(row.id, 'year', e.target.value)}
                                    placeholder="Year"
                                    className="w-20 bg-panel-2 border border-outline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors text-left placeholder:text-muted/50 h-[42px] shrink-0"
                                  />

                                  {/* Definition - Right */}
                                  <div className="flex-1 bg-panel-2 border border-outline rounded-lg focus-within:border-accent transition-colors min-w-0">
                                     <textarea 
                                        value={row.def}
                                        onChange={(e) => updateRow(row.id, 'def', e.target.value)}
                                        placeholder="Definition"
                                        rows={1}
                                        className="w-full bg-transparent border-none focus:outline-none px-3 py-[11px] text-sm resize-none min-h-[42px] overflow-hidden block"
                                        style={{ minHeight: '42px' }}
                                        onInput={(e) => {
                                            const target = e.target as HTMLTextAreaElement;
                                            target.style.height = 'auto';
                                            target.style.height = (target.scrollHeight) + 'px';
                                        }}
                                     />
                                  </div>
                          </div>
                          
                          <button 
                            onClick={() => removeRow(row.id)}
                            className="p-2 text-muted hover:text-red opacity-0 group-hover:opacity-100 transition-all shrink-0"
                            tabIndex={-1}
                          >
                             <Trash2 size={16} />
                          </button>
                      </div>
                   ))}
                   
                   <button 
                     onClick={addRow}
                     className="w-full py-3 border border-dashed border-outline rounded-xl text-muted hover:text-accent hover:border-accent hover:bg-panel-2 transition-all flex items-center justify-center gap-2 text-sm font-bold mt-4"
                   >
                      <Plus size={16} /> Add Card
                   </button>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-outline">
                    <button 
                      onClick={handleBuilderCopy}
                      className="flex items-center gap-2 px-4 py-2 text-muted hover:text-text font-medium transition-colors rounded-lg hover:bg-panel-2"
                    >
                        <Copy size={18} />
                        <span>Copy Code</span>
                    </button>

                    <button 
                      onClick={handleBuilderStart}
                      disabled={builderRows.every(r => !r.term && !r.def)}
                      className="bg-accent text-bg px-8 py-3 rounded-xl font-bold hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-lg"
                    >
                      Begin Studying
                    </button>
                </div>
            </div>
        )}

        {/* Ongoing Sessions (Only visible in Paste Mode) */}
        {mode === 'paste' && (
            <div className="space-y-4 pt-4">
               <h3 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-2 pl-2">
                  Ongoing Sessions
               </h3>
               
               {savedSets.length === 0 ? (
                 <div className="text-center py-8 text-muted/50 italic">
                    No active sessions found.
                 </div>
               ) : (
                 <div className="grid grid-cols-1 gap-3">
                   {savedSets.map((set) => {
                      const progress = Math.round((set.cards.filter(c => c.mastery === 2).length / set.cards.length) * 100);
                      return (
                       <div key={set.id} className="group flex items-center justify-between bg-panel-2 border border-outline p-4 rounded-2xl hover:border-accent/50 transition-all">
                         <div className="flex-1 cursor-pointer flex items-center gap-4" onClick={() => onStartSet(set)}>
                           <div className="w-10 h-10 rounded-full bg-panel border border-outline flex items-center justify-center text-accent font-bold text-sm">
                              {progress}%
                           </div>
                           <div>
                              <div className="font-bold text-text group-hover:text-accent transition-colors">{set.name}</div>
                              <div className="text-xs text-muted font-mono">
                                 {set.cards.length} cards
                              </div>
                           </div>
                         </div>
                         <button 
                           onClick={(e) => { e.stopPropagation(); onDeleteSet(set.id); }}
                           className="p-2 text-muted hover:text-red rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                           title="Delete Session"
                         >
                           <Trash2 size={18} />
                         </button>
                       </div>
                      );
                   })}
                 </div>
               )}
            </div>
        )}
      </div>
    </div>
  );
};
