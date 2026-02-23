import React, { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';
import clsx from 'clsx';
import { isMacPlatform } from '../utils';

interface RichInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    onBlur?: () => void;
    onFocus?: () => void;
    onKeyDown?: (e: React.KeyboardEvent) => void;
    onKeyUp?: (e: React.KeyboardEvent) => void;
    onMouseUp?: (e: React.MouseEvent) => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    disabled?: boolean;
}

export interface RichInputRef {
    applyFormat: (type: string, value?: string) => void;
    focus: (opts?: { position?: 'end' | 'first-gap' }) => void;
    getContainer: () => HTMLDivElement | null;
}

// Map styles to markdown tags
const TAGS: Record<string, { start: string; end: string; className: string; tag?: string }> = {
    bold: { start: '**', end: '**', className: 'font-bold' },
    italic: { start: '*', end: '*', className: 'italic' },
    underline: { start: '__', end: '__', className: 'underline decoration-accent underline-offset-4' },
    code: { start: '`', end: '`', className: 'bg-panel-2 border border-outline px-1 rounded text-sm font-mono text-accent' },
    'hl-r': { start: '<h=r>', end: '</h>', className: 'bg-red/20 text-red px-1 rounded' },
    'hl-b': { start: '<h=b>', end: '</h>', className: 'bg-blue/20 text-blue px-1 rounded' },
    'hl-g': { start: '<h=g>', end: '</h>', className: 'bg-green/20 text-green px-1 rounded' },
    'hl-p': { start: '<h=p>', end: '</h>', className: 'bg-purple/20 text-purple px-1 rounded' },
    'hl-y': { start: '<h=y>', end: '</h>', className: 'bg-yellow/20 text-yellow px-1 rounded' },
};

// HTML TO MARKDOWN
const htmlToMarkdown = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent || '';
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;

        if (el.tagName === 'BR') return '\n';

        let content = '';
        el.childNodes.forEach(child => {
            content += htmlToMarkdown(child);
        });

        // Check dataset first
        const markStart = el.dataset.mdStart;
        const markEnd = el.dataset.mdEnd;

        if (markStart && markEnd) {
            return `${markStart}${content}${markEnd}`;
        }

        // List Handling
        if (el.tagName === 'UL' || el.tagName === 'OL') {
            return content; // List items handles newlines
        }
        if (el.tagName === 'LI') {
            // Ensure lists use "- " format
            return `- ${content.trim()}\n`; // Add newline after item
        }

        // Fallbacks for pasted content or browser execCommand
        if (el.tagName === 'B' || el.tagName === 'STRONG') return `**${content}**`;
        if (el.tagName === 'I' || el.tagName === 'EM') return `*${content}*`;
        if (el.tagName === 'U') return `__${content}__`;
        if (el.tagName === 'CODE') return `\`${content}\``;
        if (el.tagName === 'DIV' || el.tagName === 'P') return `\n${content}`; // Block handling (basics)

        return content;
    }
    return '';
};

// MARKDOWN TO HTML (Supports Lists first, then Recursive Helpers)
const markdownToHtml = (text: string): string => {
    if (!text) return '';

    // 1. Pre-process Lists (Blocks)
    // Identify blocks of lines starting with "- "
    // Regex matches consecutive lines starting with "- " (handling \n)
    // We treat the whole block as a list
    let processedText = text;

    // We can't easily regex match the whole block with JS regex without multiline flag carefully
    // Instead, let's process line by line or use a block replacer

    // List parser for lines starting with "- " or "* "
    const lines = text.split('\n');
    let inList = false;
    let newLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            if (!inList) {
                newLines.push('<ul>');
                inList = true;
            }
            // Process content of list item recursively (for bold etc)
            const content = trimmed.substring(2);
            newLines.push(`<li>${markdownToHtmlInline(content)}</li>`);
        } else {
            if (inList) {
                newLines.push('</ul>');
                inList = false;
            }
            newLines.push(line);
        }
    }
    if (inList) newLines.push('</ul>');

    // Join back. 
    // BUT: markdownToHtmlInline expects text tokens.
    // Ideally we return the HTML string now for non-list lines too?
    // Let's refactor: separate inline parser

    const htmlLines = newLines.map(line => {
        if (line.startsWith('<ul>') || line.startsWith('<li>') || line.startsWith('</ul>')) return line;
        return markdownToHtmlInline(line);
    });

    return htmlLines.join(''); // Join without \n because <li> handles block, keeping \n might be redundant or needed for paragraphs
};

