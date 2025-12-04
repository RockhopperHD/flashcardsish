import React from 'react';
import { Card } from './types';

// Formatting Helper
export const fmtTime = (ms: number): string => {
  const s = Math.floor(ms / 1000);
  return (
    String(Math.floor(s / 3600)).padStart(2, '0') +
    ':' +
    String(Math.floor((s % 3600) / 60)).padStart(2, '0') +
    ':' +
    String(s % 60).padStart(2, '0')
  );
};

// Levenshtein Distance for Fuzzy Matching
export const distance = (a: string, b: string): number => {
  const _a = a.toLowerCase();
  const _b = b.toLowerCase();
  const dp = new Array(_b.length + 1);
  for (let j = 0; j <= _b.length; j++) dp[j] = j;
  for (let i = 1; i <= _a.length; i++) {
    let prev = i - 1;
    dp[0] = i;
    for (let j = 1; j <= _b.length; j++) {
      const temp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (_a[i - 1] === _b[j - 1] ? 0 : 1));
      prev = temp;
    }
  }
  return dp[_b.length];
};

// Check answer logic
export const checkAnswer = (inputTerm: string, inputYear: string, inputCustom: Record<string, string>, card: Card, strict: boolean = false) => {
  const strip = (s: string) => s.toLowerCase().replace(/^(the|la|el)\s+/i, '').trim();

  // 1. Check Term
  const strippedInput = strip(inputTerm);
  let bestDist = Infinity;
  let bestTerm = '';

  for (const t of card.term) {
    const dist = distance(strippedInput, strip(t));
    if (dist < bestDist) {
      bestDist = dist;
      bestTerm = t;
    }
  }

  // Strict: distance must be 0. Loose: distance <= 2
  const threshold = strict ? 0 : 2;
  const isTermMatch = bestDist <= threshold;

  // 2. Check Year (if applicable)
  let isYearMatch = true;
  if (card.year) {
    isYearMatch = inputYear.trim() === card.year.trim();
  }

  // 3. Check Custom Fields
  let isCustomMatch = true;
  const customResults: Record<string, boolean> = {};

  if (card.customFields) {
    for (const field of card.customFields) {
      const input = inputCustom[field.name] || '';
      const match = input.trim().toLowerCase() === field.value.trim().toLowerCase();
      customResults[field.name] = match;
      if (!match) isCustomMatch = false;
    }
  }

  return {
    isMatch: isTermMatch && isYearMatch && isCustomMatch,
    isTermMatch,
    isYearMatch,
    isCustomMatch,
    customResults,
    bestTerm,
    bestDist
  };
};

// Parsing Logic
export const parseInput = (text: string): Partial<Card>[] => {
  if (!text.trim()) return [];

  // Try JSON first
  try {
    const j = JSON.parse(text);
    // Check if it's a full session export or just cards
    const rawCards = j.cards ? j.cards : (Array.isArray(j) ? (j[0]?.cards ? j[0].cards : j) : [j]);

    return rawCards.map((c: any) => ({
      term: Array.isArray(c.term) ? c.term : [String(c.term || 'Untitled')],
      content: Array.isArray(c.content) ? c.content.join('\n') : String(c.content || ''),
      year: c.year ? String(c.year) : undefined,
      image: c.image ? String(c.image) : undefined,
      mastery: Number(c.mastery || 0),
      star: Boolean(c.star || 0)
    }));
  } catch (e) {
    // Fallback to Raw Separator format
    // Format: Term/Definition///Year ||| ImageURL
    // Separator: &&& on its own line

    const cardsRaw = text.split(/\n\s*&&&\s*\n/);

    return cardsRaw.map(block => {
      const fullText = block.trim();

      // 1. Extract Image and Custom Fields (|||)
      const imgParts = fullText.split('|||');
      let contentPart = imgParts[0].trim();
      let imagePart: string | undefined = undefined;
      let customFields: { name: string; value: string }[] = [];

      if (imgParts.length > 1) {
        // Take the last segment as image/metadata, and join the rest back
        const metaPart = imgParts.pop()?.trim() || '';
        contentPart = imgParts.join('|||').trim();

        // Check for custom fields: "image link , (field)(answer)"
        // We look for the first occurrence of ", (" which signals start of custom fields
        const customFieldSplit = metaPart.indexOf(', (');

        let potentialImage = metaPart;
        let potentialCustom = '';

        if (customFieldSplit !== -1) {
          potentialImage = metaPart.substring(0, customFieldSplit).trim();
          potentialCustom = metaPart.substring(customFieldSplit + 1).trim();
        } else if (metaPart.startsWith('(') && metaPart.includes(')(')) {
          // Case where there is no image, just custom fields? 
          // Or maybe user omitted the comma if no image? 
          // Let's assume strict adherence to "image , (field)" or just "(field)(answer)" if no image?
          // For now, let's support "(field)(answer)" directly if it starts with it and looks like custom fields
          // But user specified "image link , (custom field)..."
          // If no image, maybe "||| , (field)(answer)"?
          // Let's just parse regex on the whole thing if no comma found, but be careful of image URLs with parens.
          // Safe bet: if it matches the pattern at the end.
          potentialImage = metaPart;
        }

        imagePart = potentialImage || undefined;

        // Parse Custom Fields from potentialCustom
        // Regex for (Name)(Value)
        const cfRegex = /\((.*?)\)\((.*?)\)/g;
        let match;
        while ((match = cfRegex.exec(potentialCustom)) !== null) {
          customFields.push({ name: match[1].trim(), value: match[2].trim() });
        }
      }

      // 2. Split year (///) from the remaining content
      const parts = contentPart.split('///');
      const mainPart = parts[0].trim();
      const yearPart = parts[1] ? parts[1].trim() : undefined;

      // 3. Split term/def by first slash
      const slashIndex = mainPart.indexOf('/');
      let termRaw = 'Untitled';
      let defRaw = '';

      if (slashIndex !== -1) {
        termRaw = mainPart.substring(0, slashIndex).trim();
        defRaw = mainPart.substring(slashIndex + 1).trim();
      } else {
        termRaw = mainPart;
      }

      if (!termRaw && !defRaw) return null;

      return {
        term: [termRaw],
        content: defRaw,
        year: yearPart,
        image: imagePart,
        customFields: customFields.length > 0 ? customFields : undefined,
        mastery: 0,
        star: false
      };
    }).filter(Boolean) as Partial<Card>[];
  }
};

