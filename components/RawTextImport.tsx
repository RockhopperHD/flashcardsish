import React, { useState, useMemo, useEffect } from 'react';
import { Card, Settings } from '../types';
import clsx from 'clsx';
import { ArrowLeft, ArrowRight, AlertCircle, Check, X, ChevronDown } from 'lucide-react';
import { CursorTooltip } from './CursorTooltip';
import { CardPreview } from './CardPreview';
import { COMMON_CARD_SEPARATORS, COMMON_TERM_DEFINITION_SEPARATORS, parseRawImportCards } from '../src/rawImport';

interface RawTextImportProps {
    onClose: () => void; // Modal close logic ("Leave without saving" or just back)
    onContinue: (cards: Partial<Card>[], append: boolean, overrideStrategy: 'keep' | 'duplicate' | 'override') => void;
    // onOpenSettings removed as settings are now global
    rawText: string;
    setRawText: (text: string) => void;
    settings?: Settings;
    isModal?: boolean;
}

export const RawTextImport: React.FC<RawTextImportProps> = ({
    onClose,
    onContinue,
    rawText,
    setRawText,
    settings,
    isModal = false,
}) => {
    // Import Strategies
    const [importAppend, setImportAppend] = useState(true);
    const [importOverride, setImportOverride] = useState<'keep' | 'duplicate' | 'override'>('keep');

    const [isAppendOpen, setIsAppendOpen] = useState(false);
    const [isOverrideOpen, setIsOverrideOpen] = useState(false);
    const appendRef = React.useRef<HTMLDivElement>(null);
    const overrideRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (appendRef.current && !appendRef.current.contains(event.target as Node)) {
                setIsAppendOpen(false);
            }
            if (overrideRef.current && !overrideRef.current.contains(event.target as Node)) {
                setIsOverrideOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    // const [rawText, setRawText] = useState(''); // Lifted to parent

    // Separator States
    const [termDefSep, setTermDefSep] = useState('/');
    const [customTermDef, setCustomTermDef] = useState('');
    const [isCustomTermDef, setIsCustomTermDef] = useState(false);

    const [cardSep, setCardSep] = useState('\\n\\n');
    const [customCardSep, setCustomCardSep] = useState('');
    const [isCustomCardSep, setIsCustomCardSep] = useState(false);

    // Bullet Point Logic
    const [bulletMarker, setBulletMarker] = useState('>');
    const [useBulletMarker, setUseBulletMarker] = useState(false);

    // Parsing Logic
    const parsedCards = useMemo(() => {
        if (!rawText.trim()) return [];

        const resolvedCardSep = (isCustomCardSep ? customCardSep : cardSep).replace(/\\n/g, '\n');
        const resolvedTermDefSep = isCustomTermDef ? customTermDef : termDefSep;

        return parseRawImportCards(rawText, {
            termDefinitionSeparator: resolvedTermDefSep,
            cardSeparator: resolvedCardSep,
            useBulletMarker,
            bulletMarker
        });
    }, [rawText, termDefSep, customTermDef, isCustomTermDef, cardSep, customCardSep, isCustomCardSep, bulletMarker, useBulletMarker]);


    // Preview Logic
    const [previewIndex, setPreviewIndex] = useState(0);

    useEffect(() => {
        if (!isModal) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isModal, onClose]);

    useEffect(() => {
        // Reset if index out of bounds
        if (parsedCards.length > 0 && previewIndex >= parsedCards.length) {
            setPreviewIndex(0);
        }
    }, [parsedCards.length, previewIndex]);

    const handlePrevCard = () => {
        setPreviewIndex(prev => {
            if (prev === 0) return Math.min(parsedCards.length, 10) - 1;
            return prev - 1;
        });
    };

    const handleNextCard = () => {
        setPreviewIndex(prev => {
            if (prev >= Math.min(parsedCards.length, 10) - 1) return 0;
            return prev + 1;
        });
    };

    const previewCard = parsedCards.length > 0 ? parsedCards[previewIndex] : null;

    // Render Helpers
    const renderRadioGroup = (
        label: string,
        options: string[],
        selected: string,
        setSelected: (val: string) => void,
        isCustom: boolean,
        setIsCustom: (val: boolean) => void,
        customVal: string,
        setCustomVal: (val: string) => void,
        footer?: React.ReactNode
    ) => {
        return (
            <div className="bg-panel-2 p-4 rounded-xl border border-outline flex flex-col h-full">
                <h4 className="text-sm font-bold text-muted mb-3 shrink-0">{label}</h4>
                <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar">
                    {options.map(opt => (
                        <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                            <div className={clsx(
                                "w-4 h-4 rounded-full border flex items-center justify-center transition-colors",
                                !isCustom && selected === opt ? "border-accent bg-accent" : "border-muted group-hover:border-text"
                            )}>
                                {!isCustom && selected === opt && <div className="w-1.5 h-1.5 bg-bg rounded-full" />}
                            </div>
                            <input
                                type="radio"
                                className="hidden"
                                checked={!isCustom && selected === opt}
                                onChange={() => { setIsCustom(false); setSelected(opt); }}
                            />
                            <code className="text-xs font-mono bg-panel px-1 py-0.5 rounded text-text group-hover:text-accent transition-colors">
                                {opt.replace(/\n/g, '\\n')}
                            </code>
                        </label>
                    ))}

                    {/* Custom Option */}
                    <label className="flex items-center gap-3 cursor-pointer group mt-2">
                        <div className={clsx(
                            "w-4 h-4 rounded-full border flex items-center justify-center transition-colors shrink-0",
                            isCustom ? "border-accent bg-accent" : "border-muted group-hover:border-text"
                        )}>
                            {isCustom && <div className="w-1.5 h-1.5 bg-bg rounded-full" />}
                        </div>
                        <input
                            type="radio"
                            className="hidden"
                            checked={isCustom}
                            onChange={() => setIsCustom(true)}
                        />
                        <input
                            type="text"
                            placeholder="Custom"
                            value={customVal}
                            onChange={(e) => {
                                setCustomVal(e.target.value);
                                if (!isCustom) setIsCustom(true);
                            }}
                            onClick={(e) => {
                                // e.stopPropagation(); // Don't trigger radio click if just focusing? 
                                // Actually radio click is handled by label parent
                                if (!isCustom) setIsCustom(true);
                            }}
                            className={clsx(
                                "w-full bg-panel border rounded px-2 py-1 text-xs font-mono focus:border-accent outline-none",
                                isCustom ? "border-accent text-text" : "border-outline text-muted"
                            )}
                        />
                    </label>
                </div>
                {footer}
            </div>
        );
    };

    return (
        <div className={clsx(
            "max-w-6xl mx-auto w-full flex flex-col animate-in fade-in duration-500",
            isModal ? "h-full" : "min-h-[500px]"
        )}>
            {isModal && (
                <div className="p-6 border-b border-outline shrink-0 bg-panel-2 rounded-t-2xl">
                    <div className="flex items-center justify-between gap-4">
                        <h2
                            className="text-2xl text-text"
                            style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}
                        >
                            Raw Text Import
                        </h2>
                        <button
                            onClick={onClose}
                            className="text-muted hover:text-text p-2 rounded-lg hover:bg-panel-2 transition-colors"
                            aria-label="Close"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}

            <div className={clsx("flex-1 flex flex-col", isModal && "p-6 overflow-y-auto")}>
                {/* Description Row - Full Width */}
                <p className="text-sm text-text leading-relaxed mb-6 shrink-0 max-w-4xl">
                    To import a set from another application, export it as text and paste it here. You can also use a text editor like Google Docs to write your cards quickly, then paste them here to import them. After importing as raw text, you can adjust your cards with the Visual Editor.
                </p>

                {/* Main Content Grid */}
                <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 pb-6">

                    {/* Left Column: Text Input (Span 4) - Narrower */}
                    <div className="lg:col-span-4 flex flex-col min-h-[400px]">
                        <div className="relative flex-1 flex flex-col">
                            <textarea
                                value={rawText}
                                onChange={(e) => setRawText(e.target.value)}
                                placeholder="Paste text here..."
                                className="w-full flex-1 p-4 bg-panel-2 border border-outline rounded-2xl resize-none focus:border-accent outline-none text-sm font-mono leading-relaxed custom-scrollbar h-full min-h-[400px]"
                            />
                        </div>
                    </div>

                    {/* Right Column: Settings & Preview (Span 8) - Wider */}
                    <div className="lg:col-span-8 flex flex-col gap-6 pr-2">

                        {/* Separators Configuration - Fixed Height Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0">
                            {renderRadioGroup(
                                "Between Term & Definition",
                                COMMON_TERM_DEFINITION_SEPARATORS,
                                termDefSep,
                                setTermDefSep,
                                isCustomTermDef,
                                setIsCustomTermDef,
                                customTermDef,
                                setCustomTermDef
                            )}

                            {renderRadioGroup(
                                "Between Cards",
                                COMMON_CARD_SEPARATORS,
                                cardSep,
                                setCardSep,
                                isCustomCardSep,
                                setIsCustomCardSep,
                                customCardSep,
                                setCustomCardSep,
                                (
                                    <div className="mt-2 text-[10px] text-muted bg-panel border bordering-outline px-2 py-1 rounded shadow-sm text-center">
                                        <code className="text-accent">{'\\n'}</code> for new line
                                    </div>
                                )
                            )}
                        </div>

                        {/* Bullet Point Settings */}
                        <CursorTooltip content="Appends lines to previous card as bullets">
                            <div className="bg-panel-2 p-4 rounded-xl border border-outline flex items-center gap-4 shrink-0 justify-start">
                                <label className="flex items-center gap-3 cursor-pointer select-none group">
                                    <div
                                        className={clsx(
                                            "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                                            useBulletMarker ? "bg-accent border-accent" : "border-outline group-hover:border-accent"
                                        )}
                                    >
                                        {useBulletMarker && (
                                            <div className="w-2.5 h-1.5 border-b-2 border-l-2 border-bg -rotate-45 -mt-0.5" />
                                        )}
                                    </div>
                                    <input
                                        type="checkbox"
                                        className="hidden"
                                        checked={useBulletMarker}
                                        onChange={(e) => setUseBulletMarker(e.target.checked)}
                                    />
                                    <span className="text-sm font-bold text-muted group-hover:text-text transition-colors">Try to find bullets with</span>
                                </label>

                                <input
                                    type="text"
                                    placeholder=">"
                                    className={clsx(
                                        "w-14 text-center bg-panel border rounded-lg px-2 py-1.5 text-sm font-mono focus:border-accent outline-none transition-colors",
                                        useBulletMarker ? "border-accent text-text" : "border-outline text-muted"
                                    )}
                                    value={bulletMarker}
                                    onChange={(e) => {
                                        setBulletMarker(e.target.value);
                                        if (!useBulletMarker && e.target.value) setUseBulletMarker(true);
                                    }}
                                    maxLength={5}
                                />

                                <span className="text-sm font-bold text-muted">as a marker</span>
                            </div>
                        </CursorTooltip>

                        {/* Preview Section - Reduced Height */}
                        <div className="flex-1 min-h-[180px] bg-panel-2 border border-outline rounded-2xl p-4 flex flex-col relative overflow-hidden group mb-2">
                            <div className="w-full flex justify-end pb-2">
                                <div className="text-xs font-bold text-muted uppercase tracking-wider">
                                    Result Preview
                                </div>
                            </div>

                            {parsedCards.length > 0 ? (
                                <div className="flex-1 flex flex-col justify-center items-center text-center">
                                    <div className="w-full max-w-4xl px-4">
                                        {previewCard && (
                                            <CardPreview card={previewCard} />
                                        )}
                                    </div>
                                    <div className="mt-4 flex items-center justify-center gap-4">
                                        <button
                                            onClick={handlePrevCard}
                                            className="p-2 rounded-lg bg-panel border border-outline text-muted hover:text-text hover:border-accent transition-colors"
                                            title="Previous Card"
                                        >
                                            <ArrowLeft size={16} />
                                        </button>
                                        <div className="text-xs text-muted font-mono">
                                            {previewIndex + 1} / {Math.min(parsedCards.length, 10)}
                                        </div>
                                        <button
                                            onClick={handleNextCard}
                                            className="p-2 rounded-lg bg-panel border border-outline text-muted hover:text-text hover:border-accent transition-colors"
                                            title="Next Card"
                                        >
                                            <ArrowRight size={16} />
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-text">
                                    <AlertCircle size={28} className="mb-2 opacity-50" />
                                    <p className="text-sm">No cards detected</p>
                                </div>
                            )}
                        </div>

                        {/* Info Row & Bottom Action */}
                        <div className="shrink-0 space-y-4">
                            <div className="flex items-center justify-between text-sm px-1">
                                <div className="text-text font-medium">
                                    Current Count: <span className="text-text font-bold">{parsedCards.length} Cards</span>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Cancel Button (Visible in Modal Mode) */}
                                {isModal && (
                                    <button
                                        onClick={onClose}
                                        className="flex-1 py-4 bg-panel-2 border border-outline text-muted rounded-xl font-bold hover:text-text hover:border-text transition-all"
                                    >
                                        Cancel Import
                                    </button>
                                )}
                                <button
                                    onClick={() => onContinue(parsedCards, importAppend, importOverride)}
                                    disabled={parsedCards.length === 0}
                                    className="flex-[2] py-4 bg-accent text-bg rounded-xl font-bold hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50 disabled:scale-100 shadow-xl flex items-center justify-center gap-2 text-base"
                                >
                                    Import {parsedCards.length} Cards <ArrowRight size={18} />
                                </button>
                            </div>
                        </div>

                        {/* Import Strategy Options (Contextual) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 shrink-0 mt-2">
                            <CursorTooltip
                                content="When importing raw text, append new cards to the existing list instead of replacing them. If this setting is disabled, then importing raw text can delete your whole set -- be careful!"
                                isEnabled={!settings?.hideTooltips}
                                tooltipClassName="w-80 max-w-[90vw]"
                            >
                                <div className="bg-panel-2 p-3 rounded-xl border border-outline flex flex-col justify-center">
                                    <span className="text-sm font-bold text-muted mb-2">Import Method</span>
                                    <div className="relative" ref={appendRef}>
                                        <button
                                            onClick={() => setIsAppendOpen(!isAppendOpen)}
                                            className="w-full bg-panel border border-outline rounded-lg px-3 py-2 text-sm font-bold focus:border-accent outline-none transition-colors flex items-center justify-between gap-2"
                                        >
                                            <span className="truncate">
                                                {importAppend ? "Append to Current Cards" : "Replace All Cards"}
                                            </span>
                                            <ChevronDown size={14} className="opacity-50 flex-shrink-0" />
                                        </button>
                                        {isAppendOpen && (
                                            <div className="absolute bottom-full left-0 mb-2 w-full bg-panel border border-outline rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                                                {[
                                                    { value: true, label: "Append to Current Cards" },
                                                    { value: false, label: "Replace All Cards (Destructive)" },
                                                ].map((opt) => (
                                                    <button
                                                        key={opt.label}
                                                        onClick={() => {
                                                            setImportAppend(opt.value);
                                                            setIsAppendOpen(false);
                                                        }}
                                                        className={clsx(
                                                            "w-full text-left px-3 py-2 text-sm hover:bg-panel-2 transition-colors",
                                                            importAppend === opt.value ? "text-accent font-bold bg-accent/5" : "text-text"
                                                        )}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CursorTooltip>

                            <CursorTooltip
                                content="When importing raw text, choose how to handle cards with identical terms. 'Keep Old' ignores new identical cards. 'Add Duplicate' imports them anyway. 'Override Old' replaces existing cards with the newly imported ones."
                                isEnabled={!settings?.hideTooltips}
                                tooltipClassName="w-80 max-w-[90vw]"
                            >
                                <div className="bg-panel-2 p-3 rounded-xl border border-outline flex flex-col justify-center">
                                    <span className="text-sm font-bold text-muted mb-2">Duplicate Strategy</span>
                                    <div className="relative" ref={overrideRef}>
                                        <button
                                            onClick={() => setIsOverrideOpen(!isOverrideOpen)}
                                            disabled={!importAppend}
                                            className={clsx(
                                                "w-full bg-panel border border-outline rounded-lg px-3 py-2 text-sm font-bold focus:border-accent outline-none transition-colors flex items-center justify-between gap-2",
                                                !importAppend && "opacity-50 cursor-not-allowed"
                                            )}
                                        >
                                            <span className="truncate">
                                                {importOverride === 'keep' ? "Keep Old (Ignore New)" : importOverride === 'override' ? "Override Old" : "Add Duplicate"}
                                            </span>
                                            <ChevronDown size={14} className="opacity-50 flex-shrink-0" />
                                        </button>
                                        {isOverrideOpen && importAppend && (
                                            <div className="absolute bottom-full left-0 mb-2 w-full bg-panel border border-outline rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                                                {[
                                                    { value: 'keep', label: "Keep Old (Ignore New)" },
                                                    { value: 'duplicate', label: "Add Duplicate" },
                                                    { value: 'override', label: "Override Old" },
                                                ].map((opt) => (
                                                    <button
                                                        key={opt.label}
                                                        onClick={() => {
                                                            setImportOverride(opt.value as any);
                                                            setIsOverrideOpen(false);
                                                        }}
                                                        className={clsx(
                                                            "w-full text-left px-3 py-2 text-sm hover:bg-panel-2 transition-colors",
                                                            importOverride === opt.value ? "text-accent font-bold bg-accent/5" : "text-text"
                                                        )}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </CursorTooltip>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
