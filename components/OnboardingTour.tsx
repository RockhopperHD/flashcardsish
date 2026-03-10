import React from 'react';
import { X } from 'lucide-react';
import { CursorTooltip } from './CursorTooltip';

type TourMode = 'standard' | 'builder_menu';
type TourRequirement = 'none' | 'set_name' | 'first_term' | 'complete_first_card';
type TourTone = 'required' | 'optional' | 'finish';

interface TourStep {
    id: string;
    title: string;
    description: string;
    helperText: string;
    selector?: string;
    missingHint?: string;
    mode?: TourMode;
    autoAdvanceOnTargetClick?: boolean;
    requirement?: TourRequirement;
    ctaLabel?: string;
    tone?: TourTone;
}

interface BuilderGuideOption {
    id: string;
    label: string;
    selector: string;
    description: string;
    whyItMatters: string;
}

interface BuilderProgress {
    hasSetName: boolean;
    hasFirstTerm: boolean;
    hasFirstDefinition: boolean;
    hasCompleteFirstCard: boolean;
}

interface OnboardingTourProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete?: () => void;
}

const BUILDER_GUIDE_OPTIONS: BuilderGuideOption[] = [
    {
        id: 'configure',
        label: 'Set setup',
        selector: '[data-tour="builder-set-config"]',
        description: 'Rename card sides, add extra fields, and set tags from one place.',
        whyItMatters: 'This is where Flashcardsish starts fitting your subject instead of forcing everything into generic labels.',
    },
    {
        id: 'editor_mode',
        label: 'Preview mode',
        selector: '[data-tour="builder-wysiwyg"]',
        description: 'Toggle between raw markdown editing and rendered preview behavior.',
        whyItMatters: 'If formatting looks confusing, this toggle is usually the fastest way to understand what you are editing.',
    },
    {
        id: 'history',
        label: 'Undo and redo',
        selector: '[data-tour="builder-history-controls"]',
        description: 'Quickly step backward or forward after accidental edits.',
        whyItMatters: 'The builder is designed for fast drafting, so undo and redo are your safety net when you move quickly.',
    },
    {
        id: 'markdown',
        label: 'Formatting help',
        selector: '[data-tour="builder-markdown-help"]',
        description: 'Open examples for markdown, highlights, and raw text patterns.',
        whyItMatters: 'This is the fastest way to make cards easier to scan without digging through docs.',
    },
    {
        id: 'card_list',
        label: 'Card list',
        selector: '[data-tour="builder-card-list"]',
        description: 'Edit cards here, then drag them into whatever order you want.',
        whyItMatters: 'Most of your build time happens in this area, so it helps to know it is both editor and reordering surface.',
    },
    {
        id: 'add_cards',
        label: 'Add more cards',
        selector: '[data-tour="builder-add-card"]',
        description: 'Append another blank card whenever you want to keep building.',
        whyItMatters: 'Once the first card makes sense, this is how you keep growing the set without leaving the page.',
    },
    {
        id: 'export_tools',
        label: 'Copy and download',
        selector: '[data-tour="builder-export-tools"]',
        description: 'Copy the current set text or download a .flashcards file.',
        whyItMatters: 'These are your easiest backup tools when you want to move a set elsewhere or keep an offline copy.',
    },
];

