import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Trash2, Upload, Plus, Copy, AlertCircle, ArrowLeft, Download, FileText, LayoutList, HelpCircle, Save, FolderOpen, Play, Eye, Pencil, RotateCw, X, Image as ImageIcon, Link } from 'lucide-react';
import { CardSet, Card, Settings } from '../types';
import { parseInput, generateId, downloadFile, renderMarkdown } from '../utils';
import clsx from 'clsx';

interface StartMenuProps {
  librarySets: CardSet[];
  activeSessions: CardSet[];
  onStartFromLibrary: (set: CardSet) => void;
  onResumeSession: (set: CardSet) => void;
  onSaveToLibrary: (set: CardSet) => void;
  onDeleteLibrarySet: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onViewPreview: (data: {set: CardSet, mode: 'library' | 'session'}) => void;
  settings: Settings;
  onUpdateSettings: (s: Settings) => void;
}

interface BuilderRow {
  id: string;
  term: string;
  def: string;
  year: string;
  image: string;
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
  "All you.",
  "Greatness incoming?",
  "Hey, you're here."
];

// Unsaved Changes Modal
const UnsavedChangesModal: React.FC<{ 
    isOpen: boolean; 
    onSave: () => void; 
    onDiscard: () => void; 
    onCancel: () => void; 
}> = ({ isOpen, onSave, onDiscard, onCancel }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={onCancel}>
            <div className="bg-panel border border-outline rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-text mb-2">Unsaved Changes</h3>
                <p className="text-muted mb-6">You have unsaved work in the builder. What would you like to do?</p>
                <div className="flex flex-col gap-3">
                    <button onClick={onSave} className="w-full py-3 bg-accent text-bg rounded-xl font-bold hover:scale-105 transition-transform">
                        Save to Library
                    </button>
                    <button onClick={onDiscard} className="w-full py-3 bg-panel-2 border border-outline text-red rounded-xl font-bold hover:bg-red/10 transition-colors">
                        Leave without Saving
                    </button>
                    <button onClick={onCancel} className="w-full py-3 text-muted hover:text-text font-medium">
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

// Image Modal
const ImageModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    onSave: (url: string) => void; 
    initialValue: string;
}> = ({ isOpen, onClose, onSave, initialValue }) => {
    const [urlInput, setUrlInput] = useState(initialValue);
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setUrlInput(initialValue);
        }
    }, [isOpen, initialValue]);

    const handleFile = (file: File) => {
        if (!file.type.startsWith('image/')) return;
        
        const reader = new FileReader();
        reader.onloadend = () => {
            if (typeof reader.result === 'string') {
                onSave(reader.result);
                onClose();
            }
        };
        reader.readAsDataURL(file);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
             <div className="bg-panel border border-outline rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-text">Add Image</h3>
                    <button onClick={onClose}><X size={24} className="text-muted hover:text-text" /></button>
                </div>

                {/* Upload Section */}
                <div 
                    className={clsx(
                        "border-2 border-dashed rounded-xl h-36 flex flex-col items-center justify-center cursor-pointer transition-colors",
                        dragActive ? "border-accent bg-accent/10" : "border-outline hover:border-accent hover:bg-panel-2"
                    )}
                    onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                >
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={(e) => e.target.files && handleFile(e.target.files[0])} />
                    <Upload size={32} className="text-muted mb-2" />
                    <p className="text-sm text-muted font-medium">Drag & drop or click to upload</p>
                </div>

                <div className="flex items-center gap-4 my-5">
                    <div className="h-px bg-outline flex-1"></div>
                    <span className="text-muted text-xs font-bold uppercase tracking-wider opacity-60">OR</span>
                    <div className="h-px bg-outline flex-1"></div>
                </div>

                {/* Link Section */}
                <div className="flex gap-2">
                     <input 
                        value={urlInput}
                        onChange={(e) => setUrlInput(e.target.value)}
                        placeholder="Paste image link..."
                        className="flex-1 bg-panel-2 border border-outline rounded-xl px-4 py-3 focus:outline-none focus:border-accent transition-colors text-sm"
                     />
                     <button 
                        onClick={() => { onSave(urlInput); onClose(); }}
                        className="px-5 py-3 bg-panel-2 border border-outline hover:bg-accent hover:text-bg rounded-xl font-bold transition-all text-sm whitespace-nowrap"
                     >
                         Save
                     </button>
                </div>
             </div>
        </div>
    );
};

