import React, { useState, useEffect } from 'react';
import { ArrowLeft, BookOpen, Sparkles, PlayCircle, FileText, FolderOpen, Layers, User, Code, Heart, Mail, ChevronRight, Star, Check, X, Github, Calendar, Download, Cloud, Palette, ChevronDown, Pencil, Copy, Trash2, Upload, ExternalLink, Monitor, Smartphone, LayoutTemplate, ArrowDown, LayoutList, Globe } from 'lucide-react';
import clsx from 'clsx';
import { CardTagPill } from './CardTagPill';

interface DocumentationProps {
    onBack: () => void;
}

interface DocSection {
    id: string;
    title: string;
    icon: React.ReactNode;
    content: React.ReactNode;
}

// ============================================
// ANIMATED DEMO COMPONENTS
// ============================================

// Mastery Progress Demo - shows cards progressing through mastery levels
const MasteryDemo: React.FC = () => {
    const [phase, setPhase] = useState(0);
    const [fading, setFading] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            if (phase >= 3) {
                setFading(true);
                setTimeout(() => {
                    setPhase(0);
                    setFading(false);
                }, 400);
            } else {
                setPhase(p => p + 1);
            }
        }, 1500);
        return () => clearInterval(interval);
    }, [phase]);

    const getMasteryStyle = (level: number) => {
        if (level === 0) return { bg: 'bg-panel-2', border: 'border-outline', dot1: 'bg-outline', dot2: 'bg-outline', label: 'New', labelColor: 'text-muted' };
        if (level === 1) return { bg: 'bg-yellow/10', border: 'border-yellow/30', dot1: 'bg-yellow', dot2: 'bg-outline', label: 'Learning', labelColor: 'text-yellow' };
        return { bg: 'bg-green/10', border: 'border-green/30', dot1: 'bg-green', dot2: 'bg-green', label: 'Mastered', labelColor: 'text-green' };
    };

    const style = getMasteryStyle(phase);

    return (
        <div className={clsx("transition-opacity duration-300", fading && "opacity-0")}>
            <div className={clsx("inline-flex items-center gap-3 px-3 py-1.5 rounded-full border transition-all duration-500", style.bg, style.border)}>
                <div className="flex items-center gap-1.5">
                    <div className={clsx("w-2 h-2 rounded-full transition-colors duration-500", phase >= 1 ? style.dot1 : 'bg-outline')}></div>
                    <div className={clsx("w-2 h-2 rounded-full transition-colors duration-500", phase >= 2 ? style.dot2 : 'bg-outline')}></div>
                </div>
                <span className={clsx("text-sm font-semibold transition-colors duration-500", style.labelColor)}>{style.label}</span>
            </div>
        </div>
    );
};

// Answer Input Demo - simulates typing and checking an answer
const AnswerDemo: React.FC = () => {
    const [text, setText] = useState('');
    const [result, setResult] = useState<'idle' | 'correct' | 'wrong'>('idle');
    const [fading, setFading] = useState(false);
    const answer = 'Paris';
    const wrongAnswer = 'London';

    useEffect(() => {
        let timeout: NodeJS.Timeout;
        const sequence = async () => {
            // Type correct answer
            for (let i = 0; i <= answer.length; i++) {
                await new Promise(r => setTimeout(r, 150));
                setText(answer.slice(0, i));
            }
            await new Promise(r => setTimeout(r, 500));
            setResult('correct');
            await new Promise(r => setTimeout(r, 1500));

            // Reset and type wrong answer
            setResult('idle');
            setText('');
            await new Promise(r => setTimeout(r, 500));
            for (let i = 0; i <= wrongAnswer.length; i++) {
                await new Promise(r => setTimeout(r, 150));
                setText(wrongAnswer.slice(0, i));
            }
            await new Promise(r => setTimeout(r, 500));
            setResult('wrong');
            await new Promise(r => setTimeout(r, 1500));

            // Fade out and reset
            setFading(true);
            await new Promise(r => setTimeout(r, 400));
            setResult('idle');
            setText('');
            setFading(false);
        };
        sequence();
        const interval = setInterval(sequence, 8000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className={clsx("transition-opacity duration-300", fading && "opacity-0")}>
            <div className="space-y-3">
                <div className="text-sm text-muted">What is the capital of France?</div>
                <div className={clsx(
                    "px-4 py-3 rounded-xl border-2 transition-all duration-300 font-medium min-w-[200px]",
                    result === 'idle' && "bg-panel-2 border-outline text-text",
                    result === 'correct' && "bg-green/10 border-green text-green",
                    result === 'wrong' && "bg-red/10 border-red text-red"
                )}>
                    {text || <span className="text-muted/50">Type your answer...</span>}
                    {result === 'correct' && <Check className="inline ml-2" size={16} />}
                    {result === 'wrong' && <X className="inline ml-2" size={16} />}
                </div>
            </div>
        </div>
    );
};

// Folder Demo - shows cards moving into a folder (NO FADE)
const FolderDemo: React.FC = () => {
    const [phase, setPhase] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setPhase(p => p >= 3 ? 0 : p + 1);
        }, 1200);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex items-end gap-4">
            {/* Cards */}
            <div className="flex gap-1">
                {[0, 1, 2].map(i => (
                    <div
                        key={i}
                        className={clsx(
                            "w-8 h-10 bg-panel border border-outline rounded transition-all duration-500",
                            phase > i && "translate-x-12 opacity-0 scale-75"
                        )}
                    />
                ))}
            </div>
            {/* Folder */}
            <div className="relative">
                <FolderOpen
                    className={clsx(
                        "transition-all duration-300",
                        phase > 0 ? "text-accent" : "text-muted"
                    )}
                    size={40}
                />
                <div className={clsx(
                    "absolute -top-1 -right-1 w-5 h-5 bg-accent text-bg rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
                    phase === 0 && "opacity-0 scale-0"
                )}>
                    {phase}
                </div>
            </div>
        </div>
    );
};

// Star Toggle Demo (NO FADE)
const StarDemo: React.FC = () => {
    const [starred, setStarred] = useState(false);

    useEffect(() => {
        const interval = setInterval(() => {
            setStarred(s => !s);
        }, 1500);
        return () => clearInterval(interval);
    }, []);

    return (
        <button className="transition-transform hover:scale-110 active:scale-95">
            {starred ? (
                <Star className="text-yellow fill-yellow transition-all duration-300 scale-110" size={32} />
            ) : (
                <Star className="text-outline transition-all duration-300" size={32} />
            )}
        </button>
    );
};

