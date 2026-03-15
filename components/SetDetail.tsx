import React, { useState } from 'react';
import { CardSet, Card, Settings, Tag, CustomFieldDefinition } from '../types';
import { ArrowLeft, Play, Lock, BookOpen, Layers, FolderOpen, Pencil, Download, Copy, Trash2, Star, ChevronDown, ChevronUp, Share2, Check, Loader2 } from 'lucide-react';
import { downloadFile } from '../utils';
import { createSharedLink } from '../src/sharing';
import clsx from 'clsx';
import { TagPill } from './TagPill';
import { CardPreview } from './CardPreview';

interface SetDetailProps {
    set: CardSet;
    settings: Settings;
    onBack: () => void;
    onStartLearn: () => void;
    onStartFlashcards: () => void;
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
                "relative flex flex-col items-center justify-center gap-3 p-6 rounded-2xl border-2 transition-all duration-300",
                isActive && !isDisabled && "bg-accent/10 border-accent text-accent hover:bg-accent/20 hover:scale-[1.02] hover:-translate-y-1 cursor-pointer shadow-lg shadow-accent/10",
                !isActive && !isDisabled && "bg-panel-2 border-outline text-text hover:border-accent/50 hover:bg-panel-3 hover:-translate-y-1 cursor-pointer",
                isDisabled && "bg-panel-2/50 border-outline/50 text-muted/50 cursor-not-allowed"
            )}
        >
            <div className={clsx(
                "p-3 rounded-xl transition-colors",
                isActive && !isDisabled ? "bg-accent/20" : "bg-panel-3",
                isDisabled && "opacity-40"
            )}>
                {icon}
            </div>
            <span className={clsx("font-bold text-sm", isDisabled && "opacity-50")}>{label}</span>
            {isDisabled && (
                <div className="absolute top-2 right-2">
                    <Lock size={14} className="text-muted/50" />
                </div>
            )}
        </button>
    );
};

// Term Row Component
const TermRow: React.FC<{
    card: Card;
    index: number;
    onToggleStar: () => void;
    showMastery?: boolean;
    termSideFields?: (string | CustomFieldDefinition)[];
    defSideFields?: (string | CustomFieldDefinition)[];
    termLabel?: string;
    definitionLabel?: string;
}> = ({ card, index, onToggleStar, showMastery = false, termSideFields, defSideFields, termLabel, definitionLabel }) => {
    return (
        <CardPreview
            card={card}
            index={index}
            showIndex={true}
            showStarToggle={true}
            showMastery={showMastery}
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
                <div className="grid grid-cols-2 gap-4">
                    {/* Learn - Active */}
                    <ModeButton
                        label="Learn"
                        icon={<BookOpen size={24} />}
                        isActive={false}
                        onClick={onStartLearn}
                    />

                    {/* Flashcards - Active */}
                    <ModeButton
                        label="Flashcards"
                        icon={<Layers size={24} />}
                        isActive={false}
                        onClick={onStartFlashcards}
                    />
                </div>
            </div>

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
                                    card={card}
                                    index={index}
                                    onToggleStar={() => toggleStar(card)}
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
                                                    card={card}
                                                    index={set.cards.indexOf(card)}
                                                    onToggleStar={() => toggleStar(card)}
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