// Markdown Help Modal
const MarkdownHelpModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
   if (!isOpen) return null;
   return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
         <div className="bg-panel border border-outline rounded-2xl p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
               <h3 className="font-bold text-2xl text-text">Formatting Guide</h3>
               <button onClick={onClose}><X size={24} className="text-muted hover:text-text" /></button>
            </div>
            <div className="space-y-4 text-base">
               <div className="flex justify-between pb-2">
                  <span className="text-muted">Italics</span>
                  <span className="font-mono text-yellow">*italic*</span>
               </div>
               <div className="flex justify-between pb-2">
                  <span className="text-muted">Bold</span>
                  <span className="font-mono text-yellow">**bold**</span>
               </div>
               <div className="flex justify-between pb-2">
                  <span className="text-muted">Bold & Italic</span>
                  <span className="font-mono text-yellow">***text***</span>
               </div>
               <div className="flex justify-between pb-2">
                  <span className="text-muted">Underline</span>
                  <span className="font-mono text-yellow">__text__</span>
               </div>
               <div className="flex justify-between pb-2">
                  <span className="text-muted">Code</span>
                  <span className="font-mono text-yellow">`code`</span>
               </div>
               <div className="grid grid-cols-2 gap-2 pb-2">
                  <span className="text-muted">Bulleted List</span>
                  <span className="font-mono text-yellow text-right">- Item 1<br/>- Item 2</span>
               </div>
               <div className="grid grid-cols-2 gap-2">
                  <span className="text-muted">Exit List / New Para</span>
                  <span className="font-mono text-yellow text-right">&lt;p&gt;</span>
               </div>
            </div>
         </div>
      </div>
   );
};

// Builder Row Component
const BuilderRowItem: React.FC<{
    row: BuilderRow;
    index: number;
    showYear: boolean;
    isDuplicate: boolean;
    isLast: boolean;
    updateRow: (id: string, field: keyof BuilderRow, value: string) => void;
    removeRow: (id: string) => void;
    onAddNext: () => void;
    onOpenImageModal: () => void;
}> = ({ row, index, showYear, isDuplicate, isLast, updateRow, removeRow, onAddNext, onOpenImageModal }) => {
    const [isEditingDef, setIsEditingDef] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-focus textarea when entering edit mode
    useEffect(() => {
        if (isEditingDef && textareaRef.current) {
            textareaRef.current.focus();
            // Reset height
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = (textareaRef.current.scrollHeight) + 'px';
        }
    }, [isEditingDef]);

    // Handle Definition Keydown (Bullets & Tab)
    const handleDefKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter') {
            const val = textareaRef.current?.value || '';
            const selectionStart = textareaRef.current?.selectionStart || 0;
            const lastNewLine = val.lastIndexOf('\n', selectionStart - 1);
            const currentLine = val.substring(lastNewLine + 1, selectionStart);

            if (currentLine.trim().startsWith('-')) {
                e.preventDefault();
                // Insert newline and dash
                const insertion = '\n- ';
                const newVal = val.substring(0, selectionStart) + insertion + val.substring(textareaRef.current?.selectionEnd || selectionStart);
                updateRow(row.id, 'def', newVal);
                
                // Move cursor
                requestAnimationFrame(() => {
                    if (textareaRef.current) {
                        textareaRef.current.selectionStart = selectionStart + insertion.length;
                        textareaRef.current.selectionEnd = selectionStart + insertion.length;
                        textareaRef.current.style.height = 'auto';
                        textareaRef.current.style.height = (textareaRef.current.scrollHeight) + 'px';
                    }
                });
            }
        }

        if (e.key === 'Tab' && !e.shiftKey) {
            // Def is the last field now.
            if (isLast) {
                e.preventDefault();
                onAddNext();
            }
        }
    };

    return (
        <div className={clsx(
            "group relative w-full animate-in fade-in slide-in-from-left-2 duration-300",
            "p-3 mb-3 bg-panel-2/10 border border-outline rounded-xl"
        )}>
            <div className="flex flex-col md:flex-row gap-3">
                
                {/* Left Column: Term & Toolbar */}
                <div className="w-full md:w-[35%] flex flex-col gap-2">
                    <div className="relative">
                        <input 
                            id={`term-${row.id}`}
                            value={row.term}
                            onChange={(e) => updateRow(row.id, 'term', e.target.value)}
                            placeholder="Term"
                            className={clsx(
                                "w-full bg-panel-2 border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:border-accent transition-all min-h-[42px]",
                                isDuplicate ? "border-red" : "border-outline"
                            )}
                        />
                        {isDuplicate && <div className="absolute right-2 top-3 text-red"><AlertCircle size={14} /></div>}
                    </div>

                    {/* Toolbar Row: Image | Delete | Year */}
                    <div className="flex items-center gap-2">
                        {/* Image Button */}
                        <button
                            onClick={onOpenImageModal}
                            tabIndex={-1}
                            className={clsx(
                                "rounded-lg hover:bg-panel-2 transition-all shrink-0 flex items-center justify-center overflow-hidden border border-transparent",
                                row.image ? "w-[42px] h-[42px] p-0 border-outline bg-panel-2" : "p-2.5 text-muted hover:text-text"
                            )}
                            title={row.image ? "Change Image" : "Add Image"}
                        >
                            {row.image ? (
                                <img src={row.image} alt="preview" className="w-full h-full object-cover" />
                            ) : (
                                <ImageIcon size={16} />
                            )}
                        </button>

                        {/* Delete Button */}
                        <button 
                            onClick={() => removeRow(row.id)}
                            tabIndex={-1}
                            className="p-2.5 text-muted hover:text-red transition-all shrink-0"
                            title="Delete Card"
                        >
                            <Trash2 size={16} />
                        </button>

                        {/* Year Input (if enabled) */}
                        {showYear && (
                            <input 
                                value={row.year}
                                onChange={(e) => updateRow(row.id, 'year', e.target.value)}
                                placeholder="Year"
                                className="w-24 bg-panel-2 border border-outline rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-accent transition-colors text-center placeholder:text-muted/50 h-[42px]"
                            />
                        )}
                    </div>
                </div>

                {/* Right Column: Definition */}
                <div className="flex-1 min-w-0">
                    <div className="w-full relative group/def">
                        {isEditingDef ? (
                            <div className="bg-panel-2 border border-accent rounded-lg min-h-[42px] relative">
                                <textarea 
                                    ref={textareaRef}
                                    value={row.def}
                                    onChange={(e) => updateRow(row.id, 'def', e.target.value)}
                                    onBlur={() => setIsEditingDef(false)}
                                    onKeyDown={handleDefKeyDown}
                                    placeholder="Definition"
                                    rows={1}
                                    className="w-full bg-transparent border-none focus:outline-none px-3 py-2.5 text-sm resize-none min-h-[40px] overflow-hidden block custom-scrollbar leading-relaxed"
                                    onInput={(e) => {
                                        const target = e.target as HTMLTextAreaElement;
                                        target.style.height = 'auto';
                                        target.style.height = (target.scrollHeight) + 'px';
                                    }}
                                />
                            </div>
                        ) : (
                            <div 
                                tabIndex={0}
                                onFocus={() => setIsEditingDef(true)}
                                onClick={() => setIsEditingDef(true)}
                                className={clsx(
                                    "w-full min-h-[42px] px-3 py-2.5 text-sm bg-panel-2 border rounded-lg cursor-text hover:border-accent/50 transition-colors focus:outline-none focus:border-accent leading-relaxed",
                                    row.def ? "border-outline" : "border-outline text-muted italic"
                                )}
                            >
                                {row.def ? renderMarkdown(row.def) : "Click to add definition..."}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Absolute Index */}
            <div className="absolute bottom-2 right-3 text-xs text-muted font-mono opacity-30 select-none pointer-events-none">
                {index + 1}
            </div>
        </div>
    );
};


