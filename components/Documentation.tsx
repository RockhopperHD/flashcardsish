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
    Zap,
    Shuffle,
    Eye,
    Settings,
    Tag,
    Copy,
    RotateCcw,
    XCircle,
    ArrowRight,
} from 'lucide-react';
import clsx from 'clsx';

/* ───────────────────────── Props ───────────────────────── */
interface DocumentationProps {
    onBack: () => void;
}

/* ───────────────────────── Shared classes ──────────────── */
const panel = 'rounded-2xl border border-outline bg-panel-2 p-5';
const section = 'rounded-3xl border border-outline bg-panel p-6 md:p-8 lg:p-10';

/* ───────────────────────── Reusable pieces ─────────────── */
const Bullet: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <li className="flex items-start gap-2">
        <ChevronRight size={14} className="text-accent mt-1 shrink-0" />
        <span>{children}</span>
    </li>
);

const Heading: React.FC<{ kicker: string; title: string; lead: string }> = ({ kicker, title, lead }) => (
    <header className="space-y-3">
        <div className="text-[11px] tracking-[0.18em] uppercase text-accent font-bold">{kicker}</div>
        <h2 className="text-2xl md:text-3xl text-text" style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}>{title}</h2>
        <p className="text-muted leading-relaxed text-base md:text-lg">{lead}</p>
    </header>
);

const Tip: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="flex items-start gap-3 mt-4 p-4 rounded-xl border border-accent/30 bg-accent/5">
        <Zap size={16} className="text-accent mt-0.5 shrink-0" />
        <p className="text-sm text-text leading-relaxed">{children}</p>
    </div>
);

const Kbd: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <kbd className="inline-block px-1.5 py-0.5 text-[11px] font-mono font-bold bg-panel-2 border border-outline rounded text-muted mx-0.5">{children}</kbd>
);

/* ── Animated: Markdown live-render ─────────────────────── */
const MarkdownDemo: React.FC = () => {
    const [idx, setIdx] = useState(0);
    const rows = useMemo(() => [
        { raw: '**bold**', rendered: <strong>bold</strong> },
        { raw: '*italic*', rendered: <em>italic</em> },
        { raw: '__underline__', rendered: <u>underline</u> },
        { raw: '`code`', rendered: <code className="bg-panel px-1.5 py-0.5 rounded text-accent">code</code> },
        { raw: '[[slab]]', rendered: <span className="inline-block bg-[#1f2937] text-slate-300 px-2 py-0.5 rounded text-[0.9em] font-medium border border-slate-600">slab</span> },
        { raw: '<h=y>yellow</h>', rendered: <span className="bg-yellow/20 text-yellow px-1 rounded">yellow</span> },
    ], []);

    useEffect(() => {
        const t = setInterval(() => setIdx(p => (p + 1) % rows.length), 2200);
        return () => clearInterval(t);
    }, [rows.length]);

    return (
        <div className="space-y-2">
            {rows.map((r, i) => (
                <div key={r.raw} className={clsx(
                    'grid grid-cols-2 gap-2 rounded-lg border px-3 py-2 text-sm transition-all duration-300',
                    idx === i ? 'border-accent bg-accent/10 scale-[1.02]' : 'border-outline bg-panel'
                )}>
                    <div className="font-mono text-muted truncate">{r.raw}</div>
                    <div className="text-right text-text">{r.rendered}</div>
                </div>
            ))}
        </div>
    );
};

/* ── Animated: Mastery level indicator ──────────────────── */
const MasteryDemo: React.FC = () => {
    const [level, setLevel] = useState(0);
    useEffect(() => {
        const t = setInterval(() => setLevel(p => (p + 1) % 4), 1800);
        return () => clearInterval(t);
    }, []);
    const labels = ['Unseen', 'Learning', 'Learned!', 'Reset'];
    return (
        <div className="space-y-3 pt-1">
            <div className="flex justify-between items-center text-xs font-bold text-muted">
                <span>Mastery</span>
                <span className={clsx(level === 2 && 'text-green', level === 1 && 'text-yellow')}>{labels[level]}</span>
            </div>

            <div className="flex items-center gap-1.5 h-3">
                {[0, 1].map(dot => (
                    <div key={dot} className={clsx(
                        'w-2.5 h-2.5 rounded-full transition-colors duration-300',
                        level > dot ? 'bg-green' : (level === 1 && dot === 0 ? 'bg-yellow' : 'bg-outline/50')
                    )} />
                ))}
            </div>
        </div>
    );
};

