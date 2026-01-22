import React, { useState, useEffect } from 'react';
import { ArrowLeft, BookOpen, Sparkles, PlayCircle, FileText, FolderOpen, Layers, User, Code, Heart, Mail, ChevronRight, Star, Check, X, Github, Calendar, Download, Cloud, Palette, ChevronDown, Pencil, Copy, Trash2, Upload, ExternalLink, Monitor, Smartphone, LayoutTemplate, ArrowDown, LayoutList, Globe } from 'lucide-react';
import clsx from 'clsx';

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
    const [activeSection, setActiveSection] = useState<string>('welcome');

    const sections: DocSection[] = [
        {
            id: 'welcome',
            title: 'Welcome! Why Flashcardsish?',
            icon: <Sparkles size={20} />,
            content: (
                <div className="space-y-6 text-text">
                    <p className="text-lg leading-relaxed">
                        <strong className="text-accent">Flashcardsish</strong> is a modern, easy to use flashcards app with all of the features you need and additions that make it even more helpful. It's focused first on the whole learning experience that digital flashcards create while still being focused on your content.
                    </p>

                    <h3 className="text-xl font-bold mt-8 mb-4">Key Features</h3>

                    <div className="grid md:grid-cols-2 gap-6 my-8">
                        <div className="bg-panel-2 border border-outline rounded-xl p-5">
                            <h4 className="font-bold text-accent mb-2 flex items-center gap-2">
                                <Cloud size={18} className="text-accent" /> Cloud Sync
                            </h4>
                            <p className="text-sm text-muted">Sign in to sync your cards across devices for free.</p>
                            <div className="mt-4 flex justify-center">
                                <CloudSyncDemo />
                            </div>
                        </div>
                        <div className="bg-panel-2 border border-outline rounded-xl p-5">
                            <h4 className="font-bold text-accent mb-2 flex items-center gap-2">
                                <Calendar size={18} className="text-accent" /> Custom Fields
                            </h4>
                            <p className="text-sm text-muted">Add fields for years, authors, categories, or anything else.</p>
                            <div className="mt-4 flex justify-center">
                                <CustomFieldsDemo />
                            </div>
                        </div>
                        <div className="bg-panel-2 border border-outline rounded-xl p-5">
                            <h4 className="font-bold text-accent mb-2 flex items-center gap-2">
                                <Download size={18} className="text-accent" /> Download Sets
                            </h4>
                            <p className="text-sm text-muted">Export sets as JSON files to backup, share, or edit.</p>
                            <div className="mt-4 flex justify-center">
                                <DownloadDemo />
                            </div>
                        </div>
                        <div className="bg-panel-2 border border-outline rounded-xl p-5">
                            <h4 className="font-bold text-accent mb-2 flex items-center gap-2">
                                <Layers size={18} className="text-accent" /> Multistudy
                            </h4>
                            <p className="text-sm text-muted">Combine multiple sets into one session without merging.</p>
                            <div className="mt-4 flex justify-center">
                                <MultistudyDemo />
                            </div>
                        </div>
                    </div>

                    <ul className="space-y-3 text-muted">
                        <li className="flex items-start gap-3">
                            <Star className="text-accent shrink-0 mt-0.5" size={18} />
                            <span><strong className="text-text">Star Important Cards</strong> <span className="text-muted ml-auto">Mark cards for focused study sessions</span></span>
                        </li>
                        <li className="flex items-start gap-3">
                            <Palette className="text-accent shrink-0 mt-0.5" size={18} />
                            <span><strong className="text-text">Format Your Cards</strong> <span className="text-muted ml-auto">Use bold, italic, and highlights</span></span>
                        </li>
                        <li className="flex items-start gap-3">
                            <Code className="text-accent shrink-0 mt-0.5" size={18} />
                            <span><strong className="text-text">Open Source</strong> <span className="text-muted ml-auto">Fully transparent and community-driven</span></span>
                        </li>
                    </ul>
                </div>
            )
        },
        {
            id: 'getting-started',
            title: 'Getting Started',
            icon: <PlayCircle size={20} />,
            content: (
                <div className="space-y-6 text-text">
                    <p className="text-lg leading-relaxed">
                        Get up and running with Flashcardsish in just a few steps.
                    </p>

                    <div className="space-y-8">
                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-accent text-bg flex items-center justify-center font-bold shrink-0">1</div>
                            <div className="flex-1">
                                <h4 className="font-bold text-lg mb-2">Create a Set</h4>
                                <p className="text-muted mb-3">Click the <strong className="text-accent">+ Create</strong> button in the Library to open the set builder.</p>

                                <div className="my-4 flex justify-center">
                                    <CardBuilderDemo />
                                </div>

                                <p className="text-muted mb-3">Enter your terms and definitions. Each card has several optional features:</p>
                                <ul className="space-y-2 text-muted text-sm ml-4">
                                    <li className="flex items-start gap-2">
                                        <ChevronRight size={14} className="text-accent shrink-0 mt-0.5" />
                                        <span><strong className="text-text">Year Field</strong> - Add a date or year that you'll also need to answer</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <ChevronRight size={14} className="text-accent shrink-0 mt-0.5" />
                                        <span><strong className="text-text">Custom Fields</strong> - Create your own fields like "Author", "Category", or anything else. These become additional required answers.</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <ChevronRight size={14} className="text-accent shrink-0 mt-0.5" />
                                        <span><strong className="text-text">Images</strong> - Add an image URL to display alongside the definition</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <ChevronRight size={14} className="text-accent shrink-0 mt-0.5" />
                                        <span><strong className="text-text">Formatting</strong> - Use **bold**, *italic*, highlights, and more in your definitions (see Formatting section)</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <ChevronRight size={14} className="text-accent shrink-0 mt-0.5" />
                                        <span><strong className="text-text">Star</strong> - Mark important cards for focused study sessions later</span>
                                    </li>
                                </ul>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-accent text-bg flex items-center justify-center font-bold shrink-0">2</div>
                            <div>
                                <h4 className="font-bold text-lg mb-2">Start Studying</h4>
                                <p className="text-muted mb-3">Open any set and click <strong className="text-accent">Learn</strong> to begin a study session.</p>
                                <div className="my-4">
                                    <AnswerDemo />
                                </div>
                                <p className="text-muted">Type your answer and press Enter. Get it right twice to master a card!</p>
                            </div>
                        </div>

                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-accent text-bg flex items-center justify-center font-bold shrink-0">3</div>
                            <div>
                                <h4 className="font-bold text-lg mb-2">Track Your Progress</h4>
                                <p className="text-muted mb-3">Each card has a mastery level that saves between sessions.</p>
                                <div className="my-4">
                                    <MasteryDemo />
                                </div>
                                <p className="text-muted">Cards progress from <span className="text-muted">New</span> → <span className="text-yellow">Learning</span> → <span className="text-green">Mastered</span>.</p>
                            </div>
                        </div>
                    </div>


                </div>
            )
        },
        {
            id: 'formatting',
            title: 'Formatting your Cards',
            icon: <FileText size={20} />,
            content: (
                <div className="space-y-6 text-text">
                    <p className="text-lg leading-relaxed">
                        Flashcardsish supports rich text formatting to make your cards more expressive and easier to read.
                    </p>

                    <div className="my-6 flex justify-center">
                        <FormattingDemo />
                    </div>

                    <h3 className="text-xl font-bold mt-8 mb-4">Markdown Basics</h3>
                    <div className="bg-panel-2 border border-outline rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-panel">
                                <tr>
                                    <th className="text-left px-4 py-3 text-muted font-medium">You Type</th>
                                    <th className="text-right px-4 py-3 text-muted font-medium">You Get</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-outline">
                                <tr>
                                    <td className="px-4 py-3 font-mono text-muted">**bold**</td>
                                    <td className="px-4 py-3 text-right"><strong>bold</strong></td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 font-mono text-muted">*italic*</td>
                                    <td className="px-4 py-3 text-right"><em>italic</em></td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 font-mono text-muted">`code`</td>
                                    <td className="px-4 py-3 text-right"><code className="bg-panel px-1.5 py-0.5 rounded text-accent">code</code></td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 font-mono text-muted">~~strikethrough~~</td>
                                    <td className="px-4 py-3 text-right"><s>strikethrough</s></td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 font-mono text-muted">__underline__</td>
                                    <td className="px-4 py-3 text-right"><u>underline</u></td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 font-mono text-muted">(Tag) Text</td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex flex-col items-end gap-1">
                                            <span className="inline-block bg-accent/10 text-accent px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">Tag</span>
                                            <span>Text</span>
                                        </div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <h3 className="text-xl font-bold mt-8 mb-4">Highlights</h3>
                    <p className="text-muted mb-4">
                        Use colored highlights to emphasize important information:
                    </p>
                    <div className="bg-panel-2 border border-outline rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-panel">
                                <tr>
                                    <th className="text-left px-4 py-3 text-muted font-medium">You Type</th>
                                    <th className="text-right px-4 py-3 text-muted font-medium">You Get</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-outline">
                                <tr>
                                    <td className="px-4 py-3 font-mono text-muted">&lt;h=y&gt;yellow&lt;/h&gt;</td>
                                    <td className="px-4 py-3 text-right"><span className="bg-yellow/20 text-yellow px-1 rounded">yellow</span></td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 font-mono text-muted">&lt;h=r&gt;red&lt;/h&gt;</td>
                                    <td className="px-4 py-3 text-right"><span className="bg-red/20 text-red px-1 rounded">red</span></td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 font-mono text-muted">&lt;h=b&gt;blue&lt;/h&gt;</td>
                                    <td className="px-4 py-3 text-right"><span className="bg-blue/20 text-blue px-1 rounded">blue</span></td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 font-mono text-muted">&lt;h=g&gt;green&lt;/h&gt;</td>
                                    <td className="px-4 py-3 text-right"><span className="bg-green/20 text-green px-1 rounded">green</span></td>
                                </tr>
                                <tr>
                                    <td className="px-4 py-3 font-mono text-muted">&lt;h=p&gt;purple&lt;/h&gt;</td>
                                    <td className="px-4 py-3 text-right"><span className="bg-purple/20 text-purple px-1 rounded">purple</span></td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <h3 className="text-xl font-bold mt-8 mb-4">Raw Text Mode</h3>
                    <p className="text-muted mb-4">If you'd prefer to write your cards out on a document elsewhere, you can use this format:</p>
                    <div className="bg-panel-2 border border-outline rounded-xl p-4 font-mono text-sm text-muted">
                        <div>Term / Definition /// Year</div>
                        <div className="text-accent">&&&</div>
                        <div>Next Term / Next Definition</div>
                    </div>
                    <ul className="mt-4 space-y-2 text-muted text-sm">
                        <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /> Use <code className="bg-panel-2 px-1 rounded">/</code> to separate term from definition</li>
                        <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /> Use <code className="bg-panel-2 px-1 rounded">///</code> to add an optional year</li>
                        <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /> Use <code className="bg-panel-2 px-1 rounded">&&&</code> on its own line to separate cards</li>
                    </ul>

                    <h3 className="text-xl font-bold mt-8 mb-4">JSON Schema (.flashcards files)</h3>
                    <p className="text-muted mb-4">
                        When you export a set, it's saved as a JSON file with the <code className="bg-panel-2 px-1 rounded">.flashcards</code> extension.
                        You can edit these files directly in any text editor. Here's the structure:
                    </p>
                    <div className="bg-panel-2 border border-outline rounded-xl p-4 font-mono text-sm text-muted overflow-x-auto">
                        <pre>{`{
  "id": "unique-id",
  "name": "Set Name",
  "cards": [
    {
      "id": "card-id",
      "term": ["Term"],
      "content": "Definition with **formatting**",
      "year": "1776",
      "mastery": 0,
      "star": false,
      "customFields": [
        { "name": "Author", "value": "Name" }
      ]
    }
  ],
  "customFieldNames": ["Author"]
}`}</pre>
                    </div>
                    <ul className="mt-4 space-y-2 text-muted text-sm">
                        <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /> <code className="bg-panel-2 px-1 rounded">term</code> is an array (for multiple accepted answers, though UI uses first)</li>
                        <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /> <code className="bg-panel-2 px-1 rounded">mastery</code>: 0 = New, 1 = Learning, 2+ = Mastered</li>
                        <li className="flex items-start gap-2"><ChevronRight size={14} className="text-accent shrink-0 mt-0.5" /> <code className="bg-panel-2 px-1 rounded">customFieldNames</code> at set level defines which fields exist</li>
                    </ul>
                </div>
            )
        },
        {
            id: 'manage-sets',
            title: 'Manage Sets',
            icon: <FolderOpen size={20} />,
            content: (
                <div className="space-y-6 text-text">
                    <p className="text-lg leading-relaxed">
                        Keep your flashcards organized with folders, starring, and easy duplication.
                    </p>

                    <div className="my-6 flex justify-center">
                        <FolderDemo />
                    </div>

                    <h3 className="text-xl font-bold mt-8 mb-4">Organizing with Folders</h3>
                    <p className="text-muted mb-4">
                        Select multiple sets using the checkboxes, then use the action bar to:
                    </p>
                    <ul className="space-y-3 text-muted">
                        <li className="flex items-center gap-3">
                            <FolderOpen className="text-accent shrink-0" size={18} />
                            <strong className="text-text">Create Folder</strong>
                            <span className="ml-auto text-right">Group selected sets into a new folder</span>
                        </li>
                        <li className="flex items-center gap-3">
                            <ChevronDown className="text-accent shrink-0" size={18} />
                            <strong className="text-text">Move to...</strong>
                            <span className="ml-auto text-right">Move sets into an existing folder</span>
                        </li>
                    </ul>

                    <h3 className="text-xl font-bold mt-8 mb-4">Set Actions</h3>
                    <p className="text-muted mb-4">
                        On each set card, you'll find quick action buttons:
                    </p>
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="bg-panel-2 border border-outline rounded-xl p-4">
                            <h4 className="font-bold mb-2 flex items-center gap-2"><Pencil size={16} className="text-accent" /> Edit</h4>
                            <p className="text-sm text-muted">Modify cards, add new ones, or restructure your set.</p>
                        </div>
                        <div className="bg-panel-2 border border-outline rounded-xl p-4">
                            <h4 className="font-bold mb-2 flex items-center gap-2"><Copy size={16} className="text-accent" /> Duplicate</h4>
                            <p className="text-sm text-muted">Create a copy to experiment without affecting the original.</p>
                        </div>
                        <div className="bg-panel-2 border border-outline rounded-xl p-4">
                            <h4 className="font-bold mb-2 flex items-center gap-2"><Download size={16} className="text-accent" /> Export</h4>
                            <p className="text-sm text-muted">Download as a .flashcards JSON file for backup or sharing.</p>
                        </div>
                        <div className="bg-panel-2 border border-outline rounded-xl p-4">
                            <h4 className="font-bold mb-2 flex items-center gap-2"><Trash2 size={16} className="text-red" /> Delete</h4>
                            <p className="text-sm text-muted">Remove a set permanently (requires confirmation).</p>
                        </div>
                    </div>

                    <h3 className="text-xl font-bold mt-8 mb-4">Importing Sets</h3>
                    <p className="text-muted">
                        Click <Upload className="inline text-accent" size={16} /> <strong className="text-accent">Import</strong> in the Library header to load a <code className="bg-panel-2 px-1 rounded">.flashcards</code> JSON file.
                        This is great for sharing sets with friends or restoring backups.
                    </p>
                </div>
            )
        },
        {
            id: 'multistudy',
            title: 'Multistudy',
            icon: <Layers size={20} />,
            content: (
                <div className="space-y-6 text-text">
                    <p className="text-lg leading-relaxed">
                        Combine multiple sets into one mega study session. Perfect for exam prep when you need to review
                        everything at once.
                    </p>

                    <div className="my-6 flex justify-center">
                        <MultistudyDemo />
                    </div>

                    <h3 className="text-xl font-bold mt-8 mb-4">How to Start a Multistudy</h3>
                    <div className="space-y-4 text-muted">
                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-accent text-bg flex items-center justify-center font-bold shrink-0">1</div>
                            <div className="flex items-center">
                                <span>Select <strong className="text-text">2 or more sets</strong> using the checkboxes in your Library</span>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-accent text-bg flex items-center justify-center font-bold shrink-0">2</div>
                            <div className="flex items-center">
                                <span>Click the <strong className="text-accent">Multistudy</strong> button in the floating action bar</span>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="w-10 h-10 rounded-full bg-accent text-bg flex items-center justify-center font-bold shrink-0">3</div>
                            <div className="flex items-center">
                                <span>All cards from selected sets are combined and shuffled into one session</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-panel-2 border border-outline rounded-xl p-5 mt-8">
                        <h4 className="font-bold mb-3">Multistudy vs. Combine</h4>
                        <div className="grid md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <div className="text-accent font-bold mb-1">Multistudy</div>
                                <p className="text-muted">Creates a temporary session. Cards remember their original sets. Great for quick review.</p>
                            </div>
                            <div>
                                <div className="text-accent font-bold mb-1">Combine</div>
                                <p className="text-muted">Creates a new permanent set in your Library. Cards are merged together with fresh mastery levels.</p>
                            </div>
                        </div>
                    </div>

                    <h3 className="text-xl font-bold mt-8 mb-4">Visual Indicator</h3>
                    <p className="text-muted">
                        Multistudy sessions are marked with diagonal stripes so you can easily distinguish them from regular sessions in your
                        Ongoing Sessions list.
                    </p>
                </div>
            )
        },
        {
            id: 'account',
            title: 'Account Management',
            icon: <User size={20} />,
            content: (
                <div className="space-y-6 text-text">
                    <p className="text-lg leading-relaxed">
                        Sign in to sync your flashcards across all your devices. Your data is securely stored and
                        automatically synchronized.
                    </p>

                    <p className="text-muted">
                        To keep things safe and simple, Flashcardsish uses Google sign-in. It's totally optional, but is great if you're studying between devices.
                    </p>

                    <h3 className="text-xl font-bold mt-8 mb-4">Signing In</h3>
                    <p className="text-muted mb-4">
                        Open <strong className="text-accent">Settings</strong> (gear icon) and click <strong className="text-accent">Login with Google</strong>.
                        Your library will sync really fast (it's not a lot of data).
                    </p>

                    <h3 className="text-xl font-bold mt-8 mb-4">What Gets Synced?</h3>
                    <ul className="space-y-3 text-muted">
                        <li className="flex items-start gap-3">
                            <Check className="text-accent shrink-0 mt-0.5" size={18} />
                            <span>All your flashcard sets and their content</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <Check className="text-accent shrink-0 mt-0.5" size={18} />
                            <span>Mastery progress for each card</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <Check className="text-accent shrink-0 mt-0.5" size={18} />
                            <span>Starred cards</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <Check className="text-accent shrink-0 mt-0.5" size={18} />
                            <span>Folders and organization</span>
                        </li>
                        <li className="flex items-start gap-3">
                            <Check className="text-accent shrink-0 mt-0.5" size={18} />
                            <span>Ongoing study sessions</span>
                        </li>
                    </ul>

                    <h3 className="text-xl font-bold mt-8 mb-4">Managing Your Data</h3>
                    <p className="text-muted mb-4">In Settings, you can:</p>
                    <ul className="space-y-3 text-muted">
                        <li className="flex items-start gap-3">
                            <Download className="text-accent shrink-0 mt-0.5" size={18} />
                            <span><strong className="text-text">Export All Data</strong> <span className="ml-auto text-right">Download a complete backup of everything</span></span>
                        </li>
                        <li className="flex items-start gap-3">
                            <Trash2 className="text-accent shrink-0 mt-0.5" size={18} />
                            <span><strong className="text-text">Delete All Data</strong> <span className="ml-auto text-right">Permanently remove all your data (requires confirmation)</span></span>
                        </li>
                    </ul>

                    <div className="bg-panel-2 border border-outline rounded-xl p-5 mt-8">
                        <h4 className="font-bold text-accent mb-2 flex items-center gap-2"><User size={18} className="text-accent" /> Privacy Note</h4>
                        <p className="text-muted">
                            We only store what's necessary for the app to function. We don't sell your data or show ads.
                            Read our full <strong className="text-text">Privacy Policy</strong> in the footer.
                        </p>
                    </div>
                </div>
            )
        },
        {
            id: 'open-source',
            title: 'Open Source & Running Locally',
            icon: <Code size={20} />,
            content: (
                <div className="space-y-6 text-text">
                    <p className="text-lg leading-relaxed">
                        Flashcardsish is open source under the <strong className="text-accent">CC BY-NC 4.0</strong> license.
                        You can view the code, contribute, or run your own instance for non-commercial purposes.
                    </p>

                    <div className="bg-panel-2 border border-outline rounded-xl p-4 mb-6">
                        <p className="text-text font-bold mb-1 flex items-center gap-2">
                            <Check size={18} className="text-accent" /> Free Forever
                        </p>
                        <p className="text-muted text-sm">
                            There are no premium tiers, no hidden costs, and no ads.
                        </p>
                    </div>

                    <a
                        href="https://github.com/RockhopperHD/flashcardsish"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-3 px-5 py-3 bg-panel-2 border border-outline rounded-xl hover:border-accent transition-colors"
                    >
                        <Github size={24} />
                        <span className="font-bold">View on GitHub</span>
                    </a>

                    <h3 className="text-xl font-bold mt-8 mb-4">Running Locally</h3>
                    <p className="text-muted mb-4">Prerequisites: Node.js 18+ and npm</p>

                    <div className="bg-panel-2 border border-outline rounded-xl p-4 font-mono text-sm space-y-3">
                        <div>
                            <span className="text-muted"># Clone the repository</span>
                            <div className="text-text">git clone https://github.com/RockhopperHD/flashcardsish.git</div>
                        </div>
                        <div>
                            <span className="text-muted"># Install dependencies</span>
                            <div className="text-text">npm install</div>
                        </div>
                        <div>
                            <span className="text-muted"># Start the dev server</span>
                            <div className="text-text">npm run dev</div>
                        </div>
                    </div>

                    <h3 className="text-xl font-bold mt-8 mb-4">Environment Setup</h3>
                    <p className="text-muted mb-4">
                        For cloud sync to work locally, you'll need to set up Google Cloud OAuth credentials and configure the environment variables.
                        See the <strong className="text-accent">README.md</strong> for detailed instructions.
                    </p>

                    <h3 className="text-xl font-bold mt-8 mb-4">Contributing</h3>
                    <p className="text-muted">
                        Contributions are welcome! Feel free to open issues for bugs or feature requests,
                        or submit pull requests. Please follow the existing code style and include tests where applicable.
                    </p>

                    <div className="bg-panel-2 border border-outline rounded-xl p-5 mt-8">
                        <h4 className="font-bold mb-2 flex items-center gap-2"><FileText size={18} className="text-accent" /> License Details</h4>
                        <p className="text-muted text-sm">
                            This work is licensed under <a href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">Creative Commons Attribution-NonCommercial 4.0 International</a>.
                            You are free to share and adapt the material for non-commercial purposes with appropriate credit.
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
                        Have a question or want to say hi? You can find me here!
                    </p>

                    <div className="grid md:grid-cols-2 gap-4 mt-6">
                        <a href="mailto:owenw2023@gmail.com" className="flex flex-col items-center justify-center p-6 bg-panel-2 border border-outline rounded-xl hover:border-accent transition-all group">
                            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <Mail size={24} className="text-accent" />
                            </div>
                            <span className="font-bold text-lg mb-1">Email Me</span>
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
                        <p className="text-muted font-medium mb-2 uppercase tracking-wide text-xs">Flashcardsish was built by</p>
                        <h2 className="text-3xl font-extrabold mb-4 text-text">Owen Whelan</h2>

                        <div className="text-left text-muted max-w-lg mx-auto mb-8 leading-relaxed">
                            I work with education, language, technology and a few other things. I made Flashcardsish as an accessible alternative to other apps, with features I thought were lacking.
                            <br /> I've used a bunch of flashcard apps before and I found that a lot of them lacked features that I thought were important. A lot of them are also... really expensive now. So I fixed that with Flashcardsish.
                        </div>

                        <div className="flex justify-center gap-4">
                            <a
                                href="https://github.com/RockhopperHD/flashcardsish"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 px-6 py-3 bg-accent text-bg font-bold rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-accent/20"
                            >
                                <Github size={20} />
                                GitHub Repo
                            </a>
                        </div>
                    </div>

                    <h3 className="text-xl font-bold mt-8 mb-4">Built With</h3>
                    <ul className="space-y-3 text-muted">
                        <li className="flex items-end justify-between gap-2 overflow-hidden">
                            <div className="flex items-center gap-2 mb-0.5 shrink-0">
                                <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                                <strong className="text-text">React</strong>
                            </div>
                            <div className="flex-1 border-b-2 border-dotted border-muted/30 mb-1.5 mx-1 min-w-[20px]" />
                            <span className="text-muted text-sm text-right shrink-0 mb-0.5">UI Framework</span>
                        </li>
                        <li className="flex items-end justify-between gap-2 overflow-hidden">
                            <div className="flex items-center gap-2 mb-0.5 shrink-0">
                                <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                                <strong className="text-text">TypeScript</strong>
                            </div>
                            <div className="flex-1 border-b-2 border-dotted border-muted/30 mb-1.5 mx-1 min-w-[20px]" />
                            <span className="text-muted text-sm text-right shrink-0 mb-0.5">Type Safety</span>
                        </li>
                        <li className="flex items-end justify-between gap-2 overflow-hidden">
                            <div className="flex items-center gap-2 mb-0.5 shrink-0">
                                <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                                <strong className="text-text">Tailwind CSS</strong>
                            </div>
                            <div className="flex-1 border-b-2 border-dotted border-muted/30 mb-1.5 mx-1 min-w-[20px]" />
                            <span className="text-muted text-sm text-right shrink-0 mb-0.5">Styling</span>
                        </li>
                        <li className="flex items-end justify-between gap-2 overflow-hidden">
                            <div className="flex items-center gap-2 mb-0.5 shrink-0">
                                <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                                <strong className="text-text">Vite</strong>
                            </div>
                            <div className="flex-1 border-b-2 border-dotted border-muted/30 mb-1.5 mx-1 min-w-[20px]" />
                            <span className="text-muted text-sm text-right shrink-0 mb-0.5">Build Tool</span>
                        </li>
                        <li className="flex items-end justify-between gap-2 overflow-hidden">
                            <div className="flex items-center gap-2 mb-0.5 shrink-0">
                                <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                                <strong className="text-text">Google Drive</strong>
                            </div>
                            <div className="flex-1 border-b-2 border-dotted border-muted/30 mb-1.5 mx-1 min-w-[20px]" />
                            <span className="text-muted text-sm text-right shrink-0 mb-0.5">Storage & Cloud Sync</span>
                        </li>
                        <li className="flex items-end justify-between gap-2 overflow-hidden">
                            <div className="flex items-center gap-2 mb-0.5 shrink-0">
                                <div className="w-1.5 h-1.5 rounded-full bg-accent shrink-0" />
                                <strong className="text-text">Lucide Icons</strong>
                            </div>
                            <div className="flex-1 border-b-2 border-dotted border-muted/30 mb-1.5 mx-1 min-w-[20px]" />
                            <span className="text-muted text-sm text-right shrink-0 mb-0.5">Beautiful Icons</span>
                        </li>
                    </ul>
                </div>
            )
        }
    ];

    const activeDoc = sections.find(s => s.id === activeSection);

    return (
        <div className="w-full max-w-5xl mx-auto pb-20 pt-8 px-6">
            {/* Back Button */}
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
                {/* Sidebar Navigation */}
                <div className="w-64 shrink-0 hidden md:block">
                    <div className="sticky top-24">
                        <h3 className="text-xs font-bold text-muted uppercase tracking-widest mb-4 px-2">
                            How-To Guide
                        </h3>
                        <nav className="space-y-1">
                            {sections.filter(s => s.id !== 'contact').map((section) => (
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
                                    <span className={clsx(
                                        "shrink-0",
                                        activeSection === section.id ? "text-accent" : "text-muted"
                                    )}>
                                        {section.icon}
                                    </span>
                                    <span className="font-medium truncate">{section.title}</span>
                                </button>
                            ))}
                        </nav>

                        {/* Email link in sidebar */}
                        <div className="mt-8 pt-6 border-t border-outline">
                            <button
                                onClick={() => setActiveSection('contact')}
                                className={clsx(
                                    "w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors rounded-lg",
                                    activeSection === 'contact'
                                        ? "bg-accent/10 text-accent border border-accent/20"
                                        : "text-muted hover:text-accent"
                                )}
                            >
                                <Mail size={16} />
                                <span>Contact</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 min-w-0">
                    {/* Section Header */}
                    <div className="mb-8">
                        <div className="flex items-center gap-4 mb-2">
                            <div className="p-3 rounded-xl bg-accent/10 border border-accent/20">
                                <span className="text-accent">{activeDoc?.icon}</span>
                            </div>
                            <h1 className="text-3xl font-extrabold text-text">{activeDoc?.title}</h1>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="bg-panel border border-outline rounded-2xl p-8">
                        {activeDoc?.content}
                    </div>

                    {/* Mobile: Section Selector */}
                    <div className="md:hidden mt-6">
                        <label className="text-xs font-bold text-muted uppercase tracking-widest mb-2 block">
                            Jump to Section
                        </label>
                        <select
                            value={activeSection || ''}
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
