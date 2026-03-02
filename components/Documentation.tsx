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
            <div className={clsx("inline-flex items-center gap-2 px-4 py-2 rounded-xl border transition-all duration-500", style.bg, style.border)}>
                <div className="flex flex-col gap-1">
                    <div className={clsx("w-2 h-2 rounded-full transition-colors duration-500", style.dot1)}></div>
                    <div className={clsx("w-2 h-2 rounded-full transition-colors duration-500", style.dot2)}></div>
                </div>
                <span className={clsx("text-sm font-bold transition-colors duration-500", style.labelColor)}>{style.label}</span>
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

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-panel-2 border border-outline rounded-xl p-5">
                            <h4 className="font-bold text-accent mb-2 flex items-center gap-2">
                                <Cloud size={18} /> Cloud Sync
                            </h4>
                            <p className="text-sm text-muted">Optional Google sign-in for free cross-device sync.</p>
                            <div className="mt-4 flex justify-center">
                                <CloudSyncDemo />
                            </div>
                        </div>
                        <div className="bg-panel-2 border border-outline rounded-xl p-5">
                            <h4 className="font-bold text-accent mb-2 flex items-center gap-2">
                                <Calendar size={18} /> Flexible Cards
                            </h4>
                            <p className="text-sm text-muted">Year fields, custom fields, images, and cue tags in one card model.</p>
                            <div className="mt-4 flex justify-center">
                                <CustomFieldsDemo />
                            </div>
                        </div>
                        <div className="bg-panel-2 border border-outline rounded-xl p-5">
                            <h4 className="font-bold text-accent mb-2 flex items-center gap-2">
                                <Layers size={18} /> Multistudy
                            </h4>
                            <p className="text-sm text-muted">Study multiple sets at once without permanently merging them.</p>
                            <div className="mt-4 flex justify-center">
                                <MultistudyDemo />
                            </div>
                        </div>
                        <div className="bg-panel-2 border border-outline rounded-xl p-5">
                            <h4 className="font-bold text-accent mb-2 flex items-center gap-2">
                                <Download size={18} /> Backup + Portability
                            </h4>
                            <p className="text-sm text-muted">Export individual sets or full data so your content is portable.</p>
                            <div className="mt-4 flex justify-center">
                                <DownloadDemo />
                            </div>
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
                        New user flow: create a set, add cards, save, then study in Learn or Flashcards mode.
                    </p>

                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-accent text-bg flex items-center justify-center font-bold shrink-0">1</div>
                        <div className="flex-1">
                            <h4 className="font-bold text-lg mb-2">Create a Set</h4>
                            <p className="text-muted mb-3">
                                From the Library, choose <strong className="text-accent">Create</strong> and open the builder.
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
                            <p className="text-muted mb-2">At minimum, each card needs a term and a definition.</p>
                            <ul className="space-y-2 text-muted text-sm">
                                <li className="flex items-start gap-2">
                                    <ChevronRight size={14} className="text-accent shrink-0 mt-0.5" />
                                    <span>Optional extras: year, images, custom fields, and tags.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <ChevronRight size={14} className="text-accent shrink-0 mt-0.5" />
                                    <span>Use formatting syntax to improve readability and scanning speed.</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <ChevronRight size={14} className="text-accent shrink-0 mt-0.5" />
                                    <span>Star cards while building if you already know what needs extra review.</span>
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="flex gap-4">
                        <div className="w-10 h-10 rounded-full bg-accent text-bg flex items-center justify-center font-bold shrink-0">3</div>
                        <div className="space-y-4">
                            <h4 className="font-bold text-lg">Save and Study</h4>
                            <p className="text-muted">
                                Use <strong className="text-accent">Save to Library</strong>, then open the set and choose a study mode.
                            </p>
                            <div className="flex flex-wrap items-center gap-8">
                                <AnswerDemo />
                                <MasteryDemo />
                            </div>
                        </div>
                    </div>

                    <div className="bg-panel-2 border border-outline rounded-xl p-5">
                        <h4 className="font-bold mb-2">Need a walkthrough?</h4>
                        <p className="text-muted text-sm">
                            Open Settings and run the guided onboarding tour to see the full flow step-by-step.
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
                <div className="space-y-6 text-text">
                    <p className="text-lg leading-relaxed">
                        The builder has two entry points: <strong className="text-accent">Visual Editor</strong> for structured editing,
                        and <strong className="text-accent">Raw Text</strong> for bulk input.
                    </p>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-panel-2 border border-outline rounded-xl p-4">
                            <h4 className="font-bold mb-2">Visual Editor</h4>
                            <ul className="space-y-2 text-sm text-muted">
                                <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span>Drag cards with the handle to reorder.</span></li>
                                <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span>Use WYSIWYG to preview raw markdown versus rendered output.</span></li>
                                <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span>Use inline actions to duplicate, swap sides, and star cards.</span></li>
                            </ul>
                        </div>
                        <div className="bg-panel-2 border border-outline rounded-xl p-4">
                            <h4 className="font-bold mb-2">Set Configuration</h4>
                            <ul className="space-y-2 text-sm text-muted">
                                <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span>Rename “Term” and “Definition” labels for your subject.</span></li>
                                <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span>Add year + up to multiple custom fields on either side.</span></li>
                                <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span>Set tags and import behavior from one place.</span></li>
                            </ul>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div className="bg-panel-2 border border-outline rounded-xl p-5">
                            <h4 className="font-bold mb-2 flex items-center gap-2"><Star size={16} className="text-yellow" /> Starred Focus</h4>
                            <p className="text-sm text-muted mb-4">
                                Star cards during editing so you can run quick focused sessions later.
                            </p>
                            <div className="flex justify-center">
                                <StarDemo />
                            </div>
                        </div>
                        <div className="bg-panel-2 border border-outline rounded-xl p-5">
                            <h4 className="font-bold mb-2">Autosave Drafts</h4>
                            <p className="text-sm text-muted">
                                Builder work is autosaved and recoverable if you accidentally leave before finishing.
                            </p>
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
                        Flashcardsish supports markdown-style formatting and raw-text set creation for fast editing.
                    </p>

                    <div className="my-6 flex justify-center">
                        <FormattingDemo />
                    </div>

                    <h3 className="text-xl font-bold mt-8 mb-4">Formatting Syntax</h3>
                    <div className="bg-panel-2 border border-outline rounded-xl overflow-hidden">
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
                    <div className="bg-panel-2 border border-outline rounded-xl overflow-hidden">
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

                    <h3 className="text-xl font-bold mt-8 mb-4">Raw Text Patterns</h3>
                    <div className="bg-panel-2 border border-outline rounded-xl p-4 font-mono text-sm text-muted space-y-1">
                        <div>Term / Definition</div>
                        <div>Term / Definition /// Year</div>
                        <div>Term / Definition /// Year ||| https://image-url</div>
                        <div>{'>'} Bullet content to append to the previous card</div>
                    </div>
                    <p className="text-muted text-sm">
                        You can customize separators in Raw Text Import, so you are not locked to <code className="bg-panel-2 px-1 rounded">/</code>,
                        <code className="bg-panel-2 px-1 rounded ml-1">///</code>, or line breaks.
                    </p>
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
                        Choose your mode per session and tune strictness in Settings.
                    </p>

                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-panel-2 border border-outline rounded-xl p-4">
                            <h4 className="font-bold mb-2">Learn Mode</h4>
                            <p className="text-sm text-muted">
                                Answer prompts directly. Works with spelling forgiveness, keybinds, starred filtering, and answer-style options.
                            </p>
                        </div>
                        <div className="bg-panel-2 border border-outline rounded-xl p-4">
                            <h4 className="font-bold mb-2">Flashcards Mode</h4>
                            <p className="text-sm text-muted">
                                Traditional flip-through review for quick memorization runs.
                            </p>
                        </div>
                    </div>

                    <div className="bg-panel-2 border border-outline rounded-xl p-5">
                        <h4 className="font-bold mb-3">Mastery States</h4>
                        <p className="text-sm text-muted mb-4">
                            Cards progress as you answer correctly; mastery gives you an at-a-glance progress signal.
                        </p>
                        <MasteryDemo />
                    </div>

                    <h3 className="text-xl font-bold mt-8 mb-4">Answer Styles</h3>
                    <ul className="space-y-2 text-muted">
                        <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span><strong className="text-text">Standard:</strong> typed answer input.</span></li>
                        <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span><strong className="text-text">Multiple Choice:</strong> manual option selection.</span></li>
                        <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /><span><strong className="text-text">Random Choice:</strong> AI-powered option generation (requires AI key setup).</span></li>
                    </ul>

                    <h3 className="text-xl font-bold mt-8 mb-4">Multistudy vs Combine</h3>
                    <div className="mb-4 flex justify-center">
                        <MultistudyDemo />
                    </div>
                    <div className="grid md:grid-cols-2 gap-4 text-sm">
                        <div className="bg-panel-2 border border-outline rounded-xl p-4">
                            <div className="text-accent font-bold mb-1">Multistudy</div>
                            <p className="text-muted">Temporary joint session from selected sets. Original sets stay intact.</p>
                        </div>
                        <div className="bg-panel-2 border border-outline rounded-xl p-4">
                            <div className="text-accent font-bold mb-1">Combine</div>
                            <p className="text-muted">Creates a brand-new merged set you can keep and edit independently.</p>
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
                        Organize by folders, tags, stars, and batch actions so large libraries stay manageable.
                    </p>

                    <div className="my-6 flex justify-center">
                        <FolderDemo />
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

                    <h3 className="text-xl font-bold mt-8 mb-4">Set-Level Actions</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-panel-2 border border-outline rounded-xl p-4">
                            <h4 className="font-bold mb-2 flex items-center gap-2"><Pencil size={16} className="text-accent" /> Edit</h4>
                            <p className="text-sm text-muted">Open the builder with the current set preloaded.</p>
                        </div>
                        <div className="bg-panel-2 border border-outline rounded-xl p-4">
                            <h4 className="font-bold mb-2 flex items-center gap-2"><Copy size={16} className="text-accent" /> Duplicate</h4>
                            <p className="text-sm text-muted">Clone for alternate study styles or versions.</p>
                        </div>
                        <div className="bg-panel-2 border border-outline rounded-xl p-4">
                            <h4 className="font-bold mb-2 flex items-center gap-2"><Download size={16} className="text-accent" /> Export</h4>
                            <p className="text-sm text-muted">Download an individual <code className="bg-panel px-1 rounded">.flashcards</code> file.</p>
                        </div>
                        <div className="bg-panel-2 border border-outline rounded-xl p-4">
                            <h4 className="font-bold mb-2 flex items-center gap-2"><Trash2 size={16} className="text-red" /> Delete</h4>
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
                        Google sign-in is optional. Use it for sync and image hosting; stay local if you prefer.
                    </p>

                    <h3 className="text-xl font-bold mt-8 mb-4">What Syncs</h3>
                    <ul className="space-y-3 text-muted">
                        <li className="flex items-start gap-3"><Check className="text-accent shrink-0 mt-0.5" size={18} /><span>Sets, cards, and card content</span></li>
                        <li className="flex items-start gap-3"><Check className="text-accent shrink-0 mt-0.5" size={18} /><span>Mastery progress and starred state</span></li>
                        <li className="flex items-start gap-3"><Check className="text-accent shrink-0 mt-0.5" size={18} /><span>Folders, tags, and ongoing sessions</span></li>
                        <li className="flex items-start gap-3"><Check className="text-accent shrink-0 mt-0.5" size={18} /><span>Global settings relevant to study behavior</span></li>
                    </ul>

                    <h3 className="text-xl font-bold mt-8 mb-4">Backup Options</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-panel-2 border border-outline rounded-xl p-4">
                            <h4 className="font-bold mb-2 flex items-center gap-2"><Download size={16} className="text-accent" /> Export All Data</h4>
                            <p className="text-sm text-muted">Settings-level full backup for migration or recovery.</p>
                        </div>
                        <div className="bg-panel-2 border border-outline rounded-xl p-4">
                            <h4 className="font-bold mb-2 flex items-center gap-2"><Upload size={16} className="text-accent" /> Import Set Files</h4>
                            <p className="text-sm text-muted">Library-level import for shared <code className="bg-panel px-1 rounded">.flashcards</code> files.</p>
                        </div>
                    </div>

                    <div className="bg-panel-2 border border-outline rounded-xl p-5 mt-8">
                        <h4 className="font-bold text-accent mb-2 flex items-center gap-2"><User size={18} className="text-accent" /> Privacy Note</h4>
                        <p className="text-muted">
                            Flashcardsish does not use ads or sell user data. Check the in-app Privacy Policy for exact storage and deletion details.
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
                        Flashcardsish is open source under <strong className="text-accent">CC BY-NC 4.0</strong>. You can inspect, fork, and run it locally.
                    </p>

                    <a
                        href="https://github.com/RockhopperHD/flashcardsish"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-3 px-5 py-3 bg-panel-2 border border-outline rounded-xl hover:border-accent transition-colors"
                    >
                        <Github size={24} />
                        <span className="font-bold">View Repository</span>
                        <ExternalLink size={16} className="text-muted" />
                    </a>

                    <h3 className="text-xl font-bold mt-8 mb-4">Run Locally</h3>
                    <div className="bg-panel-2 border border-outline rounded-xl p-4 font-mono text-sm space-y-2">
                        <div>git clone https://github.com/RockhopperHD/flashcardsish.git</div>
                        <div>npm install</div>
                        <div>npm run dev</div>
                    </div>

                    <p className="text-muted">
                        To enable cloud sync locally, configure Google OAuth credentials as described in the README.
                    </p>

                    <div className="bg-panel-2 border border-outline rounded-xl p-5 mt-8">
                        <h4 className="font-bold mb-2 flex items-center gap-2"><FileText size={18} className="text-accent" /> License</h4>
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
                    <div className="grid md:grid-cols-2 gap-4">
                        <a href="mailto:owenw2023@gmail.com" className="flex flex-col items-center justify-center p-6 bg-panel-2 border border-outline rounded-xl hover:border-accent transition-all group">
                            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Mail size={24} className="text-accent" />
                            </div>
                            <span className="font-bold text-lg mb-1">Email</span>
                            <span className="text-muted text-sm">owenw2023@gmail.com</span>
                        </a>
                        <a href="https://www.owenwhelan.com" target="_blank" rel="noopener noreferrer" className="flex flex-col items-center justify-center p-6 bg-panel-2 border border-outline rounded-xl hover:border-accent transition-all group">
                            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Globe size={24} className="text-accent" />
                            </div>
                            <span className="font-bold text-lg mb-1">Website</span>
                            <span className="text-muted text-sm">owenwhelan.com</span>
                        </a>
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
                    <div className="bg-panel-2 border border-outline rounded-xl p-8 text-center">
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
                    <div className="sticky top-24">
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
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 rounded-xl bg-accent/10 border border-accent/20">
                                <span className="text-accent">{activeDoc?.icon}</span>
                            </div>
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
