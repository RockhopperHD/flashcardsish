import React from 'react';
import { FilePlus, FileText, X } from 'lucide-react';

interface AddSetModalProps {
    isOpen: boolean;
    onClose: () => void;
    onStartScratch: () => void;
    onStartRaw: () => void;
    onImportFile: () => void;
}

export const AddSetModal: React.FC<AddSetModalProps> = ({
    isOpen,
    onClose,
    onStartScratch,
    onStartRaw,
    onImportFile,
}) => {
    React.useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in"
            onMouseDown={onClose}
        >
            <div
                className="bg-panel border border-outline rounded-2xl p-8 w-full max-w-3xl shadow-2xl animate-in zoom-in-95 flex flex-col relative"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className="relative w-full mb-4">
                    <h2 className="text-3xl font-bold text-text text-center">Add New Set</h2>
                    <button
                        onClick={onClose}
                        data-tour="add-set-close"
                        className="absolute right-0 top-1/2 -translate-y-1/2 text-muted hover:text-text p-2 rounded-lg hover:bg-panel-2 transition-colors"
                    >
                        <X size={22} />
                    </button>
                </div>
                <p className="text-text text-lg mb-8 max-w-lg mx-auto text-center">
                    Choose the starting point that fits how you want to build this set
                </p>

                <div className="grid md:grid-cols-2 gap-4 w-full">
                    <button
                        onClick={() => {
                            onStartScratch();
                            onClose();
                        }}
                        data-tour="add-set-scratch"
                        className="group flex flex-col items-center justify-center p-8 bg-panel-2 border border-outline rounded-2xl hover:border-accent hover:bg-accent/5 transition-all outline-none"
                    >
                        <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-4">
                            <FilePlus size={32} className="text-accent" />
                        </div>
                        <h3 className="text-xl font-bold text-text mb-2">Start from Scratch</h3>
                        <p className="text-sm text-text max-w-[220px] leading-relaxed min-h-[60px]">
                            Use the visual builder to name the set and build cards one by one.
                        </p>
                    </button>

                    <button
                        onClick={() => {
                            onStartRaw();
                            onClose();
                        }}
                        className="group flex flex-col items-center justify-center p-8 bg-panel-2 border border-outline rounded-2xl hover:border-accent hover:bg-accent/5 transition-all outline-none"
                    >
                        <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-4">
                            <FileText size={32} className="text-accent" />
                        </div>
                        <h3 className="text-xl font-bold text-text mb-2">Raw Text Import</h3>
                        <p className="text-sm text-text max-w-[220px] leading-relaxed min-h-[60px]">
                            Paste a list of terms and definitions from another flashcards app, document, or notes file.
                        </p>
                    </button>
                </div>

                <div className="mt-8 text-text text-base font-bold text-center">
                    ...or{' '}
                    <button
                        onClick={onImportFile}
                        className="text-accent hover:text-accent/80 hover:underline transition-colors font-bold text-lg"
                    >
                        import a set
                    </button>
                </div>
            </div>
        </div>
    );
};
