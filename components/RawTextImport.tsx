import React, { useState, useMemo, useEffect } from 'react';
import { generateId } from '../utils';
import { Card } from '../types';
import clsx from 'clsx';
import { ArrowLeft, ArrowRight, AlertCircle, Check } from 'lucide-react';
import { CursorTooltip } from './CursorTooltip';
import ReactMarkdown from 'react-markdown';

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

    // Bullet Point Logic
    const [bulletMarker, setBulletMarker] = useState('>');
    const [useBulletMarker, setUseBulletMarker] = useState(false);

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
            const trimmedCard = rawCard.trim();
            if (!trimmedCard) return;

            // Bullet Point Logic (Chunk Mode): Append to previous card if marker matches start of chunk
            if (useBulletMarker && bulletMarker && trimmedCard.startsWith(bulletMarker)) {
                if (result.length > 0) {
                    const prevCard = result[result.length - 1];
                    const bulletContent = trimmedCard.slice(bulletMarker.length).trim();

                    if (prevCard.content) {
                        prevCard.content += `\n- ${bulletContent}`;
                    } else {
                        prevCard.content = `- ${bulletContent}`;
                    }
                    return;
                }
            }

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

            // Bullet Point Logic (Inline Mode): Check inside definition for lines starting with marker
            if (useBulletMarker && bulletMarker && def) {
                def = def.split('\n').map(line => {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith(bulletMarker)) {
                        return '- ' + trimmedLine.slice(bulletMarker.length).trim();
                    }
                    return line;
                }).join('\n');
            }

            if (term || def) {
                result.push({
                    term: [term.substring(0, 1000)],
                    content: def.substring(0, 1000),
                    year: year,
                    id: generateId(),
                    mastery: 0,
                    star: false
                });
            }

            if (result.length >= 500) return;
        });

        return result;
    }, [rawText, termDefSep, customTermDef, isCustomTermDef, cardSep, customCardSep, isCustomCardSep, yearSep, customYearSep, isCustomYearSep, enableYear, bulletMarker, useBulletMarker]);


    // Preview Logic
    const [previewIndex, setPreviewIndex] = useState(0);

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
            isModal ? "h-full" : "min-h-[500px]"
        )}>
            {/* Header (Modal Mode only or always?) */}
            {/* If Modal, maybe different header? */}
            {/* User said "doesn't have a back button". But needs to leave. */}

            {/* Description Row - Full Width */}
            <p className="text-sm text-text/60 leading-relaxed mb-6 shrink-0 max-w-4xl">
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
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

                    {/* Bullet Point Settings */}
                    <CursorTooltip content="Appends lines to previous card as bullets">
                        <div className="bg-panel-2 p-4 rounded-xl border border-outline flex items-center gap-4 shrink-0 justify-start">
                            <label className="flex items-center gap-3 cursor-pointer select-none group">
                                <div className={clsx(
                                    "w-5 h-5 rounded border flex items-center justify-center transition-colors shadow-sm",
                                    useBulletMarker ? "bg-accent border-accent text-bg" : "border-outline text-transparent group-hover:border-text bg-panel"
                                )}>
                                    <Check size={14} strokeWidth={3} />
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
                                <div className="max-w-md w-full p-5 bg-panel border border-outline rounded-xl shadow-sm">
                                    {/* Card Front (Term) */}
                                    <div className="text-base font-bold text-text mb-3 pb-3 border-b border-outline/50">
                                        {previewCard?.term?.[0] || <span className="text-muted italic">Empty Term</span>}
                                    </div>

                                    {/* Card Back (Def + Year) */}
                                    <div className="text-sm text-text/80 whitespace-pre-wrap">
                                        <div className="text-left w-full markdown-preview">
                                            {previewCard?.content ? (
                                                <ReactMarkdown
                                                    components={{
                                                        ul: ({ children }) => <ul className="list-disc list-inside">{children}</ul>,
                                                        li: ({ children }) => <li className="pl-1 text-text/80">{children}</li>,
                                                        p: ({ children }) => <p className="mb-1 last:mb-0">{children}</p>,
                                                        strong: ({ children }) => <span className="font-bold text-accent">{children}</span>,
                                                        em: ({ children }) => <span className="italic text-text/70">{children}</span>,
                                                    }}
                                                >
                                                    {previewCard.content}
                                                </ReactMarkdown>
                                            ) : (
                                                <span className="text-muted italic block text-center">Empty Definition</span>
                                            )}
                                        </div>
                                        {enableYear && previewCard?.year && (
                                            <div className="mt-2 inline-block px-2 py-0.5 rounded bg-accent/10 text-accent text-xs font-bold">
                                                {previewCard.year}
                                            </div>
                                        )}
                                    </div>
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
                            <div className="flex-1 flex flex-col items-center justify-center text-muted">
                                <AlertCircle size={28} className="mb-2 opacity-50" />
                                <p className="text-sm">No cards detected</p>
                            </div>
                        )}
                    </div>

                    {/* Info Row & Bottom Action */}
                    <div className="shrink-0 space-y-4">
                        {parsedCards.length >= 500 && (
                            <div className="bg-yellow/10 border border-yellow/20 rounded-xl p-4 animate-in slide-in-from-bottom-2">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="text-yellow shrink-0 mt-0.5" size={20} />
                                    <div>
                                        <h3 className="font-bold text-yellow text-sm mb-1">Set Capacity Reached</h3>
                                        <p className="text-sm text-text/80 leading-relaxed">
                                            Flashcardsish supports a maximum of 500 cards per set to ensure optimal performance. Only the first 500 cards from your text will be imported.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
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
