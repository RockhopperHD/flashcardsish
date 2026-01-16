import React, { useState, useMemo, useEffect } from 'react';
import { generateId } from '../utils';
import { Card } from '../types';
import clsx from 'clsx';
import { ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react';
import { CursorTooltip } from './CursorTooltip';

interface RawTextImportProps {
    onClose: () => void; // Modal close logic ("Leave without saving" or just back)
    onContinue: (cards: Partial<Card>[]) => void;
    // onOpenSettings removed as settings are now global
    rawText: string;
    setRawText: (text: string) => void;
    isModal?: boolean;
}

const COMMON_TERM_DEF = ['/', ':', '-'];
const COMMON_CARD = ['\\n\\n', '&&&', ';;;'];
const COMMON_YEAR = ['///', ':::', '==='];

export const RawTextImport: React.FC<RawTextImportProps> = ({
    onClose,
    onContinue,
    rawText,
    setRawText,
    isModal = false,
}) => {
    // const [rawText, setRawText] = useState(''); // Lifted to parent

    // Separator States
    const [termDefSep, setTermDefSep] = useState('/');
    const [customTermDef, setCustomTermDef] = useState('');
    const [isCustomTermDef, setIsCustomTermDef] = useState(false);

    const [cardSep, setCardSep] = useState('\\n\\n');
    const [customCardSep, setCustomCardSep] = useState('');
    const [isCustomCardSep, setIsCustomCardSep] = useState(false);

    const [yearSep, setYearSep] = useState('disable');
    const [customYearSep, setCustomYearSep] = useState('');
    const [isCustomYearSep, setIsCustomYearSep] = useState(false);

    // Derived enableYear based on selection
    const enableYear = yearSep !== 'disable' || (isCustomYearSep && customYearSep.trim().length > 0);

    // Parsing Logic
    const parsedCards = useMemo(() => {
        if (!rawText.trim()) return [];

        const result: Partial<Card>[] = [];

        // Resolve separators
        // Handle escaped newline sequence for card separator if user typed "\n\n"
        const resolvedCardSep = (isCustomCardSep ? customCardSep : cardSep).replace(/\\n/g, '\n');
        const resolvedTermDefSep = isCustomTermDef ? customTermDef : termDefSep;
        // Resolve Year Sep: if disabled, we ignore year splitting. 
        // If 'disable', resolvedYearSep is null/ignored.
        let resolvedYearSep = null;
        if (isCustomYearSep) resolvedYearSep = customYearSep;
        else if (yearSep !== 'disable') resolvedYearSep = yearSep;

        if (!resolvedCardSep || !resolvedTermDefSep) return [];

        const rawCards = rawText.split(resolvedCardSep);

        rawCards.forEach(rawCard => {
            if (!rawCard.trim()) return;

            let term = '';
            let def = '';
            let year = '';

            // Split Term and Rest
            const parts = rawCard.split(resolvedTermDefSep);
            if (parts.length > 0) {
                term = parts[0].trim();
                const rest = parts.slice(1).join(resolvedTermDefSep).trim();

                if (resolvedYearSep) {
                    const defParts = rest.split(resolvedYearSep);
                    def = defParts[0].trim();
                    year = defParts.slice(1).join(resolvedYearSep).trim();
                } else {
                    def = rest;
                }
            }

            if (term || def) {
                result.push({
                    term: [term], // Card type uses array for terms sometimes? check type def. 
                    // Wait, Card definition says term: string[]
                    content: def,
                    year: year,
                    id: generateId(),
                    mastery: 0,
                    star: false
                });
            }
        });

        return result;
    }, [rawText, termDefSep, customTermDef, isCustomTermDef, cardSep, customCardSep, isCustomCardSep, yearSep, customYearSep, isCustomYearSep, enableYear]);


    // Preview Logic
    const [previewIndex, setPreviewIndex] = useState(0);
    const [isFading, setIsFading] = useState(false);

    useEffect(() => {
        if (parsedCards.length === 0) return;

        // Reset if index out of bounds
        if (previewIndex >= parsedCards.length) setPreviewIndex(0);

        const interval = setInterval(() => {
            setIsFading(true);
            setTimeout(() => {
                setPreviewIndex(prev => (prev + 1) % Math.min(parsedCards.length, 10)); // Cycle through first 10
                setIsFading(false);
            }, 500); // 500ms fade out
        }, 5000 + 500); // 5s show + 500ms fade

        return () => clearInterval(interval);
    }, [parsedCards.length, previewIndex]);

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
        hasDisableOption: boolean = false,
        footer?: React.ReactNode
    ) => {
        return (
            <div className="bg-panel-2 p-4 rounded-xl border border-outline flex flex-col h-full">
                <h4 className="text-sm font-bold text-muted mb-3 shrink-0">{label}</h4>
                <div className="space-y-2 flex-1 overflow-y-auto custom-scrollbar">
                    {/* Disable Option (only for Year) */}
                    {hasDisableOption && (
                        <label className="flex items-center gap-3 cursor-pointer group">
                            <div className={clsx(
                                "w-4 h-4 rounded-full border flex items-center justify-center transition-colors shrink-0",
                                !isCustom && selected === 'disable' ? "border-accent bg-accent" : "border-muted group-hover:border-text"
                            )}>
                                {!isCustom && selected === 'disable' && <div className="w-1.5 h-1.5 bg-bg rounded-full" />}
                            </div>
                            <input
                                type="radio"
                                className="hidden"
                                checked={!isCustom && selected === 'disable'}
                                onChange={() => { setIsCustom(false); setSelected('disable'); }}
                            />
                            <span className="text-sm italic text-muted group-hover:text-text transition-colors">Disable</span>
                        </label>
                    )}

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
            isModal ? "h-full" : "h-[65vh] min-h-[500px]"
        )}>
            {/* Header (Modal Mode only or always?) */}
            {/* If Modal, maybe different header? */}
            {/* User said "doesn't have a back button". But needs to leave. */}

            {/* Description Row - Full Width */}
            <p className="text-sm text-text/60 leading-relaxed mb-6 shrink-0 max-w-4xl">
                To import a set from another application, export it as text and paste it here. You can also use a text editor like Google Docs to write your cards quickly, then paste them here to import them. After importing as raw text, you can adjust your cards with the Visual Editor.
            </p>

            {/* Main Content Grid */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8 min-h-0 overflow-hidden pb-6">

                {/* Left Column: Text Input (Span 4) - Narrower */}
                <div className="lg:col-span-4 h-full flex flex-col min-h-0">
                    <div className="relative flex-1 min-h-0 flex flex-col">
                        <textarea
                            value={rawText}
                            onChange={(e) => setRawText(e.target.value)}
                            placeholder="Paste text here..."
                            className="w-full flex-1 p-4 bg-panel-2 border border-outline rounded-2xl resize-none focus:border-accent outline-none text-sm font-mono leading-relaxed custom-scrollbar"
                        />
                    </div>
                </div>

                {/* Right Column: Settings & Preview (Span 8) - Wider */}
                <div className="lg:col-span-8 flex flex-col h-full gap-6 min-h-0 overflow-y-auto custom-scrollbar pr-2">

                    {/* Separators Configuration - Fixed Height Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[240px] shrink-0">
                        {renderRadioGroup(
                            "Between Term & Definition",
                            COMMON_TERM_DEF,
                            termDefSep,
                            setTermDefSep,
                            isCustomTermDef,
                            setIsCustomTermDef,
                            customTermDef,
                            setCustomTermDef
                        )}

                        {renderRadioGroup(
                            "Between Cards",
                            COMMON_CARD,
                            cardSep,
                            setCardSep,
                            isCustomCardSep,
                            setIsCustomCardSep,
                            customCardSep,
                            setCustomCardSep,
                            false,
                            (
                                <div className="mt-2 text-[10px] text-muted bg-panel border bordering-outline px-2 py-1 rounded shadow-sm text-center">
                                    <code className="text-accent">{'\\n'}</code> for new line
                                </div>
                            )
                        )}

                        {renderRadioGroup(
                            "Between Definition & Year",
                            COMMON_YEAR,
                            yearSep,
                            setYearSep,
                            isCustomYearSep,
                            setIsCustomYearSep,
                            customYearSep,
                            setCustomYearSep,
                            true // Has Disable Option
                        )}
                    </div>

                    {/* Preview Section - Reduced Height */}
                    <div className="flex-1 min-h-[180px] bg-panel-2 border border-outline rounded-2xl p-6 flex flex-col relative overflow-hidden group mb-2">
                        <div className="absolute top-4 right-4 text-xs font-bold text-muted uppercase tracking-wider z-10">
                            Result Preview
                        </div>

                        {parsedCards.length > 0 ? (
                            <div
                                className={clsx(
                                    "flex-1 flex flex-col justify-center items-center text-center transition-opacity duration-500",
                                    isFading ? "opacity-0" : "opacity-100"
                                )}
                            >
                                <div className="max-w-md w-full p-5 bg-panel border border-outline rounded-xl shadow-sm">
                                    {/* Card Front (Term) */}
                                    <div className="text-base font-bold text-text mb-3 pb-3 border-b border-outline/50">
                                        {previewCard?.term?.[0] || <span className="text-muted italic">Empty Term</span>}
                                    </div>

                                    {/* Card Back (Def + Year) */}
                                    <div className="text-sm text-text/80">
                                        <span className="line-clamp-2">
                                            {previewCard?.content || <span className="text-muted italic">Empty Definition</span>}
                                        </span>
                                        {enableYear && previewCard?.year && (
                                            <div className="mt-2 inline-block px-2 py-0.5 rounded bg-accent/10 text-accent text-xs font-bold">
                                                {previewCard.year}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-3 text-xs text-muted">
                                    Showing card {previewIndex + 1} of {Math.min(parsedCards.length, 10)}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-muted">
                                <AlertCircle size={28} className="mb-2 opacity-50" />
                                <p className="text-sm">No cards detected</p>
                            </div>
                        )}
                    </div>

                    {/* Info Row & Bottom Action */}
                    <div className="shrink-0 space-y-4">
                        <div className="flex items-center justify-between text-sm px-1">
                            <div className="text-muted font-medium">
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
                                onClick={() => onContinue(parsedCards)}
                                disabled={parsedCards.length === 0}
                                className="flex-[2] py-4 bg-accent text-bg rounded-xl font-bold hover:brightness-110 active:scale-[0.99] transition-all disabled:opacity-50 disabled:scale-100 shadow-xl flex items-center justify-center gap-2 text-base"
                            >
                                Import {parsedCards.length} Cards <ArrowRight size={18} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
