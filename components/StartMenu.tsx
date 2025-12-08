import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Trash2, Upload, Plus, Copy, AlertCircle, ArrowLeft, Download, FileText, LayoutList, HelpCircle, Save, FolderOpen, Play, Eye, Pencil, RotateCw, RotateCcw, X, Image as ImageIcon, Link } from 'lucide-react';
import { CardSet, Card, Settings, Folder } from '../types';
import { parseInput, generateId, downloadFile, renderMarkdown, renderInline } from '../utils';
import clsx from 'clsx';

interface StartMenuProps {
    librarySets: CardSet[];
    setLibrarySets: React.Dispatch<React.SetStateAction<CardSet[]>>;
    folders: Folder[];
    setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
    onStartFromLibrary: (set: CardSet) => void;
    onResumeSession: (set: CardSet) => void;
    onSaveToLibrary: (set: CardSet) => void;
    onDeleteLibrarySet: (id: string) => void;
    onDeleteSession: (id: string) => void;
    onViewPreview: (data: { set: CardSet, mode: 'library' | 'session' }) => void;
    settings: Settings;
    onUpdateSettings: (s: Settings) => void;
    lifetimeCorrect: number;
    onDuplicateLibrarySet: (id: string) => void;
}

interface BuilderRow {
    id: string;
    term: string;
    def: string;
    year: string;
    image: string;
    customFields: { name: string; value: string }[];
    tags: string[]; // Kept for internal state if needed, but primarily derived from term
    originalCardId?: string;
    star: boolean;
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
    "Hey, you're here.",
    "Welcome... or welcome back.",
    "Ready to study?",
    "You're in the right place.",
    "Onward.",
    "Heyo.",
    "Flashcards! Hurrah!",
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

const DeleteFolderModal: React.FC<{
    isOpen: boolean;
    folderName: string;
    setCount: number;
    onClose: () => void;
    onConfirm: (action: 'move' | 'delete') => void;
}> = ({ isOpen, folderName, setCount, onClose, onConfirm }) => {
    const [deleteClicks, setDeleteClicks] = useState(0);

    if (!isOpen) return null;

    const handleDeleteAllClick = () => {
        if (deleteClicks < 4) {
            setDeleteClicks(prev => prev + 1);
        } else {
            onConfirm('delete');
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
            <div className="bg-panel border border-outline rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-text mb-2">Delete "{folderName}"?</h3>
                <p className="text-muted mb-6">This folder contains {setCount} set{setCount === 1 ? '' : 's'}. What would you like to do with them?</p>

                <div className="space-y-3">
                    <button
                        onClick={() => onConfirm('move')}
                        className="w-full py-3 bg-panel-2 border border-outline text-text rounded-xl font-bold hover:border-accent transition-colors flex flex-col items-center justify-center gap-1"
                    >
                        <span>Delete Folder Only</span>
                        <span className="text-[10px] text-muted font-normal uppercase tracking-wider">Move sets to main Library</span>
                    </button>

                    <div className="relative">
                        <button
                            onClick={handleDeleteAllClick}
                            className={clsx(
                                "w-full py-3 border rounded-xl font-bold transition-all flex flex-col items-center justify-center gap-1",
                                deleteClicks > 0 ? "bg-red text-bg border-red" : "bg-red/5 text-red border-red/20 hover:bg-red/10"
                            )}
                        >
                            <span>Delete Folder & Sets</span>
                            <span className={clsx("text-[10px] font-normal uppercase tracking-wider", deleteClicks > 0 ? "text-bg/80" : "text-red/60")}>
                                {deleteClicks === 0 ? "Just get rid of everything" : `${5 - deleteClicks} clicks remaining`}
                            </span>
                        </button>
                    </div>

                    <button onClick={onClose} className="w-full py-2 text-muted hover:text-text font-medium text-sm mt-2">
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
                        <span className="font-mono text-yellow text-right">- Item 1<br />- Item 2</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <span className="text-muted">Exit List / New Para</span>
                        <span className="font-mono text-yellow text-right">&lt;p&gt;</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-outline/50">
                        <span className="text-muted font-bold text-accent">Image Link</span>
                        <span className="font-mono text-yellow text-right">**ADD TO RAW TEXT:** <br /> `... ||| http://link/image.jpg`</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <span className="text-muted font-bold text-accent">Year</span>
                        <span className="font-mono text-yellow text-right">**ADD TO RAW TEXT:** <br /> `... /// Year`</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
// Warning Modal
const WarningModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    message: string;
}> = ({ isOpen, onClose, onConfirm, message }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
            <div className="bg-panel border border-outline rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4 text-yellow">
                    <AlertCircle size={24} />
                    <h3 className="text-lg font-bold text-text">Warning</h3>
                </div>
                <p className="text-muted mb-6">{message}</p>
                <div className="flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 rounded-lg text-muted hover:text-text hover:bg-panel-2 transition-colors">Cancel</button>
                    <button onClick={() => { onConfirm(); onClose(); }} className="px-4 py-2 rounded-lg bg-yellow text-bg font-bold hover:bg-yellow/90 transition-colors">Confirm</button>
                </div>
            </div>
        </div>
    );
};






// No Starred Modal
const NoStarredModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onDisableAndPlay: () => void;
}> = ({ isOpen, onClose, onDisableAndPlay }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={onClose}>
            <div className="bg-panel border border-outline rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-3 mb-4 text-yellow">
                    <AlertCircle size={24} />
                    <h3 className="text-lg font-bold text-text">No Starred Cards</h3>
                </div>
                <p className="text-muted mb-6">You have "Study Starred Only" enabled, but this set has no starred cards.</p>
                <div className="flex flex-col gap-3">
                    <button onClick={onDisableAndPlay} className="w-full py-3 bg-accent text-bg rounded-xl font-bold hover:scale-105 transition-transform">
                        Disable Filter & Play
                    </button>
                    <button onClick={onClose} className="w-full py-3 text-muted hover:text-text font-medium">
                        Cancel
                    </button>
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
    customFieldNames: string[];
    updateRow: (id: string, field: keyof BuilderRow, value: any) => void;
    removeRow: (id: string) => void;
    onAddNext: () => void;
    onOpenImageModal: () => void;
}> = ({ row, index, showYear, isDuplicate, isLast, customFieldNames, updateRow, removeRow, onAddNext, onOpenImageModal }) => {
    const [isEditingDef, setIsEditingDef] = useState(false);
    const [isEditingTerm, setIsEditingTerm] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const termInputRef = useRef<HTMLInputElement>(null);

    // Highlight Toolbar State
    const [highlightToolbar, setHighlightToolbar] = useState<{ x: number, y: number, field: 'term' | 'def' } | null>(null);
    const [selectionRange, setSelectionRange] = useState<{ start: number, end: number } | null>(null);

    const handleMouseUp = (e: React.MouseEvent<HTMLInputElement | HTMLTextAreaElement>, field: 'term' | 'def') => {
        const target = e.target as HTMLInputElement | HTMLTextAreaElement;
        if (target.selectionStart !== target.selectionEnd) {
            setSelectionRange({ start: target.selectionStart || 0, end: target.selectionEnd || 0 });
            setHighlightToolbar({ x: e.clientX, y: e.clientY - 50, field });
        } else {
            setHighlightToolbar(null);
            setSelectionRange(null);
        }
    };

    const applyHighlight = (color: string) => {
        if (!highlightToolbar || !selectionRange) return;
        const field = highlightToolbar.field;
        const text = field === 'term' ? row.term : row.def;
        const before = text.substring(0, selectionRange.start);
        const selected = text.substring(selectionRange.start, selectionRange.end);
        const after = text.substring(selectionRange.end);

        const newText = `${before}<h=${color}>${selected}</h>${after}`;
        updateRow(row.id, field, newText);
        setHighlightToolbar(null);
        setSelectionRange(null);
    };

    // Auto-focus textarea when entering edit mode
    useEffect(() => {
        if (isEditingDef && textareaRef.current) {
            textareaRef.current.focus();
            // Reset height
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = (textareaRef.current.scrollHeight) + 'px';
        }
    }, [isEditingDef]);

    // Auto-focus term input when entering edit mode
    useEffect(() => {
        if (isEditingTerm && termInputRef.current) {
            termInputRef.current.focus();
        }
    }, [isEditingTerm]);

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
            {/* Highlight Toolbar */}
            {highlightToolbar && (
                <div
                    className="fixed z-[100] bg-panel border border-outline shadow-xl rounded-lg p-1.5 flex gap-1.5 animate-in fade-in zoom-in-95"
                    style={{ top: highlightToolbar.y, left: highlightToolbar.x, transform: 'translateX(-50%)' }}
                    onMouseDown={(e) => e.preventDefault()}
                >
                    {[
                        { name: 'y', class: 'bg-yellow border-yellow' },
                        { name: 'r', class: 'bg-red border-red' },
                        { name: 'b', class: 'bg-blue border-blue' },
                        { name: 'g', class: 'bg-green border-green' },
                        { name: 'p', class: 'bg-purple border-purple' }
                    ].map(c => (
                        <button
                            key={c.name}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); applyHighlight(c.name); }}
                            className={`w-6 h-6 rounded-full border ${c.class} hover:scale-110 transition-transform`}
                            title={c.name === 'r' ? 'Red' : c.name === 'b' ? 'Blue' : c.name === 'g' ? 'Green' : c.name === 'p' ? 'Purple' : 'Yellow'}
                        />
                    ))}
                </div>
            )}
            <div className="flex flex-col md:flex-row gap-3">

                {/* Left Column: Term & Toolbar */}
                <div className="w-full md:w-[35%] flex flex-col gap-2">
                    <div className="relative">
                        {isEditingTerm ? (
                            <div className="bg-panel-2 border border-accent rounded-lg min-h-[42px] relative">
                                <input
                                    ref={termInputRef}
                                    id={`term-${row.id}`}
                                    value={row.term}
                                    onChange={(e) => updateRow(row.id, 'term', e.target.value)}
                                    onMouseUp={(e) => handleMouseUp(e, 'term')}
                                    onBlur={() => setIsEditingTerm(false)}
                                    placeholder="Term"
                                    className={clsx(
                                        "w-full bg-transparent border-none focus:outline-none px-3 py-2.5 text-sm transition-all min-h-[42px]",
                                        isDuplicate && "text-red"
                                    )}
                                />
                            </div>
                        ) : (
                            <div
                                tabIndex={0}
                                onFocus={() => setIsEditingTerm(true)}
                                onClick={() => setIsEditingTerm(true)}
                                className={clsx(
                                    "w-full min-h-[42px] px-3 py-2.5 text-sm bg-panel-2 border rounded-lg cursor-text hover:border-accent/50 transition-colors focus:outline-none focus:border-accent leading-relaxed flex items-center",
                                    isDuplicate ? "border-red" : "border-outline",
                                    !row.term && "text-muted italic"
                                )}
                            >
                                {row.term ? (
                                    <span className="whitespace-pre-wrap break-words">
                                        {/* We need to render markdown here but be careful about tags which are part of the term string */}
                                        {/* The term string might contain (Tag) at the start. We should probably render that too or let renderInline handle it? */}
                                        {/* renderInline doesn't handle tags like (Tag). But we want to show the term as it will appear. */}
                                        {/* Let's just render the whole thing with renderInline which handles bold/italic/highlight */}
                                        {renderInline(row.term, `term-view-${row.id}`)}
                                    </span>
                                ) : (
                                    "Term"
                                )}
                            </div>
                        )}
                        {isDuplicate && !isEditingTerm && <div className="absolute right-2 top-3 text-red"><AlertCircle size={14} /></div>}
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

                        {/* Star Button */}
                        <button
                            onClick={() => updateRow(row.id, 'star', !row.star)}
                            tabIndex={-1}
                            className={clsx(
                                "p-2.5 transition-all shrink-0",
                                row.star ? "text-yellow hover:text-yellow/80" : "text-muted hover:text-yellow"
                            )}
                            title={row.star ? "Unstar Card" : "Star Card"}
                        >
                            {row.star ? "★" : "☆"}
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

                        {/* Custom Fields Inputs */}
                        {customFieldNames.map(fieldName => {
                            const val = row.customFields.find(f => f.name === fieldName)?.value || '';
                            return (
                                <input
                                    key={fieldName}
                                    value={val}
                                    onChange={(e) => {
                                        const newFields = row.customFields.filter(f => f.name !== fieldName);
                                        if (e.target.value) {
                                            newFields.push({ name: fieldName, value: e.target.value });
                                        }
                                        updateRow(row.id, 'customFields', newFields);
                                    }}
                                    placeholder={fieldName}
                                    className="w-24 bg-panel-2 border border-outline rounded-lg px-2 py-2 text-sm focus:outline-none focus:border-accent transition-colors text-center placeholder:text-muted/50 h-[42px]"
                                />
                            );
                        })}
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
                                    onMouseUp={(e) => handleMouseUp(e, 'def')}
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
    onStartFromLibrary,
    onResumeSession,
    onSaveToLibrary,
    onDeleteLibrarySet,
    onDeleteSession,
    onViewPreview,
    settings,
    onUpdateSettings,
    lifetimeCorrect,
    onDuplicateLibrarySet,
    setLibrarySets,
    folders,
    setFolders
}) => {
    const [view, setView] = useState<'menu' | 'builder'>('menu');
    const [builderMode, setBuilderMode] = useState<'visual' | 'raw'>('visual');
    const [showMarkdownHelp, setShowMarkdownHelp] = useState(false);

    const [showYears, setShowYears] = useState(false);
    const [customFieldNames, setCustomFieldNames] = useState<string[]>([]);
    const [newCustomFieldName, setNewCustomFieldName] = useState('');
    const [showUnsavedModal, setShowUnsavedModal] = useState(false);

    // Image Modal State
    const [showImageModal, setShowImageModal] = useState(false);
    const [editingImageRowId, setEditingImageRowId] = useState<string | null>(null);

    const [editingSetId, setEditingSetId] = useState<string | null>(null);

    // Warning Modal State
    const [warningModal, setWarningModal] = useState<{ isOpen: boolean, message: string, onConfirm: () => void }>({ isOpen: false, message: '', onConfirm: () => { } });
    const [noStarredModalSet, setNoStarredModalSet] = useState<CardSet | null>(null);


    // Builder State
    const [builderRows, setBuilderRows] = useState<BuilderRow[]>(() => {
        const saved = localStorage.getItem(BUILDER_STORAGE_KEY);
        try {
            return saved ? JSON.parse(saved) : [
                { id: '1', term: '', def: '', year: '', image: '', customFields: [], tags: [], star: false },
                { id: '2', term: '', def: '', year: '', image: '', customFields: [], tags: [], star: false },
                { id: '3', term: '', def: '', year: '', image: '', customFields: [], tags: [], star: false }
            ];
        } catch {
            return [
                { id: '1', term: '', def: '', year: '', image: '', customFields: [], tags: [], star: false },
                { id: '2', term: '', def: '', year: '', image: '', customFields: [], tags: [], star: false },
                { id: '3', term: '', def: '', year: '', image: '', customFields: [], tags: [], star: false }
            ];
        }
    });
    const [rawText, setRawText] = useState('');
    const [setName, setSetName] = useState('');

    // Custom Fields Dropdown State
    const [isCustomFieldsOpen, setIsCustomFieldsOpen] = useState(false);
    const customFieldsRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (customFieldsRef.current && !customFieldsRef.current.contains(event.target as Node)) {
                setIsCustomFieldsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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
    const [selectedSetIds, setSelectedSetIds] = useState<Set<string>>(new Set());
    const [batchDeleteClicks, setBatchDeleteClicks] = useState(0);

    // Folder State
    const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
    const [deleteFolderModal, setDeleteFolderModal] = useState<{ id: string; name: string; count: number } | null>(null);
    const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
    const [editingFolderName, setEditingFolderName] = useState('');
    const [movingSetId, setMovingSetId] = useState<string | null>(null);
    const [newFolderName, setNewFolderName] = useState('');
    const [newFolderColor, setNewFolderColor] = useState<Folder['color']>('brown');
    const [isCreatingFolder, setIsCreatingFolder] = useState(false);

    // Derived Lists
    const currentFolder = folders.find(f => f.id === currentFolderId);

    // If in a folder, show sets in that folder.
    // If at root, show root sets (no folderId) AND folders.
    // Multistudy sets are always at root in their own section.

    const displayedSets = currentFolderId
        ? librarySets.filter(s => s.folderId === currentFolderId)
        : librarySets.filter(s => !s.isMultistudy && !s.folderId);

    const displayedFolders = currentFolderId ? [] : folders;

    const multistudySets = librarySets.filter(s => s.isMultistudy);

    // Selection Logic
    const handleToggleSelect = (id: string) => {
        const newSet = new Set(selectedSetIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedSetIds(newSet);
        setBatchDeleteClicks(0);
    };

    const handleSelectAll = () => {
        if (selectedSetIds.size === displayedSets.length) {
            setSelectedSetIds(new Set());
        } else {
            setSelectedSetIds(new Set(displayedSets.map(s => s.id)));
        }
    };

    const handleCreateFolder = () => {
        if (selectedSetIds.size === 0) return;
        setNewFolderColor('brown');
        setIsCreatingFolder(true);
    };

    const confirmCreateFolder = (color: Folder['color'] = 'brown') => {
        const newFolder: Folder = {
            id: generateId(),
            name: newFolderName || 'New Folder',
            color,
            setIds: Array.from(selectedSetIds)
        };

        setFolders(prev => [...prev, newFolder]);
        setLibrarySets(prev => prev.map(s => selectedSetIds.has(s.id) ? { ...s, folderId: newFolder.id } : s));

        setSelectedSetIds(new Set());
        setNewFolderName('');
        setIsCreatingFolder(false);
    };

    const handleMoveSet = (setId: string, folderId: string | undefined) => {
        setLibrarySets(prev => prev.map(s => s.id === setId ? { ...s, folderId } : s));
        setMovingSetId(null);
    };

    const handleDeleteFolder = (folderId: string) => {
        const folderSets = librarySets.filter(s => s.folderId === folderId);
        if (folderSets.length > 0) {
            const folder = folders.find(f => f.id === folderId);
            if (folder) {
                setDeleteFolderModal({ id: folderId, name: folder.name, count: folderSets.length });
            }
            return;
        }

        // Empty folder, just delete
        setFolders(prev => prev.filter(f => f.id !== folderId));
        if (currentFolderId === folderId) setCurrentFolderId(null);
    };

    const confirmDeleteFolder = (action: 'move' | 'delete') => {
        if (!deleteFolderModal) return;

        if (action === 'move') {
            // Move sets to library (remove folderId)
            setLibrarySets(prev => prev.map(s => s.folderId === deleteFolderModal.id ? { ...s, folderId: undefined } : s));
        } else {
            // Delete sets
            const setsToDelete = librarySets.filter(s => s.folderId === deleteFolderModal.id).map(s => s.id);
            setsToDelete.forEach(id => onDeleteLibrarySet(id));
        }

        setFolders(prev => prev.filter(f => f.id !== deleteFolderModal.id));
        if (currentFolderId === deleteFolderModal.id) setCurrentFolderId(null);
        setDeleteFolderModal(null);
    };

    const handleStartRenameFolder = (folder: Folder) => {
        setEditingFolderId(folder.id);
        setEditingFolderName(folder.name);
    };

    const handleSaveRenameFolder = () => {
        if (editingFolderId && editingFolderName.trim()) {
            setFolders(prev => prev.map(f => f.id === editingFolderId ? { ...f, name: editingFolderName.trim() } : f));
        }
        setEditingFolderId(null);
        setEditingFolderName('');
    };

    const handleMultistudyFolder = (folderId: string) => {
        const folderSets = librarySets.filter(s => s.folderId === folderId);
        if (folderSets.length === 0) return;

        // Select all sets in folder and trigger multistudy creation logic
        // But we can just reuse the logic directly
        const allCards: Card[] = [];
        folderSets.forEach(set => {
            set.cards.forEach(card => {
                allCards.push({
                    ...card,
                    originalSetId: set.id,
                    originalSetName: set.name
                });
            });
        });

        const newSet: CardSet = {
            id: generateId(),
            name: `Folder Study: ${folders.find(f => f.id === folderId)?.name}`,
            cards: allCards,
            lastPlayed: Date.now(),
            elapsedTime: 0,
            topStreak: 0,
            isSessionActive: true,
            isMultistudy: true,
            customFieldNames: []
        };

        const allCustomFields = new Set<string>();
        folderSets.forEach(s => s.customFieldNames?.forEach(n => allCustomFields.add(n)));
        newSet.customFieldNames = Array.from(allCustomFields);

        handlePlaySet(newSet);
    };

    const handleMoveSelectedToFolder = (folderId: string) => {
        setLibrarySets(prev => prev.map(s => selectedSetIds.has(s.id) ? { ...s, folderId } : s));
        setSelectedSetIds(new Set());
        setMovingSetId(null); // Close any move UI if open
    };

    const handleCreateMultistudy = () => {
        const selectedSets = librarySets.filter(s => selectedSetIds.has(s.id));
        if (selectedSets.length === 0) return;

        const allCards: Card[] = [];
        selectedSets.forEach(set => {
            set.cards.forEach(card => {
                allCards.push({
                    ...card,
                    originalSetId: set.id,
                    originalSetName: set.name
                });
            });
        });

        // Shuffle cards? Or keep order? Usually multistudy implies shuffling.
        // Let's shuffle them for good measure, or let the game handle it.
        // The game shuffles anyway.

        const newSet: CardSet = {
            id: generateId(),
            name: `Multistudy (${selectedSets.length} Sets)`,
            cards: allCards,
            lastPlayed: Date.now(),
            elapsedTime: 0,
            topStreak: 0,
            isSessionActive: true,
            isMultistudy: true,
            customFieldNames: [] // Merge custom fields? Complex. Let's leave empty for now or try to merge unique ones.
        };

        // Merge custom field names
        const allCustomFields = new Set<string>();
        selectedSets.forEach(s => s.customFieldNames?.forEach(n => allCustomFields.add(n)));
        newSet.customFieldNames = Array.from(allCustomFields);

        handlePlaySet(newSet);
        setSelectedSetIds(new Set());
    };

    const handleBatchDelete = () => {
        if (batchDeleteClicks < 2) {
            setBatchDeleteClicks(prev => prev + 1);
        } else {
            // Execute Delete
            selectedSetIds.forEach(id => handleDeleteClick(id, 'library')); // Reusing existing delete logic which might be single-item focused.
            // Actually handleDeleteClick sets a confirm ID. We need direct delete.
            // We need a prop for batch delete or expose setLibrarySets?
            // The prop `onDeleteLibrarySet` is available.
            selectedSetIds.forEach(id => onDeleteLibrarySet(id));
            setSelectedSetIds(new Set());
            setBatchDeleteClicks(0);
        }
    };

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
        setEditingSetId(null);
        setCustomFieldNames([]);
        setBuilderRows([
            { id: '1', term: '', def: '', year: '', image: '', customFields: [], tags: [], star: false },
            { id: '2', term: '', def: '', year: '', image: '', customFields: [], tags: [], star: false },
            { id: '3', term: '', def: '', year: '', image: '', customFields: [], tags: [], star: false }
        ]);
        const defaultName = "New Set " + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).replace(',', '');
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
        handleSaveToLibrary();
        setShowUnsavedModal(false);
    };

    // --- BUILDER SYNC LOGIC ---

    const syncToRaw = () => {
        const text = builderRows
            .filter(r => r.term.trim() || r.def.trim())
            .map(r => {
                // Prepend tags to term if they exist (though in visual mode, tags are likely already in term if typed manually)
                // But if we have tags in r.tags (from loading), we should ensure they are in the raw text.
                // However, if the user typed "(Tag) Term" in the input, r.term already has it.
                // If we separate them, we need to reconstruct.
                // Let's assume r.term is the source of truth for visual builder.

                let line = `${r.term.trim()} / ${r.def.trim()}`;
                if (r.year.trim()) line += ` /// ${r.year.trim()}`;
                if (r.image.trim()) line += ` ||| ${r.image.trim()}`;

                // Add Custom Fields
                if (r.customFields.length > 0) {
                    if (!r.image.trim()) line += ` ||| `;
                    line += ` , `;
                    r.customFields.forEach(f => {
                        line += `(${f.name})(${f.value})`;
                    });
                }

                // Tags are now part of the term in markdown, so we don't need %%TAGS%% syntax anymore for export/raw
                // unless we want to support legacy? No, user said "use markdown to add tags".

                if (r.star) {
                    line += ` %%STAR%%`;
                }

                return line;
            })
            .join('\n\n&&&\n\n'); // New Separator
        setRawText(text);
    };

    const syncToRows = () => {
        const parsed = parseInput(rawText);
        const rows: BuilderRow[] = parsed.map((c, i) => {
            // When syncing to rows, we put the tags back into the term for visual editing
            let term = c.term?.[0] || '';
            if (c.tags && c.tags.length > 0) {
                const tagPrefix = c.tags.map(t => `(${t})`).join(' ');
                term = `${tagPrefix} ${term}`;
            }

            return {
                id: generateId() + i,
                term: term,
                def: c.content || '',
                year: c.year || '',
                image: c.image || '',
                customFields: c.customFields || [],
                tags: c.tags || [],
                star: c.star || false
            };
        });
        // Extract unique custom field names from parsed rows
        const allNames = new Set<string>();
        rows.forEach(r => r.customFields.forEach(f => allNames.add(f.name)));
        setCustomFieldNames(Array.from(allNames));

        // Ensure at least 3 rows
        while (rows.length < 3) {
            rows.push({ id: generateId(), term: '', def: '', year: '', image: '', customFields: [], tags: [], star: false });
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
        setEditingSetId(set.id);
        const rows = set.cards.map((c, i) => {
            let term = c.term[0] || '';
            if (c.tags && c.tags.length > 0) {
                const tagPrefix = c.tags.map(t => `(${t})`).join(' ');
                term = `${tagPrefix} ${term}`;
            }

            return {
                id: generateId() + i,
                term: term,
                def: c.content || '',
                year: c.year || '',
                image: c.image || '',
                customFields: c.customFields || [],
                tags: c.tags || [],
                originalCardId: c.id,
                star: c.star || false
            };
        });

        // Extract custom field names
        const allNames = new Set<string>();
        if (set.customFieldNames) {
            set.customFieldNames.forEach(n => allNames.add(n));
        } else {
            rows.forEach(r => r.customFields.forEach(f => allNames.add(f.name)));
        }
        setCustomFieldNames(Array.from(allNames));

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
                const rows = parsed.map((c, i) => {
                    let term = c.term?.[0] || '';
                    if (c.tags && c.tags.length > 0) {
                        const tagPrefix = c.tags.map(t => `(${t})`).join(' ');
                        term = `${tagPrefix} ${term}`;
                    }
                    return {
                        id: generateId() + i,
                        term: term,
                        def: c.content || '',
                        year: c.year || '',
                        image: c.image || '',
                        customFields: c.customFields || [],
                        tags: c.tags || [],
                        star: c.star || false
                    };
                });
                setBuilderRows(rows);
            }

            if (cards.length > 0 && builderMode === 'visual') {
                const rows = cards.map((c, i) => {
                    let term = c.term?.[0] || '';
                    if (c.tags && c.tags.length > 0) {
                        const tagPrefix = c.tags.map(t => `(${t})`).join(' ');
                        term = `${tagPrefix} ${term}`;
                    }
                    return {
                        id: generateId() + i,
                        term: term,
                        def: c.content || '',
                        year: c.year || '',
                        image: c.image || '',
                        customFields: c.customFields || [],
                        tags: c.tags || [],
                        star: c.star || false
                    };
                });
                setBuilderRows(rows);
            } else if (builderMode === 'raw') {
                setRawText(text);
            }

            setSetName(loadedName);
            setView('builder'); // Force to builder view
        }
    };

    const getCardsFromState = (): (Partial<Card> & { originalCardId?: string })[] => {
        if (builderMode === 'visual') {
            return builderRows
                .filter(r => r.term.trim() || r.def.trim())
                .map(r => {
                    // Parse tags from term string for the Card object
                    let termRaw = r.term; // Don't trim yet
                    let tags: string[] = [];

                    const tagRegex = /^(\s*\([^)]+\)\s*)+/;
                    const tagMatch = termRaw.match(tagRegex);

                    if (tagMatch) {
                        const fullTagString = tagMatch[0];
                        const extractedTags = fullTagString.match(/\(([^)]+)\)/g)?.map(t => t.slice(1, -1).trim()) || [];
                        tags = extractedTags;
                        termRaw = termRaw.replace(tagRegex, '');
                    }

                    termRaw = termRaw.trim();

                    return {
                        term: [termRaw],
                        content: r.def.trim(),
                        year: r.year.trim() || undefined,
                        image: r.image.trim() || undefined,
                        customFields: r.customFields,
                        tags: tags, // Use extracted tags
                        star: r.star,
                        mastery: 0,
                        originalCardId: r.originalCardId
                    };
                });
        } else {
            return parseInput(rawText);
        }
    };

    const handleStartSessionNow = () => {
        const cards = getCardsFromState();
        if (cards.length === 0) return;

        if (!setName.trim()) {
            alert("Please enter a set name.");
            return;
        }

        // Validation: Check for empty terms or definitions
        const hasEmptyFields = cards.some(c => !c.term?.[0]?.trim() || !c.content?.trim());
        if (hasEmptyFields) {
            setWarningModal({
                isOpen: true,
                message: "Some cards have empty terms or definitions. Are you sure you want to start?",
                onConfirm: () => {
                    proceedStartSession(cards);
                }
            });
            return;
        }

        proceedStartSession(cards);
    };

    const proceedStartSession = (cards: (Partial<Card> & { originalCardId?: string })[]) => {
        const fullCards: Card[] = cards.map((c, i) => ({
            id: generateId() + i,
            term: c.term || ['?'],
            content: c.content || '',
            year: c.year,
            image: c.image,
            mastery: 0,
            star: c.star || false,
            customFields: c.customFields || [],
            tags: c.tags || []
        }));

        const newSet: CardSet = {
            id: generateId(),
            name: setName || 'Untitled Set',
            cards: fullCards,
            customFieldNames: customFieldNames,
            lastPlayed: Date.now(),
            elapsedTime: 0,
            topStreak: 0,
            isSessionActive: true
        };

        handlePlaySet(newSet);
    };



    const handleSaveToLibrary = () => {
        if (!setName.trim()) {
            alert("Please name your set!");
            return;
        }

        const cards: Card[] = builderRows
            .filter(row => row.term.trim() || row.def.trim())
            .map(row => {
                // Parse tags from term string
                let termRaw = row.term.trim();
                let tags: string[] = [];

                const tagRegex = /^(\s*\([^)]+\)\s*)+/;
                const tagMatch = termRaw.match(tagRegex);

                if (tagMatch) {
                    const fullTagString = tagMatch[0];
                    const extractedTags = fullTagString.match(/\(([^)]+)\)/g)?.map(t => t.slice(1, -1).trim()) || [];
                    tags = extractedTags;
                    termRaw = termRaw.replace(tagRegex, '').trim();
                }

                return {
                    id: generateId(),
                    term: [termRaw],
                    content: row.def.trim(),
                    year: row.year.trim(),
                    image: row.image,
                    customFields: row.customFields,
                    mastery: 0,
                    star: row.star,
                    tags: tags,
                    originalSetId: editingSetId || undefined,
                    originalSetName: setName
                };
            });

        if (cards.length === 0) {
            alert("Please add at least one card!");
            return;
        }

        const newSet: CardSet = {
            id: editingSetId || generateId(),
            name: setName,
            cards,
            lastPlayed: Date.now(),
            elapsedTime: 0,
            topStreak: 0,
            customFieldNames: customFieldNames,
            folderId: currentFolderId || undefined
        };

        if (editingSetId) {
            const oldSet = librarySets.find(s => s.id === editingSetId);
            if (oldSet) {
                newSet.folderId = oldSet.folderId;
            }
        }

        onSaveToLibrary(newSet);

        setBuilderRows([
            { id: '1', term: '', def: '', year: '', image: '', customFields: [], tags: [], star: false },
            { id: '2', term: '', def: '', year: '', image: '', customFields: [], tags: [], star: false },
            { id: '3', term: '', def: '', year: '', image: '', customFields: [], tags: [], star: false }
        ]);
        setSetName('');
        setEditingSetId(null);
        setView('menu');
        setShowUnsavedModal(false);
    };

    const handleDownloadFlashcards = () => {
        let content = rawText;
        content = builderRows
            .filter(r => r.term.trim() || r.def.trim())
            .map(r => {
                let line = `${r.term.trim()} / ${r.def.trim()}`;
                if (r.year.trim()) line += ` /// ${r.year.trim()}`;
                if (r.image.trim()) line += ` ||| ${r.image.trim()}`;

                if (r.customFields.length > 0) {
                    if (!r.image.trim()) line += ` ||| `;
                    line += ` , `;
                    r.customFields.forEach(f => {
                        line += `(${f.name})(${f.value})`;
                    });
                }


                if (r.star) {
                    line += ` %%STAR%%`;
                }

                return line;
            })
            .join('\n\n&&&\n\n');

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
                    if (r.image.trim()) line += ` ||| ${r.image.trim()}`;

                    if (r.customFields.length > 0) {
                        if (!r.image.trim()) line += ` ||| `;
                        line += ` , `;
                        r.customFields.forEach(f => {
                            line += `(${f.name})(${f.value})`;
                        });
                    }

                    if (r.star) {
                        line += ` %%STAR%%`;
                    }
                    return line;
                })
                .join('\n\n&&&\n\n');
        }
        navigator.clipboard.writeText(content);
        alert("Copied to clipboard!");
    };

    // --- HELPER FOR VISUAL BUILDER ---

    const addRow = () => {
        setBuilderRows(prev => [...prev, { id: generateId(), term: '', def: '', year: '', image: '', customFields: [], tags: [], star: false }]);
    };

    const updateRow = (id: string, field: keyof BuilderRow, value: any) => {
        setBuilderRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    };

    const removeRow = (id: string) => {
        if (builderRows.length <= 1) {
            // Don't delete last row, just clear it
            setBuilderRows([{ id: generateId(), term: '', def: '', year: '', image: '', customFields: [], tags: [], star: false }]);
            return;
        }
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

    const handlePlaySet = (set: CardSet) => {
        if (settings.starredOnly) {
            const hasStarred = set.cards.some(c => c.star);
            if (!hasStarred) {
                setNoStarredModalSet(set);
                return;
            }
        }
        onStartFromLibrary(set);
    };

    const handleResumeSet = (set: CardSet) => {
        if (settings.starredOnly) {
            const hasStarred = set.cards.some(c => c.star);
            if (!hasStarred) {
                setNoStarredModalSet(set);
                return;
            }
        }
        onResumeSession(set);
    };



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

            <WarningModal
                isOpen={warningModal.isOpen}
                onClose={() => setWarningModal(prev => ({ ...prev, isOpen: false }))}
                onConfirm={warningModal.onConfirm}
                message={warningModal.message}
            />



            <NoStarredModal
                isOpen={!!noStarredModalSet}
                onClose={() => setNoStarredModalSet(null)}
                onDisableAndPlay={() => {
                    if (noStarredModalSet) {
                        onUpdateSettings({ ...settings, starredOnly: false });
                        if (noStarredModalSet.isSessionActive) {
                            onResumeSession(noStarredModalSet);
                        } else {
                            onStartFromLibrary(noStarredModalSet);
                        }
                        setNoStarredModalSet(null);
                    }
                }}
            />

            <DeleteFolderModal
                isOpen={!!deleteFolderModal}
                folderName={deleteFolderModal?.name || ''}
                setCount={deleteFolderModal?.count || 0}
                onClose={() => setDeleteFolderModal(null)}
                onConfirm={confirmDeleteFolder}
            />

            <MarkdownHelpModal isOpen={showMarkdownHelp} onClose={() => setShowMarkdownHelp(false)} />
            <input ref={fileInputRef} type="file" accept=".json,.txt,.flashcards" className="hidden" onChange={handleFileUpload} />

            {/* Header */}
            <div className="mb-10 text-left">
                {view === 'menu' && (
                    <div className="text-accent font-mono text-sm mb-1 tracking-widest uppercase opacity-80">{currentDate}</div>
                )}
                <div className="flex items-center justify-between">
                    <h1 className="text-4xl font-bold text-text tracking-tight mb-2">
                        {view === 'menu' ? greeting : 'List Builder'}
                    </h1>

                </div>
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
                    <div className="max-w-4xl mx-auto">
                        {/* LIBRARY COLUMN */}
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-2 pl-2">
                                    {currentFolderId ? (
                                        <button onClick={() => setCurrentFolderId(null)} className="flex items-center gap-1 hover:text-text transition-colors">
                                            <ArrowLeft size={14} /> {currentFolder?.name}
                                        </button>
                                    ) : (
                                        "Library"
                                    )}
                                </h3>
                                <div className="flex gap-2">
                                    {currentFolderId && (
                                        <button
                                            onClick={() => handleMultistudyFolder(currentFolderId)}
                                            className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 text-accent border border-accent/20 rounded-lg text-xs font-bold hover:bg-accent/20 transition-colors"
                                        >
                                            <Play size={14} /> Study Folder
                                        </button>
                                    )}
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
                                <div className="space-y-8">
                                    {/* Folders Section */}
                                    {!currentFolderId && displayedFolders.length > 0 && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                            {displayedFolders.map(folder => {
                                                const folderSets = librarySets.filter(s => s.folderId === folder.id);
                                                const colorMap = {
                                                    brown: 'bg-accent/20 border-accent text-accent',
                                                    red: 'bg-red/20 border-red text-red',
                                                    blue: 'bg-blue/20 border-blue text-blue',
                                                    yellow: 'bg-yellow/20 border-yellow text-yellow',
                                                    green: 'bg-green/20 border-green text-green',
                                                    purple: 'bg-purple/20 border-purple text-purple'
                                                };

                                                return (
                                                    <div key={folder.id} className={clsx("border rounded-2xl p-4 transition-all cursor-pointer hover:scale-[1.02]", colorMap[folder.color], movingSetId ? "ring-2 ring-offset-2 ring-offset-bg ring-accent" : "")}
                                                        onClick={() => {
                                                            if (editingFolderId === folder.id) return;
                                                            if (movingSetId) handleMoveSet(movingSetId, folder.id);
                                                            else setCurrentFolderId(folder.id);
                                                        }}
                                                    >
                                                        <div className="flex justify-between items-center">
                                                            <div className="flex items-center gap-2 font-bold flex-1">
                                                                <FolderOpen size={18} />
                                                                {editingFolderId === folder.id ? (
                                                                    <input
                                                                        type="text"
                                                                        value={editingFolderName}
                                                                        onChange={(e) => setEditingFolderName(e.target.value)}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') handleSaveRenameFolder();
                                                                            if (e.key === 'Escape') setEditingFolderId(null);
                                                                        }}
                                                                        onBlur={handleSaveRenameFolder}
                                                                        autoFocus
                                                                        className="bg-transparent border-b border-current outline-none w-full"
                                                                        onClick={(e) => e.stopPropagation()}
                                                                    />
                                                                ) : (
                                                                    <span>{folder.name}</span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-1">
                                                                <span className="text-xs opacity-70 font-mono mr-2">{folderSets.length} sets</span>

                                                                {selectedSetIds.size === 0 && (
                                                                    <>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); handleStartRenameFolder(folder); }}
                                                                            className="p-1 hover:bg-black/10 rounded"
                                                                            title="Rename Folder"
                                                                        >
                                                                            <Pencil size={14} />
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id); }}
                                                                            className="p-1 hover:bg-black/10 rounded"
                                                                            title="Delete Folder"
                                                                        >
                                                                            <X size={14} />
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Sets List */}
                                    <div className="space-y-3">
                                        {movingSetId && (
                                            <div
                                                className="bg-panel-2 border border-dashed border-accent p-4 rounded-xl text-center mb-4 cursor-pointer hover:bg-accent/10 transition-colors"
                                                onClick={() => handleMoveSet(movingSetId, undefined)}
                                            >
                                                <span className="text-sm font-bold text-accent">Move here (Remove from folder)</span>
                                            </div>
                                        )}

                                        {displayedSets.map(set => (
                                            <div key={set.id} className="relative group/row">
                                                {/* Checkbox - Left Wing */}
                                                <div className="absolute -left-12 top-1/2 -translate-y-1/2 w-12 flex justify-center">
                                                    <div
                                                        onClick={() => handleToggleSelect(set.id)}
                                                        className={clsx(
                                                            "w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all",
                                                            selectedSetIds.has(set.id) ? "bg-accent border-accent" : "border-outline hover:border-accent"
                                                        )}
                                                    >
                                                        {selectedSetIds.has(set.id) && <div className="w-2.5 h-1.5 border-b-2 border-l-2 border-bg -rotate-45 -mt-0.5" />}
                                                    </div>
                                                </div>

                                                <div className="group bg-panel border border-outline p-5 rounded-2xl hover:border-accent transition-all shadow-sm flex flex-col justify-between h-full">
                                                    <div className="flex justify-between items-start mb-4">
                                                        <div>
                                                            <div className="font-bold text-lg text-text group-hover:text-accent transition-colors">{set.name}</div>
                                                            <div className="text-xs text-muted font-mono">{set.cards.length} card{set.cards.length === 1 ? '' : 's'}</div>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            {selectedSetIds.size === 0 && (
                                                                <>
                                                                    <button
                                                                        onClick={() => setMovingSetId(set.id)}
                                                                        className={clsx("p-1.5 rounded hover:bg-panel-2 transition-all", movingSetId === set.id ? "text-accent animate-pulse" : "text-muted hover:text-text")}
                                                                        title="Move to Folder"
                                                                    >
                                                                        <FolderOpen size={16} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleLoadSetToBuilder(set)}
                                                                        className="p-1.5 text-muted hover:text-text rounded hover:bg-panel-2 transition-all"
                                                                        title="Edit"
                                                                    >
                                                                        <Pencil size={16} />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => onViewPreview({ set, mode: 'library' })}
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
                                                                        onClick={() => onDuplicateLibrarySet(set.id)}
                                                                        className="p-1.5 text-muted hover:text-text rounded hover:bg-panel-2 transition-all"
                                                                        title="Duplicate Set"
                                                                    >
                                                                        <Copy size={16} />
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
                                                                </>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="pt-2 mt-2 flex gap-2 relative z-10">
                                                        {set.isSessionActive ? (
                                                            <>
                                                                <button
                                                                    onClick={() => handleResumeSet(set)}
                                                                    className="flex-1 px-4 py-2 bg-accent text-bg text-sm font-bold rounded-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/20"
                                                                >
                                                                    <Play size={14} fill="currentColor" /> Resume
                                                                </button>
                                                                <button
                                                                    onClick={() => handlePlaySet(set)}
                                                                    className="px-4 py-2 bg-panel-2 border border-outline hover:border-accent text-text text-sm font-bold rounded-lg hover:bg-panel-3 transition-all flex items-center justify-center gap-2"
                                                                    title="Restart Session"
                                                                >
                                                                    <RotateCcw size={14} />
                                                                </button>
                                                            </>
                                                        ) : (
                                                            <button
                                                                onClick={() => handlePlaySet(set)}
                                                                className="w-full px-4 py-2 bg-panel-2 border border-outline hover:border-accent text-text text-sm font-bold rounded-lg hover:bg-accent hover:text-bg transition-all flex items-center justify-center gap-2"
                                                            >
                                                                <Play size={14} fill="currentColor" /> Play
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Multistudy Sets */}
                                    {multistudySets.length > 0 && (
                                        <div className="space-y-3 pt-6 border-t border-outline/50">
                                            <h3 className="text-xs font-bold uppercase tracking-widest text-muted mb-2">Multistudy Sessions</h3>
                                            {multistudySets.map(set => (
                                                <div key={set.id} className="group bg-panel-2 border border-outline p-5 rounded-2xl hover:border-accent transition-all shadow-sm flex flex-col justify-between h-full relative overflow-hidden">
                                                    <div className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{
                                                        backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 20px, transparent 20px, transparent 40px)'
                                                    }}></div>
                                                    <div className="absolute top-0 left-0 w-1 h-full bg-accent/50"></div>
                                                    <div className="flex justify-between items-start mb-4 pl-2 relative z-10">
                                                        <div>
                                                            <div className="font-bold text-lg text-text group-hover:text-accent transition-colors">{set.name}</div>
                                                            <div className="text-xs text-muted font-mono">{set.cards.length} cards</div>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteClick(set.id, 'library');
                                                                }}
                                                                className={clsx(
                                                                    "p-1.5 rounded transition-all flex items-center justify-center",
                                                                    deleteConfirmId === set.id ? "bg-red text-bg w-12" : "text-muted hover:text-red hover:border-red"
                                                                )}
                                                                title="Delete Session"
                                                            >
                                                                {deleteConfirmId === set.id ? <span className="text-[10px] font-bold uppercase">Sure?</span> : <Trash2 size={16} />}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    <div className="pt-2 mt-2 flex gap-2 pl-2 relative z-10">
                                                        <button
                                                            onClick={() => handleResumeSet(set)}
                                                            className="flex-1 px-4 py-2 bg-accent text-bg text-sm font-bold rounded-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 shadow-lg shadow-accent/20"
                                                        >
                                                            <Play size={14} fill="currentColor" /> Resume
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}


                                    {/* Floating Action Bar */}
                                    {selectedSetIds.size > 0 && (
                                        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-panel border border-outline shadow-2xl p-2 rounded-2xl animate-in slide-in-from-bottom-4">
                                            <div className="pl-4 pr-2 text-sm font-bold text-text">
                                                {selectedSetIds.size} selected
                                            </div>
                                            <div className="h-6 w-px bg-outline"></div>
                                            <button
                                                onClick={handleCreateMultistudy}
                                                className="px-6 py-2 bg-accent text-bg font-bold rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg"
                                            >
                                                Multistudy
                                            </button>
                                            <button
                                                onClick={handleCreateFolder}
                                                className="px-6 py-2 bg-panel-2 border border-outline text-text font-bold rounded-xl hover:bg-panel-3 transition-all shadow-lg"
                                            >
                                                New Folder
                                            </button>
                                            {folders.length > 0 && (
                                                <div className="relative group">
                                                    <button className="px-6 py-2 bg-panel-2 border border-outline text-text font-bold rounded-xl hover:bg-panel-3 transition-all shadow-lg flex items-center gap-2">
                                                        Move to...
                                                    </button>
                                                    <div className="absolute bottom-full left-0 mb-2 w-48 bg-panel border border-outline rounded-xl shadow-xl p-2 hidden group-hover:block animate-in fade-in slide-in-from-bottom-2">
                                                        {folders.map(f => (
                                                            <button
                                                                key={f.id}
                                                                onClick={() => handleMoveSelectedToFolder(f.id)}
                                                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-panel-2 text-sm font-medium flex items-center gap-2"
                                                            >
                                                                <div className={clsx("w-2 h-2 rounded-full", {
                                                                    'bg-accent': f.color === 'brown',
                                                                    'bg-red': f.color === 'red',
                                                                    'bg-blue': f.color === 'blue',
                                                                    'bg-yellow': f.color === 'yellow',
                                                                    'bg-green': f.color === 'green',
                                                                    'bg-purple': f.color === 'purple',
                                                                })} />
                                                                {f.name}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            <button
                                                onClick={handleBatchDelete}
                                                className={clsx(
                                                    "px-6 py-2 font-bold rounded-xl transition-all border border-transparent",
                                                    batchDeleteClicks > 0 ? "bg-red text-bg animate-pulse" : "bg-panel-2 text-red hover:bg-red/10"
                                                )}
                                            >
                                                {batchDeleteClicks === 0 ? "Delete" : (batchDeleteClicks === 1 ? "Click 2x" : "Click 1x")}
                                            </button>
                                        </div>
                                    )}

                                    {/* Folder Creation Modal */}
                                    {isCreatingFolder && (
                                        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onClick={() => setIsCreatingFolder(false)}>
                                            <div className="bg-panel border border-outline rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                                                <h3 className="text-lg font-bold text-text mb-4">Create Folder</h3>
                                                <input
                                                    autoFocus
                                                    value={newFolderName}
                                                    onChange={(e) => setNewFolderName(e.target.value)}
                                                    placeholder="Folder Name"
                                                    className="w-full bg-panel-2 border border-outline rounded-xl px-4 py-3 text-text mb-6 focus:outline-none focus:border-accent font-bold"
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') confirmCreateFolder();
                                                    }}
                                                />
                                                <div className="grid grid-cols-6 gap-2 mb-6">
                                                    {(['brown', 'red', 'blue', 'yellow', 'green', 'purple'] as const).map(color => (
                                                        <button
                                                            key={color}
                                                            onClick={() => setNewFolderColor(color)}
                                                            className={clsx(
                                                                "w-8 h-8 rounded-full border-2 transition-all",
                                                                color === 'brown' && "bg-accent border-accent",
                                                                color === 'red' && "bg-red border-red",
                                                                color === 'blue' && "bg-blue border-blue",
                                                                color === 'yellow' && "bg-yellow border-yellow",
                                                                color === 'green' && "bg-green border-green",
                                                                color === 'purple' && "bg-purple border-purple",
                                                                newFolderColor === color ? "scale-110 ring-2 ring-offset-2 ring-offset-panel ring-text" : "opacity-70 hover:opacity-100 hover:scale-105"
                                                            )}
                                                            title={color}
                                                        />
                                                    ))}
                                                </div>
                                                <div className="flex justify-end gap-2">
                                                    <button onClick={() => setIsCreatingFolder(false)} className="px-4 py-2 text-muted hover:text-text">Cancel</button>
                                                    <button onClick={() => confirmCreateFolder(newFolderColor)} className="px-6 py-2 bg-text text-bg font-bold rounded-lg hover:bg-text/90 transition-colors">OK</button>
                                                </div>
                                            </div>
                                        </div>
                                    )}    </div>
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

                                    {/* Custom Fields Manager */}
                                    <div className="flex items-center gap-2" ref={customFieldsRef}>
                                        <div className="relative">
                                            <button
                                                onClick={() => setIsCustomFieldsOpen(!isCustomFieldsOpen)}
                                                className={clsx(
                                                    "flex items-center gap-2 px-3 py-1.5 bg-panel-2 border border-outline rounded-lg text-sm font-medium transition-all",
                                                    isCustomFieldsOpen ? "text-accent border-accent" : "text-muted hover:text-text hover:border-accent"
                                                )}
                                            >
                                                <Plus size={16} /> Custom Fields
                                            </button>
                                            {isCustomFieldsOpen && (
                                                <div className="absolute top-full right-0 mt-2 w-64 bg-panel border border-outline rounded-xl shadow-xl p-4 z-50 animate-in fade-in zoom-in-95">
                                                    <h4 className="text-xs font-bold text-muted uppercase mb-2">Manage Fields</h4>
                                                    <div className="space-y-2 mb-3">
                                                        {customFieldNames.map(name => (
                                                            <div key={name} className="flex justify-between items-center bg-panel-2 px-2 py-1 rounded">
                                                                <span className="text-sm">{name}</span>
                                                                <button onClick={() => setCustomFieldNames(prev => prev.filter(n => n !== name))} className="text-red hover:text-red/80"><X size={14} /></button>
                                                            </div>
                                                        ))}
                                                        {customFieldNames.length === 0 && <div className="text-xs text-muted italic">No custom fields</div>}
                                                    </div>
                                                    <div className="flex gap-2">
                                                        <input
                                                            value={newCustomFieldName}
                                                            onChange={(e) => setNewCustomFieldName(e.target.value)}
                                                            placeholder="New Field"
                                                            className="flex-1 bg-panel-2 border border-outline rounded px-2 py-1 text-sm focus:border-accent focus:outline-none"
                                                        />
                                                        <button
                                                            onClick={() => {
                                                                if (newCustomFieldName.trim() && !customFieldNames.includes(newCustomFieldName.trim())) {
                                                                    if (customFieldNames.length >= 2) {
                                                                        alert("Max 2 custom fields allowed.");
                                                                        return;
                                                                    }
                                                                    setCustomFieldNames(prev => [...prev, newCustomFieldName.trim()]);
                                                                    setNewCustomFieldName('');
                                                                }
                                                            }}
                                                            className="p-1 bg-accent text-bg rounded hover:scale-105 transition-transform"
                                                        >
                                                            <Plus size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>

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
                                                customFieldNames={customFieldNames}
                                                updateRow={updateRow}
                                                removeRow={removeRow}
                                                onAddNext={addRow}
                                                onOpenImageModal={() => {
                                                    setEditingImageRowId(row.id);
                                                    setShowImageModal(true);
                                                }}
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
                                            placeholder={`Term / Definition /// Year ||| ImageURL\n\n&&&\n\nNext Term / Definition`}
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
                                        onClick={handleSaveToLibrary}
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
        </div >
    );
};