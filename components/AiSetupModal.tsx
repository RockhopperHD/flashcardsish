import React from 'react';
import { X, ExternalLink, Terminal, AlertTriangle, CheckSquare, Square } from 'lucide-react';

interface AiSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export const AiSetupModal: React.FC<AiSetupModalProps> = ({ isOpen, onClose, onConfirm }) => {
    const [agreed, setAgreed] = React.useState(false);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in" onMouseDown={onClose}>
            <div
                className="bg-panel border border-outline rounded-2xl shadow-2xl animate-in zoom-in-95 w-full max-w-lg mx-4 flex flex-col max-h-[90vh]"
                onMouseDown={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-outline shrink-0">
                    <h2 className="text-xl font-bold text-text flex items-center gap-2">
                        <Terminal className="text-accent" size={24} />
                        Developer API Access
                    </h2>
                    <button onClick={onClose} className="text-muted hover:text-text p-2 rounded-lg hover:bg-panel-2 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto">
                    <div className="bg-yellow/10 border border-yellow/20 rounded-xl p-4 mb-6">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="text-yellow shrink-0 mt-0.5" size={20} />
                            <div>
                                <h3 className="font-bold text-yellow text-sm mb-1">Developer Mode Only</h3>
                                <p className="text-sm text-text/80 leading-relaxed">
                                    This feature allows developers to connect their own Google Cloud/Vertex AI keys for testing purposes. It is not intended for general consumer use.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="prose prose-invert max-w-none text-text/90 mb-6">
                        <p className="text-sm">
                            By enabling Developer API Access, you confirm that you are a developer using your own API credentials in accordance with the Google AI Studio Terms of Service.
                        </p>
                    </div>

                    <div
                        onClick={() => setAgreed(!agreed)}
                        className="flex items-center gap-3 p-4 bg-panel-2 border border-outline rounded-xl cursor-pointer hover:bg-panel-3 transition-colors mb-6"
                    >
                        <div className={agreed ? "text-accent" : "text-muted"}>
                            {agreed ? <CheckSquare size={24} /> : <Square size={24} />}
                        </div>
                        <p className="text-sm font-medium text-text select-none">
                            I confirm I am a developer and agree to the Google AI Studio Terms.
                        </p>
                    </div>

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3 text-muted hover:text-text font-bold text-sm bg-transparent hover:bg-panel-2 rounded-xl transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={() => {
                                if (agreed) {
                                    onConfirm();
                                    onClose();
                                }
                            }}
                            disabled={!agreed}
                            className={`flex-1 py-3 font-bold text-sm rounded-xl transition-all ${agreed
                                ? "bg-accent text-bg hover:opacity-90 shadow-lg shadow-accent/20"
                                : "bg-panel-2 text-muted cursor-not-allowed"
                                }`}
                        >
                            Enable Developer Access
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
