import React, { useState } from 'react';
import { CardSet, Card, Settings, Tag, CustomFieldDefinition } from '../types';
import { ArrowLeft, Play, Lock, BookOpen, Layers, FolderOpen, Pencil, Download, Copy, Trash2, Star, ChevronDown, ChevronUp, Share2, Check, Loader2, FileText } from 'lucide-react';
import { downloadFile } from '../utils';
import { createSharedLink } from '../src/sharing';
import clsx from 'clsx';
import { TagPill } from './TagPill';
import { CardPreview } from './CardPreview';
import { getSrsCounts, isSrsCardDue } from '../srs';
import { normalizeCardMastery } from '../cardNormalization';
import { SrsTriangle } from './SrsTriangle';

interface SetDetailProps {
    set: CardSet;
    settings: Settings;
    onBack: () => void;
    onStartLearn: () => void;
    onStartFlashcards: () => void;
    onStartSRS: () => void;
    onStartExam: () => void;
    onUpdateSet: (set: CardSet) => void;
    onEdit: () => void;
    onDuplicate: () => void;
    onDelete: () => void;
    tags: Tag[]; // Global tag definitions
}

// Mode Button Component
const ModeButton: React.FC<{
    label: string;
    icon: React.ReactNode;
    isActive?: boolean;
    isDisabled?: boolean;
    onClick?: () => void;
}> = ({ label, icon, isActive = false, isDisabled = false, onClick }) => {
    return (
        <button
            onClick={isDisabled ? undefined : onClick}
            disabled={isDisabled}
            className={clsx(
                "relative flex w-full flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all duration-300",
                isActive && !isDisabled && "bg-accent/10 border-accent text-accent hover:bg-accent/20 hover:scale-[1.02] hover:-translate-y-1 cursor-pointer shadow-lg shadow-accent/10",
                !isActive && !isDisabled && "bg-panel-2 border-outline text-text hover:border-accent/50 hover:bg-panel-3 hover:-translate-y-1 cursor-pointer",
                isDisabled && "bg-panel-2/50 border-outline/50 text-muted/50 cursor-not-allowed"
            )}
        >
            <div className={clsx(
                "rounded-xl p-3.5 transition-colors [&>svg]:h-[26px] [&>svg]:w-[26px]",
                isActive && !isDisabled ? "bg-accent/20" : "bg-panel-3",
                isDisabled && "opacity-40"
            )}>
                {icon}
            </div>
            <span className={clsx("font-bold text-[15px]", isDisabled && "opacity-50")}>{label}</span>
            {isDisabled && (
                <div className="absolute top-2 right-2">
                    <Lock size={14} className="text-muted/50" />
                </div>
            )}
        </button>
    );
};