/* ── Animated: Sort mode card sim ───────────────────────── */
const SortDemo: React.FC = () => {
    const [pos, setPos] = useState<'center' | 'left' | 'right'>('center');
    const [review, setReview] = useState(0);
    const [gotIt, setGotIt] = useState(0);
    useEffect(() => {
        const seq = ['right', 'center', 'left', 'center', 'right', 'center'] as const;
        let i = 0;
        const t = setInterval(() => {
            const dir = seq[i % seq.length];
            setPos(dir);
            if (dir === 'left') setReview(p => p + 1);
            if (dir === 'right') setGotIt(p => p + 1);
            i++;
            if (i >= seq.length) { i = 0; setReview(0); setGotIt(0); }
        }, 1100);
        return () => clearInterval(t);
    }, []);
    return (
        <div className="flex items-center justify-between gap-4">
            <div className="text-center">
                <XCircle size={20} className="text-red mx-auto mb-1" />
                <div className="text-xs font-bold text-red">{review}</div>
                <div className="text-[10px] text-muted">Review</div>
            </div>
            <div className={clsx(
                'w-20 h-14 rounded-xl border-2 transition-all duration-500 flex items-center justify-center text-xs font-bold',
                pos === 'left' && '-translate-x-8 border-red bg-red/10 text-red',
                pos === 'right' && 'translate-x-8 border-green bg-green/10 text-green',
                pos === 'center' && 'translate-x-0 border-outline bg-panel-2 text-muted',
            )}>
                Card
            </div>
            <div className="text-center">
                <CheckCircle2 size={20} className="text-green mx-auto mb-1" />
                <div className="text-xs font-bold text-green">{gotIt}</div>
                <div className="text-[10px] text-muted">Got It</div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════ */
export const Documentation: React.FC<DocumentationProps> = ({ onBack }) => {
    const [activeSection, setActiveSection] = useState<string>('quickstart');

    const sections = useMemo(() => [
        { id: 'quickstart', label: 'Getting Started' },
        { id: 'build', label: 'Building Sets' },
        { id: 'customfields', label: 'Custom Fields' },
        { id: 'markdown', label: 'Rich Text' },
        { id: 'learn', label: 'Learn Mode' },
        { id: 'flashcards', label: 'Flashcards Mode' },
        { id: 'library', label: 'Library' },
        { id: 'keybinds', label: 'Keybinds' },
        { id: 'safety', label: 'Data & Sync' },
        { id: 'contact', label: 'Contact' },
    ], []);

    useEffect(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setActiveSection(entry.target.id);
                }
            });
        }, { rootMargin: '-20% 0px -60% 0px' });

        sections.forEach(s => {
            const el = document.getElementById(s.id);
            if (el) observer.observe(el);
        });

        return () => observer.disconnect();
    }, [sections]);

    const scrollTo = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
            const y = el.getBoundingClientRect().top + window.scrollY - 32;
            window.scrollTo({ top: y, behavior: 'smooth' });
        }
    };

    return (
        <div className="w-full max-w-[2100px] mx-auto pb-24 pt-8 px-4 flex flex-col lg:flex-row items-start gap-4 lg:gap-10">

            {/* Sidebar ToC */}
            <div className="hidden lg:flex flex-col w-56 xl:w-64 shrink-0 sticky top-12 max-h-[calc(100vh-6rem)] overflow-y-auto pr-4 scrollbar-hide">
                <button onClick={onBack} className="group flex items-center gap-2 text-muted hover:text-text font-bold text-sm uppercase tracking-wider transition-colors mb-8 shrink-0">
                    <div className="p-2 rounded-full border border-outline group-hover:bg-panel transition-colors"><ArrowLeft size={16} /></div>
                    Back
                </button>

                <div className="text-[11px] uppercase tracking-[0.16em] font-bold text-muted mb-4 pl-1">Contents</div>
                <nav className="flex flex-col gap-1 border-l-2 border-outline/50 pl-4 py-1">
                    {sections.map(s => (
                        <button
                            key={s.id}
                            onClick={() => scrollTo(s.id)}
                            className={clsx(
                                "text-left text-[13.5px] font-medium transition-all duration-200 py-1.5 leading-snug",
                                activeSection === s.id
                                    ? "text-accent translate-x-1"
                                    : "text-muted hover:text-text hover:translate-x-1"
                            )}
                        >
                            {s.label}
                        </button>
                    ))}
                </nav>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 min-w-0">
                {/* Mobile Back (hidden on desktop) */}
                <div className="lg:hidden flex items-center gap-4 mb-8">
                    <button onClick={onBack} className="group flex items-center gap-2 text-muted hover:text-text font-bold text-sm uppercase tracking-wider transition-colors">
                        <div className="p-2 rounded-full border border-outline group-hover:bg-panel transition-colors"><ArrowLeft size={16} /></div>
                        Back
                    </button>
                </div>

                {/* ── Hero ──────────────────────────────────── */}
                <div className="rounded-3xl border border-outline bg-panel p-6 md:p-8 mb-8">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="text-[11px] tracking-[0.18em] uppercase text-accent font-bold">Flashcardsish How-To Guide</div>
                    </div>
                    <h1 className="text-3xl md:text-4xl text-text mb-3" style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}>
                        Everything You Need to Know
                    </h1>
                    <p className="text-muted text-base md:text-lg leading-relaxed max-w-5xl">
                        Welcome to Flashcardsish! This guide covers most of what you need to get started and use Flashcardsish to its fullest. This guide will help you understand some of the unique aspects of Flashcardsish and clarify some of things you're familiar with from other apps.
                    </p>
                </div>

                <div className="space-y-8">

                    {/* ──────────────────────────────────────────
                    1. GETTING STARTED
                   ────────────────────────────────────────── */}
                    <section id="quickstart" className={section}>
                        <Heading kicker="Getting Started" title="Your First Set" lead="Seriously — it's that fast. Here's the play-by-play." />

                        <div className={`${panel} mt-6`}>
                            <ol className="list-decimal pl-5 space-y-3 text-sm text-muted">
                                <li>Open the <strong className="text-text">Library</strong> (that's your home screen).</li>
                                <li>Tap <strong className="text-text">Add Set</strong> — choose <strong className="text-text">Visual Builder</strong> to build cards one-by-one, or <strong className="text-text">Raw Text Import</strong> to paste a whole list at once.</li>
                                <li>Give your set a name and add at least a few cards (term + definition).</li>
                                <li>Hit <strong className="text-text">Save</strong> — your set appears in the Library.</li>
                                <li>Click into your set and press <strong className="text-text">Learn</strong> or <strong className="text-text">Flashcards</strong> to start studying!</li>
                            </ol>
                        </div>
                        <Tip>Your work auto-saves as a draft while you build, so don't worry about losing progress if you accidentally close the tab.</Tip>
                    </section>

                    {/* ──────────────────────────────────────────
                    2. BUILDING SETS
                   ────────────────────────────────────────── */}
                    <section id="build" className={section}>
                        <Heading kicker="Set Builder" title="Create Cards Your Way" lead="Use Visual Builder when you want full control, or Raw Text Import when you need speed." />

                        <div className="grid md:grid-cols-2 gap-4 mt-6">
                            <div className={panel}>
                                <div className="font-bold text-text mb-3 flex items-center gap-2"><PenSquare size={16} className="text-accent" /> Visual Builder</div>
                                <ul className="space-y-2 text-sm text-muted">
                                    <Bullet>Add cards one at a time with dedicated Term and Definition fields.</Bullet>
                                    <Bullet>Attach <strong className="text-text">images</strong> to the definition side (paste a URL, upload a file, or drag-and-drop).</Bullet>
                                    <Bullet>Enable <strong className="text-text">Term Cards</strong> in Set Config to add images on the term side too.</Bullet>
                                    <Bullet>Add an optional <strong className="text-text">Year</strong> field per card — great for history sets.</Bullet>
                                    <Bullet>Star cards while building to flag the tricky ones early.</Bullet>
                                    <Bullet>Duplicate any card with one click to speed up similar entries.</Bullet>
                                </ul>
                            </div>
                            <div className={panel}>
                                <div className="font-bold text-text mb-3 flex items-center gap-2"><Upload size={16} className="text-accent" /> Raw Text Import</div>
                                <ul className="space-y-2 text-sm text-muted">
                                    <Bullet>Paste text from Google Docs, Quizlet exports, notes apps — anything.</Bullet>
                                    <Bullet>Pick your <strong className="text-text">separators</strong>: choose what character splits terms from definitions (<code className="text-accent">/</code>, <code className="text-accent">:</code>, <code className="text-accent">-</code>, or custom), and what splits cards apart (blank line, <code className="text-accent">&amp;&amp;&amp;</code>, etc.).</Bullet>
                                    <Bullet>Enable an optional <strong className="text-text">Year separator</strong> (<code className="text-accent">///</code>, <code className="text-accent">:::</code>, etc.) to pull year data automatically.</Bullet>
                                    <Bullet>Turn on <strong className="text-text">Bullet detection</strong> — set a marker like <code className="text-accent">{'>'}</code> so lines starting with it get appended as bullet points to the previous card's definition.</Bullet>
                                    <Bullet>Choose <strong className="text-text">Import Method</strong>: append new cards to existing ones, or replace everything.</Bullet>
                                    <Bullet>Choose a <strong className="text-text">Duplicate Strategy</strong>: keep old cards, add duplicates anyway, or override old cards with new versions.</Bullet>
                                    <Bullet>Live preview shows you exactly how cards will parse before you commit!</Bullet>
                                </ul>
                            </div>
                        </div>

                        <div className={`${panel} mt-4`}>
                            <div className="font-bold text-text mb-2">Raw text format examples</div>
                            <div className="text-sm text-muted space-y-2 font-mono">
                                <div>Apple / A red fruit</div>
                                <div>Declaration of Independence / The founding document /// 1776</div>
                                <div>Mitochondria / Powerhouse of the cell ||| https://example.com/mito.jpg</div>
                            </div>
                        </div>
                        <Tip>After raw-importing, you can always switch to the Visual Builder to fine-tune individual cards, like for adding highlight or more detail. You can also import additional cards using raw text later in the Set Configuration menu.</Tip>
                    </section>

                    {/* ──────────────────────────────────────────
                    3. CUSTOM FIELDS & SET CONFIG
                   ────────────────────────────────────────── */}
                    <section id="customfields" className={section}>
                        <Heading kicker="Set Configuration" title="Custom Fields & Labels" lead="Go way beyond basic Term/Definition. Add extra fields, rename labels, and put content exactly where you want it. Your cards can be as complicated or as simple as you need them to be." />

                        <div className="grid md:grid-cols-2 gap-4 mt-6">
                            <div className={panel}>
                                <div className="font-bold text-text mb-3 flex items-center gap-2"><Settings size={16} className="text-accent" /> Custom Fields</div>
                                <p className="text-sm text-muted mb-3">When you open Set Configuration (the gear icon in the builder), you can add extra fields to either the <strong className="text-text">Term Side</strong> or the <strong className="text-text">Definition Side</strong> of every card.</p>
                                <ul className="space-y-2 text-sm text-muted">
                                    <Bullet><strong className="text-text">Text</strong> — free-text field for anything (part of speech, example sentence, etc.).</Bullet>
                                    <Bullet><strong className="text-text">Number</strong> — for numeric values (dates, quantities).</Bullet>
                                    <Bullet><strong className="text-text">A/B</strong> — a two-option toggle with custom labels (e.g. "Masculine / Feminine").</Bullet>
                                    <Bullet><strong className="text-text">True/False</strong> — a simple True or False toggle.</Bullet>
                                </ul>
                                <p className="text-sm text-muted mt-3">During Learn mode, you'll be quizzed on these extra fields too! A/B and T/F fields get their own slick toggle UI with keyboard shortcuts.</p>
                            </div>
                            <div className={panel}>
                                <div className="font-bold text-text mb-3 flex items-center gap-2"><FileText size={16} className="text-accent" /> Custom Labels</div>
                                <p className="text-sm text-muted mb-3">Don't like "Term" and "Definition"? Rename them to anything you want — <strong className="text-text">"Word" &amp; "Meaning"</strong>, <strong className="text-text">"Question" &amp; "Answer"</strong>, <strong className="text-text">"Kanji" &amp; "Reading"</strong> — it's up to you.</p>
                                <p className="text-sm text-muted">Your custom labels show up everywhere: the builder, study modes, flashcard faces, and the set detail page. It makes everything feel like <em>your</em> set.</p>
                                <div className="mt-4 p-3 rounded-lg border border-outline bg-panel text-sm text-muted">
                                    <strong className="text-text">Term Cards toggle:</strong> Enable this in Set Config to allow images on the term side of your cards, not just the definition side.
                                </div>
                            </div>
                        </div>
                        <Tip>Custom fields are tested during Learn mode, not Flashcards mode. If you use A/B or T/F fields, you can answer them with keyboard shortcuts — check the Keybinds section!</Tip>
                    </section>

                    {/* ──────────────────────────────────────────
                    4. RICH TEXT / MARKDOWN
                   ────────────────────────────────────────── */}
                    <section id="markdown" className={section}>
                        <Heading kicker="Formatting" title="Rich Text & Markdown" lead="Make your cards pop with bold, italic, highlights, code blocks, and more. Type it in the builder and it renders beautifully during study." />

                        <div className="grid lg:grid-cols-2 gap-6 mt-6">
                            <div className="space-y-4">
                                <div className="rounded-2xl border border-outline bg-panel-2 overflow-hidden h-full">
                                    <div className="px-4 py-3 border-b border-outline bg-panel text-sm font-bold text-text">Text Formatting</div>
                                    <div className="p-4 grid grid-cols-2 gap-3 text-sm">
                                        <div className="font-mono text-muted">**bold**</div><div className="text-right text-text"><strong>bold</strong></div>
                                        <div className="font-mono text-muted">*italic*</div><div className="text-right text-text"><em>italic</em></div>
                                        <div className="font-mono text-muted">__underline__</div><div className="text-right text-text"><u>underline</u></div>
                                        <div className="font-mono text-muted">`code`</div><div className="text-right"><code className="bg-panel px-1.5 py-0.5 rounded text-accent">code</code></div>
                                        <div className="font-mono text-muted">[[slab]]</div><div className="text-right"><span title="Slabs are great for vocabulary categories or grammar labels!" className="cursor-help inline-block bg-[#1f2937] text-slate-300 px-2 py-0.5 rounded text-[0.9em] border border-slate-600">slab</span></div>
                                        <div className="font-mono text-muted">(Cue) Term</div><div className="text-right text-text"><span title="Cues are hints that disappear during testing." className="cursor-help px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-panel border border-outline text-muted mr-1.5 align-middle">Cue</span><span title="The term value">Term</span></div>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="rounded-2xl border border-outline bg-panel-2 overflow-hidden">
                                    <div className="px-4 py-3 border-b border-outline bg-panel text-sm font-bold text-text">Colored Highlights</div>
                                    <div className="p-4 space-y-2 text-sm">
                                        <div className="flex items-center justify-between"><code className="text-muted">&lt;h=y&gt;text&lt;/h&gt;</code><span className="bg-yellow/20 text-yellow px-1.5 rounded">yellow</span></div>
                                        <div className="flex items-center justify-between"><code className="text-muted">&lt;h=r&gt;text&lt;/h&gt;</code><span className="bg-red/20 text-red px-1.5 rounded">red</span></div>
                                        <div className="flex items-center justify-between"><code className="text-muted">&lt;h=b&gt;text&lt;/h&gt;</code><span className="bg-blue/20 text-blue px-1.5 rounded">blue</span></div>
                                        <div className="flex items-center justify-between"><code className="text-muted">&lt;h=g&gt;text&lt;/h&gt;</code><span className="bg-green/20 text-green px-1.5 rounded">green</span></div>
                                        <div className="flex items-center justify-between"><code className="text-muted">&lt;h=p&gt;text&lt;/h&gt;</code><span className="bg-purple/20 text-purple px-1.5 rounded">purple</span></div>
                                    </div>
                                </div>

                                <div className="rounded-2xl border border-outline bg-panel-2 overflow-hidden">
                                    <div className="px-4 py-3 border-b border-outline bg-panel text-sm font-bold text-text">Bulleted Lists</div>
                                    <div className="p-4 text-sm text-muted">
                                        Use <code className="text-accent">- item</code> or <code className="text-accent">* item</code> at the start of a line for bullet lists. Type <code className="text-accent">&lt;p&gt;</code> to exit list mode and return to normal text.
                                    </div>
                                </div>
                            </div>
                        </div>
                        <Tip>You don't need to perfect your cards on day 1 -- you can edit them as you study, turning your deck into a living, breathing study material.</Tip>
                    </section>

                    {/* ──────────────────────────────────────────
                    5. LEARN MODE
                   ────────────────────────────────────────── */}
                    <section id="learn" className={section}>
                        <Heading kicker="Learn Mode" title="Learn Mode: Lock In" lead="Learn mode is where real memorization happens. Type (or choose) your answers and build mastery card-by-card." />

                        <div className="grid md:grid-cols-2 gap-4 mt-6">
                            <div className={panel}>
                                <div className="font-bold text-text mb-3 flex items-center gap-2"><Zap size={16} className="text-accent" /> Zen Mode</div>
                                <p className="text-sm text-muted mb-2">Cards keep cycling until every single one hits full mastery. No rounds, no breaks — just you and the cards in a continuous flow.</p>
                                <ul className="space-y-2 text-sm text-muted">
                                    <Bullet>Cards you get wrong stay in rotation until you nail them.</Bullet>
                                    <Bullet>Your <strong className="text-text">streak</strong> tracks consecutive correct answers — see how high you can go!</Bullet>
                                    <Bullet>Enable <strong className="text-text">Brutal Mode</strong> for extra challenge: if you get a card wrong at 1/2 mastery, it resets to 0/2.</Bullet>
                                </ul>
                            </div>
                            <div className={panel}>
                                <div className="font-bold text-text mb-3 flex items-center gap-2"><Layers size={16} className="text-accent" /> Batch Mode</div>
                                <p className="text-sm text-muted mb-2">Study in rounds. Each batch contains a fixed number of cards (default: 10). Master a batch, then get new cards introduced.</p>
                                <ul className="space-y-2 text-sm text-muted">
                                    <Bullet>After each batch, you get a <strong className="text-text">summary screen</strong> showing accuracy, tricky cards, and encouragement.</Bullet>
                                    <Bullet>Cards you get wrong bounce back into the current batch so you can retry them.</Bullet>
                                    <Bullet>Customize <strong className="text-text">Batch Length</strong> (3–50 cards) in Settings.</Bullet>
                                </ul>
                            </div>
                        </div>

                        <div className={`${panel} mt-4`}>
                            <div className="font-bold text-text mb-3">Mastery System</div>
                            <MasteryDemo />
                            <p className="text-sm text-muted mt-3">Every card has a <strong className="text-text">3-level mastery bar</strong>: Unseen → Learning → Learned. Get it right to level up. Get it wrong to drop back. The goal is to get every card to "Learned."</p>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4 mt-4">
                            <div className={panel}>
                                <div className="font-bold text-text mb-2 text-sm">Answer Styles</div>
                                <ul className="space-y-2 text-sm text-muted">
                                    <Bullet><strong className="text-text">Standard</strong> — type your answer.</Bullet>
                                    <Bullet><strong className="text-text">Multiple Choice</strong> — pick from 4 options pulled from your set.</Bullet>
                                    <Bullet><strong className="text-text">Random Choice</strong> — AI generates plausible wrong answers (requires AI setup).</Bullet>
                                </ul>
                            </div>
                            <div className={panel}>
                                <div className="font-bold text-text mb-2 text-sm">Answer Direction</div>
                                <p className="text-sm text-muted">Flip which side you're tested on! By default you see the Definition and type the Term. Switch to <strong className="text-text">"Answer with Definition"</strong> in Settings to see the Term and type the Definition instead.</p>
                            </div>
                            <div className={panel}>
                                <div className="font-bold text-text mb-2 text-sm">Mixup Detection</div>
                                <p className="text-sm text-muted">Type the wrong answer and Flashcardsish will tell you <strong className="text-text">which card</strong> your answer actually belongs to. Super helpful for catching when you've mixed up similar terms!</p>
                            </div>
                            <div className={panel}>
                                <div className="font-bold text-text mb-2 text-sm">Accuracy & Forgiveness</div>
                                <p className="text-sm text-muted">Customize how picky Flashcardsish is in <strong className="text-text">Settings</strong>. Forgive minor spelling errors, ignore diacritics, ignore capitalization, or allow specific letter "wiggle room". Try <strong className="text-text">Retype Mistakes</strong> or <strong className="text-text">Brutal Mode</strong> for true mastery!</p>
                            </div>
                        </div>
                        <Tip>Use <strong>Zen</strong> for focused deep study. Use <strong>Batch</strong> when you want manageable chunks with built-in progress tracking.</Tip>
                    </section>

                    {/* ──────────────────────────────────────────
                    7. FLASHCARDS MODE
                   ────────────────────────────────────────── */}
                    <section id="flashcards" className={section}>
                        <Heading kicker="Flashcards Mode" title="Flashcards Mode: Flip, sort, and review" lead="A more relaxed study mode — flip through cards at your own pace, or actively sort them into piles." />

                        <div className="grid md:grid-cols-2 gap-4 mt-6">
                            <div className={panel}>
                                <div className="font-bold text-text mb-3 flex items-center gap-2"><Layers size={16} className="text-accent" /> Stack Mode</div>
                                <p className="text-sm text-muted mb-2">Classic flashcard experience. Flip a card, read both sides, move on.</p>
                                <ul className="space-y-2 text-sm text-muted">
                                    <Bullet>Navigate with <Kbd>←</Kbd> <Kbd>→</Kbd> arrows or on-screen buttons.</Bullet>
                                    <Bullet>Flip cards with <Kbd>Space</Kbd> or by clicking/tapping.</Bullet>
                                    <Bullet>Shuffle the deck anytime with the shuffle button.</Bullet>
                                    <Bullet>Star cards while reviewing to flag them.</Bullet>
                                    <Bullet>Finish the stack and celebrate with confetti!</Bullet>
                                </ul>
                            </div>
                            <div className={panel}>
                                <div className="font-bold text-text mb-3 flex items-center gap-2"><Shuffle size={16} className="text-accent" /> Sort Mode</div>
                                <p className="text-sm text-muted mb-2">Flip each card, then sort it: <strong className="text-red">Review</strong> (need more practice) or <strong className="text-green">Got It</strong> (nailed it).</p>
                                <div className="my-4 p-4 rounded-xl border border-outline bg-panel">
                                    <SortDemo />
                                </div>
                                <ul className="space-y-2 text-sm text-muted">
                                    <Bullet>After each round, cards in the Review pile become your next deck.</Bullet>
                                    <Bullet>Keep going until every card is in the Got It pile — then you win!</Bullet>
                                    <Bullet>Undo your last sort decision at any time with <Kbd>Z</Kbd>.</Bullet>
                                </ul>
                            </div>
                        </div>
                        <Tip>Sort mode is amazing for the night before an exam — you naturally focus more time on the cards you don't know yet.</Tip>
                    </section>

                    {/* ──────────────────────────────────────────
                    8. LIBRARY & ORGANIZATION
                   ────────────────────────────────────────── */}
                    <section id="library" className={section}>
                        <Heading kicker="Library" title="Organize Everything... No, Really" lead="Folders, tags, stars, multi-select — keep your library clean no matter how many sets you build." />

                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
                            <div className={panel}>
                                <div className="font-bold text-text mb-2 flex items-center gap-2"><FolderOpen size={16} className="text-accent" /> Folders</div>
                                <p className="text-sm text-muted">Create colored folders (brown, red, blue, yellow, green, purple) and drag sets into them. Rename or delete folders anytime. Folders keep your Library from becoming a wall of cards.</p>
                            </div>
                            <div className={panel}>
                                <div className="font-bold text-text mb-2 flex items-center gap-2"><Tag size={16} className="text-accent" /> Tags</div>
                                <p className="text-sm text-muted">Create tags in Settings → Tags with 22+ color options. Apply them to sets for quick visual grouping. One set can have multiple tags — perfect for cross-referencing ("Biology" + "Final Exam").</p>
                            </div>
                            <div className={panel}>
                                <div className="font-bold text-text mb-2 flex items-center gap-2"><Star size={16} className="text-accent" /> Stars</div>
                                <p className="text-sm text-muted">Star individual cards during building OR during study. Then toggle <strong className="text-text">"Study Starred Only"</strong> in Settings to focus exclusively on your trouble cards.</p>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-4 mt-4">
                            <div className={panel}>
                                <div className="font-bold text-text mb-3 flex items-center gap-2"><Layers size={16} className="text-accent" /> Multistudy</div>
                                <p className="text-sm text-muted mb-2">Select 2+ sets and hit <strong className="text-text">Multistudy</strong> to combine them into a single temporary study session. The original sets stay untouched — Multistudy creates a separate session that pulls cards from all selected sets.</p>
                                <ul className="space-y-2 text-sm text-muted">
                                    <Bullet>Great for exam review across multiple chapters.</Bullet>
                                    <Bullet>You can also Multistudy an entire folder at once!</Bullet>
                                    <Bullet>Cards show which original set they came from so you always have context.</Bullet>
                                </ul>
                            </div>
                            <div className={panel}>
                                <div className="font-bold text-text mb-3 flex items-center gap-2"><Copy size={16} className="text-accent" /> More Library Tools</div>
                                <ul className="space-y-2 text-sm text-muted">
                                    <Bullet><strong className="text-text">Combine</strong> — merge multiple sets into one permanent set.</Bullet>
                                    <Bullet><strong className="text-text">Duplicate</strong> — clone a set instantly.</Bullet>
                                    <Bullet><strong className="text-text">Edit</strong> — jump back into the Visual Builder to modify any set.</Bullet>
                                    <Bullet><strong className="text-text">Export</strong> — download any set as a <code className="text-accent">.flashcards</code> file.</Bullet>
                                    <Bullet><strong className="text-text">Import</strong> — drag-and-drop or upload <code className="text-accent">.flashcards</code> files to add sets.</Bullet>
                                    <Bullet><strong className="text-text">Local-only</strong> — mark sets that should never sync to the cloud.</Bullet>
                                </ul>
                            </div>
                        </div>
                        <Tip>Use multi-select (checkboxes) to bulk-move sets between folders, create Multistudy sessions, or combine sets all at once.</Tip>
                    </section>

                    {/* ──────────────────────────────────────────
                    9. KEYBINDS
                   ────────────────────────────────────────── */}
                    <section id="keybinds" className={section}>
                        <Heading kicker="Keybinds" title="Keyboard Centric" lead="Flashcardsish is fully keyboard-navigable. Customize every shortcut in Settings → Study Settings → Keybinds. These are the default ones." />

                        <div className={`${panel} mt-6`}>
                            <div className="grid md:grid-cols-2 gap-6 text-sm text-muted">
                                <div>
                                    <div className="font-bold text-text mb-3">Learn Mode</div>
                                    <ul className="space-y-2">
                                        <Bullet><Kbd>Enter</Kbd> — submit your answer.</Bullet>
                                        <Bullet><Kbd>Tab</Kbd> — move to next field (locked).</Bullet>
                                        <Bullet><Kbd>A</Kbd> / <Kbd>←</Kbd> — select Option A / True.</Bullet>
                                        <Bullet><Kbd>B</Kbd> / <Kbd>→</Kbd> — select Option B / False.</Bullet>
                                        <Bullet>All keybinds are remappable!</Bullet>
                                    </ul>
                                </div>
                                <div>
                                    <div className="font-bold text-text mb-3">Flashcards Mode</div>
                                    <ul className="space-y-2">
                                        <Bullet><Kbd>Space</Kbd> / <Kbd>Enter</Kbd> — flip card.</Bullet>
                                        <Bullet><Kbd>←</Kbd> — previous card / Review pile.</Bullet>
                                        <Bullet><Kbd>→</Kbd> — next card / Got It pile.</Bullet>
                                        <Bullet><Kbd>Z</Kbd> — undo last sort decision.</Bullet>
                                    </ul>
                                </div>
                            </div>
                        </div>
                        <Tip>Open the Keybinds modal from Settings — it has a live <strong>keyboard visualization</strong> that highlights your bindings as you hover over each action!</Tip>
                    </section>

                    {/* ──────────────────────────────────────────
                    10. CLOUD SYNC & BACKUPS
                   ────────────────────────────────────────── */}
                    <section id="safety" className={section}>
                        <Heading kicker="Data & Sync" title="Keep your data safe" lead="Your cards are stored locally first. Optionally sync to Google Drive for free, and export backups whenever you want." />

                        <div className="grid md:grid-cols-3 gap-4 mt-6">
                            <div className={panel}>
                                <div className="font-bold text-text mb-2 flex items-center gap-2"><HardDrive size={15} className="text-accent" /> Local First</div>
                                <p className="text-sm text-muted">Everything saves to your browser's local storage automatically. Even without internet, your cards are right here on this device.</p>
                            </div>
                            <div className={panel}>
                                <div className="font-bold text-text mb-2 flex items-center gap-2"><Cloud size={15} className="text-accent" /> Google Drive Sync</div>
                                <p className="text-sm text-muted">Sign in with Google (go to Settings → You) to sync your library to Google Drive. Access your cards from any device, totally free. Mark specific sets as <strong className="text-text">Local-only</strong> if you don't want them synced.</p>
                            </div>
                            <div className={panel}>
                                <div className="font-bold text-text mb-2 flex items-center gap-2"><Download size={15} className="text-accent" /> Manual Exports</div>
                                <p className="text-sm text-muted">Export individual sets as <code className="text-accent">.flashcards</code> files, or export your <strong className="text-text">entire account</strong> (all sets, folders, settings) as a JSON backup from Settings → You.</p>
                            </div>
                        </div>
                        <Tip>Before a big exam or major edits, export your full account as a JSON backup. It takes two seconds and could save your life!</Tip>
                    </section>

                    <section id="contact" className={section}>
                        <Heading kicker="Contact" title="Questions? Ideas? Bugs?" lead="Flashcardsish is currently a solo passion project, and I'm always open to feedback, ideas, and comments." />

                        <div className={`${panel} mt-6`}>
                            <p className="text-sm text-muted">
                                Found a bug? Have an idea for a cool feature? Or just want to say hi? <br /><br />
                                Send an email to <a href="mailto:owenw2023@gmail.com" className="text-accent font-bold hover:underline transition-all">owenw2023@gmail.com</a>. You can also use the feedback button in the bottom right.
                            </p>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
};
