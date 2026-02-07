import React from 'react';
import { Bold, Italic, Underline, Code, Highlighter } from 'lucide-react';
import clsx from 'clsx';

export const FloatingToolbar: React.FC<{
    position: { top: number; left: number } | null;
    onFormat: (type: string, value?: string) => void;
    visible: boolean;
    anchor?: 'top' | 'bottom';
}> = ({ position, onFormat, visible, anchor = 'bottom' }) => {
    if (!visible || !position) return null;

    return (
        <div
            className="fixed z-[100] flex flex-col bg-panel border-2 border-outline rounded-xl shadow-2xl p-2 animate-in fade-in zoom-in-95 min-w-[200px]"
            style={{
                top: position.top,
                left: position.left,
                transform: anchor === 'bottom'
                    ? 'translate(-50%, -100%)'
                    : 'translate(0, 0)'
            }}
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => e.stopPropagation()}
        >
            <MenuButton icon={<Bold size={16} />} label="Bold" onClick={() => onFormat('bold')} shortcut="Ctrl+B" />
            <MenuButton icon={<Italic size={16} />} label="Italic" onClick={() => onFormat('italic')} shortcut="Ctrl+I" />
            <MenuButton icon={<Underline size={16} />} label="Underline" onClick={() => onFormat('underline')} shortcut="Ctrl+U" />
            <MenuButton icon={<Code size={16} />} label="Code" onClick={() => onFormat('code')} shortcut="Ctrl+`" />

            <div className="h-px bg-outline my-2 mx-1" />

            <div className="px-2 py-1">
                <div className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2 flex items-center gap-2">
                    <Highlighter size={12} />
                    Highlight
                </div>
                <div className="flex justify-between items-center gap-1">
                    {[
                        { color: 'none', bg: 'bg-panel border-red/50 relative overflow-hidden' },
                        { color: 'r', bg: 'bg-red' },
                        { color: 'b', bg: 'bg-blue' },
                        { color: 'g', bg: 'bg-green' },
                        { color: 'p', bg: 'bg-purple' },
                        { color: 'y', bg: 'bg-yellow' }
                    ].map(c => (
                        <button
                            key={c.color}
                            onClick={(e) => {
                                e.stopPropagation();
                                onFormat('highlight', c.color === 'none' ? undefined : c.color);
                            }}
                            className={clsx(
                                "w-6 h-6 rounded-full transition-transform hover:scale-110 active:scale-95 border-2 border-transparent hover:border-text shadow-sm flex items-center justify-center",
                                c.bg
                            )}
                            title={c.color === 'none' ? "Remove Highlight" : `Highlight ${c.color}`}
                        >
                            {c.color === 'none' && (
                                <div className="absolute inset-0 flex items-center justify-center transform -rotate-45">
                                    <div className="w-full h-0.5 bg-red" />
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

const MenuButton: React.FC<{
    icon: React.ReactNode;
    label: string;
    onClick: () => void;
    shortcut?: string;
}> = ({ icon, label, onClick, shortcut }) => (
    <button
        onClick={(e) => {
            e.stopPropagation();
            onClick();
        }}
        className="flex items-center w-full gap-3 px-3 py-2 text-sm font-medium text-muted hover:text-text hover:bg-panel-2 rounded-lg transition-colors group text-left"
    >
        <span className="group-hover:text-accent transition-colors">{icon}</span>
        <span>{label}</span>
        {shortcut && <span className="ml-auto text-xs opacity-50 font-mono">{shortcut}</span>}
    </button>
);