// Custom Fields Demo - shows fields appearing
const CustomFieldsDemo: React.FC = () => {
    const [phase, setPhase] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setPhase(p => p >= 3 ? 0 : p + 1);
        }, 1200);
        return () => clearInterval(interval);
    }, []);

    const fields = [
        { label: 'Year', value: '1776' },
        { label: 'Author', value: 'Jefferson' },
        { label: 'Category', value: 'History' },
    ];

    return (
        <div className="space-y-2">
            {fields.map((field, i) => (
                <div
                    key={i}
                    className={clsx(
                        "flex items-center gap-2 px-3 py-1.5 bg-panel-2 border border-outline rounded-lg text-sm transition-all duration-300",
                        phase > i ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"
                    )}
                >
                    <span className="text-muted">{field.label}:</span>
                    <span className="text-accent font-medium">{field.value}</span>
                </div>
            ))}
        </div>
    );
};

// Card Builder Demo - shows building a card
const CardBuilderDemo: React.FC = () => {
    const [phase, setPhase] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setPhase(p => p >= 4 ? 0 : p + 1);
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="w-full max-w-xs">
            <div className="bg-panel-2 border border-outline rounded-xl p-4 space-y-3">
                {/* Term field */}
                <div className={clsx(
                    "px-3 py-2 bg-panel border border-outline rounded-lg text-sm transition-all duration-300",
                    phase >= 1 ? "border-accent" : ""
                )}>
                    <span className="text-muted text-xs block mb-1">Term</span>
                    <span className={clsx("transition-opacity", phase >= 1 ? "opacity-100" : "opacity-30")}>
                        {phase >= 1 ? "Declaration of Independence" : "Enter term..."}
                    </span>
                </div>
                {/* Definition field */}
                <div className={clsx(
                    "px-3 py-2 bg-panel border border-outline rounded-lg text-sm transition-all duration-300",
                    phase >= 2 ? "border-accent" : ""
                )}>
                    <span className="text-muted text-xs block mb-1">Definition</span>
                    <span className={clsx("transition-opacity", phase >= 2 ? "opacity-100" : "opacity-30")}>
                        {phase >= 2 ? "Document declaring US independence" : "Enter definition..."}
                    </span>
                </div>
                {/* Custom field */}
                <div className={clsx(
                    "px-3 py-2 bg-accent/10 border border-accent/30 rounded-lg text-sm transition-all duration-300",
                    phase >= 3 ? "opacity-100" : "opacity-0"
                )}>
                    <span className="text-accent text-xs block mb-1">Year</span>
                    <span className="text-accent font-medium">1776</span>
                </div>
                {/* Star */}
                <div className={clsx(
                    "flex items-center gap-2 transition-all duration-300",
                    phase >= 4 ? "opacity-100" : "opacity-0"
                )}>
                    <Star className="text-yellow fill-yellow" size={16} />
                    <span className="text-sm text-muted">Starred</span>
                </div>
            </div>
        </div>
    );
};

// Multistudy Demo - cards gets checked then slide into center
const MultistudyDemo: React.FC = () => {
    const [phase, setPhase] = useState(0);
    const [stripeOffset, setStripeOffset] = useState(0);

    // Phase 0: Cards static
    // Phase 1: Check card 1
    // Phase 2: Check card 2
    // Phase 3: Check card 3
    // Phase 4: Slide to center (Cards 1 & 3 slide into 2)
    // Phase 5: Bounce/Impact
    // Phase 6: Transform to striped
    // Phase 7: Hold
    // Phase 8: Reset (fade out)

    useEffect(() => {
        const interval = setInterval(() => {
            setPhase(p => p >= 8 ? 0 : p + 1);
        }, 800); // 800ms per phase - Slower
        return () => clearInterval(interval);
    }, []);

    // Animate stripes
    useEffect(() => {
        const stripeInterval = setInterval(() => {
            setStripeOffset(o => (o + 2) % 40);
        }, 30);
        return () => clearInterval(stripeInterval);
    }, []);

    return (
        <div className="flex items-center justify-center gap-2 h-24 relative w-64">
            {/* Source cards */}
            {[0, 1, 2].map(i => {
                // Determine movement based on index
                let translateX = "translate-x-0";
                let scale = "scale-100";
                let opacity = "opacity-100";

                if (phase >= 4 && phase < 6) {
                    // Slide phase
                    if (i === 0) translateX = "translate-x-[56px]"; // Move Right
                    if (i === 2) translateX = "-translate-x-[56px]"; // Move Left
                }

                if (phase === 5) {
                    // Impact/Bounce
                    scale = "scale-90";
                }

                if (phase >= 6) {
                    // Transform phase
                    opacity = "opacity-0";
                    scale = "scale-50";
                }

                if (phase === 8) {
                    // Reset
                    opacity = "opacity-0";
                }

                return (
                    <div
                        key={i}
                        className={clsx(
                            "w-12 h-16 rounded-lg border-2 transition-all duration-500 bg-panel relative z-10",
                            phase > i && phase < 8 ? "border-accent bg-accent/10" : "border-outline",
                            translateX, scale, opacity
                        )}
                        style={{
                            transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' // Bounce effect on move
                        }}
                    >
                        {/* Checkmark */}
                        <div className={clsx(
                            "absolute inset-0 flex items-center justify-center text-accent transition-all duration-300",
                            phase > i ? "opacity-100 scale-100" : "opacity-0 scale-50"
                        )}>
                            <Check size={20} />
                        </div>
                    </div>
                );
            })}

            {/* Merged striped card */}
            <div
                className={clsx(
                    "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-24 rounded-xl border-2 border-accent overflow-hidden transition-all duration-500 shadow-xl z-20",
                    phase >= 6 && phase < 8 ? "opacity-100 scale-100" : "opacity-0 scale-50"
                )}
                style={{
                    transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' // Bouncy entrance
                }}
            >
                {/* Background */}
                <div className="absolute inset-0 bg-panel-2" />

                {/* Animated stripes - HIGH CONTRAST */}
                <div
                    className="absolute inset-0 opacity-40 mix-blend-overlay"
                    style={{
                        backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 10px, transparent 10px, transparent 20px)',
                        backgroundPosition: `${stripeOffset}px ${stripeOffset}px`
                    }}
                />

                {/* Accent bar */}
                <div className="absolute top-0 left-0 w-1.5 h-full bg-accent" />

                {/* Content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Layers className="text-accent mb-1" size={24} />
                    <div className="px-2 py-0.5 bg-accent text-bg rounded-md text-xs font-bold">
                        3 SETS
                    </div>
                </div>
            </div>
        </div>
    );
};

// Cloud Sync Demo
const CloudSyncDemo: React.FC = () => {
    const [phase, setPhase] = useState(0);

    // 0: Idle
    // 1: Card appears at Desktop
    // 2: Card flies to Cloud
    // 3: Cloud processes (pulse)
    // 4: Card flies to Mobile
    // 5: Card stays at Mobile
    // 6: Reset

    useEffect(() => {
        const interval = setInterval(() => {
            setPhase(p => p >= 6 ? 0 : p + 1);
        }, 600);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex items-center justify-center gap-10 h-16 relative w-64">
            {/* Desktop */}
            <div className="relative z-10">
                <Monitor size={24} className={clsx("transition-colors duration-300", phase === 1 ? "text-text" : "text-muted")} />
                <div className={clsx(
                    "absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent transition-all duration-300",
                    phase === 1 ? "opacity-100 scale-100" : "opacity-0 scale-0"
                )} />
            </div>

            {/* Cloud (Center) */}
            <div className="relative z-10">
                <Cloud size={32} className={clsx("transition-all duration-300", phase === 3 ? "text-accent scale-110" : "text-muted scale-100")} />
            </div>

            {/* Mobile */}
            <div className="relative z-10">
                <Smartphone size={24} className={clsx("transition-colors duration-300", phase === 5 ? "text-text" : "text-muted")} />
                <div className={clsx(
                    "absolute -top-1 -right-1 w-2 h-2 rounded-full bg-accent transition-all duration-300",
                    phase === 5 ? "opacity-100 scale-100" : "opacity-0 scale-0"
                )} />
            </div>

            {/* Flying Packet */}
            <div
                className={clsx(
                    "absolute top-1/2 left-0 -translate-y-1/2 p-1.5 bg-panel border border-accent rounded-md text-accent shadow-sm transition-all duration-500 ease-in-out z-20",
                    // Positions calculated roughly based on container width
                    phase <= 1 && "left-[15%] opacity-0 scale-50", // Desktop
                    phase === 2 && "left-[50%] -translate-x-1/2 opacity-100 scale-100", // Cloud
                    phase === 3 && "left-[50%] -translate-x-1/2 opacity-0 scale-50", // In Cloud (hide)
                    phase === 4 && "left-[85%] -translate-x-full opacity-100 scale-100", // Mobile
                    phase >= 5 && "left-[85%] -translate-x-full opacity-0 scale-50", // Arrived
                )}
            >
                <FileText size={14} />
            </div>
        </div>
    )
}

