import React from 'react';
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, X } from 'lucide-react';
import { CursorTooltip } from './CursorTooltip';

interface TourStep {
    id: string;
    title: string;
    description: string;
    selector?: string;
    missingHint?: string;
    mode?: 'standard' | 'builder_menu';
    autoAdvanceOnTargetClick?: boolean;
}

interface BuilderGuideOption {
    id: string;
    label: string;
    selector: string;
    description: string;
}

interface OnboardingTourProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete?: () => void;
}

const BUILDER_GUIDE_OPTIONS: BuilderGuideOption[] = [
    {
        id: 'set_name',
        label: 'Set Name',
        selector: '[data-tour="builder-set-name"]',
        description: 'Name your set so it is easy to find in your library later.',
    },
    {
        id: 'editor_mode',
        label: 'Editor Mode',
        selector: '[data-tour="builder-wysiwyg"]',
        description: 'Use this toggle to switch between markdown and formatted editing views.',
    },
    {
        id: 'configure',
        label: 'Configure Set',
        selector: '[data-tour="builder-set-config"]',
        description: 'Use Set Configuration to rename sides, add custom fields, and set tags or metadata.',
    },
    {
        id: 'edit_cards',
        label: 'Edit Cards',
        selector: '[data-tour="builder-card-list"]',
        description: 'This is where you write and edit your card terms and definitions.',
    },
    {
        id: 'markdown',
        label: 'Custom Markdown',
        selector: '[data-tour="builder-markdown-help"]',
        description: 'Open Formatting Help to see supported markdown syntax and examples for richer cards.',
    },
    {
        id: 'history',
        label: 'Undo / Redo',
        selector: '[data-tour="builder-history-controls"]',
        description: 'Use Undo/Redo while building to quickly recover edits or step forward again.',
    },
    {
        id: 'add_cards',
        label: 'Add Cards',
        selector: '[data-tour="builder-add-card"]',
        description: 'Use Add Card to expand your set as you build.',
    },
    {
        id: 'export_tools',
        label: 'Copy / Download',
        selector: '[data-tour="builder-export-tools"]',
        description: 'Use these tools to copy your set text or download a .flashcards export file.',
    },
];