// Inline Parser (Old markdownToHtml)
const markdownToHtmlInline = (text: string): string => {
    if (!text) return '';
    let remaining = text;
    let html = '';

    while (remaining.length > 0) {
        // Regex search
        const tokenRegex = /(\[\[.*?\]\])|(<h=[rbgpy]>)|(<\/h>)|(`)|(\*\*\*)|(\*\*)|(\*)|(__)|(<u>)|(<\/u>)/;
        const match = remaining.match(tokenRegex);

        if (!match) {
            html += remaining;
            break;
        }

        const idx = match.index!;
        const token = match[0];

        if (idx > 0) {
            html += remaining.substring(0, idx);
        }

        const rest = remaining.substring(idx + token.length);

        if (token.startsWith('[[') && token.endsWith(']]')) {
            const innerText = token.substring(2, token.length - 2);
            html += `<span data-md-start="[[" data-md-end="]]" contenteditable="false" class="inline-block bg-[#1f2937] text-slate-300 px-2 py-0.5 rounded text-[0.9em] font-medium mx-1 cursor-default select-none border border-slate-600" style="background-image: repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.05) 5px, rgba(255,255,255,0.05) 10px);">${innerText}</span>`;
            remaining = rest;
        } else if (token.startsWith('<h=')) {
            // Highlight opener
            const color = token.charAt(3);
            const tag = `hl-${color}`;
            const def = TAGS[tag];
            // Find closer
            let depth = 1;
            let endIdx = -1;
            const searchRe = /(<h=[rbgpy]>)|(<\/h>)/g;
            searchRe.lastIndex = 0;
            let m;
            while ((m = searchRe.exec(rest)) !== null) {
                if (m[0].startsWith('<h=')) depth++;
                else depth--;
                if (depth === 0) {
                    endIdx = m.index;
                    break;
                }
            }

            if (endIdx !== -1) {
                const innerMd = rest.substring(0, endIdx);
                const innerHtml = markdownToHtmlInline(innerMd);
                html += `<span data-md-start="${def.start}" data-md-end="${def.end}" class="${def.className}">${innerHtml}</span>`;
                remaining = rest.substring(endIdx + 4); // skip </h>
            } else {
                html += token; // Unmatched
                remaining = rest;
            }
        } else if (token === '***') {
            // Bold + Italic
            const end = rest.indexOf('***');
            if (end !== -1) {
                html += `<span data-md-start="***" data-md-end="***" class="font-bold italic">${markdownToHtmlInline(rest.substring(0, end))}</span>`;
                remaining = rest.substring(end + 3);
            } else { html += token; remaining = rest; }
        } else if (token === '**') {
            // Bold
            const end = rest.indexOf('**');
            if (end !== -1) {
                html += `<span data-md-start="**" data-md-end="**" class="${TAGS.bold.className}">${markdownToHtmlInline(rest.substring(0, end))}</span>`;
                remaining = rest.substring(end + 2);
            } else { html += token; remaining = rest; }
        } else if (token === '*') {
            // Italic
            const end = rest.indexOf('*');
            if (end !== -1) {
                html += `<span data-md-start="*" data-md-end="*" class="${TAGS.italic.className}">${markdownToHtmlInline(rest.substring(0, end))}</span>`;
                remaining = rest.substring(end + 1);
            } else { html += token; remaining = rest; }
        } else if (token === '__') {
            const end = rest.indexOf('__');
            if (end !== -1) {
                html += `<span data-md-start="__" data-md-end="__" class="${TAGS.underline.className}">${markdownToHtmlInline(rest.substring(0, end))}</span>`;
                remaining = rest.substring(end + 2);
            } else { html += token; remaining = rest; }
        } else if (token === '`') {
            const end = rest.indexOf('`');
            if (end !== -1) {
                html += `<span data-md-start="\`" data-md-end="\`" class="${TAGS.code.className}">${rest.substring(0, end)}</span>`;
                remaining = rest.substring(end + 1);
            } else { html += token; remaining = rest; }
        } else if (token.startsWith('</')) {
            html += token;
            remaining = rest;
        } else {
            html += token;
            remaining = rest;
        }
        continue;
    }
    return html;
};

