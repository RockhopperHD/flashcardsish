import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Settings } from '../types';
import { DEFAULT_SETTINGS } from '../storage';
import { X, RotateCcw } from 'lucide-react';
import clsx from 'clsx';
import { CursorTooltip } from './CursorTooltip';
import { isMacPlatform } from '../utils';

interface KeybindsModalProps {
    isOpen: boolean;
    onClose: () => void;
    settings: Settings;
    onUpdate: (s: Settings) => void;
}

// A keybind row definition
interface KeybindKey {
    settingKey?: keyof Settings;
    label: string;
    locked?: boolean;
    lockedTooltip?: string;
    displayValue?: string;
}

interface KeybindAction {
    id: string;
    label: string;
    keys: KeybindKey[];
}

const getDisplayValue = (key: string | undefined) => {
    if (!key) return '—';
    if (key === 'ArrowLeft') return '←';
    if (key === 'ArrowRight') return '→';
    if (key === 'ArrowUp') return '↑';
    if (key === 'ArrowDown') return '↓';
    if (key === ' ') return 'Space';
    if (key === 'Enter') return 'Enter';
    if (key === 'Tab') return 'Tab';
    if (key === 'Escape') return 'Esc';
    if (key === 'Backspace') return 'Bksp';
    if (key.length === 1) return key.toUpperCase();
    return key;
};

// Map e.key values to keyboard data-key/data-char for highlight
// We also use this to map pressed keys to DOM elements
const keyToSelector = (key: string, keyCode?: number): string | null => {
    if (!key) return null;

    // Explicit keyCode mappings for non-character keys
    // This matches the data-key attributes in the JSX
    const codeMap: Record<number, string> = {
        37: '[data-key="37"]', // Left
        38: '[data-key="38"]', // Up/Down (shared visual key in this layout)
        39: '[data-key="39"]', // Right
        40: '[data-key="38"]', // Down -> maps to shared arrow key
        32: '[data-key="32"]', // Space
        13: '[data-key="13"]', // Enter
        9: '[data-key="9"]',  // Tab
        27: '[data-key="27"]', // Esc
        8: '[data-key="8"]',  // Backspace
        16: '[data-key="16"]', // Shift (left usually)
        17: '[data-key="17"]', // Ctrl
        18: '[data-key="18"]', // Alt
        91: '[data-key="91"]', // Meta (Left)
        93: '[data-key="93-R"]', // Meta (Right)
        20: '[data-key="20"]', // Caps
        191: '[data-key="191"]', // / ?
    };

    if (keyCode && codeMap[keyCode]) return codeMap[keyCode];

    // String based map for some special keys if keyCode fails or for bound settings
    const stringMap: Record<string, string> = {
        'ArrowLeft': '[data-key="37"]',
        'ArrowRight': '[data-key="39"]',
        'ArrowUp': '[data-key="38"]',
        'ArrowDown': '[data-key="38"]',
        ' ': '[data-key="32"]',
        'Enter': '[data-key="13"]',
        'Tab': '[data-key="9"]',
        'Escape': '[data-key="27"]',
        'Backspace': '[data-key="8"]',
        'Shift': '[data-key="16"]',
        'Control': '[data-key="17"]',
        'Alt': '[data-key="18"]',
        'Meta': '[data-key="91"]',
        'CapsLock': '[data-key="20"]',
        '/': '[data-key="191"]',
        '?': '[data-key="191"]',
    };
    if (stringMap[key]) return stringMap[key];

    // Single characters (A-Z, 0-9)
    if (key.length === 1) {
        return `[data-char="${key.toUpperCase()}"]`;
    }

    // Function keys
    const fnMatch = key.match(/^F(\d+)$/);
    if (fnMatch) {
        // data-key for F1 is 112
        const fNum = parseInt(fnMatch[1]);
        return `[data-key="${111 + fNum}"]`;
    }

    return null;
};

// Color for each action category
const ACTION_COLORS: Record<string, string> = {
    optionA: '#3b82f6',    // blue
    optionB: '#f97316',    // orange
    flipCard: '#a855f7',   // purple
    submitAnswer: '#10b981', // emerald
    nextField: '#64748b',  // slate/gray
    openKeybinds: '#d0a45e', // accent
};

