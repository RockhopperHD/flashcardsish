import React from 'react';
import { Bold, Italic, Underline, Code } from 'lucide-react';

export const FloatingToolbar: React.FC<{
    position: { top: number; left: number } | null;
    onFormat: (type: string, value?: string) => void;
    visible: boolean;
}> = ({ position, onFormat, visible }) => {
    if (!visible || !position) return null;

    return (
        <div
            className="fixed z-[100] flex items-center bg-panel border border-outline rounded-full shadow-2xl px-3 py-2 gap-2 animate-in fade-in zoom-in-95"
            style={{ top: position.top, left: position.left, transform: 'translate(-50%, -100%)' }}
            onMouseDown={(e) => e.preventDefault()} // Prevent losing focus
            onClick={(e) => e.stopPropagation()} // Prevent closing modals
        >
            <button onClick={() => onFormat('bold')} title="Bold" className="p-2 text-muted hover:text-text hover:bg-panel-2 rounded-lg transition-colors"><Bold size={18} /></button>
            <button onClick={() => onFormat('italic')} title="Italic" className="p-2 text-muted hover:text-text hover:bg-panel-2 rounded-lg transition-colors"><Italic size={18} /></button>
            <button onClick={() => onFormat('underline')} title="Underline" className="p-2 text-muted hover:text-text hover:bg-panel-2 rounded-lg transition-colors"><Underline size={18} /></button>
            <button onClick={() => onFormat('code')} title="Code" className="p-2 text-muted hover:text-text hover:bg-panel-2 rounded-lg transition-colors"><Code size={18} /></button>

            <div className="w-px h-6 bg-outline/50 mx-1" />

            <div className="flex items-center gap-2 px-1">
                {[
                    { color: 'r', bg: 'bg-red' },
                    { color: 'b', bg: 'bg-blue' },
                    { color: 'g', bg: 'bg-green' },
                    { color: 'p', bg: 'bg-purple' },
                    { color: 'y', bg: 'bg-yellow' }
                ].map(c => (
                    <button
                        key={c.color}
                        onClick={() => onFormat('highlight', c.color)}
                        className={`w-5 h-5 rounded-full ${c.bg} hover:scale-125 transition-transform border border-transparent hover:border-text shadow-sm`}
                        title={`Highlight ${c.color}`}
                    />
                ))}
            </div>
        </div>
    );
};