const TOUR_STEPS: TourStep[] = [
    {
        id: 'add_set',
        title: 'Create a New Set',
        description: 'Click Add to start creating a set from the library screen.',
        selector: '[data-tour="menu-add-set"]',
        missingHint: 'Go to the Home/Library view to find the Add button.',
    },
    {
        id: 'start_scratch',
        title: 'Choose the Visual Builder',
        description: 'Select Start from Scratch for the guided visual editor flow.',
        selector: '[data-tour="add-set-scratch"]',
        missingHint: 'Open the Add modal first.',
    },
    {
        id: 'name_set',
        title: 'Name Your Set',
        description: 'Give your set a clear title so it is easy to find later.',
        selector: '[data-tour="builder-set-name"]',
        missingHint: 'Enter the builder first.',
    },
    {
        id: 'builder_menu',
        title: 'Builder Walkthrough',
        description: 'Use these quick buttons to learn the core builder tools before finishing.',
        mode: 'builder_menu',
        autoAdvanceOnTargetClick: false,
    },
    {
        id: 'save_study',
        title: 'Save and Study',
        description: 'This action area is where you save your set to library or jump straight into Study Now.',
        selector: '[data-tour="builder-save-study"]',
        missingHint: 'This appears in the builder footer.',
    },
    {
        id: 'complete',
        title: 'Tour Complete',
        description: 'You are ready to build sets and study. You can restart this tour anytime from Settings.',
    },
];

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ isOpen, onClose, onComplete }) => {
    const [stepIndex, setStepIndex] = React.useState(0);
    const [targetRect, setTargetRect] = React.useState<DOMRect | null>(null);
    const [activeBuilderGuideId, setActiveBuilderGuideId] = React.useState<string | null>(null);
    const [isBuilderOptionsMinimized, setIsBuilderOptionsMinimized] = React.useState(false);
    const [canFinishBuilderGuide, setCanFinishBuilderGuide] = React.useState(false);
    const [isPanelParkedLeft, setIsPanelParkedLeft] = React.useState(false);
    const completionReportedRef = React.useRef(false);

    const step = TOUR_STEPS[stepIndex];
    const isLastStep = stepIndex === TOUR_STEPS.length - 1;
    const activeBuilderGuide = activeBuilderGuideId ? BUILDER_GUIDE_OPTIONS.find((opt) => opt.id === activeBuilderGuideId) || null : null;
    const activeSelector = step.mode === 'builder_menu' ? activeBuilderGuide?.selector : step.selector;
    const activeDescription = step.mode === 'builder_menu'
        ? (activeBuilderGuide?.description || 'Choose one option to highlight that part of the builder.')
        : step.description;

    const getStepSelector = React.useCallback((candidateStep: TourStep): string | undefined => {
        if (candidateStep.mode === 'builder_menu') return BUILDER_GUIDE_OPTIONS[0]?.selector;
        return candidateStep.selector;
    }, []);

    const getVisibleRect = React.useCallback((selector: string): DOMRect | null => {
        const target = document.querySelector(selector) as HTMLElement | null;
        if (!target) return null;
        const rect = target.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return null;
        return rect;
    }, []);

    const refreshTarget = React.useCallback(() => {
        const saveStudyArea = document.querySelector('[data-tour="builder-save-study"]') as HTMLElement | null;
        const hasAtLeastOneCard = saveStudyArea?.getAttribute('data-tour-has-card') === 'true';
        setCanFinishBuilderGuide(hasAtLeastOneCard);

        if (!isOpen || !activeSelector) {
            setTargetRect(null);
            return;
        }

        const rect = getVisibleRect(activeSelector);
        if (!rect) {
            if (step.mode === 'builder_menu') {
                setTargetRect(null);
                setActiveBuilderGuideId(null);
                return;
            }

            setTargetRect(null);
            for (let i = stepIndex - 1; i >= 0; i -= 1) {
                const previous = TOUR_STEPS[i];
                const previousSelector = getStepSelector(previous);
                if (!previousSelector) continue;
                if (getVisibleRect(previousSelector)) {
                    if (previous.mode === 'builder_menu') {
                        setActiveBuilderGuideId(BUILDER_GUIDE_OPTIONS[0].id);
                    }
                    setStepIndex(i);
                    break;
                }
            }
            return;
        }

        setTargetRect(rect);
    }, [activeSelector, getStepSelector, getVisibleRect, isOpen, step.mode, stepIndex]);

    React.useEffect(() => {
        if (!isOpen) {
            setStepIndex(0);
            setTargetRect(null);
            setActiveBuilderGuideId(null);
            setIsBuilderOptionsMinimized(false);
            setCanFinishBuilderGuide(false);
            setIsPanelParkedLeft(false);
            completionReportedRef.current = false;
        }
    }, [isOpen]);

    React.useEffect(() => {
        if (!isOpen || !isLastStep || completionReportedRef.current) return;
        completionReportedRef.current = true;
        onComplete?.();
    }, [isLastStep, isOpen, onComplete]);

    React.useEffect(() => {
        if (!isOpen) return;
        if (step.mode === 'builder_menu') {
            setActiveBuilderGuideId(null);
            setIsBuilderOptionsMinimized(false);
        }
    }, [isOpen, step.mode, stepIndex]);

    React.useEffect(() => {
        if (!isOpen) return;

        const update = () => window.requestAnimationFrame(refreshTarget);
        const intervalId = window.setInterval(update, 250);

        window.addEventListener('resize', update);
        window.addEventListener('scroll', update, true);
        update();

        return () => {
            window.clearInterval(intervalId);
            window.removeEventListener('resize', update);
            window.removeEventListener('scroll', update, true);
        };
    }, [isOpen, refreshTarget]);

    React.useEffect(() => {
        if (!isOpen) return;

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [isOpen, onClose]);

    React.useEffect(() => {
        if (!isOpen || !activeSelector || isLastStep || step.autoAdvanceOnTargetClick === false) return;

        const onDocumentClick = (event: MouseEvent) => {
            const targetElement = document.querySelector(activeSelector) as HTMLElement | null;
            if (!targetElement) return;
            if (!targetElement.contains(event.target as Node)) return;

            window.setTimeout(() => {
                setStepIndex((prev) => Math.min(prev + 1, TOUR_STEPS.length - 1));
            }, 75);
        };

        document.addEventListener('click', onDocumentClick, true);
        return () => document.removeEventListener('click', onDocumentClick, true);
    }, [activeSelector, isLastStep, isOpen, step.autoAdvanceOnTargetClick]);

    React.useEffect(() => {
        if (!isOpen || step.mode !== 'builder_menu' || !activeSelector) return;

        const onDocumentClick = (event: MouseEvent) => {
            const targetElement = document.querySelector(activeSelector) as HTMLElement | null;
            if (!targetElement) return;
            if (!targetElement.contains(event.target as Node)) return;

            window.setTimeout(() => {
                setActiveBuilderGuideId(null);
                setTargetRect(null);
            }, 100);
        };

        document.addEventListener('click', onDocumentClick, true);
        return () => document.removeEventListener('click', onDocumentClick, true);
    }, [activeSelector, isOpen, step.mode]);

    if (!isOpen) return null;

    const padding = 8;
    const highlightStyle = targetRect
        ? {
            top: Math.max(targetRect.top - padding, 8),
            left: Math.max(targetRect.left - padding, 8),
            width: targetRect.width + padding * 2,
            height: targetRect.height + padding * 2,
        }
        : undefined;
    const spotlightStyle = highlightStyle
        ? {
            ...highlightStyle,
            boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.55)',
            borderRadius: '12px',
        }
        : undefined;

    return (
        <div className="fixed inset-0 z-[220] pointer-events-none">
            {targetRect && (
                <div
                    className="absolute"
                    style={spotlightStyle}
                />
            )}

            {targetRect && (
                <div
                    className="absolute rounded-xl border-2 border-accent shadow-[0_0_0_1px_rgba(0,0,0,0.3)] animate-pulse"
                    style={highlightStyle}
                />
            )}

            <div className={`absolute left-4 right-4 bottom-4 md:right-auto md:bottom-auto md:left-0 md:top-1/2 md:-translate-y-1/2 md:w-[420px] transition-transform duration-300 ease-out ${isPanelParkedLeft ? 'md:-translate-x-[calc(100%-52px)]' : 'md:translate-x-6'}`}>
                <div className="w-full bg-panel border border-outline rounded-2xl shadow-2xl pointer-events-auto">
                    <div className="p-5 border-b border-outline/80">
                        <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-2 text-accent text-sm font-bold">
                                <BookOpen size={16} />
                                Guided Tour
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setIsPanelParkedLeft((prev) => !prev)}
                                    className="hidden md:inline-flex items-center gap-1 text-xs text-muted hover:text-text transition-colors"
                                    aria-label={isPanelParkedLeft ? 'Bring tour panel back' : 'Send tour panel left'}
                                >
                                    {isPanelParkedLeft ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                                    <span>{isPanelParkedLeft ? 'Show' : 'Hide'}</span>
                                </button>
                                <button
                                    onClick={onClose}
                                    className="text-muted hover:text-text transition-colors"
                                    aria-label="Close guided tour"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                        </div>
                        <p className="text-xs text-muted mt-2">Step {stepIndex + 1} of {TOUR_STEPS.length}</p>
                        <h3 className="text-lg font-bold text-text mt-2">{step.title}</h3>
                        <p className="text-sm text-muted mt-1 leading-relaxed">{activeDescription}</p>
                    </div>

                    <div className="p-4 flex items-center justify-between gap-2">
                        {step.mode === 'builder_menu' ? (
                            <div className="w-full space-y-2">
                                <div className="flex items-center justify-between px-1 pb-1">
                                    <span className="text-xs text-muted uppercase tracking-wide">Builder Options</span>
                                    <button
                                        onClick={() => setIsBuilderOptionsMinimized((prev) => !prev)}
                                        className="inline-flex items-center gap-1 text-xs text-muted hover:text-text transition-colors"
                                        aria-label={isBuilderOptionsMinimized ? 'Show builder options' : 'Minimize builder options'}
                                    >
                                        {isBuilderOptionsMinimized ? (
                                            <>
                                                <ChevronDown size={14} />
                                                <span>Show</span>
                                            </>
                                        ) : (
                                            <>
                                                <ChevronUp size={14} />
                                                <span>Hide</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                                {!isBuilderOptionsMinimized ? (
                                    BUILDER_GUIDE_OPTIONS.map((option) => (
                                        <button
                                            key={option.id}
                                            onClick={() => {
                                                const isAlreadySelected = activeBuilderGuideId === option.id;
                                                if (isAlreadySelected) {
                                                    setActiveBuilderGuideId(null);
                                                    setTargetRect(null);
                                                    return;
                                                }
                                                setActiveBuilderGuideId(option.id);
                                                const target = document.querySelector(option.selector) as HTMLElement | null;
                                                if (target) {
                                                    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                                                }
                                            }}
                                            className={`w-full px-3 py-2 text-sm rounded-lg border transition-colors text-left ${activeBuilderGuideId === option.id
                                                ? 'border-accent text-accent bg-accent/10'
                                                : 'border-outline text-muted hover:text-text hover:border-accent/60'
                                                }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))
                                ) : (
                                    <div className="px-1 py-1 text-xs text-muted">
                                        Builder options are minimized. Expand any time without leaving the tour.
                                    </div>
                                )}
                                <CursorTooltip
                                    isEnabled={!canFinishBuilderGuide}
                                    content="Your set needs at least one card to continue! Use the tour buttons above to guide you in making your set."
                                >
                                    <button
                                        onClick={() => {
                                            if (!canFinishBuilderGuide) return;
                                            setStepIndex((prev) => Math.min(prev + 1, TOUR_STEPS.length - 1));
                                        }}
                                        aria-disabled={!canFinishBuilderGuide}
                                        className={`w-full mt-1 px-3 py-2 text-sm rounded-lg font-bold transition-colors text-center ${canFinishBuilderGuide
                                            ? 'bg-accent text-bg hover:bg-accent/90'
                                            : 'bg-accent/40 text-bg/70 cursor-not-allowed shadow-none opacity-50'
                                            }`}
                                    >
                                        I&apos;m Done
                                    </button>
                                </CursorTooltip>
                            </div>
                        ) : (
                            <div className="text-xs text-muted">
                                {isLastStep ? 'Tour complete. You can close this panel.' : 'Click the highlighted control to continue.'}
                            </div>
                        )}
                    </div>
                </div>
                {isPanelParkedLeft && (
                    <button
                        onClick={() => setIsPanelParkedLeft(false)}
                        className="hidden md:inline-flex absolute top-5 right-0 translate-x-[112%] items-center gap-1 rounded-lg border border-outline bg-panel px-2 py-1 text-xs text-muted hover:text-text hover:border-accent transition-colors pointer-events-auto"
                        aria-label="Bring tour panel back"
                    >
                        <ChevronRight size={14} />
                        <span>Show</span>
                    </button>
                )}
            </div>
        </div>
    );
};
