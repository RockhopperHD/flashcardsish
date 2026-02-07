import React, { useState } from 'react';
import { CardSet, Card, Settings, Tag } from '../types';
import { ArrowLeft, Play, Lock, BookOpen, Layers, FolderOpen, Pencil, Download, Copy, Trash2 } from 'lucide-react';
import { renderMarkdown, renderInline, downloadFile, sanitizeImageUrl } from '../utils';
import clsx from 'clsx';

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
}> = ({ card, index, onToggleStar, showMastery = false }) => {
    return (
        <div className="group flex gap-4 p-4 bg-panel border border-outline rounded-xl hover:border-accent/30 transition-all">
            {/* Index */}
            <div className="text-xs font-mono text-muted pt-1 w-8 text-center shrink-0">
                {index + 1}
            </div>

            {/* Image (if exists) */}
            {sanitizeImageUrl(card.image) && (
                <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-outline bg-panel-2 flex items-center justify-center">
                    <img src={sanitizeImageUrl(card.image)} alt="Card" className="w-full h-full object-cover" loading="lazy" />
                </div>
            )}

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-1">
                <div className="font-bold text-text">
                    {card.term.join(' / ')}
                </div>
                <div className="text-sm text-muted leading-relaxed prose-content">
                    {renderMarkdown(card.content)}
                </div>
                {card.year && (
                    <div className="text-xs text-accent font-mono">{card.year}</div>
                )}
                {card.customFields && card.customFields.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1">
                        {card.customFields.map((cf, i) => (
                            <span key={i} className="text-xs px-2 py-0.5 bg-panel-2 border border-outline rounded-full text-muted">
                                {cf.name}: {cf.value}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* Mastery Indicator (only shown when showMastery is true) */}
            {showMastery && (
                <div className="pt-0.5 shrink-0">
                    {card.mastery >= 2 ? (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-green/10 border border-green/20 rounded-lg">
                            <div className="flex flex-col gap-0.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-green"></div>
                                <div className="w-1.5 h-1.5 rounded-full bg-green"></div>
                            </div>
                            <span className="text-[10px] font-bold uppercase text-green">Done</span>
                        </div>
                    ) : card.mastery === 1 ? (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-yellow/10 border border-yellow/20 rounded-lg">
                            <div className="flex flex-col gap-0.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-yellow"></div>
                                <div className="w-1.5 h-1.5 rounded-full bg-outline"></div>
                            </div>
                            <span className="text-[10px] font-bold uppercase text-yellow">In Progress</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1.5 px-2 py-1 bg-panel-3 border border-outline rounded-lg">
                            <div className="flex flex-col gap-0.5">
                                <div className="w-1.5 h-1.5 rounded-full bg-outline"></div>
                                <div className="w-1.5 h-1.5 rounded-full bg-outline"></div>
                            </div>
                            <span className="text-[10px] font-bold uppercase text-muted">New</span>
                        </div>
                    )}
                </div>
            )}

            {/* Star Button */}
            <button
                onClick={onToggleStar}
                className="pt-1 shrink-0 transition-transform hover:scale-110"
            >
                {card.star ? (
                    <span className="text-yellow text-lg">★</span>
                ) : (
                    <span className="text-outline hover:text-muted text-lg group-hover:text-muted/50">☆</span>
                )}
            </button>
        </div>
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

    const masteredCount = set.cards.filter(c => c.mastery >= 2).length;
    const starredCount = set.cards.filter(c => c.star).length;
    const progress = set.cards.length > 0 ? Math.round((masteredCount / set.cards.length) * 100) : 0;

    const toggleStar = (cardId: string) => {
        const newCards = set.cards.map(c =>
            c.id === cardId ? { ...c, star: !c.star } : c
        );
        onUpdateSet({ ...set, cards: newCards });
    };

    const handleExport = () => {
        downloadFile(set.name + '.flashcards', JSON.stringify(set, null, 2), 'json');
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
                                <div
                                    key={tagId}
                                    className={clsx(
                                        "px-2.5 py-0.5 rounded-full text-xs font-bold border flex items-center gap-1.5 opacity-90",
                                        // Dynamic color classes might be tricky if not safelisted, but let's try standard approach or style
                                        `bg-${tagDef.color}-500/10 text-${tagDef.color}-600 border-${tagDef.color}-500/20`
                                    )}
                                    // Fallback style just in case Tailwind doesn't generate these on fly
                                    style={{
                                        backgroundColor: `var(--color-${tagDef.color}-500-10, rgba(0,0,0,0.05))`,
                                        borderColor: `var(--color-${tagDef.color}-500-20, rgba(0,0,0,0.1))`,
                                        color: `var(--color-${tagDef.color}-600, currentColor)`
                                    }}
                                >
                                    <div className={`w-1.5 h-1.5 rounded-full bg-${tagDef.color}-500`} style={{ backgroundColor: `var(--color-${tagDef.color}-500)` }} />
                                    {tagDef.name}
                                </div>
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
                        <span className="text-yellow font-mono">★ {starredCount}</span>
                    )}
                    {progress > 0 && (
                        <span className="text-accent font-bold">{progress}% complete</span>
                    )}
                </div>
            </div>

            {/* Action Toolbar */}
            <div className="mb-10 flex items-center gap-2 p-3 bg-panel-2 border border-outline rounded-xl">
                <button
                    onClick={onEdit}
                    className="flex items-center gap-2 px-3 py-2 text-muted hover:text-text hover:bg-panel-3 rounded-lg transition-all"
                    title="Edit Set"
                >
                    <Pencil size={16} />
                    <span className="text-sm font-medium hidden sm:inline">Edit</span>
                </button>
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

            {/* Terms List */}
            <div>
                <h2 className="text-xs font-bold text-muted uppercase tracking-widest mb-4 pl-1">
                    Terms in this Set ({set.cards.length})
                </h2>
                <div className="space-y-3">
                    {set.cards.map((card, index) => (
                        <TermRow
                            key={card.id}
                            card={card}
                            index={index}
                            onToggleStar={() => toggleStar(card.id)}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};
