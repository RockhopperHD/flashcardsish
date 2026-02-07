import React from 'react';
import { X, ExternalLink, HelpCircle } from 'lucide-react';

interface AiSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AiSetupModal: React.FC<AiSetupModalProps> = ({ isOpen, onClose }) => {
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
                        <HelpCircle className="text-accent" size={24} />
                        Setting up AI Features
                    </h2>
                    <button onClick={onClose} className="text-muted hover:text-text p-2 rounded-lg hover:bg-panel-2 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto">
                    <div className="prose prose-invert max-w-none text-text/90">
                        <p className="mb-4">
                            Flashcardsish uses Google's Gemini models to generate content on the fly in Flashcardsish. To enable this, you need a free API key from Google. You can use Google AI Studio to generate a key (long string of letters) and paste it here. For security reasons, this is stored only on browser-side and deleted when you close Flashcardsish. <br /> <br /> You should keep your API key secret; don't publish it, ever. <br /> <br /> Flashcardsish uses smaller models where possible to reduce rate-limiting (getting cut off from using the API key). You can track your usage on the Google AI Studio homepage. <br /> <br /> Google has their own Terms of Service, including an age minimum, for creating API keys. You can learn more here: <a href="https://ai.google.dev/gemini-api/docs/api-key">Google AI Key Information</a>.
                        </p>
                    </div>

                    <a
                        href="https://aistudio.google.com/app/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-2 w-full p-3 bg-accent text-bg font-bold rounded-xl hover:opacity-90 transition-opacity"
                    >
                        Get Your API Key <ExternalLink size={16} />
                    </a>
                </div>
            </div>
        </div>
    );
};