export const generateId = () => Math.random().toString(36).substr(2, 9);

export const downloadFile = (filename: string, content: string, type: 'text' | 'json') => {
  const mime = type === 'json' ? 'application/json' : 'text/plain';
  const element = document.createElement('a');
  const file = new Blob([content], { type: mime });
  element.href = URL.createObjectURL(file);
  element.download = filename;
  document.body.appendChild(element);
  element.click();
  document.body.removeChild(element);
};

// --- MARKDOWN RENDERING ---

const renderInline = (text: string, keyPrefix: string): React.ReactNode[] => {
  // 1. Code: `text`
  // 2. BoldItalic: ***text***
  // 3. Bold: **text**
  // 4. Italic: *text*
  // 5. Underline: __text__

  const parts = text.split(/(`[^`]+`)|(\*\*\*[^*]+\*\*\*)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(__[^_]+__)/g).filter(p => p !== undefined && p !== '');

  return parts.map((part, idx) => {
    const key = `${keyPrefix}-${idx}`;

    // Code
    if (part.startsWith('`') && part.endsWith('`')) {
      return React.createElement('code', { key, className: "bg-panel-2 border border-outline px-1.5 py-0.5 rounded text-[0.9em] font-mono text-accent" }, part.slice(1, -1));
    }
    // Bold & Italic
    if (part.startsWith('***') && part.endsWith('***')) {
      return React.createElement('strong', { key, className: "font-bold text-accent italic" }, part.slice(3, -3));
    }
    // Bold
    if (part.startsWith('**') && part.endsWith('**')) {
      return React.createElement('strong', { key, className: "font-bold text-accent" }, part.slice(2, -2));
    }
    // Italic
    if (part.startsWith('*') && part.endsWith('*')) {
      return React.createElement('em', { key, className: "italic text-muted/90" }, part.slice(1, -1));
    }
    // Underline
    if (part.startsWith('__') && part.endsWith('__')) {
      return React.createElement('u', { key, className: "underline decoration-accent underline-offset-4" }, part.slice(2, -2));
    }

    return React.createElement('span', { key }, part);
  });
};

export const renderMarkdown = (content: string): React.ReactNode => {
  if (!content) return React.createElement('div', { className: "text-muted italic opacity-50" }, "No content");

  // 1. Extract Category: (Item) Definition
  let category: string | null = null;
  let body = content;

  const catMatch = content.match(/^\((.*?)\)\s*(.*)/s);
  if (catMatch) {
    category = catMatch[1];
    body = catMatch[2];
  }

  // 2. Split by <p> for block separation (Explicit paragraph break)
  const blocks = body.split(/<p>/i);

  const renderedBlocks = blocks.map((block, blockIdx) => {
    // Check if block contains list items (hyphens)
    // We treat lines starting with "- " as list items
    const lines = block.split('\n');
    const nodes: React.ReactNode[] = [];
    let listBuffer: React.ReactNode[] = [];

    lines.forEach((line, lineIdx) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('-')) {
        // List item
        listBuffer.push(
          React.createElement('li', { key: `li-${lineIdx}`, className: "list-disc marker:text-accent pl-1" },
            renderInline(trimmed.substring(1).trim(), `li-content-${blockIdx}-${lineIdx}`)
          )
        );
      } else {
        // Flush list if exists
        if (listBuffer.length > 0) {
          nodes.push(React.createElement('ul', { key: `ul-${blockIdx}-${lineIdx}`, className: "mb-2 pl-4 space-y-1" }, [...listBuffer]));
          listBuffer = [];
        }
        // Regular text
        if (trimmed) {
          nodes.push(
            React.createElement('div', { key: `txt-${blockIdx}-${lineIdx}`, className: "mb-1" },
              renderInline(trimmed, `txt-${blockIdx}-${lineIdx}`)
            )
          );
        }
      }
    });

    // Flush remaining list
    if (listBuffer.length > 0) {
      nodes.push(React.createElement('ul', { key: `ul-end-${blockIdx}`, className: "mb-2 pl-4 space-y-1" }, [...listBuffer]));
    }

    return React.createElement('div', { key: blockIdx, className: "mb-4 last:mb-0" }, nodes);
  });

  const children: React.ReactNode[] = [];
  if (category) {
    children.push(
      React.createElement('div', { key: "cat", className: "text-xs font-bold uppercase tracking-widest text-accent mb-2 opacity-80" }, category)
    );
  }
  children.push(React.createElement('div', { key: "body" }, renderedBlocks));

  return React.createElement(React.Fragment, {}, children);
};