// Download Sets Demo
// Download Sets Demo
const DownloadDemo: React.FC = () => {
    const [phase, setPhase] = useState(0);

    // 0: Cards scattered
    // 1: Cards stacking
    // 2: Transform to File
    // 3: File drops/downloads
    // 4: Reset

    useEffect(() => {
        const interval = setInterval(() => {
            setPhase(p => p >= 4 ? 0 : p + 1);
        }, 800);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex items-center justify-center h-16 relative w-32">
            {/* Cards Group */}
            <div className={clsx("transition-all duration-500 absolute", phase >= 2 ? "opacity-0 scale-50" : "opacity-100")}>
                <div className={clsx("absolute w-8 h-10 bg-panel border border-muted rounded transition-transform duration-500",
                    phase === 0 ? "-rotate-12 -translate-x-4" : "rotate-0 translate-x-0")} />
                <div className={clsx("absolute w-8 h-10 bg-panel border border-muted rounded transition-transform duration-500",
                    phase === 0 ? "rotate-12 translate-x-4" : "rotate-0 translate-x-0")} />
                <div className={clsx("absolute w-8 h-10 bg-panel-2 border border-accent rounded z-10 transition-transform duration-500",
                    phase === 0 ? "rotate-0 -translate-y-2" : "rotate-0 translate-y-0")} />
            </div>

            {/* File Icon */}
            <div className={clsx("transition-all duration-500 absolute flex flex-col items-center",
                phase < 2 ? "opacity-0 scale-50" : "opacity-100 scale-100",
                phase === 3 ? "translate-y-4" : "translate-y-0"
            )}>
                <FileText size={32} className="text-text" />
                <div className="absolute -bottom-2 -right-2 bg-accent text-bg text-[8px] font-bold px-1 rounded">JSON</div>
            </div>
        </div>
    );
};

// Formatting Demo - shows markdown rendering (NO FADE)
const FormattingDemo: React.FC = () => {
    const [phase, setPhase] = useState(0);
    const examples = [
        { raw: '**Bold Text**', rendered: <strong>Bold Text</strong> },
        { raw: '*Italic Text*', rendered: <em>Italic Text</em> },
        { raw: '`code`', rendered: <code className="bg-panel-2 px-1 rounded">code</code> },
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setPhase(p => p >= examples.length - 1 ? 0 : p + 1);
        }, 2000);
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex items-center gap-4">
            <div className="px-3 py-2 bg-panel-2 border border-outline rounded-lg font-mono text-sm text-muted">
                {examples[phase].raw}
            </div>
            <ChevronRight className="text-accent" size={20} />
            <div className="px-3 py-2 bg-panel border border-outline rounded-lg text-text">
                {examples[phase].rendered}
            </div>
        </div>
    );
};

// ============================================
// MAIN HOW-TO GUIDE COMPONENT
// ============================================