const TOUR_STEPS: TourStep[] = [
    {
        id: 'add_set',
        title: 'Start from the library',
        description: 'Click Add to create a new set from your library screen.',
        helperText: 'This is the main starting point whenever you want to make a fresh set or import one.',
        selector: '[data-tour="menu-add-set"]',
        missingHint: 'Go to the Home or Library view to find the Add button.',
        tone: 'required',
    },
    {
        id: 'start_scratch',
        title: 'Choose the visual builder',
        description: 'Pick Start from Scratch to build your first set one card at a time.',
        helperText: 'Raw Text Import is great for bulk pasting later, but the visual builder is the clearest way to learn where everything lives.',
        selector: '[data-tour="add-set-scratch"]',
        missingHint: 'Open the Add modal first.',
        tone: 'required',
    },
    {
        id: 'name_set',
        title: 'Give the set a useful name',
        description: 'Type a clear title like "Biology Quiz 2" or "Spanish Verbs".',
        helperText: 'A specific title makes the set much easier to recognize in your library later, especially once you have a few saved.',
        selector: '[data-tour="builder-set-name"]',
        missingHint: 'Enter the builder first.',
        autoAdvanceOnTargetClick: false,
        requirement: 'set_name',
        ctaLabel: 'Continue',
        tone: 'required',
    },
    {
        id: 'first_term',
        title: 'Write the prompt on card 1',
        description: 'Click the first left-hand box and add the word, question, or cue you want to study.',
        helperText: 'Think of this side as the thing that should trigger recall. Keeping it short usually makes review faster.',
        selector: '[data-tour="builder-first-term"]',
        missingHint: 'The first card should be visible in the builder.',
        autoAdvanceOnTargetClick: false,
        requirement: 'first_term',
        ctaLabel: 'Continue',
        tone: 'required',
    },
    {
        id: 'first_definition',
        title: 'Finish the first card',
        description: 'Fill the right-hand box with the answer, definition, or explanation for that first prompt.',
        helperText: 'One complete card is enough to teach the full build flow. After that, the rest of the set works the same way.',
        selector: '[data-tour="builder-first-definition"]',
        missingHint: 'The first card should be visible in the builder.',
        autoAdvanceOnTargetClick: false,
        requirement: 'complete_first_card',
        ctaLabel: 'Continue',
        tone: 'required',
    },
    {
        id: 'builder_menu',
        title: 'Learn the useful extras',
        description: 'Pick one builder shortcut below to spotlight it in place.',
        helperText: 'Choose one to preview it. You can try more than one before moving on.',
        mode: 'builder_menu',
        autoAdvanceOnTargetClick: false,
        ctaLabel: 'Continue',
        tone: 'optional',
    },
    {
        id: 'save_study',
        title: 'Finish here when you are ready',
        description: 'This action area is where you either save the set to your library or jump straight into Study Now.',
        helperText: 'You do not need to press either button to finish the tour. The important part is knowing where your save and study actions live.',
        selector: '[data-tour="builder-save-study"]',
        missingHint: 'Scroll to the builder footer to see the save and study buttons.',
        autoAdvanceOnTargetClick: false,
        requirement: 'complete_first_card',
        ctaLabel: 'Done',
        tone: 'required',
    },
    {
        id: 'complete',
        title: 'You are ready to use Flashcardsish',
        description: 'You now know how to start a set, fill the first card, and find the save and study controls.',
        helperText: 'You can restart this tour from Settings any time if you want a quick refresher.',
        autoAdvanceOnTargetClick: false,
        ctaLabel: 'Close tour',
        tone: 'finish',
    },
];