const WarningModal: React.FC<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onClose: () => void;
    onConfirm: () => void;
}> = ({ isOpen, title, message, confirmLabel, onClose, onConfirm }) => {
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in"
            onMouseDown={onClose}
        >
            <div
                className="bg-panel border border-outline rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95"
                onMouseDown={(event) => event.stopPropagation()}
            >
                <div className="mb-4">
                    <h3 className="text-xl font-bold text-text mb-2">{title}</h3>
                    <p className="text-text leading-relaxed">{message}</p>
                </div>
                <div className="flex flex-col gap-3">
                    <button
                        type="button"
                        onClick={() => {
                            onConfirm();
                            onClose();
                        }}
                        className="w-full py-3 rounded-xl bg-yellow text-bg font-bold transition-colors hover:bg-yellow/90"
                    >
                        {confirmLabel}
                    </button>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full py-3 text-muted hover:text-text font-medium rounded-xl hover:bg-panel-2 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

// Term Row Component
const TermRow: React.FC<{
    card: Card;
    index: number;
    onToggleStar: () => void;
    showMastery?: boolean;
    masteryMode?: 'learn' | 'srs';
    showSrsIndicator?: boolean;
    showMasteryDots?: boolean;
    termSideFields?: (string | CustomFieldDefinition)[];
    defSideFields?: (string | CustomFieldDefinition)[];
    termLabel?: string;
    definitionLabel?: string;
}> = ({ card, index, onToggleStar, showMastery = false, masteryMode = 'learn', showSrsIndicator = false, showMasteryDots = false, termSideFields, defSideFields, termLabel, definitionLabel }) => {
    return (
        <CardPreview
            card={card}
            index={index}
            showIndex={true}
            showStarToggle={true}
            showMastery={showMastery}
            masteryMode={masteryMode}
            showSrsIndicator={showSrsIndicator}
            showMasteryDots={showMasteryDots}
            indicatorVariant="set-preview"
            onToggleStar={onToggleStar}
            termSideFields={termSideFields}
            defSideFields={defSideFields}
            termLabel={termLabel}
            definitionLabel={definitionLabel}
            className="hover:border-accent/30"
        />
    );
};


export const SetDetail: React.FC<SetDetailProps> = ({
    set,
    settings,
    onBack,
    onStartLearn,
    onStartFlashcards,
    onStartSRS,
    onStartExam,
    onUpdateSet,
    onEdit,
    onDuplicate,
    onDelete,
    tags
}) => {
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const [shareUrl, setShareUrl] = useState<string | null>(null);
    const [shareStatus, setShareStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
    const [shareError, setShareError] = useState<string | null>(null);
    const [showExamBetaWarning, setShowExamBetaWarning] = useState(false);

    const toggleGroup = (groupKey: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(groupKey)) next.delete(groupKey);
            else next.add(groupKey);
            return next;
        });
    };

    // Group cards (if multistudy)
    const groupedCards = React.useMemo(() => {
        if (!set.isMultistudy) return null;
        const groups = new Map<string, { groupName: string; cards: Card[] }>();
        set.cards.forEach(card => {
            const groupName = card.originalSetName || "Unknown Set";
            const groupKey = card.originalSetId || `unknown:${groupName}`;
            const existing = groups.get(groupKey);
            if (existing) {
                existing.cards.push(card);
            } else {
                groups.set(groupKey, { groupName, cards: [card] });
            }
        });
        return Array.from(groups.entries()).map(([groupKey, group]) => ({
            groupKey,
            groupName: group.groupName,
            cards: group.cards
        }));
    }, [set]);

    const masteredCount = set.cards.filter(c => c.mastery >= 2).length;
    const starredCount = set.cards.filter(c => c.star).length;
    const progress = set.cards.length > 0 ? Math.round((masteredCount / set.cards.length) * 100) : 0;
    const isSrsSet = Boolean(set.srsSessionStats);
    const hasActiveLearnSession = Boolean(set.isSessionActive && !set.srsSessionStats && !set.flashcardsSessionStats);
    const srsCounts = React.useMemo(() => getSrsCounts(set.cards), [set.cards]);
    const srsDueCount = React.useMemo(() => set.cards.filter(card => isSrsCardDue(card)).length, [set.cards]);

    const getCardKey = (card: Card): string => {
        if (set.isMultistudy && card.originalSetId) return `${card.originalSetId}::${card.id}`;
        return card.id;
    };

    const toggleStar = (card: Card) => {
        const targetKey = getCardKey(card);
        const newCards = set.cards.map(c =>
            getCardKey(c) === targetKey ? { ...c, star: !c.star } : c
        );
        onUpdateSet({ ...set, cards: newCards });
    };

    const getPreviewCard = (card: Card): Card => {
        const mastery = normalizeCardMastery(card.mastery);
        return {
            ...card,
            mastery: hasActiveLearnSession ? mastery : mastery >= 2 ? 2 : 0
        };
    };

    const handleExport = () => {
        downloadFile(set.name + '.flashcards', JSON.stringify(set, null, 2), 'json');
    };

    const handleShare = async () => {
        if (shareStatus === 'loading' || shareStatus === 'done') return;
        setShareStatus('loading');
        setShareError(null);
        try {
            const id = await createSharedLink(set);
            const url = `${window.location.origin}${window.location.pathname}?share=${id}`;
            setShareUrl(url);
            setShareStatus('done');
        } catch (e) {
            setShareError(e instanceof Error ? e.message : 'Failed to create share link. Please try again.');
            setShareStatus('error');
            setTimeout(() => { setShareStatus('idle'); setShareError(null); }, 5000);
        }
    };

    const [copied, setCopied] = useState(false);
    const handleCopyShareUrl = () => {
        if (!shareUrl) return;
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDeleteClick = () => {
        if (deleteConfirm) {
            onDelete();
        } else {
            setDeleteConfirm(true);
            setTimeout(() => setDeleteConfirm(false), 3000);
        }
    };

    return (
        <div className="max-w-5xl mx-auto w-full pb-20 animate-in fade-in duration-500">
            {/* Back Button */}
            <button
                onClick={onBack}
                className="mb-8 flex items-center gap-3 text-muted hover:text-text transition-colors font-bold uppercase text-xs tracking-wider group"
            >
                <div className="p-2 rounded-full border border-outline group-hover:bg-panel group-hover:border-accent transition-colors">
                    <ArrowLeft size={16} />
                </div>
                Back to Library
            </button>

            {/* Set Header */}
            <div className="mb-6">
                <h1
                    className="text-4xl text-text tracking-tight mb-3"
                    style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}
                >
                    {set.name}
                </h1>

                {/* Tag Pills */}
                {set.tags && set.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-4">
                        {set.tags.map(tagId => {
                            const tagDef = tags.find(t => t.id === tagId);
                            if (!tagDef) return null;
                            return (
                                <TagPill key={tagId} tag={tagDef} />
                            );
                        })}
                    </div>
                )}
                <div className="flex items-center gap-6 text-muted">
                    <span className="font-mono">{set.cards.length} cards</span>
                    {isSrsSet && (
                        <span className="text-red font-mono">{srsDueCount} due now</span>
                    )}
                    {masteredCount > 0 && (
                        <span className="text-green font-mono">{masteredCount} mastered</span>
                    )}
                    {starredCount > 0 && (
                        <span className="flex items-center gap-1 font-mono text-text">
                            <Star size={12} className="text-accent" fill="currentColor" />
                            {starredCount}
                        </span>
                    )}
                    {progress > 0 && (
                        <span className="text-accent font-bold">{progress}% complete</span>
                    )}
                </div>
                {isSrsSet && (
                    <div className="mt-4 flex flex-wrap items-center gap-3">
                        {[
                            { level: 0, count: srsCounts.unseen },
                            { level: 1, count: srsCounts.red },
                            { level: 2, count: srsCounts.yellow },
                            { level: 3, count: srsCounts.green },
                            { level: 4, count: srsCounts.blue }
                        ].map(item => (
                            <div key={item.level} className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-outline bg-panel-2 text-sm">
                                <SrsTriangle level={item.level} className="w-3 h-3" />
                                <span className="font-mono text-text">{item.count}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Action Toolbar */}
            <div className="mb-10 flex items-center gap-2 p-3 bg-panel-2 border border-outline rounded-xl">
                {!set.isMultistudy && (
                    <button
                        onClick={onEdit}
                        className="flex items-center gap-2 px-3 py-2 text-muted hover:text-text hover:bg-panel-3 rounded-lg transition-all"
                        title="Edit Set"
                    >
                        <Pencil size={16} />
                        <span className="text-sm font-medium hidden sm:inline">Edit</span>
                    </button>
                )}
                <button
                    onClick={handleExport}
                    className="flex items-center gap-2 px-3 py-2 text-muted hover:text-text hover:bg-panel-3 rounded-lg transition-all"
                    title="Export JSON"
                >
                    <Download size={16} />
                    <span className="text-sm font-medium hidden sm:inline">Export</span>
                </button>
                <button
                    onClick={onDuplicate}
                    className="flex items-center gap-2 px-3 py-2 text-muted hover:text-text hover:bg-panel-3 rounded-lg transition-all"
                    title="Duplicate Set"
                >
                    <Copy size={16} />
                    <span className="text-sm font-medium hidden sm:inline">Duplicate</span>
                </button>
                <button
                    onClick={handleShare}
                    className="flex items-center gap-2 px-3 py-2 text-muted hover:text-text hover:bg-panel-3 rounded-lg transition-all"
                    title="Share Set"
                    disabled={shareStatus === 'loading'}
                >
                    {shareStatus === 'loading' ? <Loader2 size={16} className="animate-spin" /> : shareStatus === 'done' ? <Check size={16} className="text-green" /> : <Share2 size={16} />}
                    <span className="text-sm font-medium hidden sm:inline">Share</span>
                </button>
                <div className="flex-1" />
                <button
                    onClick={handleDeleteClick}
                    className={clsx(
                        "flex items-center gap-2 px-3 py-2 rounded-lg transition-all",
                        deleteConfirm
                            ? "bg-red text-bg"
                            : "text-muted hover:text-red hover:bg-red/10"
                    )}
                    title="Delete Set"
                >
                    <Trash2 size={16} />
                    <span className="text-sm font-medium hidden sm:inline">
                        {deleteConfirm ? "Confirm?" : "Delete"}
                    </span>
                </button>
            </div>

            {/* Share URL Banner */}
            {shareStatus === 'done' && shareUrl && (
                <div className="mb-6 flex items-center gap-3 p-3 bg-accent/10 border border-accent/30 rounded-xl">
                    <Share2 size={16} className="text-accent shrink-0" />
                    <span className="text-sm text-muted flex-1 truncate font-mono">{shareUrl}</span>
                    <button
                        onClick={handleCopyShareUrl}
                        className="text-xs font-bold text-accent hover:text-accent/80 transition-colors shrink-0"
                    >
                        {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                        onClick={() => { setShareStatus('idle'); setShareUrl(null); }}
                        className="text-muted hover:text-text transition-colors shrink-0"
                    >
                        ×
                    </button>
                </div>
            )}
            {shareStatus === 'error' && (
                <div className="mb-6 p-3 bg-red/10 border border-red/30 rounded-xl text-sm text-red">
                    {shareError ?? 'Failed to create share link. Please try again.'}
                </div>
            )}

            {/* Modes Grid */}
            <div className="mb-12">
                <h2 className="text-xs font-bold text-muted uppercase tracking-widest mb-4 pl-1">Study Modes</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Learn - Active */}
                    <div className="h-full space-y-2">
                        <div className="h-6" />
                        <ModeButton
                            label="Learn"
                            icon={<BookOpen size={24} />}
                            isActive={false}
                            onClick={onStartLearn}
                        />
                    </div>

                    {/* Flashcards - Active */}
                    <div className="h-full space-y-2">
                        <div className="h-6" />
                        <ModeButton
                            label="Flashcards"
                            icon={<Layers size={24} />}
                            isActive={false}
                            onClick={onStartFlashcards}
                        />
                    </div>

                    {/* SRS - Active */}
                    <div className="h-full space-y-2">
                        <div className="h-6" />
                        <ModeButton
                            label="SRS"
                            icon={<Play size={24} />}
                            isActive={false}
                            onClick={onStartSRS}
                        />
                    </div>

                    {/* Exam - Active */}
                    <div className="h-full space-y-2">
                        <div className="flex h-6 items-center justify-center">
                            <span className="rounded-full border border-yellow/35 bg-yellow/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-yellow">
                                Beta
                            </span>
                        </div>
                        <ModeButton
                            label="Exam"
                            icon={<FileText size={24} />}
                            isActive={false}
                            onClick={() => setShowExamBetaWarning(true)}
                        />
                    </div>
                </div>
            </div>

            <WarningModal
                isOpen={showExamBetaWarning}
                title="Exam Mode Beta"
                message="Exam mode is still rough around the edges. Expect some uneven question quality and grading while it’s still being refined."
                confirmLabel="Continue to Exam"
                onClose={() => setShowExamBetaWarning(false)}
                onConfirm={onStartExam}
            />

            {/* Cards List */}
            <div>
                {!set.isMultistudy ? (
                    <>
                        <h2 className="text-xs font-bold text-muted uppercase tracking-widest mb-4 pl-1">
                            Cards in this Set ({set.cards.length})
                        </h2>
                        <div className="space-y-3">
                            {set.cards.map((card, index) => (
                                <TermRow
                                    key={card.id || index}
                                    card={getPreviewCard(card)}
                                    index={index}
                                    onToggleStar={() => toggleStar(card)}
                                    showMastery={isSrsSet}
                                    masteryMode={isSrsSet ? 'srs' : 'learn'}
                                    showSrsIndicator={isSrsSet}
                                    showMasteryDots={true}
                                    termSideFields={set.termSideFields}
                                    defSideFields={set.defSideFields}
                                    termLabel={set.termLabel}
                                    definitionLabel={set.definitionLabel}
                                />
                            ))}
                        </div>
                    </>
                ) : (
                    <div className="space-y-6">
                        {groupedCards && groupedCards.map(({ groupKey, groupName, cards: groupCards }) => {
                            const isCollapsed = collapsedGroups.has(groupKey);
                            return (
                                <div key={groupKey} className="bg-panel-2 rounded-xl border border-outline overflow-hidden">
                                    <div
                                        className="px-4 py-3 bg-panel-3 border-b border-outline flex items-center justify-between cursor-pointer hover:bg-panel transition-colors"
                                        onClick={() => toggleGroup(groupKey)}
                                    >
                                        <h3 className="font-bold text-sm text-text flex items-center gap-2">
                                            {groupName} <span className="text-muted text-xs bg-panel px-2 py-0.5 rounded-full">{groupCards.length}</span>
                                        </h3>
                                        <div className="text-muted">
                                            {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                                        </div>
                                    </div>
                                    {!isCollapsed && (
                                        <div className="p-3 space-y-2">
                                            {groupCards.map((card, index) => (
                                                <TermRow
                                                    key={card.id || `${groupKey}-${index}`}
                                                    card={getPreviewCard(card)}
                                                    index={set.cards.indexOf(card)}
                                                    onToggleStar={() => toggleStar(card)}
                                                    showMastery={isSrsSet}
                                                    masteryMode={isSrsSet ? 'srs' : 'learn'}
                                                    showSrsIndicator={isSrsSet}
                                                    showMasteryDots={true}
                                                    termSideFields={set.termSideFields}
                                                    defSideFields={set.defSideFields}
                                                    termLabel={set.termLabel}
                                                    definitionLabel={set.definitionLabel}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