export const KeybindsModal: React.FC<KeybindsModalProps> = ({ isOpen, onClose, settings, onUpdate }) => {
    const isMac = isMacPlatform();
    // Draft state: work on a copy so Cancel discards changes
    const [draft, setDraft] = useState<Settings>({ ...settings });
    const [activeInput, setActiveInput] = useState<string | null>(null); // settingKey being captured
    const [pressedKeys, setPressedKeys] = useState<Set<string>>(new Set()); // IDs of pressed keys (selector strings)
    const keyboardRef = useRef<HTMLDivElement>(null);

    // Reset draft when opened
    useEffect(() => {
        if (isOpen) {
            // Merge with defaults ensures we don't have blank values for new settings
            setDraft({ ...DEFAULT_SETTINGS, ...settings });
            setActiveInput(null);
            setPressedKeys(new Set());
        }
    }, [isOpen, settings]);

    // Track physical key presses for visual feedback
    useEffect(() => {
        if (!isOpen) return;

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onClose();
            }
        };

        window.addEventListener('keydown', handleEscape, true);

        const handleKeyDown = (e: KeyboardEvent) => {
            // Identify selector for this key
            const selector = keyToSelector(e.key, e.keyCode);
            if (selector) {
                setPressedKeys(prev => {
                    const next = new Set(prev);
                    next.add(selector);
                    return next;
                });
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            const selector = keyToSelector(e.key, e.keyCode);
            if (selector) {
                setPressedKeys(prev => {
                    const next = new Set(prev);
                    next.delete(selector);
                    return next;
                });
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        return () => {
            window.removeEventListener('keydown', handleEscape, true);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    }, [isOpen, onClose]);

    const actions: KeybindAction[] = [
        {
            id: 'optionA',
            label: 'Choose Option A / True',
            keys: [
                { settingKey: 'learnModeLeftKey1', label: 'Primary' },
                { settingKey: 'learnModeLeftKey2', label: 'Secondary' },
            ]
        },
        {
            id: 'optionB',
            label: 'Choose Option B / False',
            keys: [
                { settingKey: 'learnModeRightKey1', label: 'Primary' },
                { settingKey: 'learnModeRightKey2', label: 'Secondary' },
            ]
        },
        {
            id: 'flipCard',
            label: 'Flip Card',
            keys: [
                { settingKey: 'flipCardKey1', label: 'Primary' },
                { settingKey: 'flipCardKey2', label: 'Secondary' },
            ]
        },
        {
            id: 'submitAnswer',
            label: 'Submit Answer',
            keys: [
                { settingKey: 'submitAnswerKey1', label: 'Primary' },
            ]
        },
        {
            id: 'nextField',
            label: 'Move to Next Field',
            keys: [
                { settingKey: 'nextFieldKey1', label: 'Primary', locked: true, lockedTooltip: 'Tab is always used for field navigation and cannot be changed.' },
            ]
        },
        {
            id: 'openKeybinds',
            label: 'Open Keybinds',
            keys: [
                { label: 'Shortcut', locked: true, displayValue: 'Cmd + ? / Ctrl + ?', lockedTooltip: 'This shortcut is fixed and works from any screen.' },
            ]
        },
    ];

    // Collect all currently bound keys for highlight
    const getBoundKeys = useCallback((): { key: string; actionId: string }[] => {
        const result: { key: string; actionId: string }[] = [];
        for (const action of actions) {
            for (const k of action.keys) {
                if (!k.settingKey) continue;
                const val = draft[k.settingKey] as string | undefined;
                if (val) {
                    result.push({ key: val, actionId: action.id });
                }
            }
        }
        return result;
    }, [draft]);

    // Update keyboard highlights (Bound keys + Pressed keys)
    useEffect(() => {
        if (!keyboardRef.current) return;

        // 1. Reset all keys
        const allKeys = keyboardRef.current.querySelectorAll('.kb-key');
        allKeys.forEach(el => {
            const element = el as HTMLElement;
            element.removeAttribute('data-highlight');
            element.style.removeProperty('--highlight-color');
            element.style.removeProperty('box-shadow');
            element.style.removeProperty('border-color');
            // Reset "pressed" styles
            element.style.removeProperty('background-color');
            element.style.removeProperty('color');
            element.style.removeProperty('transform');
            element.style.removeProperty('filter');
            element.style.removeProperty('z-index');
            element.style.removeProperty('font-weight');
        });

        // 2. Apply "Bound" highlights
        const bound = getBoundKeys();
        for (const { key, actionId } of bound) {
            const selector = keyToSelector(key);
            if (selector) {
                const el = keyboardRef.current.querySelector(selector) as HTMLElement | null;
                if (el) {
                    el.setAttribute('data-highlight', actionId);
                    const color = ACTION_COLORS[actionId] || '#3b82f6';
                    el.style.setProperty('--highlight-color', color);
                    el.style.boxShadow = `0 0 0 2px ${color}, 0 0.2em 0 0.05em ${color}44`;
                    el.style.borderColor = color;
                }
            }
        }

        // 3. Apply "Pressed" visual state
        pressedKeys.forEach(selector => {
            const el = keyboardRef.current?.querySelector(selector) as HTMLElement | null;
            if (el) {
                el.style.transform = 'translateY(2px) scale(0.98)'; // Stronger press effect

                if (el.hasAttribute('data-highlight')) {
                    // Bound key: Simple brightness shift
                    el.style.filter = 'brightness(1.2)';
                } else {
                    // Unbound key
                    el.style.backgroundColor = 'var(--text)';
                    el.style.color = 'var(--bg)';
                    el.style.borderColor = 'transparent';
                    el.style.fontWeight = 'bold';
                }
            }
        });

    }, [draft, getBoundKeys, pressedKeys]);

    // Handle key capture for active input (rebinding)
    useEffect(() => {
        if (!activeInput) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            e.preventDefault();
            e.stopPropagation();

            const key = e.key;
            // Don't allow modifier-only keys
            if (['Shift', 'Control', 'Alt', 'Meta'].includes(key)) return;
            // Don't allow Tab (reserved for next field)
            if (key === 'Tab') return;

            setDraft(prev => ({ ...prev, [activeInput]: key }));
            setActiveInput(null);
        };

        window.addEventListener('keydown', handleKeyDown, true);
        return () => window.removeEventListener('keydown', handleKeyDown, true);
    }, [activeInput]);

    const handleOk = () => {
        onUpdate(draft);
        onClose();
    };

    const handleCancel = () => {
        onClose();
    };

    const handleResetAll = () => {
        setDraft(prev => ({
            ...prev,
            learnModeLeftKey1: DEFAULT_SETTINGS.learnModeLeftKey1,
            learnModeLeftKey2: DEFAULT_SETTINGS.learnModeLeftKey2,
            learnModeRightKey1: DEFAULT_SETTINGS.learnModeRightKey1,
            learnModeRightKey2: DEFAULT_SETTINGS.learnModeRightKey2,
            flipCardKey1: DEFAULT_SETTINGS.flipCardKey1,
            flipCardKey2: DEFAULT_SETTINGS.flipCardKey2,
            submitAnswerKey1: DEFAULT_SETTINGS.submitAnswerKey1,
            nextFieldKey1: DEFAULT_SETTINGS.nextFieldKey1,
        }));
    };

    const handleClearKey = (settingKey: string) => {
        setDraft(prev => ({ ...prev, [settingKey]: '' }));
    };

    const conflicts = (() => {
        const boundKeys: Record<string, { label: string, actionId: string }[]> = {};
        actions.forEach(action => {
            action.keys.forEach(k => {
                if (!k.settingKey) return;
                const val = draft[k.settingKey] as string;
                if (val) {
                    if (!boundKeys[val]) boundKeys[val] = [];
                    boundKeys[val].push({ label: `${action.label} (${k.label})`, actionId: action.id });
                }
            });
        });
        const list: string[] = [];
        Object.entries(boundKeys).forEach(([key, usages]) => {
            if (usages.length > 1) {
                // Allow overlapping Flip Card and Submit Answer
                const allowedIds = ['flipCard', 'submitAnswer'];
                const isException = usages.every(u => allowedIds.includes(u.actionId));

                if (!isException) {
                    list.push(`"${getDisplayValue(key)}" is used by: ${usages.map(u => u.label).join(', ')}`);
                }
            }
        });
        return list;
    })();

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in"
            onMouseDown={handleCancel}
        >
            <div
                className="bg-panel border border-outline rounded-2xl shadow-2xl animate-in zoom-in-95 w-full max-w-4xl max-h-[90vh] flex flex-col"
                onMouseDown={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-outline shrink-0">
                    <h3
                        className="text-3xl text-text"
                        style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}
                    >
                        Keybinds
                    </h3>
                    <button onClick={handleCancel} className="text-muted hover:text-text p-2 rounded-lg hover:bg-panel-2 transition-colors">
                        <X size={24} />
                    </button>
                </div>

                {/* Fixed Top Section: Instructions + Keyboard */}
                <div className="p-6 pb-0 border-b border-outline/50 bg-panel z-10 shrink-0">
                    <p className="text-text leading-relaxed mb-6">
                        Flashcardsish is designed with keyboards in mind, including however you use it. Click any slot below to rebind it, then press your desired key. Right-click a slot to clear it.
                    </p>

                    {conflicts.length > 0 && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl animate-in fade-in slide-in-from-top-2">
                            <div className="font-bold flex items-center gap-2 mb-1">
                                Duplicate Bindings Detected
                            </div>
                            <ul className="list-disc list-inside text-sm opacity-90 space-y-1">
                                {conflicts.map((c, i) => <li key={i}>{c}</li>)}
                            </ul>
                        </div>
                    )}

                    <div className="keybinds-keyboard-container hidden md:block pb-6">
                        <div ref={keyboardRef} className="keybinds-keyboard scale-[0.9] origin-top-left">
                            {/* Row 1: Function keys */}
                            <div className="kb-row kb-row--fn">
                                <div data-key="27" className="kb-key kb-key--word"><span>esc</span></div>
                                <div data-key="112" className="kb-key kb-key--fn-key"><span>F1</span></div>
                                <div data-key="113" className="kb-key kb-key--fn-key"><span>F2</span></div>
                                <div data-key="114" className="kb-key kb-key--fn-key"><span>F3</span></div>
                                <div data-key="115" className="kb-key kb-key--fn-key"><span>F4</span></div>
                                <div data-key="116" className="kb-key kb-key--fn-key"><span>F5</span></div>
                                <div data-key="117" className="kb-key kb-key--fn-key"><span>F6</span></div>
                                <div data-key="118" className="kb-key kb-key--fn-key"><span>F7</span></div>
                                <div data-key="119" className="kb-key kb-key--fn-key"><span>F8</span></div>
                                <div data-key="120" className="kb-key kb-key--fn-key"><span>F9</span></div>
                                <div data-key="121" className="kb-key kb-key--fn-key"><span>F10</span></div>
                                <div data-key="122" className="kb-key kb-key--fn-key"><span>F11</span></div>
                                <div data-key="123" className="kb-key kb-key--fn-key"><span>F12</span></div>
                            </div>
                            {/* Row 2: Number row */}
                            <div className="kb-row">
                                <div className="kb-key kb-key--double" data-key="192"><div>~</div><div>`</div></div>
                                <div className="kb-key kb-key--double" data-key="49"><div>!</div><div>1</div></div>
                                <div className="kb-key kb-key--double" data-key="50"><div>@</div><div>2</div></div>
                                <div className="kb-key kb-key--double" data-key="51"><div>#</div><div>3</div></div>
                                <div className="kb-key kb-key--double" data-key="52"><div>$</div><div>4</div></div>
                                <div className="kb-key kb-key--double" data-key="53"><div>%</div><div>5</div></div>
                                <div className="kb-key kb-key--double" data-key="54"><div>^</div><div>6</div></div>
                                <div className="kb-key kb-key--double" data-key="55"><div>&amp;</div><div>7</div></div>
                                <div className="kb-key kb-key--double" data-key="56"><div>*</div><div>8</div></div>
                                <div className="kb-key kb-key--double" data-key="57"><div>(</div><div>9</div></div>
                                <div className="kb-key kb-key--double" data-key="48"><div>)</div><div>0</div></div>
                                <div className="kb-key kb-key--double" data-key="189"><div>_</div><div>-</div></div>
                                <div className="kb-key kb-key--double" data-key="187"><div>+</div><div>=</div></div>
                                <div className="kb-key kb-key--word kb-key--w4" data-key="8"><span>delete</span></div>
                            </div>
                            {/* Row 3: QWERTY */}
                            <div className="kb-row">
                                <div className="kb-key kb-key--word kb-key--w4" data-key="9"><span>tab</span></div>
                                <div className="kb-key kb-key--letter" data-char="Q">Q</div>
                                <div className="kb-key kb-key--letter" data-char="W">W</div>
                                <div className="kb-key kb-key--letter" data-char="E">E</div>
                                <div className="kb-key kb-key--letter" data-char="R">R</div>
                                <div className="kb-key kb-key--letter" data-char="T">T</div>
                                <div className="kb-key kb-key--letter" data-char="Y">Y</div>
                                <div className="kb-key kb-key--letter" data-char="U">U</div>
                                <div className="kb-key kb-key--letter" data-char="I">I</div>
                                <div className="kb-key kb-key--letter" data-char="O">O</div>
                                <div className="kb-key kb-key--letter" data-char="P">P</div>
                                <div className="kb-key kb-key--double" data-key="219" data-char="{["><div>{"{"}</div><div>[</div></div>
                                <div className="kb-key kb-key--double" data-key="221" data-char="}]"><div>{"}"}</div><div>]</div></div>
                                <div className="kb-key kb-key--double" data-key="220" data-char="|\"><div>|</div><div>\</div></div>
                            </div>
                            {/* Row 4: Home row */}
                            <div className="kb-row">
                                <div className="kb-key kb-key--word kb-key--w5" data-key="20"><span>caps</span></div>
                                <div className="kb-key kb-key--letter" data-char="A">A</div>
                                <div className="kb-key kb-key--letter" data-char="S">S</div>
                                <div className="kb-key kb-key--letter" data-char="D">D</div>
                                <div className="kb-key kb-key--letter" data-char="F">F</div>
                                <div className="kb-key kb-key--letter" data-char="G">G</div>
                                <div className="kb-key kb-key--letter" data-char="H">H</div>
                                <div className="kb-key kb-key--letter" data-char="J">J</div>
                                <div className="kb-key kb-key--letter" data-char="K">K</div>
                                <div className="kb-key kb-key--letter" data-char="L">L</div>
                                <div className="kb-key kb-key--double" data-key="186"><div>:</div><div>;</div></div>
                                <div className="kb-key kb-key--double" data-key="222"><div>"</div><div>'</div></div>
                                <div className="kb-key kb-key--word kb-key--w5" data-key="13"><span>return</span></div>
                            </div>
                            {/* Row 5: Shift row */}
                            <div className="kb-row">
                                <div className="kb-key kb-key--word kb-key--w6" data-key="16"><span>shift</span></div>
                                <div className="kb-key kb-key--letter" data-char="Z">Z</div>
                                <div className="kb-key kb-key--letter" data-char="X">X</div>
                                <div className="kb-key kb-key--letter" data-char="C">C</div>
                                <div className="kb-key kb-key--letter" data-char="V">V</div>
                                <div className="kb-key kb-key--letter" data-char="B">B</div>
                                <div className="kb-key kb-key--letter" data-char="N">N</div>
                                <div className="kb-key kb-key--letter" data-char="M">M</div>
                                <div className="kb-key kb-key--double" data-key="188"><div>&lt;</div><div>,</div></div>
                                <div className="kb-key kb-key--double" data-key="190"><div>&gt;</div><div>.</div></div>
                                <div className="kb-key kb-key--double" data-key="191"><div>?</div><div>/</div></div>
                                <div className="kb-key kb-key--word kb-key--w6" data-key="16-R"><span>shift</span></div>
                            </div>
                            {/* Row 6: Bottom row */}
                            <div className="kb-row kb-row--bottom justify-center">
                                <div className="kb-key kb-key--word kb-key--w1" data-key={isMac ? "91" : "17"}>
                                    <span>{isMac ? "⌘" : "ctrl"}</span>
                                </div>
                                <div className="kb-key kb-key--word kb-key--w1" data-key="18"><span>alt</span></div>
                                <div className="kb-key kb-key--space flex-grow max-w-[200px]" data-key="32" data-char=" ">&nbsp;</div>
                                <div className="kb-key kb-key--word kb-key--w1" data-key="18-R"><span>alt</span></div>
                                <div className="kb-key kb-key--arrow" data-key="37"><span>◀</span></div>
                                <div className="kb-key kb-key--arrow-tall" data-key="38"><div>▲</div><div>▼</div></div>
                                <div className="kb-key kb-key--arrow" data-key="39"><span>▶</span></div>
                            </div>
                        </div>

                        {/* Legend */}
                        <div className="flex flex-wrap gap-4 mt-6 justify-center">
                            {actions.map(action => (
                                <div key={action.id} className="flex items-center gap-2 text-sm text-muted">
                                    <div
                                        className="w-3 h-3 rounded-full"
                                        style={{ backgroundColor: ACTION_COLORS[action.id] }}
                                    />
                                    <span>{action.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Content: Scrollable Settings Only */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {/* Keybind Actions */}
                    <div className="space-y-4">
                        {actions.map(action => (
                            <div key={action.id} className="p-4 bg-panel-2 rounded-xl border border-outline/50 hover:border-accent/30 transition-all">
                                <div className="flex items-center gap-3 mb-3">
                                    <div
                                        className="w-4 h-4 rounded-full shrink-0"
                                        style={{ backgroundColor: ACTION_COLORS[action.id] }}
                                    />
                                    <span className="font-bold text-text text-lg">{action.label}</span>
                                </div>
                                <div className="flex gap-3 ml-7">
                                    {action.keys.map(k => {
                                        const keySetting = k.settingKey;
                                        const val = keySetting ? (draft[keySetting] as string | undefined) : undefined;
                                        const isActive = keySetting ? activeInput === keySetting : false;
                                        const isLocked = k.locked || !keySetting;
                                        const displayValue = k.displayValue ?? getDisplayValue(val);

                                        const button = (
                                            <button
                                                key={keySetting ?? `${action.id}-${k.label}`}
                                                onClick={() => {
                                                    if (isLocked || !keySetting) return;
                                                    setActiveInput(isActive ? null : keySetting);
                                                }}
                                                onContextMenu={(e) => {
                                                    e.preventDefault();
                                                    if (isLocked || !keySetting) return;
                                                    handleClearKey(keySetting);
                                                }}
                                                className={clsx(
                                                    "px-4 py-2 rounded-lg text-base font-bold border transition-all select-none min-w-[80px]",
                                                    isLocked
                                                        ? "bg-panel border-outline/50 text-muted cursor-not-allowed opacity-60"
                                                        : isActive
                                                            ? "bg-accent/20 border-accent text-accent ring-2 ring-accent/30 animate-pulse"
                                                            : "bg-panel border-outline text-text hover:border-accent/50 cursor-pointer hover:bg-panel-3"
                                                )}
                                            >
                                                <span className="text-xs text-muted block mb-1 uppercase tracking-wider">{k.label}</span>
                                                {isActive ? '...' : displayValue}
                                            </button>
                                        );

                                        if (isLocked && k.lockedTooltip) {
                                            return (
                                                <CursorTooltip
                                                    key={k.settingKey}
                                                    content={k.lockedTooltip}
                                                    isEnabled={true}
                                                    tooltipClassName="w-64"
                                                >
                                                    {button}
                                                </CursorTooltip>
                                            );
                                        }

                                        return button;
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t border-outline shrink-0 bg-panel-2/50">
                    <button
                        onClick={handleResetAll}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-muted hover:text-text bg-panel hover:bg-panel-3 border border-outline rounded-lg transition-colors duration-150"
                    >
                        <RotateCcw size={16} />
                        Reset All
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={handleCancel}
                            className="px-6 py-2.5 text-base font-bold text-muted hover:text-text bg-panel hover:bg-panel-3 border border-outline rounded-lg transition-colors duration-150"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleOk}
                            className="px-6 py-2.5 text-base font-bold text-bg bg-accent hover:bg-accent/90 rounded-lg transition-colors duration-150 shadow-lg shadow-accent/20"
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
