import React from 'react';
import { FilePlus, FileText, Upload, Plus } from 'lucide-react';
import clsx from 'clsx';

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
    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in"
            onMouseDown={onClose}
        >
            <div
                className="bg-panel border border-outline rounded-2xl p-8 w-full max-w-3xl shadow-2xl animate-in zoom-in-95 flex flex-col items-center text-center relative"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <h2 className="text-3xl font-bold text-text mb-2">Add New Set</h2>
                <p className="text-muted text-lg mb-8 max-w-lg">
                    Choose how you want to start creating your set
                </p>

                <div className="grid md:grid-cols-2 gap-4 w-full">
                    {/* Start from Scratch */}
                    <button
                        onClick={() => {
                            onStartScratch();
                            onClose();
                        }}
                        className="group flex flex-col items-center justify-center p-8 bg-panel-2 border border-outline rounded-2xl hover:border-accent hover:bg-accent/5 transition-all outline-none"
                    >
                        <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <FilePlus size={32} className="text-accent" />
                        </div>
                        <h3 className="text-xl font-bold text-text mb-2">Start from Scratch</h3>
                        <p className="text-sm text-muted max-w-[200px] leading-relaxed min-h-[60px]">
                            Start with a clean slate and use the Set Builder in Flashcardsish to create cards.
                        </p>
                    </button>

                    {/* Start with Raw Text */}
                    <button
                        onClick={() => {
                            onStartRaw();
                            onClose();
                        }}
                        className="group flex flex-col items-center justify-center p-8 bg-panel-2 border border-outline rounded-2xl hover:border-accent hover:bg-accent/5 transition-all outline-none"
                    >
                        <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                            <FileText size={32} className="text-accent" />
                        </div>
                        <h3 className="text-xl font-bold text-text mb-2">Start with Raw Text</h3>
                        <p className="text-sm text-muted max-w-[200px] leading-relaxed min-h-[60px]">
                            Start by pasting in a list of terms of definitions, either from another flashcards app or from a text editor.
                        </p>
                    </button>
                </div>

                <div className="mt-8 text-muted/60 text-base font-bold">
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