export const Documentation: React.FC<DocumentationProps> = ({ onBack }) => {
    const [activeSection, setActiveSection] = useState<string>('overview');

    const sections: DocSection[] = [
        {
            id: 'overview',
            title: 'Overview',
            icon: <Sparkles size={20} />,
            content: (
                <div className="space-y-6 text-text">
                    <p className="text-lg leading-relaxed">
                        <strong className="text-accent">Flashcardsish</strong> is built for fast creation, focused study, and clean organization.
                        You can stay minimal or go deep with custom fields, tags, folders, and sync.
                    </p>

                    <p className="text-muted leading-relaxed">
                        It is meant to cover the full study loop: create material, organize it, review it in different ways, and keep it portable.
                        You can stay local on one device, sign in with Google for sync, or export your data whenever you want manual backups.
                    </p>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <h4 className="font-bold text-accent mb-2">Cloud Sync</h4>
                            <p className="text-sm text-muted">Optional Google sign-in for free cross-device sync, including sets, study progress, folders, tags, and relevant settings.</p>
                            <div className="mt-4 flex justify-center">
                                <CloudSyncDemo />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-bold text-accent mb-2">Flexible Cards</h4>
                            <p className="text-sm text-muted">Year fields, custom fields, images, and cue tags in one card model, so one set can support vocabulary, chronology, authorship, and other structured subjects.</p>
                            <div className="mt-4 flex justify-center">
                                <CustomFieldsDemo />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-bold text-accent mb-2">Multistudy</h4>
                            <p className="text-sm text-muted">Study multiple sets at once without permanently merging them, which is perfect for chapters, units, exam bundles, or themed review.</p>
                            <div className="mt-4 flex justify-center">
                                <MultistudyDemo />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-bold text-accent mb-2">Backup + Portability</h4>
                            <p className="text-sm text-muted">Export individual sets or full data so your content is portable for backup, migration, sharing, or manual editing outside the app.</p>
                            <div className="mt-4 flex justify-center">
                                <DownloadDemo />
                            </div>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <h4 className="font-bold mb-2">Create Fast</h4>
                            <p className="text-sm text-muted">Build visually when you want precision, or switch to raw text when speed matters more than clicks.</p>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-bold mb-2">Study Your Way</h4>
                            <p className="text-sm text-muted">Swap between Learn Mode, Flashcards Mode, starred-only review, multiple choice, and other settings depending on the session.</p>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <h4 className="font-bold mb-2">Own the Library</h4>
                            <p className="text-sm text-muted">Use folders, tags, exports, and optional sync so the app scales from one quick set to a full semester of material.</p>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'quick-start',
            title: 'Quick Start',
            icon: <PlayCircle size={20} />,
            content: (
                <div className="space-y-8 text-text">
                    <p className="text-lg leading-relaxed">
                        The fastest first-time flow is: create a set, add a few cards, save it to the Library, then start a Learn or Flashcards session.
                        If you want a guided version, the onboarding tour in Settings walks through the same path with in-app prompts.
                    </p>

                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-accent text-bg flex items-center justify-center font-bold shrink-0">1</div>
                        <div className="flex-1">
                            <h4 className="font-bold text-lg mb-2">Create a Set</h4>
                            <p className="text-muted mb-3">
                                From the Library, choose <strong className="text-accent">Create</strong> and open the builder. If you already have notes prepared,
                                you can also start with Raw Text Import instead of building card-by-card.
                            </p>
                            <div className="my-4 flex justify-center">
                                <CardBuilderDemo />
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-accent text-bg flex items-center justify-center font-bold shrink-0">2</div>
                        <div>
                            <h4 className="font-bold text-lg mb-2">Add Terms and Definitions</h4>
                            <p className="text-muted mb-2">At minimum, each card needs a term and a definition. After that, you can make the card as simple or as rich as the subject needs.</p>
                            <ul className="space-y-2 text-muted text-sm">
                                <li className="flex items-start gap-2">
                                    <ChevronRight size={14} className="text-accent shrink-0 mt-0.5" />
                                    <span>Optional extras include year, images, custom fields on either side, set tags, and per-card cue tags like <code className="bg-panel-2 px-1 rounded">(Cue)</code>.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <ChevronRight size={14} className="text-accent shrink-0 mt-0.5" />
                                    <span>Use formatting syntax for bold, italics, underlines, code, highlights, and slab styling so important parts stand out during review.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <ChevronRight size={14} className="text-accent shrink-0 mt-0.5" />
                                    <span>Star cards while building if you already know what needs extra review later.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <ChevronRight size={14} className="text-accent shrink-0 mt-0.5" />
                                    <span>Use Set Configuration to rename labels, enable term-side cards, and define the extra fields your set will use.</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-accent text-bg flex items-center justify-center font-bold shrink-0">3</div>
                        <div className="space-y-4">
                            <h4 className="font-bold text-lg">Save and Study</h4>
                            <p className="text-muted">
                                Use <strong className="text-accent">Save to Library</strong>, then open the set and choose a study mode. Learn Mode is best when you want answer checking and mastery progress; Flashcards Mode is better for quick flip-through review.
                            </p>
                            <ul className="space-y-2 text-muted text-sm">
                                <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span>Use Settings to switch between typed answers, multiple choice, answer direction, stricter matching, and starred-only study.</span></li>
                                <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span>Mastery updates as you answer cards correctly, so the set gradually shows what is new, in progress, or learned.</span></li>
                            </ul>
                            <div className="flex flex-wrap items-center gap-8">
                                <AnswerDemo />
                                <MasteryDemo />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h4 className="font-bold mb-2">Need a walkthrough?</h4>
                        <p className="text-muted text-sm">
                            Open Settings and run the guided onboarding tour to see the full flow step-by-step. It is especially helpful if you want to understand how the builder, Library, and study screens connect.
                        </p>
                    </div>
                </div>
            )
        },
        {
            id: 'builder',
            title: 'Builder & Card Design',
            icon: <LayoutTemplate size={20} />,
            content: (
                <div className="space-y-8 text-text">
                    <p className="text-lg leading-relaxed">
                        The builder has two entry points: <strong className="text-accent">Visual Editor</strong> for structured editing,
                        and <strong className="text-accent">Raw Text</strong> for bulk input. Most people use Visual Editor when shaping card structure and Raw Text when importing or cleaning up lots of cards quickly.
                    </p>

                    <div className="space-y-3">
                        <h3 className="text-xl font-bold">Visual Editor</h3>
                        <p className="text-muted">
                            Use the visual builder when you want to shape cards carefully, preview formatting as you go, and make structural changes without dropping into raw text.
                        </p>
                        <div className="grid md:grid-cols-2 gap-8 items-start">
                            <div className="space-y-3">
                                <ul className="space-y-2 text-sm text-muted">
                                    <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span>Drag cards with the handle to reorder.</span></li>
                                    <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span>Use WYSIWYG to preview raw markdown versus rendered output.</span></li>
                                    <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span>Use inline actions to duplicate, swap sides, and star cards without leaving the editor.</span></li>
                                    <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span>Use Visual Editor when you want to check formatting, images, and field layout card-by-card.</span></li>
                                </ul>
                            </div>
                            <div className="flex justify-center">
                                <CardBuilderDemo />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <h3 className="text-xl font-bold">Set Configuration</h3>
                        <p className="text-muted">
                            Set Configuration is where you decide what kind of information a set will carry and how the cards should behave while you study them.
                        </p>
                        <ul className="space-y-2 text-sm text-muted">
                            <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span>Rename &quot;Term&quot; and &quot;Definition&quot; labels so the set fits your subject language.</span></li>
                            <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span>Add year plus custom fields on the term side or definition side depending on what you want to answer with.</span></li>
                            <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span>Define text, number, A/B, or True/False style custom fields for more structured studying.</span></li>
                            <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span>Set tags and import behavior from one place so the whole set stays consistent.</span></li>
                        </ul>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-3">
                            <h3 className="text-xl font-bold">Rich Cards</h3>
                            <p className="text-muted">Flashcardsish can handle more than plain front-and-back prompts when the subject calls for it.</p>
                            <ul className="space-y-2 text-sm text-muted">
                                <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span>Cards can include images, year values, and extra fields.</span></li>
                                <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span>If you need media on the prompt side, enable term-side cards in the set configuration.</span></li>
                                <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span>Prefix a term with cues like <code className="bg-panel px-1 rounded">(Example)</code> or <code className="bg-panel px-1 rounded">(Formula)</code> to add quick context without rewriting the whole card.</span></li>
                            </ul>
                        </div>
                        <div className="space-y-3">
                            <h3 className="text-xl font-bold">Workflow Notes</h3>
                            <p className="text-muted">The builder is meant to stay flexible while still protecting work in progress.</p>
                            <ul className="space-y-2 text-sm text-muted">
                                <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span>You are not trapped in one mode. Sets can move between bulk text editing and visual editing, which is great for cleanup passes after import.</span></li>
                                <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span>Star cards during editing so you can run quick focused sessions later without building a second set just for difficult terms.</span></li>
                                <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span>Builder work is autosaved and recoverable if you accidentally leave before finishing, which makes larger editing sessions much safer.</span></li>
                            </ul>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'formatting',
            title: 'Formatting & Raw Text',
            icon: <FileText size={20} />,
            content: (
                <div className="space-y-6 text-text">
                    <p className="text-lg leading-relaxed">
                        Flashcardsish supports markdown-style formatting and raw-text set creation so you can make cards readable without slowing yourself down.
                    </p>

                    <p className="text-sm text-muted leading-relaxed">
                        This is especially useful when a plain sentence is not enough and you want visual structure on the card itself. Formatting helps with emphasis, notation, scanning speed, and quick context clues during review.
                    </p>

                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <h4 className="font-bold mb-2">Use Formatting For</h4>
                            <p className="text-sm text-muted">Emphasis, notation, definitions inside definitions, and quick visual grouping when a card needs more structure.</p>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-bold mb-2">Use Raw Text For</h4>
                            <p className="text-sm text-muted">Copying notes from documents, converting lists into cards, or editing many cards quickly without clicking into every field.</p>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <h4 className="font-bold mb-2">Good To Know</h4>
                            <p className="text-sm text-muted">Raw Text Import can be customized, so separators are not fixed forever. It is meant to flex around your source material.</p>
                        </div>
                    </div>

                    <div className="my-6 flex justify-center">
                        <FormattingDemo />
                    </div>

                    <h3 className="text-xl font-bold mt-8 mb-4">Formatting Syntax</h3>
                    <div className="border border-outline rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-panel">
                                <tr>
                                    <th className="text-left px-4 py-3 text-muted font-medium">You Type</th>
                                    <th className="text-right px-4 py-3 text-muted font-medium">You Get</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-outline">
                                <tr><td className="px-4 py-3 font-mono text-muted">**bold**</td><td className="px-4 py-3 text-right"><strong>bold</strong></td></tr>
                                <tr><td className="px-4 py-3 font-mono text-muted">*italic*</td><td className="px-4 py-3 text-right"><em>italic</em></td></tr>
                                <tr><td className="px-4 py-3 font-mono text-muted">`code`</td><td className="px-4 py-3 text-right"><code className="bg-panel px-1.5 py-0.5 rounded text-accent">code</code></td></tr>
                                <tr><td className="px-4 py-3 font-mono text-muted">__underline__</td><td className="px-4 py-3 text-right"><u>underline</u></td></tr>
                                <tr><td className="px-4 py-3 font-mono text-muted">~~strike~~</td><td className="px-4 py-3 text-right"><s>strike</s></td></tr>
                                <tr>
                                    <td className="px-4 py-3 font-mono text-muted">[[slab]]</td>
                                    <td className="px-4 py-3 text-right">
                                        <span className="inline-block bg-[#1f2937] text-slate-300 px-2 py-0.5 rounded text-[0.9em] font-medium mx-1 border border-slate-600" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.05) 5px, rgba(255,255,255,0.05) 10px)' }}>slab</span>
                                    </td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 font-mono text-muted">(Cue) Text</td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex flex-col items-end gap-1">
                                            <CardTagPill label="Cue" />
                                            <span>Text</span>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <h3 className="text-xl font-bold mt-8 mb-4">Highlights</h3>
                    <div className="border border-outline rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-panel">
                                <tr>
                                    <th className="text-left px-4 py-3 text-muted font-medium">You Type</th>
                                    <th className="text-right px-4 py-3 text-muted font-medium">You Get</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-outline">
                                <tr><td className="px-4 py-3 font-mono text-muted">&lt;h=y&gt;...&lt;/h&gt;</td><td className="px-4 py-3 text-right"><span className="bg-yellow/20 text-yellow px-1 rounded">yellow</span></td></tr>
                                <tr><td className="px-4 py-3 font-mono text-muted">&lt;h=r&gt;...&lt;/h&gt;</td><td className="px-4 py-3 text-right"><span className="bg-red/20 text-red px-1 rounded">red</span></td></tr>
                                <tr><td className="px-4 py-3 font-mono text-muted">&lt;h=b&gt;...&lt;/h&gt;</td><td className="px-4 py-3 text-right"><span className="bg-blue/20 text-blue px-1 rounded">blue</span></td></tr>
                                <tr><td className="px-4 py-3 font-mono text-muted">&lt;h=g&gt;...&lt;/h&gt;</td><td className="px-4 py-3 text-right"><span className="bg-green/20 text-green px-1 rounded">green</span></td></tr>
                                <tr><td className="px-4 py-3 font-mono text-muted">&lt;h=p&gt;...&lt;/h&gt;</td><td className="px-4 py-3 text-right"><span className="bg-purple/20 text-purple px-1 rounded">purple</span></td></tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="space-y-2">
                        <h4 className="font-bold mb-2">Special Patterns</h4>
                        <ul className="space-y-2 text-sm text-muted">
                            <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span><strong className="text-text">Cue tags:</strong> Put labels like <code className="bg-panel px-1 rounded">(Cause)</code> or <code className="bg-panel px-1 rounded">(Character)</code> at the front of a term.</span></li>
                            <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span><strong className="text-text">Slabs:</strong> Use <code className="bg-panel px-1 rounded">[[text]]</code> when you want a chunk to feel more like a callout than standard inline formatting.</span></li>
                            <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span><strong className="text-text">Highlights:</strong> Use colored highlight tags when a date, exception, or critical term must stand out instantly.</span></li>
                        </ul>
                    </div>

                    <h3 className="text-xl font-bold mt-8 mb-4">Raw Text Patterns</h3>
                    <div className="border border-outline rounded-lg p-4 font-mono text-sm text-muted space-y-1">
                        <div>Term / Definition</div>
                        <div>Term / Definition /// Year</div>
                        <div>Term / Definition /// Year ||| https://image-url</div>
                        <div>{'>'} Bullet content to append to the previous card</div>
                    </div>
                    <p className="text-muted text-sm">
                        You can customize separators in Raw Text Import, so you are not locked to <code className="bg-panel-2 px-1 rounded">/</code>,
                        <code className="bg-panel-2 px-1 rounded ml-1">///</code>, or line breaks.
                    </p>
                    <div className="space-y-2">
                        <h4 className="font-bold mb-2">Raw Text Workflow Tips</h4>
                        <ul className="space-y-2 text-sm text-muted">
                            <li className="flex items-start gap-2"><Check size={14} className="text-accent shrink-0 mt-0.5" /><span>Paste rough material in first, then switch to Visual Editor for polishing and reordering.</span></li>
                            <li className="flex items-start gap-2"><Check size={14} className="text-accent shrink-0 mt-0.5" /><span>Use image URLs when portability matters, because direct uploaded image data is not ideal for downloaded set files.</span></li>
                            <li className="flex items-start gap-2"><Check size={14} className="text-accent shrink-0 mt-0.5" /><span>Use append lines when one card needs extra bullets or explanation without breaking it into multiple cards.</span></li>
                        </ul>
                    </div>
                </div>
            )
        },
        {
            id: 'study',
            title: 'Study Modes & Mastery',
            icon: <BookOpen size={20} />,
            content: (
                <div className="space-y-6 text-text">
                    <p className="text-lg leading-relaxed">
                        Choose your mode per session, then use Settings to make the app more forgiving, more strict, or more focused depending on what you are trying to practice.
                    </p>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <h4 className="font-bold mb-2">Learn Mode</h4>
                            <p className="text-sm text-muted">
                                Answer prompts directly and get answer checking, mastery updates, streak feedback, and stricter review behavior. Learn Mode supports typed answers, multiple choice, starred-only focus, keybinds, answer direction switching, and tolerance rules for spelling and formatting differences.
                            </p>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-bold mb-2">Flashcards Mode</h4>
                            <p className="text-sm text-muted">
                                Traditional flip-through review for quick memorization runs. Flashcards Mode also supports a sort-style workflow where cards get pushed into review or got-it piles.
                            </p>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <h4 className="font-bold mb-2">Learn Sub-Modes</h4>
                            <ul className="space-y-2 text-sm text-muted">
                                <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span><strong className="text-text">Zen:</strong> straightforward progression with mastery gains and optional brutal resets.</span></li>
                                <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span><strong className="text-text">Batch:</strong> review cards in chunks, revisit mistakes inside the batch, and get break screens between rounds.</span></li>
                            </ul>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-bold mb-2">Study Direction</h4>
                            <p className="text-sm text-muted">The <strong className="text-text">Answer With</strong> setting flips what you are shown and what you must supply, so the same set can train recognition or recall.</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h4 className="font-bold mb-3">Mastery States</h4>
                        <p className="text-sm text-muted mb-4">
                            Cards progress as you answer correctly; mastery gives you an at-a-glance signal for what is new, what is still in progress, and what feels stable.
                        </p>
                        <MasteryDemo />
                    </div>

                    <h3 className="text-xl font-bold mt-8 mb-4">Answer Styles</h3>
                    <ul className="space-y-2 text-muted">
                        <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span><strong className="text-text">Standard:</strong> typed answer input with spelling forgiveness, retype-on-mistake, and answer checking across main and extra fields.</span></li>
                        <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span><strong className="text-text">Multiple Choice:</strong> option-based answering when you want less typing and faster pacing.</span></li>
                        <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span><strong className="text-text">Random Choice:</strong> Flashcardsish can build option sets from the other answers already in your deck.</span></li>
                    </ul>

                    <h3 className="text-xl font-bold mt-8 mb-4">Important Study Settings</h3>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-2">
                            <div className="text-accent font-bold mb-2">Accuracy Controls</div>
                            <p className="text-muted">Turn on spelling forgiveness, ignore diacritics, ignore capitalization, forgive leading &quot;the&quot;, and adjust wiggle room when you want the app to focus on knowledge rather than exact typing.</p>
                        </div>
                        <div className="space-y-2">
                            <div className="text-accent font-bold mb-2">Pressure Controls</div>
                            <p className="text-muted">Enable retype-on-mistake, starred-only study, shuffle, and brutal mode when you want more deliberate repetition or want to isolate weak cards.</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h4 className="font-bold mb-2">Keybinds</h4>
                        <p className="text-sm text-muted">Flashcardsish supports customizable study keybinds for answer choices, card flipping, and answer submission. Open the Keybinds panel from Settings if you prefer keyboard-heavy study sessions.</p>
                    </div>

                    <h3 className="text-xl font-bold mt-8 mb-4">Multistudy vs Combine</h3>
                    <div className="mb-4 flex justify-center">
                        <MultistudyDemo />
                    </div>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div className="space-y-2">
                            <div className="text-accent font-bold mb-1">Multistudy</div>
                            <p className="text-muted">Temporary joint session from selected sets. Original sets stay intact, which is ideal for chapter bundles, unit review, and exam prep.</p>
                        </div>
                        <div className="space-y-2">
                            <div className="text-accent font-bold mb-1">Combine</div>
                            <p className="text-muted">Creates a brand-new merged set you can keep and edit independently when you actually want one new permanent set.</p>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'library',
            title: 'Library Organization',
            icon: <FolderOpen size={20} />,
            content: (
                <div className="space-y-6 text-text">
                    <p className="text-lg leading-relaxed">
                        Organize by folders, tags, stars, search, and batch actions so large libraries stay manageable even after you have many classes or units in one place.
                    </p>

                    <div className="my-6 flex justify-center">
                        <FolderDemo />
                    </div>

                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <h4 className="font-bold mb-2">Search + Filters</h4>
                            <p className="text-sm text-muted">Search by set name or tag, then narrow further by clicking tags in the Library when a folder is still too broad.</p>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-bold mb-2">Folders</h4>
                            <p className="text-sm text-muted">Put sets into color-coded folders for broad structure such as course, semester, topic area, or project.</p>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                            <h4 className="font-bold mb-2">Stars</h4>
                            <p className="text-sm text-muted">Stars live at the card level, not just the set level, so you can keep one set and still carve out a focused review subset.</p>
                        </div>
                    </div>

                    <h3 className="text-xl font-bold mt-8 mb-4">Batch Actions</h3>
                    <ul className="space-y-3 text-muted">
                        <li className="flex items-center gap-3">
                            <FolderOpen className="text-accent shrink-0" size={18} />
                            <span><strong className="text-text">Create Folder</strong> from selected sets.</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <ChevronDown className="text-accent shrink-0" size={18} />
                            <span><strong className="text-text">Move to...</strong> to re-organize sets quickly.</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <Layers className="text-accent shrink-0" size={18} />
                            <span><strong className="text-text">Multistudy/Combine</strong> for multi-set workflows.</span>
                        </li>
                    </ul>

                    <div className="space-y-2">
                        <h4 className="font-bold mb-2">Set Tags vs Cue Tags</h4>
                        <p className="text-sm text-muted">Set tags help organize the Library and power filtering. Cue tags live inside cards and help you interpret the card itself during study. They work together, but they solve different problems.</p>
                    </div>

                    <h3 className="text-xl font-bold mt-8 mb-4">Set-Level Actions</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <h4 className="font-bold mb-2">Edit</h4>
                            <p className="text-sm text-muted">Open the builder with the current set preloaded.</p>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-bold mb-2">Duplicate</h4>
                            <p className="text-sm text-muted">Clone for alternate study styles or versions.</p>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-bold mb-2">Export</h4>
                            <p className="text-sm text-muted">Download an individual <code className="bg-panel px-1 rounded">.flashcards</code> file for backup, sharing, or manual editing.</p>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-bold mb-2">Delete</h4>
                            <p className="text-sm text-muted">Removes the set permanently after confirmation.</p>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'sync-backup',
            title: 'Sync, Backup & Privacy',
            icon: <User size={20} />,
            content: (
                <div className="space-y-6 text-text">
                    <p className="text-lg leading-relaxed">
                        Google sign-in is optional. Use it for free sync and easier image hosting, or stay local if you prefer a single-device setup. Flashcardsish supports both approaches.
                    </p>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <h4 className="font-bold mb-2">Local Storage</h4>
                            <p className="text-sm text-muted">Great for private, offline-ish, or single-device use. Local-only sets stay on the current device until you explicitly move them to cloud storage.</p>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-bold mb-2">Cloud Storage</h4>
                            <p className="text-sm text-muted">Great when you study on multiple devices or want Google Drive-backed persistence. Sync is optional, not required to use the app.</p>
                        </div>
                    </div>

                    <h3 className="text-xl font-bold mt-8 mb-4">What Syncs</h3>
                    <ul className="space-y-3 text-muted">
                        <li className="flex items-start gap-3"><Check className="text-accent shrink-0 mt-0.5" size={18} /><span>Sets, cards, and card content</span></li>
                        <li className="flex items-start gap-3"><Check className="text-accent shrink-0 mt-0.5" size={18} /><span>Mastery progress and starred state</span></li>
                        <li className="flex items-start gap-3"><Check className="text-accent shrink-0 mt-0.5" size={18} /><span>Folders, tags, and ongoing sessions</span></li>
                        <li className="flex items-start gap-3"><Check className="text-accent shrink-0 mt-0.5" size={18} /><span>Global settings relevant to study behavior</span></li>
                    </ul>

                    <h3 className="text-xl font-bold mt-8 mb-4">Backup Options</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <h4 className="font-bold mb-2">Export All Data</h4>
                            <p className="text-sm text-muted">Settings-level full backup for migration or recovery when you want a snapshot of more than one set.</p>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-bold mb-2">Import Set Files</h4>
                            <p className="text-sm text-muted">Library-level import for shared <code className="bg-panel px-1 rounded">.flashcards</code> files or archived sets you previously exported.</p>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <h4 className="font-bold mb-2">Image Portability Note</h4>
                        <p className="text-sm text-muted">If a set uses directly uploaded image data, exported set files are not the best long-term transport format for those images. If portability matters, prefer image URLs.</p>
                    </div>

                    <div className="space-y-2 mt-8">
                        <h4 className="font-bold text-accent mb-2">Privacy Note</h4>
                        <p className="text-muted">
                            Flashcardsish does not use ads or sell user data. Check the in-app Privacy Policy for exact storage, deletion, and third-party service details, especially if you use optional Google sync or sharing features.
                        </p>
                    </div>
                </div>
            )
        },
        {
            id: 'open-source',
            title: 'Open Source & Local Run',
            icon: <Code size={20} />,
            content: (
                <div className="space-y-6 text-text">
                    <p className="text-lg leading-relaxed">
                        Flashcardsish is open source under <strong className="text-accent">CC BY-NC 4.0</strong>. You can inspect the code, fork the project, run it locally, and adapt it for your own non-commercial workflows.
                    </p>

                    <a
                        href="https://github.com/RockhopperHD/flashcardsish"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-accent hover:text-text transition-colors"
                    >
                        <Github size={24} />
                        <span className="font-bold">View Repository</span>
                        <ExternalLink size={16} className="text-muted" />
                    </a>

                    <h3 className="text-xl font-bold mt-8 mb-4">Local Options</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="border border-outline rounded-lg p-4 space-y-3">
                            <h4 className="font-bold">Offline-Only Mode</h4>
                            <ol className="text-sm text-text space-y-2 list-decimal pl-5">
                                <li>Clone or download the repository.</li>
                                <li>Open the `flashcardsish` project folder in your terminal.</li>
                                <li>Run `npm install` once.</li>
                                <li>Run `npm run dev:offline` and open the local URL Vite gives you.</li>
                            </ol>
                            <p className="text-sm text-muted">
                                Best for running the full Flashcardsish experience locally without Google setup. Your sets and progress stay on this machine until you export them back out.
                            </p>
                        </div>
                        <div className="border border-outline rounded-lg p-4 space-y-3">
                            <h4 className="font-bold">Backup and Restore</h4>
                            <ol className="text-sm text-text space-y-2 list-decimal pl-5">
                                <li>Open Settings.</li>
                                <li>Go to Global Settings.</li>
                                <li>Use Export Data to download a full JSON backup.</li>
                                <li>Use Restore Backup from the same area when you need to bring that snapshot back.</li>
                            </ol>
                            <p className="text-sm text-muted">
                                Best when you want a portable copy of your sets, folders, tags, settings, and progress without relying on cloud sync.
                            </p>
                        </div>
                    </div>

                    <p className="text-muted">
                        Offline-only mode keeps the main app feel intact while separating local storage from the hosted app. Use full backups when you want to move or preserve that local data.
                    </p>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <h4 className="font-bold mb-2">Why Run Locally?</h4>
                            <p className="text-sm text-muted">Local runs are useful for personal customization, offline-leaning study, testing changes, or simply keeping your workflow closer to your own machine.</p>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-bold mb-2">Data Portability</h4>
                            <p className="text-sm text-muted">Exported set files and open source code mean the app is not a black box. You can inspect the project and keep backups outside the live hosted app.</p>
                        </div>
                    </div>

                    <div className="space-y-2 mt-8">
                        <h4 className="font-bold mb-2">License</h4>
                        <p className="text-muted text-sm">
                            Licensed under <a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Creative Commons Attribution-NonCommercial 4.0</a>.
                        </p>
                    </div>
                </div>
            )
        },
        {
            id: 'contact',
            title: 'Contact',
            icon: <Mail size={20} />,
            content: (
                <div className="space-y-6 text-text">
                    <p className="text-lg leading-relaxed">
                        Questions, bug reports, or feedback are welcome.
                    </p>
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="space-y-2">
                            <h4 className="font-bold mb-2">Email</h4>
                            <a href="mailto:owenw2023@gmail.com" className="text-muted hover:text-text transition-colors">owenw2023@gmail.com</a>
                        </div>
                        <div className="space-y-2">
                            <h4 className="font-bold mb-2">Website</h4>
                            <a href="https://www.owenwhelan.com" target="_blank" rel="noopener noreferrer" className="text-muted hover:text-text transition-colors">owenwhelan.com</a>
                        </div>
                    </div>
                </div>
            )
        },
        {
            id: 'credits',
            title: 'Credits',
            icon: <LayoutList size={20} />,
            content: (
                <div className="space-y-6 text-text">
                    <div className="pt-2 text-center">
                        <p className="text-muted font-medium mb-2 uppercase tracking-wide text-xs">Created by</p>
                        <h2 className="text-3xl mb-4 text-text" style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}>
                            Owen Whelan
                        </h2>
                        <p className="text-muted max-w-2xl mx-auto leading-relaxed">
                            Flashcardsish was built as an accessible, no-ads alternative focused on practical study workflows.
                        </p>
                    </div>

                    <h3 className="text-xl font-bold mt-8 mb-4">Built With</h3>
                    <ul className="space-y-3 text-muted">
                        <li className="flex items-end justify-between gap-2 overflow-hidden"><div className="flex items-center gap-2 mb-0.5 shrink-0"><div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" /><strong className="text-text">React</strong></div><div className="flex-1 border-b-2 border-dotted border-muted/30 mb-1.5 mx-1 min-w-[20px]" /><span className="text-muted text-sm text-right shrink-0 mb-0.5">UI Framework</span></li>
                        <li className="flex items-end justify-between gap-2 overflow-hidden"><div className="flex items-center gap-2 mb-0.5 shrink-0"><div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" /><strong className="text-text">TypeScript</strong></div><div className="flex-1 border-b-2 border-dotted border-muted/30 mb-1.5 mx-1 min-w-[20px]" /><span className="text-muted text-sm text-right shrink-0 mb-0.5">Type Safety</span></li>
                        <li className="flex items-end justify-between gap-2 overflow-hidden"><div className="flex items-center gap-2 mb-0.5 shrink-0"><div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" /><strong className="text-text">Tailwind CSS</strong></div><div className="flex-1 border-b-2 border-dotted border-muted/30 mb-1.5 mx-1 min-w-[20px]" /><span className="text-muted text-sm text-right shrink-0 mb-0.5">Styling</span></li>
                        <li className="flex items-end justify-between gap-2 overflow-hidden"><div className="flex items-center gap-2 mb-0.5 shrink-0"><div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" /><strong className="text-text">Vite</strong></div><div className="flex-1 border-b-2 border-dotted border-muted/30 mb-1.5 mx-1 min-w-[20px]" /><span className="text-muted text-sm text-right shrink-0 mb-0.5">Build Tooling</span></li>
                        <li className="flex items-end justify-between gap-2 overflow-hidden"><div className="flex items-center gap-2 mb-0.5 shrink-0"><div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" /><strong className="text-text">Google Drive</strong></div><div className="flex-1 border-b-2 border-dotted border-muted/30 mb-1.5 mx-1 min-w-[20px]" /><span className="text-muted text-sm text-right shrink-0 mb-0.5">Sync + Storage</span></li>
                    </ul>
                </div>
            )
        }
    ];

    const activeDoc = sections.find((s) => s.id === activeSection);

    return (
        <div className="w-full max-w-6xl mx-auto pb-20 pt-8 px-6">
            <div className="flex items-center gap-4 mb-8">
                <button
                    onClick={onBack}
                    className="group flex items-center gap-2 text-muted hover:text-text font-bold text-sm uppercase tracking-wider transition-colors"
                >
                    <div className="p-2 rounded-full border border-outline group-hover:bg-panel transition-colors">
                        <ArrowLeft size={16} />
                    </div>
                    Back
                </button>
            </div>

            <div className="flex gap-8">
                <div className="w-72 shrink-0 hidden md:block">
                    <div className="sticky top-24 bg-panel border border-outline rounded-2xl p-4">
                        <h3 className="text-xs font-bold text-muted uppercase tracking-widest mb-4 px-2">
                            Documentation
                        </h3>
                        <nav className="space-y-1">
                            {sections.map((section) => (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSection(section.id)}
                                    className={clsx(
                                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all text-sm",
                                        activeSection === section.id
                                            ? "bg-accent/10 text-accent border border-accent/20"
                                            : "text-muted hover:text-text hover:bg-panel-2"
                                    )}
                                >
                                    <span className={clsx("shrink-0", activeSection === section.id ? "text-accent" : "text-muted")}>
                                        {section.icon}
                                    </span>
                                    <span className="font-medium truncate">{section.title}</span>
                                </button>
                            ))}
                        </nav>
                    </div>
                </div>

                <div className="flex-1 min-w-0">
                    <div className="mb-8">
                        <div className="mb-2">
                            <h1 className="text-3xl text-text" style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}>
                                {activeDoc?.title}
                            </h1>
                        </div>
                    </div>

                    <div className="bg-panel border border-outline rounded-2xl p-8">
                        {activeDoc?.content}
                    </div>

                    <div className="md:hidden mt-6">
                        <label className="text-xs font-bold text-muted uppercase tracking-widest mb-2 block">
                            Jump to Section
                        </label>
                        <select
                            value={activeSection}
                            onChange={(e) => setActiveSection(e.target.value)}
                            className="w-full bg-panel-2 border border-outline rounded-xl px-4 py-3 text-text font-medium focus:outline-none focus:border-accent"
                        >
                            {sections.map((section) => (
                                <option key={section.id} value={section.id}>
                                    {section.title}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
};
