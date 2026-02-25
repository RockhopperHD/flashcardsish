import React, { useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    BookOpen,
    CheckCircle2,
    ChevronRight,
    Cloud,
    Download,
    FileText,
    FolderOpen,
    Github,
    Globe,
    GraduationCap,
    HardDrive,
    Keyboard,
    Layers,
    Mail,
    PenSquare,
    Sparkles,
    Star,
    Upload,
} from 'lucide-react';
import clsx from 'clsx';

interface DocumentationProps {
    onBack: () => void;
}

const panelClasses = 'rounded-2xl border border-outline bg-panel-2 p-5';
const sectionClasses = 'rounded-3xl border border-outline bg-panel p-6 md:p-8 lg:p-10';

const Bullet: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <li className="flex items-start gap-2">
        <ChevronRight size={14} className="text-accent mt-1 shrink-0" />
        <span>{children}</span>
    </li>
);

const SectionHeading: React.FC<{
    kicker: string;
    title: string;
    lead: string;
}> = ({ kicker, title, lead }) => (
    <header className="space-y-3">
        <div className="text-[11px] tracking-[0.18em] uppercase text-accent font-bold">{kicker}</div>
        <h2
            className="text-2xl md:text-3xl text-text"
            style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}
        >
            {title}
        </h2>
        <p className="text-muted leading-relaxed text-base md:text-lg">{lead}</p>
    </header>
);

const InlineFigure: React.FC<{
    title: string;
    caption: string;
    children: React.ReactNode;
}> = ({ title, caption, children }) => (
    <figure className="my-6">
        <div className="rounded-2xl border border-outline bg-panel-2 p-4 md:p-5">
            <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-accent mb-3">Animated Walkthrough Figure</div>
            <div className="text-sm font-bold text-text mb-3">{title}</div>
            {children}
        </div>
        <figcaption className="text-xs text-muted mt-2">{caption}</figcaption>
    </figure>
);

const StepFigure: React.FC<{
    steps: Array<{ title: string; detail: string }>;
    intervalMs?: number;
}> = ({ steps, intervalMs = 1300 }) => {
    const [phase, setPhase] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setPhase((prev) => (prev + 1) % steps.length);
        }, intervalMs);
        return () => clearInterval(interval);
    }, [intervalMs, steps.length]);

    return (
        <div className="space-y-2">
            {steps.map((step, i) => (
                <div
                    key={step.title}
                    className={clsx(
                        'rounded-xl border px-3 py-2.5 transition-all duration-300',
                        phase === i
                            ? 'border-accent bg-accent/10'
                            : 'border-outline bg-panel'
                    )}
                >
                    <div className="flex items-center gap-2 mb-1">
                        <div
                            className={clsx(
                                'w-5 h-5 rounded-full border text-[11px] font-bold flex items-center justify-center transition-all',
                                phase === i
                                    ? 'border-accent text-accent bg-accent/10'
                                    : 'border-outline text-muted bg-panel-2'
                            )}
                        >
                            {i + 1}
                        </div>
                        <div className="text-sm font-bold text-text">{step.title}</div>
                    </div>
                    <div className="text-xs text-muted pl-7">{step.detail}</div>
                </div>
            ))}

            <div className="h-1.5 rounded-full bg-panel overflow-hidden mt-2">
                <div
                    className="h-full bg-accent transition-all duration-500"
                    style={{ width: `${((phase + 1) / steps.length) * 100}%` }}
                />
            </div>
        </div>
    );
};