export const RichInput = forwardRef<RichInputRef, RichInputProps>(({
    value,
    onChange,
    placeholder,
    className,
    onBlur,
    onFocus,
    onKeyDown,
    onKeyUp,
    onMouseUp,
    onContextMenu,
    disabled
}, ref) => {
    const isMac = isMacPlatform();
    const contentEditableRef = useRef<HTMLDivElement>(null);
    const isTyping = useRef(false);
    const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const lastSyncedValue = useRef<string>(value);

    const getMarkdownFromContent = () => {
        if (!contentEditableRef.current) return '';
        let md = '';
        contentEditableRef.current.childNodes.forEach(child => {
            md += htmlToMarkdown(child);
        });

        // Strip a single leading newline if present, to account for first-block behavior
        if (md.startsWith('\n')) return md.substring(1);
        return md;
    };

    // Helpers for Cursor Preservation
    const getCaretIndex = (element: HTMLElement) => {
        let position = 0;
        const isSupported = typeof window.getSelection !== "undefined";
        if (isSupported) {
            const selection = window.getSelection();
            if (selection && selection.rangeCount !== 0) {
                const range = window.getSelection()!.getRangeAt(0);
                const preCaretRange = range.cloneRange();
                preCaretRange.selectNodeContents(element);
                preCaretRange.setEnd(range.endContainer, range.endOffset);
                position = preCaretRange.toString().length;
            }
        }
        return position;
    };

    const setCaretIndex = (element: HTMLElement, index: number) => {
        let charIndex = 0;
        const range = document.createRange();
        range.setStart(element, 0);
        range.collapse(true);
        const nodeStack = [element];
        let node;
        let found = false;

        while (!found && (node = nodeStack.pop())) {
            if (node.nodeType === 3) {
                const nextCharIndex = charIndex + (node.textContent?.length || 0);
                if (index >= charIndex && index <= nextCharIndex) {
                    range.setStart(node, index - charIndex);
                    range.collapse(true);
                    found = true;
                }
                charIndex = nextCharIndex;
            } else {
                let i = node.childNodes.length;
                while (i--) {
                    nodeStack.push(node.childNodes[i]);
                }
            }
        }

        const selection = window.getSelection();
        if (selection) {
            selection.removeAllRanges();
            selection.addRange(range);
        }
    };

    // Force sync: re-render the markdown → HTML in the contentEditable
    // Preserves full selection range (not just collapsed caret)
    const forceSync = useCallback(() => {
        if (!contentEditableRef.current) return;
        const hasFocus = document.activeElement === contentEditableRef.current;

        // Capture FULL selection range (start + end) before re-rendering
        let startPos = 0;
        let endPos = 0;
        if (hasFocus) {
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0) {
                const range = sel.getRangeAt(0);

                const startRange = range.cloneRange();
                startRange.selectNodeContents(contentEditableRef.current);
                startRange.setEnd(range.startContainer, range.startOffset);
                startPos = startRange.toString().length;

                const endRange = range.cloneRange();
                endRange.selectNodeContents(contentEditableRef.current);
                endRange.setEnd(range.endContainer, range.endOffset);
                endPos = endRange.toString().length;
            }
        }

        const currentMd = getMarkdownFromContent();
        contentEditableRef.current.innerHTML = markdownToHtml(currentMd);
        lastSyncedValue.current = currentMd;

        // Restore full selection range
        if (hasFocus) {
            const restoreRange = document.createRange();
            let charIndex = 0;
            let startNode: Node | null = null;
            let startOffset = 0;
            let endNode: Node | null = null;
            let endOffset = 0;

            const walk = (node: Node) => {
                if (startNode && endNode) return;
                if (node.nodeType === Node.TEXT_NODE) {
                    const len = node.textContent?.length || 0;
                    if (!startNode && charIndex + len >= startPos) {
                        startNode = node;
                        startOffset = startPos - charIndex;
                    }
                    if (!endNode && charIndex + len >= endPos) {
                        endNode = node;
                        endOffset = endPos - charIndex;
                    }
                    charIndex += len;
                } else {
                    for (let i = 0; i < node.childNodes.length; i++) {
                        walk(node.childNodes[i]);
                        if (startNode && endNode) return;
                    }
                }
            };

            walk(contentEditableRef.current);

            if (startNode && endNode) {
                restoreRange.setStart(startNode, startOffset);
                restoreRange.setEnd(endNode, endOffset);
                const sel = window.getSelection();
                if (sel) {
                    sel.removeAllRanges();
                    sel.addRange(restoreRange);
                }
            } else if (startNode) {
                restoreRange.setStart(startNode, startOffset);
                restoreRange.collapse(true);
                const sel = window.getSelection();
                if (sel) {
                    sel.removeAllRanges();
                    sel.addRange(restoreRange);
                }
            }
        }
    }, []);

    // Sync value to HTML (only when not typing to avoid cursor jumps / loops)
    useEffect(() => {
        if (isTyping.current) return;
        if (contentEditableRef.current) {
            const currentMd = getMarkdownFromContent();
            if (value !== currentMd) {
                // Preserve cursor
                const caretPos = getCaretIndex(contentEditableRef.current);

                contentEditableRef.current.innerHTML = markdownToHtml(value);
                lastSyncedValue.current = value;

                // Restore cursor if we had focus
                if (document.activeElement === contentEditableRef.current) {
                    setCaretIndex(contentEditableRef.current, caretPos);
                }
            }
        }
    }, [value]);

    const handleInput = () => {
        if (contentEditableRef.current) {
            // Fix "Ghost Highlights": Remove empty highlight spans that might remain after deletion
            const highlights = contentEditableRef.current.querySelectorAll('span[data-md-start^="<h="]');
            highlights.forEach(el => {
                if (!el.textContent && el.childNodes.length === 0) {
                    el.remove();
                } else if (el.textContent === '' && el.childNodes.length === 1 && el.firstChild?.nodeName === 'BR') {
                    // Empty line with just BR? If we want to allow highlighted empty lines, keep it.
                    // Usually users don't want ghost empty lines highlighted.
                    // But if it's a block, maybe. Span is inline.
                    el.remove();
                    // Recover the BR?
                    // contentEditableRef.current?.appendChild(document.createElement('br'));
                    // Complex. Let's strictly remove empty text text content.
                }
            });

            isTyping.current = true;
            const md = getMarkdownFromContent();
            onChange(md);
            // Reset isTyping after a short delay so external value syncs can work
            if (syncTimeoutRef.current) {
                clearTimeout(syncTimeoutRef.current);
            }
            syncTimeoutRef.current = setTimeout(() => {
                isTyping.current = false;
            }, 50);
        }
    };

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        };
    }, []);

    // Helper: find closest ancestor highlight span
    const findHighlightAncestor = (from: Node): HTMLElement | null => {
        let n: Node | null = from;
        while (n && n !== contentEditableRef.current) {
            if (n.nodeType === Node.ELEMENT_NODE) {
                const el = n as HTMLElement;
                if (el.dataset.mdStart && el.dataset.mdStart.startsWith('<h=')) {
                    return el;
                }
            }
            n = n.parentNode;
        }
        return null;
    };

    // Helper: emit markdown without triggering DOM-replacing sync
    const emitMarkdown = () => {
        const md = getMarkdownFromContent();
        isTyping.current = true;
        onChange(md);
        setTimeout(() => { isTyping.current = false; }, 50);
    };

    const applyFormat = (type: string, val?: string) => {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        if (!contentEditableRef.current?.contains(range.commonAncestorContainer)) return;

        // ── HIGHLIGHT LOGIC ──────────────────────────────────────────────
        if (type === 'highlight') {
            // Find any existing highlight ancestor
            const existingHighlight = findHighlightAncestor(range.commonAncestorContainer);
            const newDef = val ? TAGS[`hl-${val}`] : undefined;

            if (existingHighlight) {
                const currentStart = existingHighlight.dataset.mdStart;

                const isToggleOff = newDef && currentStart === newDef.start;
                const isRemove = !val;
                const isSwap = newDef && !isToggleOff;

                const selText = range.toString();
                const spanText = existingHighlight.textContent || '';
                const isFull = selText === spanText || range.collapsed || selText.length >= spanText.length;

                if (isFull) {
                    if (isSwap) {
                        // Fast path: just update attributes
                        existingHighlight.className = newDef.className;
                        existingHighlight.dataset.mdStart = newDef.start;
                        existingHighlight.dataset.mdEnd = newDef.end;
                    } else {
                        // Remove/Toggle: Unwrap
                        const docFrag = document.createDocumentFragment();
                        while (existingHighlight.firstChild) {
                            docFrag.appendChild(existingHighlight.firstChild);
                        }
                        existingHighlight.parentNode?.replaceChild(docFrag, existingHighlight);
                    }
                } else {
                    // Partial Split
                    const beforeRange = document.createRange();
                    beforeRange.setStart(existingHighlight, 0);
                    beforeRange.setEnd(range.startContainer, range.startOffset);

                    const afterRange = document.createRange();
                    afterRange.setStart(range.endContainer, range.endOffset);
                    afterRange.setEnd(existingHighlight, existingHighlight.childNodes.length);

                    const beforeContent = beforeRange.cloneContents();
                    const selectedContent = range.cloneContents();
                    const afterContent = afterRange.cloneContents();

                    const frag = document.createDocumentFragment();

                    // 1. Before Part (Keep Old Color)
                    if (beforeContent.textContent) {
                        const s = document.createElement('span');
                        s.className = existingHighlight.className;
                        s.dataset.mdStart = existingHighlight.dataset.mdStart;
                        s.dataset.mdEnd = existingHighlight.dataset.mdEnd;
                        s.appendChild(beforeContent);
                        frag.appendChild(s);
                    }

                    // 2. Middle Part (New Color or Bare)
                    if (isSwap) {
                        const s = document.createElement('span');
                        s.className = newDef.className;
                        s.dataset.mdStart = newDef.start;
                        s.dataset.mdEnd = newDef.end;
                        s.appendChild(selectedContent);
                        frag.appendChild(s);
                    } else {
                        frag.appendChild(selectedContent);
                    }

                    // 3. After Part (Keep Old Color)
                    if (afterContent.textContent) {
                        const s = document.createElement('span');
                        s.className = existingHighlight.className;
                        s.dataset.mdStart = existingHighlight.dataset.mdStart;
                        s.dataset.mdEnd = existingHighlight.dataset.mdEnd;
                        s.appendChild(afterContent);
                        frag.appendChild(s);
                    }

                    existingHighlight.parentNode?.replaceChild(frag, existingHighlight);
                }
                emitMarkdown();
                return;
            }

            // If we are removing (val is undefined) but didn't find a common ancestor highlight
            if (!val) {
                // Try to remove nested highlights in the selection
                try {
                    const content = range.extractContents();
                    const spans = content.querySelectorAll('span');
                    let modified = false;
                    spans.forEach(s => {
                        const el = s as HTMLElement;
                        if (el.dataset.mdStart && el.dataset.mdStart.startsWith('<h=')) {
                            while (el.firstChild) el.parentNode?.insertBefore(el.firstChild, el);
                            el.parentNode?.removeChild(el);
                            modified = true;
                        }
                    });
                    range.insertNode(content);
                    if (modified) emitMarkdown();
                } catch (e) {
                    console.error("Remove highlight failed", e);
                }
                return;
            }

            // No existing highlight — wrap selection in new highlight
            if (!newDef) return; // Cannot highlight without a color definition
            if (range.collapsed) return; // Nothing to highlight

            const span = document.createElement('span');
            span.className = newDef.className;
            span.dataset.mdStart = newDef.start;
            span.dataset.mdEnd = newDef.end;

            try {
                const content = range.extractContents();

                // Cleanup nested highlights to enforce override (for mixed selections)
                const existingSpans = content.querySelectorAll('span');
                existingSpans.forEach(s => {
                    const el = s as HTMLElement;
                    if (el.dataset.mdStart && el.dataset.mdStart.startsWith('<h=')) {
                        while (el.firstChild) el.parentNode?.insertBefore(el.firstChild, el);
                        el.parentNode?.removeChild(el);
                    }
                });

                span.appendChild(content);
                range.insertNode(span);

                selection.removeAllRanges();
                const newRange = document.createRange();
                newRange.selectNodeContents(span);
                selection.addRange(newRange);

                emitMarkdown();
            } catch (e) {
                console.error("Highlight failed", e);
            }
            return;
        }

        // ── NON-HIGHLIGHT FORMATTING ─────────────────────────────────────
        const def = TAGS[type];
        if (!def) return;

        // Check if the selection is entirely within an existing format span of the same type
        const ancestor = range.commonAncestorContainer;
        let formatParent: HTMLElement | null = null;
        let node: Node | null = ancestor;

        while (node && node !== contentEditableRef.current) {
            if (node.nodeType === Node.ELEMENT_NODE) {
                const el = node as HTMLElement;
                if (el.dataset.mdStart === def.start && el.dataset.mdEnd === def.end) {
                    formatParent = el;
                    break;
                }
            }
            node = node.parentNode;
        }

        if (formatParent) {
            // Toggle OFF: unwrap the formatting span
            const selText = range.toString();
            const spanText = formatParent.textContent || '';

            if (selText === spanText || range.collapsed || selText.length >= spanText.length) {
                // Full unwrap
                const docFrag = document.createDocumentFragment();
                while (formatParent.firstChild) {
                    docFrag.appendChild(formatParent.firstChild);
                }
                formatParent.parentNode?.replaceChild(docFrag, formatParent);
            } else {
                // Partial unwrap: split the span around the selection
                const beforeRange = document.createRange();
                beforeRange.setStart(formatParent, 0);
                beforeRange.setEnd(range.startContainer, range.startOffset);

                const afterRange = document.createRange();
                afterRange.setStart(range.endContainer, range.endOffset);
                afterRange.setEnd(formatParent, formatParent.childNodes.length);

                const beforeContent = beforeRange.cloneContents();
                const selectedContent = range.cloneContents();
                const afterContent = afterRange.cloneContents();

                const frag = document.createDocumentFragment();

                if (beforeContent.textContent) {
                    const beforeSpan = document.createElement('span');
                    beforeSpan.className = def.className;
                    beforeSpan.dataset.mdStart = def.start;
                    beforeSpan.dataset.mdEnd = def.end;
                    beforeSpan.appendChild(beforeContent);
                    frag.appendChild(beforeSpan);
                }

                frag.appendChild(selectedContent);

                if (afterContent.textContent) {
                    const afterSpan = document.createElement('span');
                    afterSpan.className = def.className;
                    afterSpan.dataset.mdStart = def.start;
                    afterSpan.dataset.mdEnd = def.end;
                    afterSpan.appendChild(afterContent);
                    frag.appendChild(afterSpan);
                }

                formatParent.parentNode?.replaceChild(frag, formatParent);
            }

            emitMarkdown();
            return;
        }

        // Apply Formatting (wrap)
        if (range.collapsed) return; // Nothing to format

        const span = document.createElement('span');
        span.className = def.className;
        span.dataset.mdStart = def.start;
        span.dataset.mdEnd = def.end;

        try {
            const content = range.extractContents();
            span.appendChild(content);
            range.insertNode(span);

            // Keep the text selected after formatting
            selection.removeAllRanges();
            const newRange = document.createRange();
            newRange.selectNodeContents(span);
            selection.addRange(newRange);

            emitMarkdown();
        } catch (e) {
            console.error("Formatting failed", e);
        }
    };

    useImperativeHandle(ref, () => ({
        focus: (opts?: { position?: 'end' | 'first-gap' }) => {
            if (contentEditableRef.current) {
                contentEditableRef.current.focus();

                const selection = window.getSelection();
                if (!selection) return;

                if (opts?.position === 'first-gap') {
                    const walker = document.createTreeWalker(contentEditableRef.current, NodeFilter.SHOW_TEXT, null);
                    let gapNode: Node | null = null;
                    while (walker.nextNode()) {
                        if (walker.currentNode.textContent?.includes('\u200B')) {
                            gapNode = walker.currentNode;
                            break;
                        }
                    }

                    if (gapNode) {
                        const range = document.createRange();
                        range.setStart(gapNode, gapNode.textContent!.indexOf('\u200B') + 1);
                        range.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(range);
                        return;
                    }
                }

                // Move cursor to end of content
                const range = document.createRange();
                range.selectNodeContents(contentEditableRef.current);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        },
        applyFormat,
        getContainer: () => contentEditableRef.current
    }));

    const handleKeyDownInternal = (e: React.KeyboardEvent) => {
        const selection = window.getSelection();

        // Auto-list on '* ' or '- ' (WYSIWYG)
        if (e.key === ' ' && selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            const node = range.startContainer;

            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent || '';
                const offset = range.startOffset;

                // Check if we are typing space after '*' or '-'
                if (offset > 0) {
                    const char = text.charAt(offset - 1);
                    if (char === '*' || char === '-') {
                        // Check if it's the start of the line (ignoring whitespace)
                        const prefix = text.substring(0, offset - 1);
                        if (/^\s*$/.test(prefix)) {
                            // Valid list trigger
                            e.preventDefault();

                            // 1. Remove the marker characters (* or -) using execCommand to preserve history
                            const removeRange = document.createRange();
                            removeRange.setStart(node, offset - 1);
                            removeRange.setEnd(node, offset);
                            selection.removeAllRanges();
                            selection.addRange(removeRange);
                            document.execCommand('delete');

                            // 2. Ensure we are in a separate block (splits <br> lines if necessary)
                            // This prevents "absorbing" the previous line into the bullet
                            document.execCommand('formatBlock', false, 'div');

                            // 3. Convert to list
                            document.execCommand('insertUnorderedList');

                            handleInput();
                            return;
                        }
                    }
                }
            }
        }

        // Handle Backspace in empty list item
        if (e.key === 'Backspace' && selection && selection.rangeCount > 0) {
            // Find LI
            let current = selection.getRangeAt(0).commonAncestorContainer;
            let foundLi: HTMLElement | null = null;

            // Walk up
            while (current && current !== contentEditableRef.current) {
                if (current.nodeName === 'LI') {
                    foundLi = current as HTMLElement;
                    break;
                }
                current = current.parentElement!;
            }

            if (foundLi) {
                // Check if empty
                const text = foundLi.textContent || '';
                // If text is effectively empty (just whitespace or nothing), exit list
                if (text.trim().length === 0) {
                    e.preventDefault();
                    document.execCommand('outdent'); // Turn LI into normal block (Div/P)
                    handleInput();
                    return;
                }
            }
        }

        // Handle <p> trigger
        // "typing <p> within a bulleted list exits the list mode for that line"
        if (e.key === '>' && selection && selection.rangeCount > 0) {
            // Check previous chars
            const range = selection.getRangeAt(0);
            const startOffset = range.startOffset;
            if (startOffset >= 2 && range.startContainer.textContent) {
                const textBefore = range.startContainer.textContent.substring(startOffset - 2, startOffset);
                if (textBefore === '<p') {
                    // Trigger found!
                    e.preventDefault();

                    // 1. Select the '<p' to remove it properly via execCommand
                    const removeRange = document.createRange();
                    removeRange.setStart(range.startContainer, startOffset - 2);
                    removeRange.setEnd(range.startContainer, startOffset);
                    selection.removeAllRanges();
                    selection.addRange(removeRange);
                    document.execCommand('delete');

                    // 2. Exit list mode
                    // 'outdent' converts <li> to a block element at the same level
                    document.execCommand('outdent');

                    handleInput();
                    return;
                }
            }
        }

        // Handle Tab for Slabs
        if (e.key === 'Tab' && selection && selection.isCollapsed) {
            const range = selection.getRangeAt(0);

            let nextNode: Node | null = null;
            if (range.startContainer.nodeType === Node.TEXT_NODE) {
                if (range.startOffset === range.startContainer.textContent?.length) {
                    nextNode = range.startContainer.nextSibling;
                }
            } else {
                nextNode = range.startContainer.childNodes[range.startOffset];
            }

            if (nextNode && nextNode.nodeType === Node.ELEMENT_NODE) {
                const el = nextNode as HTMLElement;
                if (el.dataset?.mdStart === '[[') {
                    // Cursor is strictly before a slab.
                    let afterSlab = el.nextSibling;
                    if (afterSlab) {
                        e.preventDefault();
                        const newRange = document.createRange();
                        // If there is text, select the text node to keep the cursor in a valid editing state
                        if (afterSlab.nodeType === Node.TEXT_NODE) {
                            newRange.setStart(afterSlab, 0);
                        } else {
                            if (afterSlab.nodeName === 'BR') {
                                newRange.setStartBefore(afterSlab);
                            } else {
                                // For spans or other nodes, safest is often startBefore or inserting a zero-width space
                                newRange.setStartBefore(afterSlab);
                            }
                        }
                        newRange.collapse(true);
                        selection.removeAllRanges();
                        selection.addRange(newRange);
                        return;
                    }
                }
            }
        }

        // Keyboard Shortcuts (Ctrl/Cmd)
        const modKeyPressed = isMac ? e.metaKey : e.ctrlKey;
        if (modKeyPressed && !e.shiftKey && !e.altKey) {
            const key = e.key.toLowerCase();
            if (key === 'b') {
                e.preventDefault();
                applyFormat('bold');
            } else if (key === 'i') {
                e.preventDefault();
                applyFormat('italic');
            } else if (key === 'u') {
                e.preventDefault();
                applyFormat('underline');
            } else if (key === '`') { // Code shortcut
                e.preventDefault();
                applyFormat('code');
            }
        }

        if (onKeyDown) onKeyDown(e);
    };

    return (
        <div
            ref={contentEditableRef}
            contentEditable={!disabled}
            className={clsx("outline-none whitespace-pre-wrap [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5", className, disabled && "opacity-50 pointer-events-none")}
            onInput={handleInput}
            onBlur={() => {
                // On blur, force a sync so the user sees formatted content
                if (syncTimeoutRef.current) {
                    clearTimeout(syncTimeoutRef.current);
                    syncTimeoutRef.current = null;
                }
                isTyping.current = false;
                forceSync();
                if (onBlur) onBlur();
            }}
            onFocus={onFocus}
            onKeyDown={handleKeyDownInternal}
            onKeyUp={onKeyUp}
            onMouseUp={onMouseUp}
            onContextMenu={onContextMenu}
            data-placeholder={placeholder}
            suppressContentEditableWarning // React complains otherwise
        />
    );
});

RichInput.displayName = "RichInput";
