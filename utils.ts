import React from 'react';
import { Card, CardSet, CustomFieldDefinition } from './types';

// --- IMAGE URL SECURITY ---

/**
 * Validates an image URL for security.
 * - Allows data: URIs (for locally uploaded images)
 * - Allows https: URLs only for remote images
 * - Blocks javascript:, file:, and other potentially dangerous protocols
 * - Blocks http: URLs (insecure, mixed content)
 * 
 * @param url - The URL to validate
 * @returns true if the URL is safe to use, false otherwise
 */
export const isValidImageUrl = (url: string | undefined | null): boolean => {
  if (!url || typeof url !== 'string') return false;

  const trimmed = url.trim();
  if (!trimmed) return false;

  // Allow data: URIs (base64 encoded images from file uploads)
  if (trimmed.startsWith('data:image/')) {
    // Block SVG data URIs as they can contain scripts
    if (trimmed.startsWith('data:image/svg')) {
      return false;
    }
    return true;
  }

  // Only allow https: for remote URLs
  if (trimmed.startsWith('https://')) {
    return true;
  }

  // Block everything else (http:, javascript:, file:, etc.)
  return false;
};

/**
 * Sanitizes an image URL, returning empty string if invalid.
 * Use this before rendering any user-provided image URLs.
 */
export const sanitizeImageUrl = (url: string | undefined | null): string => {
  if (isValidImageUrl(url)) {
    return url!.trim();
  }
  return '';
};

/**
 * Validates a file type for image upload security.
 * Blocks SVG files (can contain scripts) and other non-image types.
 * 
 * @param file - The File object to validate
 * @returns true if the file type is safe, false otherwise
 */
export const isValidImageFile = (file: File): boolean => {
  const safeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/avif',
    'image/bmp'
  ];

  // Block SVG explicitly (can contain scripts)
  if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
    return false;
  }

  return safeTypes.includes(file.type.toLowerCase());
};

