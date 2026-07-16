import React from 'react';
import ReactMarkdown from 'react-markdown';
import { History, X } from 'lucide-react';
import changelogMarkdown from '../CHANGELOG.md?raw';

interface ChangelogModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const firstEntryIndex = changelogMarkdown.indexOf('## ');
const changelogEntries = firstEntryIndex >= 0
    ? changelogMarkdown.slice(firstEntryIndex)
    : changelogMarkdown;

export const ChangelogModal: React.FC<ChangelogModalProps> = ({ isOpen, onClose }) => {
    React.useEffect(() => {
        if (!isOpen) return;

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in"
            onMouseDown={onClose}
            role="presentation"
        >
            <div
                className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-outline bg-panel shadow-2xl animate-in zoom-in-95"
                onMouseDown={(event) => event.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby="changelog-title"
            >
                <div className="flex items-center justify-between gap-4 border-b border-outline bg-panel-2 p-5 sm:p-6">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-accent/30 bg-accent/10 text-accent">
                            <History size={20} />
                        </div>
                        <div className="min-w-0">
                            <h2
                                id="changelog-title"
                                className="text-2xl text-text sm:text-3xl"
                                style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}
                            >
                                What's new
                            </h2>
                            <p className="mt-0.5 text-xs text-muted sm:text-sm">
                                The biggest Flashcardsish updates since launch.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="shrink-0 rounded-lg p-2 text-muted transition-colors hover:bg-panel hover:text-text"
                        aria-label="Close changelog"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-2 text-text sm:px-7">
                    <ReactMarkdown
                        components={{
                            h2: ({ children }) => (
                                <h3
                                    className="border-b border-outline/70 pb-3 pt-6 text-xl text-text sm:text-2xl"
                                    style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 700 }}
                                >
                                    {children}
                                </h3>
                            ),
                            ul: ({ children }) => (
                                <ul className="list-disc space-y-2.5 py-4 pl-5 text-sm leading-relaxed text-muted marker:text-accent sm:text-[15px]">
                                    {children}
                                </ul>
                            ),
                            li: ({ children }) => <li className="pl-1">{children}</li>,
                            p: ({ children }) => <p className="leading-relaxed">{children}</p>,
                            code: ({ children }) => (
                                <code className="rounded bg-panel-2 px-1.5 py-0.5 text-xs text-accent">
                                    {children}
                                </code>
                            )
                        }}
                    >
                        {changelogEntries}
                    </ReactMarkdown>
                </div>

                <div className="border-t border-outline bg-panel-2 px-5 py-4 text-center sm:px-6">
                    <p className="text-xs text-muted">Built in public since November 2025.</p>
                </div>
            </div>
        </div>
    );
};