const MarkdownFigure: React.FC = () => {
    const [phase, setPhase] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setPhase((prev) => (prev + 1) % 6);
        }, 1200);
        return () => clearInterval(interval);
    }, []);

    const rows = [
        { raw: '**bold**', rendered: <strong>bold</strong> },
        { raw: '*italic*', rendered: <em>italic</em> },
        { raw: '__underline__', rendered: <u>underline</u> },
        { raw: '`code`', rendered: <code className="bg-panel px-1.5 py-0.5 rounded text-accent">code</code> },
        { raw: '[[slab]]', rendered: <span className="inline-block bg-[#1f2937] text-slate-300 px-2 py-0.5 rounded text-[0.9em] font-medium border border-slate-600">slab</span> },
        { raw: '<h=y>yellow</h>', rendered: <span className="bg-yellow/20 text-yellow px-1 rounded">yellow</span> },
    ];

    return (
        <div className="space-y-2">
            {rows.map((row, i) => (
                <div
                    key={row.raw}
                    className={clsx(
                        'grid grid-cols-2 gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-300',
                        phase === i ? 'border-accent bg-accent/10' : 'border-outline bg-panel'
                    )}
                >
                    <div className="font-mono text-muted truncate">{row.raw}</div>
                    <div className="text-right text-text">{row.rendered}</div>
                </div>
            ))}
        </div>
    );
};