// Sanitize a set by removing zombie custom field data from cards
// This ensures cards only contain data for fields that are actually defined
export const sanitizeSet = (set: CardSet): CardSet => {
  // Get the list of valid field names from the set's definitions
  const validFieldNames = new Set<string>();

  if (set.version && set.version >= 2) {
    // V2 schema: use termSideFields and defSideFields
    set.termSideFields?.forEach(f => {
      const name = typeof f === 'string' ? f : f.name;
      if (name) validFieldNames.add(name);
    });
    set.defSideFields?.forEach(f => {
      const name = typeof f === 'string' ? f : f.name;
      if (name) validFieldNames.add(name);
    });
  } else if (set.customFieldNames) {
    // V1 schema: use customFieldNames
    set.customFieldNames.forEach(name => validFieldNames.add(name));
  }
  // If no field definitions exist at all, validFieldNames is empty
  // This means ALL custom field data on cards is zombie data

  // Sanitize each card's customFields
  const sanitizedCards = set.cards.map(card => {
    if (!card.customFields || card.customFields.length === 0) {
      return card;
    }

    // If there are no valid definitions, remove all custom fields
    if (validFieldNames.size === 0) {
      const { customFields, ...rest } = card;
      return rest as Card;
    }

    // Filter to only valid fields
    const filteredFields = card.customFields.filter(f => validFieldNames.has(f.name));

    if (filteredFields.length === card.customFields.length) {
      return card; // No changes needed
    }

    if (filteredFields.length === 0) {
      const { customFields, ...rest } = card;
      return rest as Card;
    }

    return { ...card, customFields: filteredFields };
  });

  // Only create a new object if changes were made
  const hasChanges = sanitizedCards.some((c, i) => c !== set.cards[i]);
  return hasChanges ? { ...set, cards: sanitizedCards } : set;
};

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
export const checkAnswer = (
  inputTerm: string,
  inputYear: string,
  inputCustom: Record<string, string>,
  card: Card,
  strict: boolean = false,
  customFieldDefs?: CustomFieldDefinition[]
) => {
  const strip = (s: string) => {
    // Strip markdown: **, *, __, `, <h=...>
    let clean = s
      .replace(/<h=[^>]+>/g, '')
      .replace(/<\/h>/g, '')
      .replace(/\*\*\*/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/__/g, '')
      .replace(/`/g, '')
      .replace(/<u>/g, '')
      .replace(/<\/u>/g, '');
    // Normalize and remove diacritics
    clean = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    return clean.toLowerCase().replace(/^(the|la|el)\s+/i, '').trim();
  };

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
    isYearMatch = strip(inputYear) === strip(card.year);
  }

  // 3. Check Custom Fields (Only fields present in definitions, if provided)
  let isCustomMatch = true;
  const customResults: Record<string, boolean> = {};

  if (card.customFields) {
    for (const field of card.customFields) {
      // If definitions provided, skip if this field isn't in them
      if (customFieldDefs && !customFieldDefs.some(d => d.name === field.name)) {
        continue;
      }

      const input = inputCustom[field.name] || '';
      const match = strip(input) === strip(field.value);
      customResults[field.name] = match;
      if (!match) isCustomMatch = false;
    }

    // Also check for missing required fields (in definitions) that user didn't input?
    // Actually, if we loop card.customFields, we check fields that HAVE VALUES on the card.
    // That's usually correct. 
    // BUT: If a field is defined but has NO value on card? Then we shouldn't check it?
    // Current logic: loops card.customFields. 
    // This is correct: we only check fields that exist on the card AND are enabled in definitions.
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

// Check definition answer logic (for "Answer with Definition" mode)
export const checkDefinitionAnswer = (
  inputDefinition: string,
  inputYear: string,
  inputCustom: Record<string, string>,
  card: Card,
  strict: boolean = false,
  customFieldDefs?: CustomFieldDefinition[]
) => {
  const strip = (s: string) => {
    // Strip markdown: **, *, __, `, <h=...>
    let clean = s
      .replace(/<h=[^>]+>/g, '')
      .replace(/<\/h>/g, '')
      .replace(/\*\*\*/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/__/g, '')
      .replace(/`/g, '')
      .replace(/<u>/g, '')
      .replace(/<\/u>/g, '')
      .replace(/<p>/gi, ' ')
      .replace(/- /g, ' ');
    // Normalize and remove diacritics
    clean = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    return clean.toLowerCase().replace(/^(the|la|el)\s+/i, '').trim();
  };

  // 1. Check Definition (content)
  const strippedInput = strip(inputDefinition);
  const strippedContent = strip(card.content);

  const def_dist = distance(strippedInput, strippedContent);

  // For definitions, we use a proportional threshold since they can be longer
  // Strict: distance must be 0. Loose: distance <= max(2, 5% of content length)
  const threshold = strict ? 0 : Math.max(2, Math.floor(strippedContent.length * 0.05));
  const isDefinitionMatch = def_dist <= threshold;

  // 2. Check Year (if applicable)
  let isYearMatch = true;
  if (card.year) {
    isYearMatch = strip(inputYear) === strip(card.year);
  }

  // 3. Check Custom Fields
  let isCustomMatch = true;
  const customResults: Record<string, boolean> = {};

  if (card.customFields) {
    for (const field of card.customFields) {
      // If definitions provided, skip if this field isn't in them
      if (customFieldDefs && !customFieldDefs.some(d => d.name === field.name)) {
        continue;
      }

      const input = inputCustom[field.name] || '';
      const match = strip(input) === strip(field.value);
      customResults[field.name] = match;
      if (!match) isCustomMatch = false;
    }
  }

  return {
    isMatch: isDefinitionMatch && isYearMatch && isCustomMatch,
    isDefinitionMatch,
    isYearMatch,
    isCustomMatch,
    customResults,
    bestDist: def_dist
  };
};

// Find mixups - detect when user's wrong answer matches content from a different card
export interface MixupItem {
  field: 'term' | 'definition' | 'year' | string;
  fieldType: 'text' | 'number';
  inputValue: string;
  matchedCardTerm: string;
  matchedCard: Card;
}

export const findMixup = (
  inputTerm: string,
  inputYear: string,
  inputCustom: Record<string, string>,
  currentCard: Card,
  allCards: Card[],
  answerWithDefinition: boolean,
  customFieldDefs?: CustomFieldDefinition[]
): MixupItem[] => {
  const strip = (s: string) => {
    let clean = s
      .replace(/<h=[^>]+>/g, '')
      .replace(/<\/h>/g, '')
      .replace(/\*\*\*/g, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/__/g, '')
      .replace(/`/g, '')
      .replace(/<u>/g, '')
      .replace(/<\/u>/g, '')
      .replace(/<p>/gi, ' ')
      .replace(/- /g, ' ');
    clean = clean.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return clean.toLowerCase().replace(/^(the|la|el)\s+/i, '').trim();
  };

  const mixups: MixupItem[] = [];
  const strippedInput = strip(inputTerm);
  const strippedYear = strip(inputYear);

  // Helper to get display term for a card
  const getDisplayTerm = (card: Card) => card.term[0] || 'Unknown';

  // Check other cards for matches
  for (const otherCard of allCards) {
    if (otherCard.id === currentCard.id) continue;

    const otherDisplayTerm = getDisplayTerm(otherCard);

    // Check main answer field (term or definition depending on mode)
    if (strippedInput) {
      if (answerWithDefinition) {
        // User is answering with definition - check if input matches other card's definition
        const otherDefStripped = strip(otherCard.content);
        // Only flag if current card's definition doesn't have the same value
        if (strip(currentCard.content) !== otherDefStripped && strippedInput === otherDefStripped) {
          mixups.push({
            field: 'definition',
            fieldType: 'text',
            inputValue: otherCard.content.length > 50 ? otherCard.content.substring(0, 50) + '...' : otherCard.content,
            matchedCardTerm: otherDisplayTerm,
            matchedCard: otherCard
          });
        }
      } else {
        // User is answering with term - check if input matches other card's term
        for (const otherTerm of otherCard.term) {
          const otherTermStripped = strip(otherTerm);
          // Only flag if current card's terms don't include this value
          const currentTermsStripped = currentCard.term.map(t => strip(t));
          if (!currentTermsStripped.includes(otherTermStripped) && strippedInput === otherTermStripped) {
            mixups.push({
              field: 'term',
              fieldType: 'text',
              inputValue: otherTerm,
              matchedCardTerm: otherDisplayTerm,
              matchedCard: otherCard
            });
            break; // Only need one match per card
          }
        }
      }
    }

    // Check year
    if (strippedYear && otherCard.year) {
      const otherYearStripped = strip(otherCard.year);
      // Only flag if current card's year is different or doesn't have a year
      const currentYearStripped = currentCard.year ? strip(currentCard.year) : '';
      if (currentYearStripped !== otherYearStripped && strippedYear === otherYearStripped) {
        mixups.push({
          field: 'year',
          fieldType: 'number',
          inputValue: otherCard.year,
          matchedCardTerm: otherDisplayTerm,
          matchedCard: otherCard
        });
      }
    }

    // Check custom fields
    for (const [fieldName, inputValue] of Object.entries(inputCustom)) {
      if (!inputValue) continue;
      const strippedCustomInput = strip(inputValue);

      const otherField = otherCard.customFields?.find(f => f.name === fieldName);
      if (!otherField) continue;

      const otherValueStripped = strip(otherField.value);
      const currentField = currentCard.customFields?.find(f => f.name === fieldName);
      const currentValueStripped = currentField ? strip(currentField.value) : '';

      // Only flag if current card's field value is different
      if (currentValueStripped !== otherValueStripped && strippedCustomInput === otherValueStripped) {
        // Determine field type
        const fieldDef = customFieldDefs?.find(d => d.name === fieldName);
        const fieldType: 'text' | 'number' = fieldDef?.type === 'number' ? 'number' : 'text';

        mixups.push({
          field: fieldName,
          fieldType,
          inputValue: otherField.value,
          matchedCardTerm: otherDisplayTerm,
          matchedCard: otherCard
        });
      }
    }
  }

  return mixups;
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

      tags: Array.isArray(c.tags) ? c.tags : [],
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

      // 1.5 Extract Tags (%%TAGS%%)
      // Format: ... %%TAGS%%tag1%%tag2
      let tags: string[] = [];
      const tagSplit = contentPart.split('%%TAGS%%');
      if (tagSplit.length > 1) {
        contentPart = tagSplit[0].trim();
        const tagString = tagSplit[1];
        // Split by %%
        tags = tagString.split('%%').map(t => t.trim()).filter(Boolean);
      }

      // 1.6 Extract Star (%%STAR%%)
      let isStarred = false;
      if (contentPart.includes('%%STAR%%')) {
        isStarred = true;
        contentPart = contentPart.replace('%%STAR%%', '').trim();
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

      // 1.5 Extract Tags from Term (e.g. "(Tag) Term")
      // We look for leading (Tag) patterns in the termRaw
      const tagRegex = /^(\s*\([^)]+\)\s*)+/;
      const tagMatch = termRaw.match(tagRegex);

      if (tagMatch) {
        const fullTagString = tagMatch[0];
        // Extract individual tags: (Tag1) (Tag2)
        const extractedTags = fullTagString.match(/\(([^)]+)\)/g)?.map(t => t.slice(1, -1).trim()) || [];
        tags = [...tags, ...extractedTags];

        // Remove tags from term
        termRaw = termRaw.replace(tagRegex, '').trim();
      }

      if (!termRaw && !defRaw) return null;

      return {
        term: [termRaw],
        content: defRaw,
        year: yearPart,
        image: imagePart,
        tags: tags.length > 0 ? tags : undefined,
        customFields: customFields.length > 0 ? customFields : undefined,
        mastery: 0,
        star: isStarred
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

export const renderInline = (text: string, keyPrefix: string, isHighlighted: boolean = false): React.ReactNode[] => {
  // 1. Code: `text`
  // 1. Highlight: <h=c>text</h>
  // 2. Code: `text`
  // 3. BoldItalic: ***text***
  // 4. Bold: **text**
  // 5. Italic: *text* or _text_
  // 6. Underline: __text__ or <u>text</u>

  const parts = text.split(/(<h=[^>]+>.*?<\/h>)|(`[^`]+`)|(\*\*\*[^*]+\*\*\*)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|(__[^_]+__)|(<u>[^<]+<\/u>)/g).filter(p => p !== undefined && p !== '');

  return parts.map((part, idx) => {
    const key = `${keyPrefix}-${idx}`;

    // Highlight
    if (part.startsWith('<h=')) {
      const match = part.match(/<h=([^>]+)>(.*?)<\/h>/);
      if (match) {
        const colorCode = match[1].toLowerCase();
        const content = match[2];

        let bgClass = "bg-yellow/20 text-yellow";
        if (colorCode === 'r') bgClass = "bg-red/20 text-red";
        if (colorCode === 'b') bgClass = "bg-blue/20 text-blue";
        if (colorCode === 'g') bgClass = "bg-green/20 text-green";
        if (colorCode === 'p') bgClass = "bg-purple/20 text-purple";
        if (colorCode === 'y') bgClass = "bg-yellow/20 text-yellow";

        // Recursively render content inside highlight, passing isHighlighted=true
        return React.createElement('span', { key, className: `${bgClass} px-1 rounded font-medium` }, renderInline(content, `${key}-inner`, true));
      }
    }

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
      // If highlighted, use text-current (inherit color from highlight). Otherwise use text-accent.
      const className = `font-extrabold ${isHighlighted ? 'text-current' : 'text-accent'}`;
      return React.createElement('strong', { key, className }, part.slice(2, -2));
    }
    // Italic
    if (part.startsWith('*') && part.endsWith('*')) {
      return React.createElement('em', { key, className: "italic text-muted/90" }, part.slice(1, -1));
    }
    // Underline
    if ((part.startsWith('__') && part.endsWith('__')) || (part.startsWith('<u>') && part.endsWith('</u>'))) {
      const content = part.startsWith('__') ? part.slice(2, -2) : part.slice(3, -4);
      return React.createElement('u', { key, className: "underline decoration-accent underline-offset-4" }, content);
    }

    return React.createElement('span', { key }, part);
  });
};

// Helper to extract category (Tag) from content
export const extractCategory = (content: string): { category: string | null; body: string } => {
  const catMatch = content.match(/^\((.*?)\)\s*(.*)/s);
  if (catMatch) {
    return { category: catMatch[1], body: catMatch[2] };
  }
  return { category: null, body: content };
};

export const renderMarkdown = (content: string): React.ReactNode => {
  if (!content) return React.createElement('div', { className: "text-muted italic opacity-50" }, "No content");

  // 1. Extract Category
  const { category, body } = extractCategory(content);

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
      React.createElement('div', { key: "cat", className: "inline-block bg-accent/10 border border-accent/20 text-accent px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide mb-2" }, category)
    );
  }
  children.push(React.createElement('div', { key: "body" }, renderedBlocks));

  return React.createElement(React.Fragment, {}, children);
};