export const StartMenu: React.FC<StartMenuProps> = ({ 
  librarySets,
  activeSessions,
  onStartFromLibrary,
  onResumeSession,
  onSaveToLibrary,
  onDeleteLibrarySet,
  onDeleteSession,
  onViewPreview,
  settings,
  onUpdateSettings
}) => {
  const [view, setView] = useState<'menu' | 'builder'>('menu');
  const [builderMode, setBuilderMode] = useState<'visual' | 'raw'>('visual');
  const [showMarkdownHelp, setShowMarkdownHelp] = useState(false);
  const [showYears, setShowYears] = useState(false);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  
  // Image Modal State
  const [showImageModal, setShowImageModal] = useState(false);
  const [editingImageRowId, setEditingImageRowId] = useState<string | null>(null);

  // Builder State
  const [builderRows, setBuilderRows] = useState<BuilderRow[]>(() => {
    const saved = localStorage.getItem(BUILDER_STORAGE_KEY);
    try {
        return saved ? JSON.parse(saved) : [
            { id: '1', term: '', def: '', year: '', image: '' },
            { id: '2', term: '', def: '', year: '', image: '' },
            { id: '3', term: '', def: '', year: '', image: '' }
        ];
    } catch {
        return [
            { id: '1', term: '', def: '', year: '', image: '' },
            { id: '2', term: '', def: '', year: '', image: '' },
            { id: '3', term: '', def: '', year: '', image: '' }
        ];
    }
  });
  const [rawText, setRawText] = useState('');
  const [setName, setSetName] = useState('');
  
  // Focus Management for new rows
  const prevRowCount = useRef(builderRows.length);
  useEffect(() => {
    if (builderRows.length > prevRowCount.current) {
        // Row added, find the last row's term input and focus it
        const lastRow = builderRows[builderRows.length - 1];
        const el = document.getElementById(`term-${lastRow.id}`);
        if (el) el.focus();
    }
    prevRowCount.current = builderRows.length;
  }, [builderRows.length]);

  // Delete Confirmation State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const greeting = useMemo(() => GREETINGS[Math.floor(Math.random() * GREETINGS.length)], []);
  const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Persist builder rows only in visual mode
  useEffect(() => {
     if (builderMode === 'visual') {
         localStorage.setItem(BUILDER_STORAGE_KEY, JSON.stringify(builderRows));
     }
  }, [builderRows, builderMode]);

  const handleCreateNew = () => {
    setSetName('');
    setBuilderRows([
        { id: '1', term: '', def: '', year: '', image: '' },
        { id: '2', term: '', def: '', year: '', image: '' },
        { id: '3', term: '', def: '', year: '', image: '' }
    ]);
    const defaultName = "New Set " + new Date().toLocaleDateString('en-US', {month:'short', day:'numeric', year:'numeric'}).replace(',', '');
    setSetName(defaultName);
    setView('builder');
  };

  const handleBackToLibrary = () => {
      // Check for unsaved changes
      let isDirty = false;
      if (builderMode === 'raw') {
          isDirty = !!rawText.trim();
      } else {
          isDirty = builderRows.some(r => r.term.trim() || r.def.trim());
      }

      if (isDirty) {
          setShowUnsavedModal(true);
      } else {
          setView('menu');
      }
  };

  const handleDiscard = () => {
      setShowUnsavedModal(false);
      setView('menu');
      setSetName('');
      setBuilderRows([]); // Reset handled by next enter
  };

  const handleSaveAndExit = () => {
      handleSaveToLibraryAction();
      setShowUnsavedModal(false);
  };

  // --- BUILDER SYNC LOGIC ---

  const syncToRaw = () => {
    const text = builderRows
         .filter(r => r.term.trim() || r.def.trim())
         .map(r => {
             let line = `${r.term.trim()} / ${r.def.trim()}`;
             if (r.year.trim()) line += ` /// ${r.year.trim()}`;
             return line;
         })
         .join('\n\n&&&\n\n'); // New Separator
    setRawText(text);
  };

  const syncToRows = () => {
    const parsed = parseInput(rawText);
    const rows: BuilderRow[] = parsed.map((c, i) => ({
        id: generateId() + i,
        term: c.term?.[0] || '',
        def: c.content || '',
        year: c.year || '',
        image: c.image || ''
    }));
    // Ensure at least 3 rows
    while (rows.length < 3) {
        rows.push({ id: generateId(), term: '', def: '', year: '', image: '' });
    }
    setBuilderRows(rows);
  };

  const switchMode = (newMode: 'visual' | 'raw') => {
      if (newMode === builderMode) return;
      
      if (newMode === 'raw') {
          syncToRaw();
      } else {
          syncToRows();
      }
      setBuilderMode(newMode);
  };

  const handleLoadSetToBuilder = (set: CardSet) => {
      setSetName(set.name);
      const rows = set.cards.map((c, i) => ({
          id: generateId() + i,
          term: c.term[0] || '',
          def: c.content || '',
          year: c.year || '',
          image: c.image || ''
      }));
      setBuilderRows(rows);
      setView('builder');
      setBuilderMode('visual');
  };

  // --- ACTIONS ---

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const text = await e.target.files[0].text();
      // Detect if it's JSON or TXT
      let loadedName = e.target.files[0].name.replace('.json', '').replace('.flashcards', '').replace('.txt', '');
      let cards = [];

      try {
         const json = JSON.parse(text);
         if (json.name) loadedName = json.name;
         cards = parseInput(text); // parseInput handles both JSON structure and raw
      } catch {
         // Raw text
         setRawText(text);
         // If we are in visual mode, we need to sync immediately
         const parsed = parseInput(text);
         const rows = parsed.map((c, i) => ({
             id: generateId() + i,
             term: c.term?.[0] || '',
             def: c.content || '',
             year: c.year || '',
             image: ''
         }));
         setBuilderRows(rows);
      }
      
      if (cards.length > 0 && builderMode === 'visual') {
           const rows = cards.map((c, i) => ({
             id: generateId() + i,
             term: c.term?.[0] || '',
             def: c.content || '',
             year: c.year || '',
             image: c.image || ''
         }));
         setBuilderRows(rows);
      } else if (builderMode === 'raw') {
          setRawText(text);
      }

      setSetName(loadedName);
      setView('builder'); // Force to builder view
    }
  };

  const getCardsFromState = (): Partial<Card>[] => {
      if (builderMode === 'visual') {
          return builderRows
            .filter(r => r.term.trim() || r.def.trim())
            .map(r => ({
                term: [r.term.trim()],
                content: r.def.trim(),
                year: r.year.trim() || undefined,
                image: r.image.trim() || undefined,
                star: false,
                mastery: 0
            }));
      } else {
          return parseInput(rawText);
      }
  };

  const handleStartSessionNow = () => {
      const cards = getCardsFromState();
      if (cards.length === 0) return;
      
      const fullCards: Card[] = cards.map((c, i) => ({
        id: generateId() + i,
        term: c.term || ['?'],
        content: c.content || '',
        year: c.year,
        image: c.image,
        mastery: 0,
        star: c.star || false
     }));

     const newSet: CardSet = {
        id: generateId(),
        name: setName || `Set ${librarySets.length + 1}`,
        cards: fullCards,
        lastPlayed: Date.now(),
        elapsedTime: 0,
        topStreak: 0
     };
     
     // Save to Library first to ensure persistence
     onSaveToLibrary(newSet);
     // Start Session
     onStartFromLibrary(newSet);

     // Clear Builder State
     setSetName('');
     setRawText('');
     const emptyRows = [
        { id: '1', term: '', def: '', year: '', image: '' },
        { id: '2', term: '', def: '', year: '', image: '' },
        { id: '3', term: '', def: '', year: '', image: '' }
     ];
     setBuilderRows(emptyRows);
     // Explicitly clear local storage to prevent builder restoration on next visit
     localStorage.setItem(BUILDER_STORAGE_KEY, JSON.stringify(emptyRows));
     setShowUnsavedModal(false);
  };

  const handleSaveToLibraryAction = () => {
      const cards = getCardsFromState();
      if (cards.length === 0) return;
      
      const fullCards: Card[] = cards.map((c, i) => ({
        id: generateId() + i,
        term: c.term || ['?'],
        content: c.content || '',
        year: c.year,
        image: c.image,
        mastery: 0,
        star: c.star || false
     }));

     const newSet: CardSet = {
        id: generateId(), 
        name: setName || `Set ${librarySets.length + 1}`,
        cards: fullCards,
        lastPlayed: Date.now(),
        elapsedTime: 0,
        topStreak: 0
     };
     
     onSaveToLibrary(newSet);
     setView('menu');
     setSetName('');
     setRawText('');
     setBuilderRows([
        { id: '1', term: '', def: '', year: '', image: '' },
        { id: '2', term: '', def: '', year: '', image: '' },
        { id: '3', term: '', def: '', year: '', image: '' }
     ]);
  };

  const handleDownloadFlashcards = () => {
      let content = rawText;
      if (builderMode === 'visual') {
          content = builderRows
             .filter(r => r.term.trim() || r.def.trim())
             .map(r => {
                 let line = `${r.term.trim()} / ${r.def.trim()}`;
                 if (r.year.trim()) line += ` /// ${r.year.trim()}`;
                 return line;
             })
             .join('\n\n&&&\n\n');
      }
      downloadFile((setName || 'deck') + '.flashcards', content, 'text');
  };

  const handleCopyCode = () => {
      let content = rawText;
      if (builderMode === 'visual') {
          content = builderRows
             .filter(r => r.term.trim() || r.def.trim())
             .map(r => {
                 let line = `${r.term.trim()} / ${r.def.trim()}`;
                 if (r.year.trim()) line += ` /// ${r.year.trim()}`;
                 return line;
             })
             .join('\n\n&&&\n\n');
      }
      navigator.clipboard.writeText(content);
      alert("Copied to clipboard!");
  };

  // --- HELPER FOR VISUAL BUILDER ---
  
  const addRow = () => {
     setBuilderRows(prev => [...prev, { id: generateId(), term: '', def: '', year: '', image: '' }]);
  };

  const updateRow = (id: string, field: keyof BuilderRow, value: string) => {
     setBuilderRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  const removeRow = (id: string) => {
     setBuilderRows(prev => prev.filter(r => r.id !== id));
  };

  const openImageModal = (rowId: string) => {
      setEditingImageRowId(rowId);
      setShowImageModal(true);
  };

  const handleSaveImage = (url: string) => {
      if (editingImageRowId) {
          updateRow(editingImageRowId, 'image', url);
      }
  };

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

  const handleDeleteClick = (id: string, type: 'session' | 'library') => {
      if (deleteConfirmId === id) {
          if (type === 'session') onDeleteSession(id);
          else onDeleteLibrarySet(id);
          setDeleteConfirmId(null);
      } else {
          setDeleteConfirmId(id);
          setTimeout(() => setDeleteConfirmId(null), 3000);
      }
  };

  // Check for uploaded images (Base64)
  const hasUploadedImages = useMemo(() => {
      return builderRows.some(r => r.image && r.image.startsWith('data:'));
  }, [builderRows]);

  return (
    <div className="max-w-5xl mx-auto w-full pb-20 animate-in fade-in duration-700">
      
      <UnsavedChangesModal 
        isOpen={showUnsavedModal}
        onSave={handleSaveAndExit}
        onDiscard={handleDiscard}
        onCancel={() => setShowUnsavedModal(false)}
      />

      <ImageModal 
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        onSave={handleSaveImage}
        initialValue={editingImageRowId ? (builderRows.find(r => r.id === editingImageRowId)?.image || '') : ''}
      />

      <MarkdownHelpModal isOpen={showMarkdownHelp} onClose={() => setShowMarkdownHelp(false)} />
      <input ref={fileInputRef} type="file" accept=".json,.txt,.flashcards" className="hidden" onChange={handleFileUpload} />

      {/* Header */}
      <div className={clsx("mb-10", view === 'builder' ? "text-center" : "text-left")}>
         {view === 'menu' && (
             <div className="text-accent font-mono text-sm mb-1 tracking-widest uppercase opacity-80">{currentDate}</div>
         )}
         <h1 className="text-4xl font-bold text-text tracking-tight mb-2">
            {view === 'menu' ? greeting : 'List Builder'}
         </h1>
         <p className="text-muted text-lg">
            {view === 'menu' ? 'Study a deck or create a new one below.' : 'Build decks here!'}
         </p>
      </div>

      {view === 'builder' && (
         <button 
           onClick={handleBackToLibrary}
           className="mb-6 flex items-center gap-3 text-muted hover:text-text transition-colors font-bold uppercase text-xs tracking-wider group"
         >
            <div className="p-2 rounded-full border border-outline group-hover:bg-panel group-hover:border-accent transition-colors">
               <ArrowLeft size={16} /> 
            </div>
            Back to Library
         </button>
      )}

      <div className="space-y-12">
        
        {/* MENU MODE */}
        {view === 'menu' && (
            <div className="grid lg:grid-cols-[1fr_1fr] gap-8 items-start">
                {/* ACTIVE SESSIONS COLUMN */}
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <h3 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-2 pl-2">
                           Active Sessions
                        </h3>
                        <div className="flex gap-2 opacity-0 pointer-events-none" aria-hidden>
                            <button className="flex items-center gap-2 px-3 py-1.5 bg-panel-2 border border-outline rounded-lg text-xs font-bold">
                                <Upload size={14} /> Import
                            </button>
                            <button className="flex items-center gap-2 px-3 py-1.5 bg-text text-bg rounded-lg text-xs font-bold">
                                <Plus size={14} /> Create
                            </button>
                        </div>
                    </div>

                    {activeSessions.length === 0 ? (
                        <div className="py-16 border border-dashed border-outline rounded-2xl bg-panel/30 text-center">
                            <p className="text-muted italic text-sm">No ongoing sessions.</p>
                            <p className="text-muted/50 text-xs mt-1">Start one from your Library.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {activeSessions.map(session => {
                                const progress = Math.round((session.cards.filter(c => c.mastery === 2).length / session.cards.length) * 100);
                                return (
                                    <div key={session.id} className="group flex items-center justify-between bg-panel-2 border border-outline p-4 rounded-2xl hover:border-accent/50 transition-all shadow-sm">
                                        <div className="flex-1 flex items-center gap-4">
                                            <div className="relative shrink-0">
                                                <div className="w-10 h-10 rounded-full bg-panel border border-outline flex items-center justify-center text-accent font-bold text-xs">
                                                    {progress}%
                                                </div>
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-bold text-text group-hover:text-accent transition-colors truncate">{session.name}</div>
                                                <div className="text-xs text-muted font-mono">
                                                    {session.cards.length} cards &bull; {new Date(session.lastPlayed).toLocaleDateString()}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 pl-2">
                                             <button 
                                                onClick={() => handleDeleteClick(session.id, 'session')}
                                                className={clsx(
                                                    "p-2 rounded-lg bg-panel border transition-all text-xs font-bold",
                                                    deleteConfirmId === session.id ? "border-red text-red w-16" : "border-outline text-muted hover:text-red hover:border-red"
                                                )}
                                                title="Delete Session"
                                            >
                                                {deleteConfirmId === session.id ? "Sure?" : <Trash2 size={16} />}
                                            </button>
                                            <button 
                                                onClick={() => onResumeSession(session)}
                                                className="p-2 bg-accent text-bg rounded-lg hover:scale-105 active:scale-95 transition-all"
                                                title="Resume"
                                            >
                                                <Play size={16} fill="currentColor" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* LIBRARY COLUMN */}
                <div className="space-y-4">
                     <div className="flex justify-between items-center">
                        <h3 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-2 pl-2">
                            Library
                        </h3>
                        <div className="flex gap-2">
                            <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="flex items-center gap-2 px-3 py-1.5 bg-panel-2 border border-outline rounded-lg text-xs font-bold text-muted hover:text-text hover:border-accent transition-colors"
                            >
                                <Upload size={14} /> Import
                            </button>
                            <button 
                                onClick={handleCreateNew}
                                className="flex items-center gap-2 px-3 py-1.5 bg-text text-bg rounded-lg text-xs font-bold hover:scale-105 active:scale-95 transition-all shadow-lg"
                            >
                                <Plus size={14} /> Create
                            </button>
                        </div>
                    </div>

                    {librarySets.length === 0 ? (
                        <div className="py-16 border border-dashed border-outline rounded-2xl bg-panel/30 text-center">
                            <p className="text-muted italic mb-4">Your library is empty.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {librarySets.map(set => (
                                <div key={set.id} className="group bg-panel border border-outline p-5 rounded-2xl hover:border-accent transition-all shadow-sm flex flex-col justify-between h-full">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <div className="font-bold text-lg text-text group-hover:text-accent transition-colors">{set.name}</div>
                                            <div className="text-xs text-muted font-mono">{set.cards.length} card{set.cards.length === 1 ? '' : 's'}</div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                             <button 
                                                onClick={() => handleLoadSetToBuilder(set)}
                                                className="p-1.5 text-muted hover:text-text rounded hover:bg-panel-2 transition-all"
                                                title="Edit"
                                            >
                                                <Pencil size={16} />
                                            </button>
                                            <button 
                                                onClick={() => onViewPreview({set, mode: 'library'})}
                                                className="p-1.5 text-muted hover:text-text rounded hover:bg-panel-2 transition-all"
                                                title="Preview"
                                            >
                                                <Eye size={16} />
                                            </button>
                                            <button 
                                                onClick={() => downloadFile(set.name + '.flashcards', JSON.stringify(set, null, 2), 'json')}
                                                className="p-1.5 text-muted hover:text-text rounded hover:bg-panel-2 transition-all"
                                                title="Export JSON"
                                            >
                                                <Download size={16} />
                                            </button>
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleDeleteClick(set.id, 'library');
                                                }}
                                                className={clsx(
                                                    "p-1.5 rounded transition-all flex items-center justify-center",
                                                    deleteConfirmId === set.id ? "bg-red text-bg w-12" : "text-muted hover:text-red hover:border-red"
                                                )}
                                                title="Delete Set"
                                            >
                                                {deleteConfirmId === set.id ? <span className="text-[10px] font-bold uppercase">Sure?</span> : <Trash2 size={16} />}
                                            </button>
                                        </div>
                                    </div>
                                    
                                    <div className="pt-2 mt-2">
                                        <button 
                                            onClick={() => onStartFromLibrary(set)}
                                            className="w-full px-4 py-2 bg-panel-2 border border-outline hover:border-accent text-text text-sm font-bold rounded-lg hover:bg-accent hover:text-bg transition-all flex items-center justify-center gap-2"
                                        >
                                            <Play size={14} fill="currentColor" /> Play
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* BUILDER MODE */}
        {view === 'builder' && (
            <div className="animate-in zoom-in-95 duration-300">
                <div className="bg-panel border border-outline rounded-2xl p-6 shadow-lg">
                    {/* Builder Header/Toolbar */}
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6 border-b border-outline pb-6">
                        <input 
                        value={setName}
                        onChange={(e) => setSetName(e.target.value)}
                        placeholder="Set Name"
                        className="bg-panel-2 border border-outline rounded-xl px-4 py-2 text-text w-full md:w-auto min-w-[300px] focus:outline-none focus:border-accent transition-colors font-bold"
                        />

                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer group select-none">
                                <div
                                    onClick={() => setShowYears(!showYears)}
                                    className={clsx(
                                        "w-10 h-6 rounded-full p-1 transition-colors border border-transparent",
                                        showYears ? "bg-accent" : "bg-outline"
                                    )}
                                >
                                    <div 
                                        className={clsx(
                                            "w-3.5 h-3.5 bg-bg rounded-full shadow-sm transition-transform duration-200",
                                            showYears ? "translate-x-4" : "translate-x-0"
                                        )} 
                                    />
                                </div>
                                <span className="text-sm text-muted group-hover:text-text transition-colors font-medium">Show Years</span>
                            </label>

                            <div className="h-6 w-px bg-outline"></div>
                            
                            <div className="flex items-center bg-panel-2 border border-outline rounded-lg p-1">
                                <button
                                onClick={() => switchMode('visual')}
                                className={clsx(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                                    builderMode === 'visual' ? "bg-panel shadow-sm text-accent" : "text-muted hover:text-text"
                                )}
                                >
                                <LayoutList size={16} /> Visual
                                </button>
                                <button
                                onClick={() => switchMode('raw')}
                                className={clsx(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                                    builderMode === 'raw' ? "bg-panel shadow-sm text-accent" : "text-muted hover:text-text"
                                )}
                                >
                                <FileText size={16} /> Raw Text
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="mb-6">
                    {builderMode === 'visual' ? (
                        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                            <div className="flex justify-end mb-2">
                                <button onClick={() => setShowMarkdownHelp(true)} className="text-xs text-muted hover:text-accent flex items-center gap-1">
                                    <HelpCircle size={12} /> Formatting Help
                                </button>
                            </div>
                            {builderRows.map((row, index) => (
                                <BuilderRowItem 
                                    key={row.id}
                                    row={row}
                                    index={index}
                                    showYear={showYears}
                                    isDuplicate={duplicateIds.has(row.id)}
                                    isLast={index === builderRows.length - 1}
                                    updateRow={updateRow}
                                    removeRow={removeRow}
                                    onAddNext={addRow}
                                    onOpenImageModal={() => openImageModal(row.id)}
                                />
                            ))}
                            <button 
                            onClick={addRow}
                            className="w-full py-3 border border-dashed border-outline rounded-xl text-muted hover:text-accent hover:border-accent hover:bg-panel-2 transition-all flex items-center justify-center gap-2 text-sm font-bold mt-4"
                            >
                                <Plus size={16} /> Add Card
                            </button>
                        </div>
                    ) : (
                        <div className="relative">
                            <div className="flex justify-end mb-2">
                                <button onClick={() => setShowMarkdownHelp(true)} className="text-xs text-muted hover:text-accent flex items-center gap-1">
                                    <HelpCircle size={12} /> Formatting Help
                                </button>
                            </div>
                            <textarea
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                            placeholder={`Term / Definition /// Year\n\n&&&\n\nNext Term / Definition`}
                            className="w-full bg-panel-2 border border-outline rounded-xl p-4 min-h-[400px] font-mono text-sm focus:outline-none focus:border-accent resize-y leading-relaxed"
                            />
                        </div>
                    )}
                    </div>

                    {/* Footer Actions */}
                    <div className="flex flex-col md:flex-row items-center justify-between pt-6 border-t border-outline gap-4">
                        <div className="flex gap-2 w-full md:w-auto">
                            <button 
                            onClick={handleCopyCode}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 text-muted hover:text-text font-medium transition-colors rounded-lg hover:bg-panel-2"
                            >
                                <Copy size={18} />
                                <span className="inline">Copy</span>
                            </button>
                            <button 
                            onClick={handleDownloadFlashcards}
                            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 text-muted hover:text-text font-medium transition-colors rounded-lg hover:bg-panel-2"
                            >
                                <Download size={18} />
                                <span className="inline">.flashcards</span>
                            </button>
                        </div>

                        <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
                            <button 
                            onClick={handleSaveToLibraryAction}
                            className="flex items-center justify-center gap-2 px-6 py-3 bg-panel-2 border border-outline rounded-xl font-bold text-text hover:border-accent transition-all"
                            >
                                <FolderOpen size={18} /> Save to Library
                            </button>
                            <button 
                            onClick={handleStartSessionNow}
                            className="flex items-center justify-center gap-2 bg-accent text-bg px-8 py-3 rounded-xl font-bold hover:scale-105 active:scale-95 transition-all shadow-lg"
                            >
                            <Play size={18} fill="currentColor" /> Study Now
                            </button>
                        </div>
                    </div>
                </div>
                
                <div className="text-center mt-6 text-sm opacity-80 space-y-1">
                    <p className="text-red font-bold">
                        Cards are saved per device in local storage: if you clear your cookies, you can lose them. It is highly recommended you download important sets!
                    </p>
                    {hasUploadedImages && (
                        <p className="text-blue font-bold">
                            You've uploaded images directly to this set. If you download your set, they won't be saved. To save them, put images in your set with image URLs.
                        </p>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};