export const Documentation: React.FC<DocumentationProps> = ({ onBack }) => {
    const jumpLinks = useMemo(
        () => [
            { id: 'welcome', label: 'Welcome' },
            { id: 'quickstart', label: 'Quick Start' },
            { id: 'build', label: 'Build Sets' },
            { id: 'markdown', label: 'Markdown' },
            { id: 'study', label: 'Study Modes' },
            { id: 'library', label: 'Library' },
            { id: 'safety', label: 'Backups & Sync' },
            { id: 'contact', label: 'Contact' },
        ],
        []
    );

    return (
        <div className="w-full max-w-[1500px] mx-auto pb-24 pt-8 px-4 md:px-8 lg:px-10">
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

            <div className="rounded-3xl border border-outline bg-panel p-6 md:p-8 mb-8">
                <div className="flex items-center gap-3 mb-3">
                    <Sparkles size={20} className="text-accent" />
                    <div className="text-[11px] tracking-[0.18em] uppercase text-accent font-bold">Flashcardsish How-To Brochure</div>
                </div>
                <h1
                    className="text-3xl md:text-4xl text-text mb-3"
                    style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}
                >
                    Welcome! Why Flashcardsish?
                </h1>
                <p className="text-muted text-base md:text-lg leading-relaxed max-w-5xl">
                    This guide is a real walkthrough for end users. It explains how to set up cards, format them,
                    choose the right study mode, organize your library, and protect your data.
                    Animations below are used as quick visual examples of each workflow.
                </p>

                <div className="flex flex-wrap gap-2 mt-5">
                    {jumpLinks.map((link) => (
                        <a
                            key={link.id}
                            href={`#${link.id}`}
                            className="px-3 py-1.5 rounded-full border border-outline bg-panel-2 text-xs font-bold text-muted hover:text-text hover:border-accent transition-colors"
                        >
                            {link.label}
                        </a>
                    ))}
                </div>
            </div>

            <div className="space-y-8">
                <section id="welcome" className={sectionClasses}>
                    <SectionHeading
                        kicker="Overview"
                        title="What Flashcardsish is best at"
                        lead="Fast setup, flexible study, and practical organization without locking you into one workflow."
                    />

                    <div className="grid md:grid-cols-2 gap-4 mt-6">
                        <div className={panelClasses}>
                            <div className="font-bold text-text mb-2">Most useful for</div>
                            <ul className="space-y-2 text-sm text-muted">
                                <Bullet>Vocabulary and language terms.</Bullet>
                                <Bullet>Names, dates, and definitions.</Bullet>
                                <Bullet>Class content that needs repeated recall.</Bullet>
                            </ul>
                        </div>
                        <div className={panelClasses}>
                            <div className="font-bold text-text mb-2">Core strengths</div>
                            <ul className="space-y-2 text-sm text-muted">
                                <Bullet>Create cards quickly (visual or raw text).</Bullet>
                                <Bullet>Multiple study styles for different energy levels.</Bullet>
                                <Bullet>Folders, tags, stars, multistudy, and exports.</Bullet>
                            </ul>
                        </div>
                    </div>

                    <InlineFigure
                        title="From idea to study session"
                        caption="This mirrors how most users work in the app day-to-day."
                    >
                        <StepFigure
                            steps={[
                                { title: 'Create a set', detail: 'Start with visual builder or raw text import.' },
                                { title: 'Run Learn mode', detail: 'Study immediately and see what cards are weak.' },
                                { title: 'Star hard cards', detail: 'Mark problem cards during review.' },
                                { title: 'Refine and repeat', detail: 'Edit only what needs improvement.' },
                            ]}
                        />
                    </InlineFigure>
                </section>

                <section id="quickstart" className={sectionClasses}>
                    <SectionHeading
                        kicker="Walkthrough"
                        title="Quick Start: your first study session"
                        lead="If this is your first time, follow these exact steps once."
                    />

                    <div className={`${panelClasses} mt-6`}>
                        <div className="font-bold text-text mb-3">Step-by-step</div>
                        <ol className="list-decimal pl-5 space-y-2 text-sm text-muted">
                            <li>Go to the Library page and click <strong className="text-text">Add Set</strong>.</li>
                            <li>Choose <strong className="text-text">Visual Builder</strong> or <strong className="text-text">Raw Text Import</strong>.</li>
                            <li>Name your set and add at least 5 to 10 cards.</li>
                            <li>Save the set and open it.</li>
                            <li>Click <strong className="text-text">Learn</strong> to begin.</li>
                        </ol>
                    </div>

                    <InlineFigure
                        title="First session button path"
                        caption="This animation follows the same five steps listed above."
                    >
                        <StepFigure
                            steps={[
                                { title: 'Library', detail: 'Open your set list.' },
                                { title: 'Add Set', detail: 'Pick visual or raw import.' },
                                { title: 'Add cards', detail: 'Enter term and definition pairs.' },
                                { title: 'Save', detail: 'Create the set.' },
                                { title: 'Learn', detail: 'Start your first practice run.' },
                            ]}
                        />
                    </InlineFigure>
                </section>

                <section id="build" className={sectionClasses}>
                    <SectionHeading
                        kicker="Set Builder"
                        title="Build sets efficiently"
                        lead="Use Visual Builder for control and Raw Text Import for speed."
                    />

                    <div className="grid md:grid-cols-2 gap-4 mt-6">
                        <div className={panelClasses}>
                            <div className="font-bold text-text mb-2 flex items-center gap-2"><PenSquare size={16} className="text-accent" /> Visual Builder</div>
                            <ul className="space-y-2 text-sm text-muted">
                                <Bullet>Term + definition with optional year and images.</Bullet>
                                <Bullet>Custom fields (text, number, A/B, true/false).</Bullet>
                                <Bullet>Field labels and set-level structure options.</Bullet>
                                <Bullet>Card starring while building.</Bullet>
                            </ul>
                        </div>
                        <div className={panelClasses}>
                            <div className="font-bold text-text mb-2 flex items-center gap-2"><Upload size={16} className="text-accent" /> Raw Text Import</div>
                            <ul className="space-y-2 text-sm text-muted">
                                <Bullet>Paste text from docs and parse in bulk.</Bullet>
                                <Bullet>Set separators for term/definition, cards, and year.</Bullet>
                                <Bullet>Use bullet marker detection (like <code>{'>'}</code>) for appended bullet lines.</Bullet>
                                <Bullet>Choose import behavior: append/replace and duplicate strategy.</Bullet>
                            </ul>
                        </div>
                    </div>

                    <InlineFigure
                        title="Visual vs Raw import workflow"
                        caption="Both paths end in the same card set and study tools."
                    >
                        <StepFigure
                            steps={[
                                { title: 'Pick creation mode', detail: 'Visual for detail, raw import for speed.' },
                                { title: 'Configure content', detail: 'Add cards and optional extra fields.' },
                                { title: 'Preview result', detail: 'Check imported card output before continuing.' },
                                { title: 'Save and study', detail: 'Open Learn mode immediately after build.' },
                            ]}
                        />
                    </InlineFigure>
                </section>

                <section id="markdown" className={sectionClasses}>
                    <SectionHeading
                        kicker="Formatting"
                        title="Markdown guide (practical version)"
                        lead="Use formatting to make cards easier to scan and memorize quickly."
                    />

                    <InlineFigure
                        title="Live formatting examples"
                        caption="These are actual formatting patterns supported by the card renderer and editor tools."
                    >
                        <MarkdownFigure />
                    </InlineFigure>

                    <div className="grid xl:grid-cols-2 gap-4 mt-4">
                        <div className="rounded-2xl border border-outline bg-panel-2 overflow-hidden">
                            <div className="px-4 py-3 border-b border-outline bg-panel text-sm font-bold text-text">Core Syntax</div>
                            <div className="p-4">
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div className="font-mono text-muted">**bold**</div><div className="text-right text-text"><strong>bold</strong></div>
                                    <div className="font-mono text-muted">*italic*</div><div className="text-right text-text"><em>italic</em></div>
                                    <div className="font-mono text-muted">__underline__</div><div className="text-right text-text"><u>underline</u></div>
                                    <div className="font-mono text-muted">`code`</div><div className="text-right"><code className="bg-panel px-1.5 py-0.5 rounded text-accent">code</code></div>
                                    <div className="font-mono text-muted">[[slab]]</div><div className="text-right"><span className="inline-block bg-[#1f2937] text-slate-300 px-2 py-0.5 rounded text-[0.9em] border border-slate-600">slab</span></div>
                                    <div className="font-mono text-muted">(Cue) Term</div><div className="text-right text-text">cue pill + term</div>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-outline bg-panel-2 overflow-hidden">
                            <div className="px-4 py-3 border-b border-outline bg-panel text-sm font-bold text-text">Highlights + Structure</div>
                            <div className="p-4 space-y-3 text-sm">
                                <div className="flex items-center justify-between gap-2"><code className="text-muted">&lt;h=y&gt;text&lt;/h&gt;</code><span className="bg-yellow/20 text-yellow px-1 rounded">yellow</span></div>
                                <div className="flex items-center justify-between gap-2"><code className="text-muted">&lt;h=r&gt;text&lt;/h&gt;</code><span className="bg-red/20 text-red px-1 rounded">red</span></div>
                                <div className="flex items-center justify-between gap-2"><code className="text-muted">&lt;h=b&gt;text&lt;/h&gt;</code><span className="bg-blue/20 text-blue px-1 rounded">blue</span></div>
                                <div className="flex items-center justify-between gap-2"><code className="text-muted">&lt;h=g&gt;text&lt;/h&gt;</code><span className="bg-green/20 text-green px-1 rounded">green</span></div>
                                <div className="flex items-center justify-between gap-2"><code className="text-muted">&lt;h=p&gt;text&lt;/h&gt;</code><span className="bg-purple/20 text-purple px-1 rounded">purple</span></div>
                                <div className="pt-2 border-t border-outline text-muted">
                                    Line-start <code>- item</code> or <code>* item</code> creates bullet lists.
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className={`${panelClasses} mt-4`}>
                        <div className="font-bold text-text mb-2">Raw text extras you can paste</div>
                        <div className="text-sm text-muted space-y-2 font-mono">
                            <div>Term / Definition</div>
                            <div>Term / Definition /// 1776</div>
                            <div>Term / Definition ||| https://example.com/image.jpg</div>
                        </div>
                    </div>
                </section>

                <section id="study" className={sectionClasses}>
                    <SectionHeading
                        kicker="Study"
                        title="Pick the right mode for the job"
                        lead="Different modes help with different phases of learning."
                    />

                    <div className="grid md:grid-cols-2 gap-4 mt-6">
                        <div className={panelClasses}>
                            <div className="font-bold text-text mb-2 flex items-center gap-2"><GraduationCap size={16} className="text-accent" /> Learn Mode</div>
                            <ul className="space-y-2 text-sm text-muted">
                                <Bullet>Zen for continuous flow.</Bullet>
                                <Bullet>Batch for round-based pacing.</Bullet>
                                <Bullet>Answer style: Standard, Multiple Choice, or Random Choice (if enabled).</Bullet>
                                <Bullet>Answer direction toggle: answer with term or definition.</Bullet>
                            </ul>
                        </div>
                        <div className={panelClasses}>
                            <div className="font-bold text-text mb-2 flex items-center gap-2"><Layers size={16} className="text-accent" /> Flashcards Mode</div>
                            <ul className="space-y-2 text-sm text-muted">
                                <Bullet>Stack mode for simple flipping and progression.</Bullet>
                                <Bullet>Sort mode with “Review” and “Got It” piles.</Bullet>
                                <Bullet>Manual deck shuffle for quick reruns.</Bullet>
                                <Bullet>Star cards directly during review.</Bullet>
                            </ul>
                        </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-4 mt-4">
                        <div className={panelClasses}>
                            <div className="font-bold text-text mb-2 flex items-center gap-2"><Keyboard size={16} className="text-accent" /> Accuracy controls</div>
                            <ul className="space-y-2 text-sm text-muted">
                                <Bullet>Forgive spelling, capitalization, and diacritics.</Bullet>
                                <Bullet>Optional wiggle room for minor typos.</Bullet>
                                <Bullet>Retype mistakes for stricter reinforcement.</Bullet>
                                <Bullet>Brutal Mode for harder mastery progression.</Bullet>
                            </ul>
                        </div>
                        <div className={panelClasses}>
                            <div className="font-bold text-text mb-2">Session controls</div>
                            <ul className="space-y-2 text-sm text-muted">
                                <Bullet>Shuffle cards.</Bullet>
                                <Bullet>Study starred-only cards.</Bullet>
                                <Bullet>Batch length control.</Bullet>
                                <Bullet>Auto-advance + custom keybinds.</Bullet>
                            </ul>
                        </div>
                    </div>

                    <InlineFigure
                        title="Mode selection and session tuning"
                        caption="Use this sequence each time: choose mode, set pressure, then run."
                    >
                        <StepFigure
                            steps={[
                                { title: 'Pick mode', detail: 'Zen, Batch, or Flashcards based on goal.' },
                                { title: 'Set answer style', detail: 'Type or choose answers.' },
                                { title: 'Tune strictness', detail: 'Set typo forgiveness and retype behavior.' },
                                { title: 'Start session', detail: 'Review broadly, then switch to starred-only.' },
                            ]}
                        />
                    </InlineFigure>
                </section>

                <section id="library" className={sectionClasses}>
                    <SectionHeading
                        kicker="Library"
                        title="Organize large set collections"
                        lead="Keep things tidy so studying stays fast."
                    />

                    <div className="grid md:grid-cols-2 gap-4 mt-6">
                        <div className={panelClasses}>
                            <div className="font-bold text-text mb-2 flex items-center gap-2"><FolderOpen size={16} className="text-accent" /> Structure + labels</div>
                            <ul className="space-y-2 text-sm text-muted">
                                <Bullet>Create folders and move sets between them.</Bullet>
                                <Bullet>Rename or delete folders when reorganizing.</Bullet>
                                <Bullet>Create and apply tags to sets.</Bullet>
                                <Bullet>Star hard cards for focused repair sessions.</Bullet>
                            </ul>
                        </div>
                        <div className={panelClasses}>
                            <div className="font-bold text-text mb-2 flex items-center gap-2"><Layers size={16} className="text-accent" /> Multi-set tools</div>
                            <ul className="space-y-2 text-sm text-muted">
                                <Bullet>Multistudy mixes selected sets into one temporary session.</Bullet>
                                <Bullet>Combine creates one permanent merged set.</Bullet>
                                <Bullet>Edit and duplicate existing sets quickly.</Bullet>
                                <Bullet>Move sets between local-only and cloud storage modes.</Bullet>
                            </ul>
                        </div>
                    </div>

                    <InlineFigure
                        title="Library cleanup workflow"
                        caption="A repeatable pattern for keeping your study library manageable."
                    >
                        <StepFigure
                            steps={[
                                { title: 'Select related sets', detail: 'Use checkboxes for bulk actions.' },
                                { title: 'Move/group', detail: 'Put sets into folders and apply tags.' },
                                { title: 'Create multistudy', detail: 'Run mixed review for exams.' },
                                { title: 'Combine if needed', detail: 'Make a permanent merged set for long-term use.' },
                            ]}
                        />
                    </InlineFigure>
                </section>

                <section id="safety" className={sectionClasses}>
                    <SectionHeading
                        kicker="Backups"
                        title="Keep your data safe"
                        lead="Use local saves, optional cloud sync, and exports together for the best protection."
                    />

                    <div className="grid md:grid-cols-3 gap-4 mt-6">
                        <div className={panelClasses}>
                            <div className="font-bold text-text mb-2 flex items-center gap-2"><HardDrive size={15} className="text-accent" /> Local first</div>
                            <p className="text-sm text-muted">Your data writes locally so work remains available on this device.</p>
                        </div>
                        <div className={panelClasses}>
                            <div className="font-bold text-text mb-2 flex items-center gap-2"><Cloud size={15} className="text-accent" /> Optional sync</div>
                            <p className="text-sm text-muted">Sign in with Google to sync eligible sets to Drive.</p>
                        </div>
                        <div className={panelClasses}>
                            <div className="font-bold text-text mb-2 flex items-center gap-2"><Download size={15} className="text-accent" /> Manual exports</div>
                            <p className="text-sm text-muted">Export `.flashcards` sets and full-account JSON backups.</p>
                        </div>
                    </div>

                    <InlineFigure
                        title="Recommended backup routine"
                        caption="This is the safest workflow before big exams and major set edits."
                    >
                        <StepFigure
                            steps={[
                                { title: 'Study normally', detail: 'Use local and optional cloud sync.' },
                                { title: 'Export important sets', detail: 'Download `.flashcards` backups.' },
                                { title: 'Export all data', detail: 'Create a full JSON snapshot from settings.' },
                                { title: 'Repeat regularly', detail: 'Do this before major milestones.' },
                            ]}
                        />
                    </InlineFigure>
                </section>

                <section id="contact" className={sectionClasses}>
                    <SectionHeading
                        kicker="Contact"
                        title="Need help or want a feature?"
                        lead="Send feedback, bug reports, or suggestions."
                    />

                    <div className="grid md:grid-cols-3 gap-4 mt-6">
                        <a
                            href="mailto:owenw2023@gmail.com"
                            className="rounded-xl border border-outline bg-panel-2 p-5 hover:border-accent transition-colors"
                        >
                            <div className="font-bold text-text flex items-center gap-2 mb-1"><Mail size={16} className="text-accent" /> Email</div>
                            <div className="text-sm text-muted">owenw2023@gmail.com</div>
                        </a>
                        <a
                            href="https://www.owenwhelan.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-xl border border-outline bg-panel-2 p-5 hover:border-accent transition-colors"
                        >
                            <div className="font-bold text-text flex items-center gap-2 mb-1"><Globe size={16} className="text-accent" /> Website</div>
                            <div className="text-sm text-muted">owenwhelan.com</div>
                        </a>
                        <a
                            href="https://github.com/RockhopperHD/flashcardsish"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-xl border border-outline bg-panel-2 p-5 hover:border-accent transition-colors"
                        >
                            <div className="font-bold text-text flex items-center gap-2 mb-1"><Github size={16} className="text-accent" /> GitHub</div>
                            <div className="text-sm text-muted">Project source and issues</div>
                        </a>
                    </div>

                    <div className={`${panelClasses} mt-4`}>
                        <div className="font-bold text-text mb-2">Useful bug report format</div>
                        <ul className="space-y-2 text-sm text-muted">
                            <Bullet>What page/feature you were using.</Bullet>
                            <Bullet>What you clicked and expected to happen.</Bullet>
                            <Bullet>What happened instead.</Bullet>
                        </ul>
                    </div>
                </section>
            </div>
        </div>
    );
};
