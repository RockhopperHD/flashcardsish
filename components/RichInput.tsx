import React, { useRef, useEffect, useImperativeHandle, forwardRef } from 'react';
import clsx from 'clsx';

interface RichInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    onBlur?: () => void;
    onFocus?: () => void;
    onKeyDown?: (e: React.KeyboardEvent) => void;
    onMouseUp?: (e: React.MouseEvent) => void;
}

export interface RichInputRef {
    applyFormat: (type: string, value?: string) => void;
    focus: () => void;
}

// Map styles to markdown tags
const TAGS: Record<string, { start: string; end: string; className: string; tag?: string }> = {
    bold: { start: '**', end: '**', className: 'font-bold text-accent' },
    italic: { start: '*', end: '*', className: 'italic text-accent' },
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

// MARKDOWN TO HTML (Simple Regex Parser that supports nesting)
const markdownToHtml = (text: string): string => {
    if (!text) return '';

    // We need to parse recursively to build the HTML tree string
    let remaining = text;
    let html = '';

    while (remaining.length > 0) {
        // Regex search
        const tokenRegex = /(<h=[rbgpy]>)|(<\/h>)|(`)|(\*\*\*)|(\*\*)|(\*)|(__)|(<u>)|(<\/u>)/;
        const match = remaining.match(tokenRegex);

        if (!match) {
            html += remaining; // Escape HTML? Ideally yes.
            break;
        }

        const idx = match.index!;
        const token = match[0];

        if (idx > 0) {
            html += remaining.substring(0, idx);
        }

        const rest = remaining.substring(idx + token.length);

        if (token.startsWith('<h=')) {
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
                const innerHtml = markdownToHtml(innerMd);
                html += `<span data-md-start="${def.start}" data-md-end="${def.end}" class="${def.className}">${innerHtml}</span>`;
                remaining = rest.substring(endIdx + 4); // skip </h>
            } else {
                html += token; // Unmatched
                remaining = rest;
            }
        } else if (token === '**') {
            // Bold
            const end = rest.indexOf('**');
            if (end !== -1) {
                html += `<span data-md-start="**" data-md-end="**" class="${TAGS.bold.className}">${markdownToHtml(rest.substring(0, end))}</span>`;
                remaining = rest.substring(end + 2);
            } else { html += token; remaining = rest; }
        } else if (token === '*') {
            // Italic
            const end = rest.indexOf('*');
            if (end !== -1) {
                html += `<span data-md-start="*" data-md-end="*" class="${TAGS.italic.className}">${markdownToHtml(rest.substring(0, end))}</span>`;
                remaining = rest.substring(end + 1);
            } else { html += token; remaining = rest; }
        } else if (token === '__') {
            const end = rest.indexOf('__');
            if (end !== -1) {
                html += `<span data-md-start="__" data-md-end="__" class="${TAGS.underline.className}">${markdownToHtml(rest.substring(0, end))}</span>`;
                remaining = rest.substring(end + 2);
            } else { html += token; remaining = rest; }
        } else if (token === '`') {
            const end = rest.indexOf('`');
            if (end !== -1) {
                html += `<span data-md-start="\`" data-md-end="\`" class="${TAGS.code.className}">${rest.substring(0, end)}</span>`; // Code is literal, no recurse
                remaining = rest.substring(end + 1);
            } else { html += token; remaining = rest; }
        } else if (token.startsWith('</')) {
            // Stray closer
            html += token;
            remaining = rest;
        } else {
            // Other tokens (?)
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
    onMouseUp
}, ref) => {
    const contentEditableRef = useRef<HTMLDivElement>(null);
    const isTyping = useRef(false);

    // Sync value to HTML (only when not typing to avoid cursor jumps / loops)
    useEffect(() => {
        if (isTyping.current) return;
        if (contentEditableRef.current && value !== htmlToMarkdown(contentEditableRef.current)) {
            contentEditableRef.current.innerHTML = markdownToHtml(value);
        }
    }, [value]);

    const handleInput = () => {
        if (contentEditableRef.current) {
            isTyping.current = true;
            const md = htmlToMarkdown(contentEditableRef.current);
            onChange(md);
            setTimeout(() => isTyping.current = false, 50);
        }
    };

    useImperativeHandle(ref, () => ({
        focus: () => {
            contentEditableRef.current?.focus();
        },
        applyFormat: (type: string, val?: string) => {
            const selection = window.getSelection();
            if (!selection || !selection.rangeCount) return;

            const range = selection.getRangeAt(0);
            if (!contentEditableRef.current?.contains(range.commonAncestorContainer)) return;

            // Create the wrapper wrapper
            let def: any;
            if (type === 'highlight' && val) {
                def = TAGS[`hl-${val}`];
            } else {
                def = TAGS[type];
            }

            if (!def) return;

            // Custom Span insertion
            const span = document.createElement('span');
            span.className = def.className;
            span.dataset.mdStart = def.start;
            span.dataset.mdEnd = def.end;

            // Surround contents
            try {
                // range.surroundContents fails if range partially selects a non-text node.
                // Safer way: extractContents -> append to span -> insert span
                const content = range.extractContents();
                span.appendChild(content);
                range.insertNode(span);

                // Clean up selection
                selection.removeAllRanges();
                const newRange = document.createRange();
                newRange.selectNodeContents(span);
                selection.addRange(newRange);

                // Trigger Change
                handleInput();
            } catch (e) {
                console.error("Formatting failed", e);
            }
        }
    }));

    return (
        <div
            ref={contentEditableRef}
            contentEditable
            className={clsx("outline-none whitespace-pre-wrap", className)}
            onInput={handleInput}
            onBlur={onBlur}
            onFocus={onFocus}
            onKeyDown={onKeyDown}
            onMouseUp={onMouseUp}
            data-placeholder={placeholder}
            suppressContentEditableWarning // React complains otherwise
        />
    );
});

RichInput.displayName = "RichInput";
