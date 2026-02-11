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
    onContextMenu?: (e: React.MouseEvent) => void;
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
        const tokenRegex = /(<h=[rbgpy]>)|(<\/h>)|(`)|(\*\*\*)|(\*\*)|(\*)|(__)|(<u>)|(<\/u>)/;
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
                const innerHtml = markdownToHtmlInline(innerMd);
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
    onMouseUp,
    onContextMenu
}, ref) => {
    const contentEditableRef = useRef<HTMLDivElement>(null);
    const isTyping = useRef(false);

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

    // Sync value to HTML (only when not typing to avoid cursor jumps / loops)
    useEffect(() => {
        if (isTyping.current) return;
        if (contentEditableRef.current) {
            const currentMd = getMarkdownFromContent();
            if (value !== currentMd) {
                // Preserve cursor
                const caretPos = getCaretIndex(contentEditableRef.current);

                contentEditableRef.current.innerHTML = markdownToHtml(value);

                // Restore cursor if we had focus
                if (document.activeElement === contentEditableRef.current) {
                    setCaretIndex(contentEditableRef.current, caretPos);
                }
            }
        }
    }, [value]);

    const handleInput = () => {
        if (contentEditableRef.current) {
            isTyping.current = true;
            const md = getMarkdownFromContent();
            onChange(md);
            setTimeout(() => isTyping.current = false, 50);
        }
    };

    const applyFormat = (type: string, val?: string) => {
        const selection = window.getSelection();
        if (!selection || !selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        if (!contentEditableRef.current?.contains(range.commonAncestorContainer)) return;

        // Removing Highlight logic
        if (type === 'highlight' && !val) {
            // This is a naive implementation that attempts to unwrap if check passes
            // Currently complex due to DOM nesting, but 'none' was requested as a button.
            // For proper unwrapping we'd need to walk up from current selection.
            // Given constraint, we might skip complex unwrap now or implement simple
            // unwrap if the strict parent is the span.
            const parent = range.commonAncestorContainer.parentElement;
            if (parent && parent.dataset.mdStart && parent.dataset.mdStart.startsWith('<h=')) {
                // Unwrap
                const docFrag = document.createDocumentFragment();
                while (parent.firstChild) {
                    docFrag.appendChild(parent.firstChild);
                }
                parent.parentNode?.replaceChild(docFrag, parent);
                handleInput();
                return;
            }
            return;
        }

        // Apply Formatting
        let def: any;
        if (type === 'highlight' && val) {
            def = TAGS[`hl-${val}`];
        } else {
            def = TAGS[type];
        }

        if (!def) return;

        const span = document.createElement('span');
        span.className = def.className;
        span.dataset.mdStart = def.start;
        span.dataset.mdEnd = def.end;

        try {
            const content = range.extractContents();
            span.appendChild(content);
            range.insertNode(span);

            selection.removeAllRanges();
            const newRange = document.createRange();
            newRange.selectNodeContents(span);
            selection.addRange(newRange);

            handleInput();
        } catch (e) {
            console.error("Formatting failed", e);
        }
    };

    useImperativeHandle(ref, () => ({
        focus: () => {
            if (contentEditableRef.current) {
                contentEditableRef.current.focus();

                // Move cursor to end of content
                const range = document.createRange();
                range.selectNodeContents(contentEditableRef.current);
                range.collapse(false);
                const selection = window.getSelection();
                if (selection) {
                    selection.removeAllRanges();
                    selection.addRange(range);
                }
            }
        },
        applyFormat
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

        // Keyboard Shortcuts
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
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
            contentEditable
            className={clsx("outline-none whitespace-pre-wrap [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5", className)}
            onInput={handleInput}
            onBlur={onBlur}
            onFocus={onFocus}
            onKeyDown={handleKeyDownInternal}
            onMouseUp={onMouseUp}
            onContextMenu={onContextMenu}
            data-placeholder={placeholder}
            suppressContentEditableWarning // React complains otherwise
        />
    );
});

RichInput.displayName = "RichInput";
