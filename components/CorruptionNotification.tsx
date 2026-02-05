import React, { useEffect, useState } from 'react';
import { AlertTriangle, X, CheckCircle2, AlertCircle } from 'lucide-react';
import { CorruptionReport } from '../storageV2';

interface CorruptionNotificationProps {
    reports: CorruptionReport[];
    onDismiss: () => void;
}

/**
 * Alert component shown when data corruption is detected during app load.
 * Displays details about what was corrupted and what was recovered.
 */
export const CorruptionNotification: React.FC<CorruptionNotificationProps> = ({
    reports,
    onDismiss
}) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        // Auto-dismiss after 15 seconds
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(onDismiss, 300);
        }, 15000);

        return () => clearTimeout(timer);
    }, [onDismiss]);

    if (reports.length === 0) return null;

    const hasRecoveredCards = reports.some(r => r.recoveredCards && r.recoveredCards > 0);
    const hasTotalLoss = reports.some(r => r.type === 'set' && r.recoveredCards === 0 && r.totalCards && r.totalCards > 0);

    return (
        <div
            className={`fixed bottom-4 right-4 max-w-md z-50 transition-all duration-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                }`}
        >
            <div className="bg-panel rounded-xl border border-outline shadow-2xl overflow-hidden">
                {/* Header */}
                <div className={`px-4 py-3 flex items-center gap-3 ${hasTotalLoss ? 'bg-red/10' : hasRecoveredCards ? 'bg-yellow/10' : 'bg-blue/10'
                    }`}>
                    {hasTotalLoss ? (
                        <AlertTriangle className="w-5 h-5 text-red flex-shrink-0" />
                    ) : hasRecoveredCards ? (
                        <AlertCircle className="w-5 h-5 text-yellow flex-shrink-0" />
                    ) : (
                        <CheckCircle2 className="w-5 h-5 text-blue flex-shrink-0" />
                    )}

                    <h3 className="font-bold text-text flex-1">
                        {hasTotalLoss ? 'Data Recovery Issue' :
                            hasRecoveredCards ? 'Partial Data Recovery' :
                                'Settings Reset'}
                    </h3>

                    <button
                        onClick={() => {
                            setIsVisible(false);
                            setTimeout(onDismiss, 300);
                        }}
                        className="p-1 text-muted hover:text-text transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="px-4 py-3 space-y-2">
                    {reports.map((report, index) => (
                        <div
                            key={index}
                            className="flex items-start gap-2 text-sm"
                        >
                            <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${report.type === 'set' && report.recoveredCards === 0 ? 'bg-red' :
                                    report.recoveredCards ? 'bg-yellow' : 'bg-blue'
                                }`} />

                            <div>
                                <span className="font-medium text-text">
                                    {report.type === 'config' ? 'Settings' :
                                        report.type === 'structure' ? 'Folder structure' :
                                            report.fileName}
                                </span>

                                {report.recoveredCards !== undefined && (
                                    <span className="text-muted ml-2">
                                        {report.recoveredCards === 0 ? (
                                            `(${report.totalCards} cards lost)`
                                        ) : (
                                            `(${report.recoveredCards}/${report.totalCards} cards saved)`
                                        )}
                                    </span>
                                )}

                                {report.error && !report.recoveredCards && (
                                    <span className="text-muted ml-2">— {report.error}</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Footer Tip */}
                <div className="px-4 py-2 bg-panel-2 border-t border-outline">
                    <p className="text-xs text-muted">
                        {hasTotalLoss ?
                            'Some data could not be recovered. This may be due to file corruption.' :
                            hasRecoveredCards ?
                                'Some cards were recovered from corrupted files. Review your sets for accuracy.' :
                                'Your settings have been reset to defaults. Adjust them in the settings menu.'}
                    </p>
                </div>
            </div>
        </div>
    );
};

/**
 * Simple popup as an alternative inline notification
 */
export const CorruptionPopup: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    reports: CorruptionReport[];
}> = ({ isOpen, onClose, reports }) => {
    if (!isOpen || reports.length === 0) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-panel rounded-2xl border border-outline shadow-2xl max-w-md w-full mx-4">
                <div className="p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 rounded-full bg-yellow/20 flex items-center justify-center">
                            <AlertTriangle className="w-6 h-6 text-yellow" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-text">Data Recovery Notice</h2>
                            <p className="text-sm text-muted">Some files required recovery</p>
                        </div>
                    </div>

                    <div className="space-y-2 mb-6">
                        {reports.map((report, index) => (
                            <div
                                key={index}
                                className="p-3 bg-panel-2 rounded-lg border border-outline"
                            >
                                <div className="font-medium text-text text-sm">
                                    {report.type === 'config' ? '⚙️ Settings' :
                                        report.type === 'structure' ? '📁 Folder Structure' :
                                            `📝 ${report.fileName.replace('.flashcards', '')}`}
                                </div>
                                <div className="text-xs text-muted mt-1">
                                    {report.error || 'File was corrupted and has been reset'}
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        onClick={onClose}
                        className="w-full py-3 bg-accent text-bg font-bold rounded-xl hover:bg-accent/90 transition-colors"
                    >
                        I Understand
                    </button>
                </div>
            </div>
        </div>
    );
};
