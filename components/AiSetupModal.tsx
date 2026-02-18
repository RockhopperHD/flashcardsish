import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface AiSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export const AiSetupModal: React.FC<AiSetupModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const [agreed, setAgreed] = React.useState(false);

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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onMouseDown={onClose}>
            <div
                className="bg-panel border border-outline rounded-2xl shadow-2xl animate-in zoom-in-95 w-full max-w-lg mx-4 flex flex-col max-h-[90vh]"
                onMouseDown={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-outline shrink-0 bg-panel-2 rounded-t-2xl">
                    <div className="flex items-center justify-between gap-4">
                        <h2
                            className="text-2xl text-text"
                            style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}
                        >
                            Developer API Access
                        </h2>
                        <button onClick={onClose} className="text-muted hover:text-text p-2 rounded-lg hover:bg-panel-2 transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto">
                    <div className="bg-yellow/10 border border-yellow/20 rounded-xl p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="text-yellow shrink-0 mt-0.5" size={20} />
                            <div>
                                <h3 className="font-bold text-yellow text-sm mb-1">Developer Mode Only</h3>
                                <p className="text-base text-text leading-relaxed">
                                    This feature allows developers to connect their own Google Cloud/Vertex AI keys for testing purposes. It is not intended for general consumer use.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="prose prose-invert max-w-none text-text mb-6">
                        <p className="text-base">
                            By enabling Developer API Access, you confirm that you are a developer using your own API credentials in accordance with the Google AI Studio Terms of Service.
                        </p>
                    </div>

                    <label
                        className="flex items-center gap-3 p-4 bg-panel-2 border border-outline rounded-xl cursor-pointer hover:bg-panel-3 transition-colors mb-6 select-none group"
                    >
                        <input
                            type="checkbox"
                            checked={agreed}
                            onChange={(e) => setAgreed(e.target.checked)}
                            className="hidden"
                        />
                        <div
                            className={agreed
                                ? "w-5 h-5 rounded border-2 flex items-center justify-center transition-all bg-accent border-accent"
                                : "w-5 h-5 rounded border-2 flex items-center justify-center transition-all border-outline group-hover:border-accent"
                            }
                        >
                            {agreed && (
                                <div className="w-2.5 h-1.5 border-b-2 border-l-2 border-bg -rotate-45 -mt-0.5" />
                            )}
                        </div>
                        <p className="text-base font-medium text-text">
                            I confirm I am a developer and agree to the Google AI Studio Terms.
                        </p>
                    </label>

                    <div className="flex flex-col gap-2">
                        <button
                            onClick={() => {
                                if (agreed) {
                                    onConfirm();
                                    onClose();
                                }
                            }}
                            disabled={!agreed}
                            className={`w-full py-3 font-bold text-sm rounded-xl transition-colors duration-150 ${agreed
                                ? "bg-accent text-bg hover:bg-accent/90 shadow-lg shadow-accent/20"
                                : "bg-panel-2 text-muted cursor-not-allowed"
                                }`}
                        >
                            Enable Developer Access
                        </button>
                        <button
                            onClick={onClose}
                            className="w-full py-3 text-muted hover:text-text font-bold text-sm bg-transparent hover:bg-panel-2 rounded-xl transition-colors duration-150"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