export const OnboardingTour: React.FC<OnboardingTourProps> = ({ isOpen, onClose, onComplete }) => {
    const [stepIndex, setStepIndex] = React.useState(0);
    const [targetRect, setTargetRect] = React.useState<DOMRect | null>(null);
    const [activeBuilderGuideId, setActiveBuilderGuideId] = React.useState<string | null>(null);
    const [visitedBuilderGuideIds, setVisitedBuilderGuideIds] = React.useState<string[]>([]);
    const [isCurrentStepReady, setIsCurrentStepReady] = React.useState(false);
    const [isDockHidden, setIsDockHidden] = React.useState(false);
    const completionReportedRef = React.useRef(false);

    const step = TOUR_STEPS[stepIndex];
    const isLastStep = stepIndex === TOUR_STEPS.length - 1;
    const activeBuilderGuide = activeBuilderGuideId
        ? BUILDER_GUIDE_OPTIONS.find((option) => option.id === activeBuilderGuideId) || null
        : null;
    const activeSelector = step.mode === 'builder_menu' ? activeBuilderGuide?.selector : step.selector;
    const combinedDescription = `${step.description} ${step.helperText}`.trim();
    const activeGuideParagraph = activeBuilderGuide
        ? `${activeBuilderGuide.description} ${activeBuilderGuide.whyItMatters}`.trim()
        : '';

    const getBuilderProgress = React.useCallback((): BuilderProgress => {
        const setNameInput = document.querySelector('[data-tour="builder-set-name"]') as HTMLInputElement | null;
        const firstTerm = document.querySelector('[data-tour="builder-first-term"]') as HTMLElement | null;
        const firstDefinition = document.querySelector('[data-tour="builder-first-definition"]') as HTMLElement | null;

        const hasSetName = !!setNameInput?.value.trim();
        const hasFirstTerm = firstTerm?.getAttribute('data-tour-filled') === 'true';
        const hasFirstDefinition = firstDefinition?.getAttribute('data-tour-filled') === 'true';

        return {
            hasSetName,
            hasFirstTerm,
            hasFirstDefinition,
            hasCompleteFirstCard: hasFirstTerm && hasFirstDefinition,
        };
    }, []);

    const evaluateStepReadiness = React.useCallback((candidateStep: TourStep, progress: BuilderProgress = getBuilderProgress()) => {
        switch (candidateStep.requirement || 'none') {
            case 'set_name':
                return progress.hasSetName;
            case 'first_term':
                return progress.hasFirstTerm;
            case 'complete_first_card':
                return progress.hasCompleteFirstCard;
            case 'none':
            default:
                return true;
        }
    }, [getBuilderProgress]);

    const getStepSelector = React.useCallback((candidateStep: TourStep): string | undefined => {
        if (candidateStep.mode === 'builder_menu') {
            return activeBuilderGuide?.selector;
        }
        return candidateStep.selector;
    }, [activeBuilderGuide]);

    const clickSelector = React.useCallback((selector: string) => {
        const element = document.querySelector(selector) as HTMLElement | null;
        if (!element) return false;
        element.click();
        return true;
    }, []);

    const getVisibleRect = React.useCallback((selector: string): DOMRect | null => {
        const target = document.querySelector(selector) as HTMLElement | null;
        if (!target) return null;
        const rect = target.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) return null;
        return rect;
    }, []);

    const refreshTarget = React.useCallback(() => {
        const progress = getBuilderProgress();
        setIsCurrentStepReady(evaluateStepReadiness(step, progress));

        if (!isOpen || !activeSelector) {
            setTargetRect(null);
            return;
        }

        const rect = getVisibleRect(activeSelector);
        if (!rect) {
            if (step.mode === 'builder_menu') {
                setTargetRect(null);
                return;
            }

            setTargetRect(null);
            for (let i = stepIndex - 1; i >= 0; i -= 1) {
                const previous = TOUR_STEPS[i];
                const previousSelector = getStepSelector(previous);
                if (!previousSelector) continue;
                if (getVisibleRect(previousSelector)) {
                    if (previous.mode === 'builder_menu') {
                        setActiveBuilderGuideId(null);
                    }
                    setStepIndex(i);
                    break;
                }
            }
            return;
        }

        setTargetRect(rect);
    }, [activeSelector, evaluateStepReadiness, getBuilderProgress, getStepSelector, getVisibleRect, isOpen, step, stepIndex]);

    const handleBack = React.useCallback(() => {
        if (stepIndex === 0) return;

        if (step.mode === 'builder_menu' && activeBuilderGuideId) {
            setActiveBuilderGuideId(null);
            setTargetRect(null);
            return;
        }

        if (step.id === 'start_scratch') {
            clickSelector('[data-tour="add-set-close"]');
        }

        if (step.id === 'name_set') {
            const wentBackToLibrary = clickSelector('[data-tour="builder-back-to-library"]');
            if (wentBackToLibrary) {
                window.setTimeout(() => {
                    clickSelector('[data-tour="menu-add-set"]');
                }, 140);
            }
        }

        setStepIndex((prev) => Math.max(prev - 1, 0));
    }, [activeBuilderGuideId, clickSelector, step, stepIndex]);

    React.useEffect(() => {
        if (!isOpen) {
            setStepIndex(0);
            setTargetRect(null);
            setActiveBuilderGuideId(null);
            setVisitedBuilderGuideIds([]);
            setIsCurrentStepReady(false);
            setIsDockHidden(false);
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
        if (step.mode === 'builder_menu') return;
        setActiveBuilderGuideId(null);
        setIsDockHidden(false);
    }, [isOpen, step.mode]);

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
        if (!isOpen || !activeSelector) return;

        const target = document.querySelector(activeSelector) as HTMLElement | null;
        if (!target) return;

        window.requestAnimationFrame(() => {
            target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
        });
    }, [activeSelector, isOpen, stepIndex]);

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

    if (!isOpen) return null;

    const padding = 8;
    const progressPercent = ((stepIndex + 1) / TOUR_STEPS.length) * 100;
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
    const shouldDimScreen = Boolean(targetRect && step.mode !== 'builder_menu');
    const shouldShowHighlight = Boolean(targetRect);
    const showTonePill = step.tone === 'optional' || step.tone === 'finish';
    const toneLabel = step.tone === 'finish' ? 'Ready to go' : 'Optional stop';
    const hasViewedBuilderShortcut = visitedBuilderGuideIds.length > 0;
    const isBuilderGuideDetail = step.mode === 'builder_menu' && Boolean(activeBuilderGuideId);
    const showPrimaryButton = isLastStep || step.mode === 'builder_menu' || step.autoAdvanceOnTargetClick === false;
    const primaryButtonDisabled = isLastStep
        ? false
        : isBuilderGuideDetail
            ? false
            : step.mode === 'builder_menu'
                ? !hasViewedBuilderShortcut
                : !isCurrentStepReady;
    const footerMessage = isLastStep
        ? 'You can close this tour now.'
        : isBuilderGuideDetail
            ? 'Continue to go back to the full list of builder shortcuts.'
            : step.mode === 'builder_menu'
                ? (hasViewedBuilderShortcut
                    ? 'Choose another shortcut or continue to the next tour step.'
                    : 'Choose one shortcut below to preview it before continuing.')
                : step.autoAdvanceOnTargetClick === false
                    ? (isCurrentStepReady ? 'Continue when you are ready.' : 'Click the highlighted thing to continue.')
                    : 'Click the highlighted control to continue.';
    const disabledReason = step.mode === 'builder_menu'
        ? 'Choose one builder shortcut first so the tour can spotlight it.'
        : step.requirement === 'set_name'
            ? 'Add a set name first so the tour knows you completed this step.'
            : step.requirement === 'first_term'
                ? 'Type something into the first prompt box before continuing.'
                : step.requirement === 'complete_first_card'
                    ? 'Complete the first card with both a prompt and an answer before continuing.'
                    : 'Complete the highlighted step first.';
    const primaryLabel = isBuilderGuideDetail
        ? 'Continue'
        : step.ctaLabel || (isLastStep ? 'Close tour' : 'Continue');

    return (
        <div className="fixed inset-0 z-[220] pointer-events-none">
            {shouldDimScreen && (
                <div
                    className="absolute"
                    style={spotlightStyle}
                />
            )}

            {shouldShowHighlight && (
                <div
                    className={`absolute rounded-xl border-2 border-accent shadow-[0_0_0_1px_rgba(0,0,0,0.3)] ${step.mode === 'builder_menu' ? '' : 'animate-pulse'}`}
                    style={highlightStyle}
                />
            )}

            {step.mode === 'builder_menu' && isDockHidden ? (
                <div className="absolute inset-x-0 bottom-4 flex justify-center pointer-events-auto">
                    <button
                        onClick={() => setIsDockHidden(false)}
                        className="rounded-full border border-outline bg-panel/95 px-5 py-3 text-base font-bold text-text shadow-xl backdrop-blur-md hover:border-accent transition-colors"
                    >
                        Show Guided Tour
                    </button>
                </div>
            ) : (
                <div className="absolute inset-x-4 bottom-4">
                    <div className="mx-auto w-full max-w-[980px] rounded-[24px] border border-outline bg-panel/95 shadow-2xl backdrop-blur-md pointer-events-auto overflow-hidden relative">
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 text-muted hover:text-text transition-colors z-10"
                            aria-label="Close guided tour"
                        >
                            <X size={18} />
                        </button>
                        <div className="flex flex-col lg:flex-row lg:items-center">
                            <div className="lg:w-[250px] p-4 lg:p-5 border-b lg:border-b-0 lg:border-r border-outline/80">
                                <div className="pr-8">
                                    <p
                                        className="text-white text-lg leading-none"
                                        style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}
                                    >
                                        Guided Tour
                                    </p>
                                    <p className="text-xs text-muted mt-2">Step {stepIndex + 1} of {TOUR_STEPS.length}</p>
                                </div>

                                <div className="mt-4 h-2 rounded-full bg-panel-2 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-accent transition-[width] duration-300"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>

                                {showTonePill && (
                                    <span className={`inline-flex mt-4 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${step.tone === 'finish'
                                        ? 'bg-green/10 text-green border border-green/20'
                                        : 'bg-blue/10 text-blue border border-blue/20'
                                        }`}>
                                        {toneLabel}
                                    </span>
                                )}

                                <h3 className="mt-4 text-base text-white font-medium leading-snug">{step.title}</h3>
                            </div>

                            <div className="flex-1 p-4 lg:p-5 min-w-0">
                                {step.mode !== 'builder_menu' && (
                                    <>
                                        <p className="text-sm text-text leading-relaxed">{combinedDescription}</p>
                                        {!targetRect && step.missingHint && (
                                            <p className="text-sm text-yellow mt-3">{step.missingHint}</p>
                                        )}
                                    </>
                                )}

                                {step.mode === 'builder_menu' && !isBuilderGuideDetail && (
                                    <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                                        {BUILDER_GUIDE_OPTIONS.map((option) => {
                                            const isVisited = visitedBuilderGuideIds.includes(option.id);

                                            return (
                                                <button
                                                    key={option.id}
                                                    onClick={() => {
                                                        setActiveBuilderGuideId(option.id);
                                                        setVisitedBuilderGuideIds((prev) => (
                                                            prev.includes(option.id) ? prev : [...prev, option.id]
                                                        ));

                                                        const target = document.querySelector(option.selector) as HTMLElement | null;
                                                        if (target) {
                                                            target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                                                        }
                                                    }}
                                                    className="rounded-xl border border-outline bg-panel px-3 py-3 text-left transition-colors text-muted hover:text-text hover:border-accent/60"
                                                >
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className="text-sm font-bold">{option.label}</span>
                                                        {isVisited && (
                                                            <span className="text-[11px] uppercase tracking-wide text-green">Viewed</span>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {isBuilderGuideDetail && (
                                    <p className="text-sm text-text leading-relaxed">{activeGuideParagraph}</p>
                                )}
                            </div>

                            <div className="lg:w-[220px] p-4 lg:p-5 border-t lg:border-t-0 lg:border-l border-outline/80">
                                <p className="text-sm text-muted leading-relaxed mb-4">{footerMessage}</p>

                                <div className="flex gap-2 lg:flex-col">
                                    <button
                                        onClick={handleBack}
                                        disabled={stepIndex === 0}
                                        className="flex-1 px-3 py-2.5 text-sm rounded-xl border border-outline text-muted hover:text-text hover:border-accent transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        Back
                                    </button>

                                    {step.mode === 'builder_menu' && (
                                        <button
                                            onClick={() => setIsDockHidden(true)}
                                            className="flex-1 px-3 py-2.5 text-sm rounded-xl border border-outline text-muted hover:text-text hover:border-accent transition-colors"
                                        >
                                            Hide
                                        </button>
                                    )}

                                    {showPrimaryButton && (
                                        <CursorTooltip isEnabled={primaryButtonDisabled} content={disabledReason}>
                                            <button
                                                onClick={() => {
                                                    if (isLastStep) {
                                                        onClose();
                                                        return;
                                                    }
                                                    if (isBuilderGuideDetail) {
                                                        setActiveBuilderGuideId(null);
                                                        setTargetRect(null);
                                                        return;
                                                    }
                                                    if (primaryButtonDisabled) return;
                                                    setStepIndex((prev) => Math.min(prev + 1, TOUR_STEPS.length - 1));
                                                }}
                                                aria-disabled={primaryButtonDisabled}
                                                className={`flex-1 px-4 py-2.5 text-sm rounded-xl font-bold transition-colors ${primaryButtonDisabled
                                                    ? 'bg-accent/40 text-bg/70 cursor-not-allowed opacity-60'
                                                    : 'bg-accent text-bg hover:bg-accent/90'
                                                    }`}
                                            >
                                                {primaryLabel}
                                            </button>
                                        </CursorTooltip>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
