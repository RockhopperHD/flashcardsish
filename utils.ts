
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
export const checkAnswer = (inputTerm: string, inputYear: string, card: Card, strict: boolean = false) => {
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

  return {
    isMatch: isTermMatch && isYearMatch,
    isTermMatch,
    isYearMatch,
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
    const rawCards = Array.isArray(j) ? (j[0]?.cards ? j[0].cards : j) : (j.cards ? j.cards : [j]);
    return rawCards.map((c: any) => ({
      term: Array.isArray(c.term) ? c.term : [String(c.term || 'Untitled')],
      content: Array.isArray(c.content) ? c.content.join('\n') : String(c.content || ''),
      year: c.year ? String(c.year) : undefined,
      mastery: Number(c.mastery || 0),
      star: Boolean(c.star || 0)
    }));
  } catch (e) {
    // Fallback to Slash format
    // Format: Term/Definition///Year
    // Split by newline to handle lists properly
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    
    return lines.map(line => {
      // Split year first (///)
      const parts = line.split('///');
      const mainPart = parts[0].trim();
      const yearPart = parts[1] ? parts[1].trim() : undefined;
      
      // Split term/def by first slash
      const slashIndex = mainPart.indexOf('/');
      let termRaw = 'Untitled';
      let defRaw = '';
      
      if (slashIndex !== -1) {
        termRaw = mainPart.substring(0, slashIndex).trim();
        defRaw = mainPart.substring(slashIndex + 1).trim();
      } else {
        termRaw = mainPart;
      }
      
      return {
        term: [termRaw],
        content: defRaw,
        year: yearPart,
        mastery: 0,
        star: false
      };
    });
  }
};

export const generateId = () => Math.random().toString(36).substr(2, 9);

export const DEFAULT_SET: any = {
  name: "Demo",
  cards: [
    { term: "Atom", content: "* Smallest unit of matter * Composed of nucleus and electrons", mastery: 0, star: 0 },
    { term: "Photosynthesis", content: "Process plants use to convert light to chemical energy", mastery: 0, star: 0 },
    { term: "Moon Landing", content: "Apollo 11 mission lands Neil Armstrong on the moon", year: "1969", mastery: 0, star: 0 }
  ]
};

// --- MARKDOWN RENDERING ---

const renderInline = (text: string, keyPrefix: string): React.ReactNode[] => {
  // Split by tags: <b>Bold</b>, <i>Italic</i>, __Underline__
  const parts = text.split(/(<b>.*?<\/b>)|(<i>.*?<\/i>)|(__.*?__)/g).filter(p => p !== undefined && p !== '');
  
  return parts.map((part, idx) => {
    const key = `${keyPrefix}-${idx}`;
    
    if (part.startsWith('<b>') && part.endsWith('</b>')) {
      return React.createElement('b', { key, className: "font-bold text-accent" }, part.slice(3, -4));
    }
    if (part.startsWith('__') && part.endsWith('__')) {
      return React.createElement('u', { key, className: "underline decoration-accent underline-offset-4" }, part.slice(2, -2));
    }
    if (part.startsWith('<i>') && part.endsWith('</i>')) {
      return React.createElement('i', { key, className: "italic text-muted/80" }, part.slice(3, -4));
    }
    
    return React.createElement('span', { key }, part);
  });
};

export const renderMarkdown = (content: string): React.ReactNode => {
  // 1. Extract Category: (Item) Definition
  let category: string | null = null;
  let body = content;
  
  const catMatch = content.match(/^\((.*?)\)\s*(.*)/s);
  if (catMatch) {
    category = catMatch[1];
    body = catMatch[2];
  }

  // 2. Split by <p> for blocks
  const blocks = body.split(/<p>/i);

  const renderedBlocks = blocks.map((block, blockIdx) => {
    // Check if block contains bullets (*)
    if (block.includes('*')) {
       const parts = block.split('*');
       const nodes: React.ReactNode[] = [];
       
       // First part is regular text before the first bullet
       if (parts[0].trim()) {
          nodes.push(
            React.createElement('div', { key: `pre-${blockIdx}`, className: "mb-2" },
               renderInline(parts[0].trim(), `pre-${blockIdx}`)
            )
          );
       }

       // Subsequent parts are list items
       if (parts.length > 1) {
          const listItems = parts.slice(1).map((p, i) => 
             p.trim() ? React.createElement('li', { key: i, className: "list-disc marker:text-accent pl-1" },
                renderInline(p.trim(), `li-${blockIdx}-${i}`)
             ) : null
          ).filter(Boolean);

          if (listItems.length > 0) {
            nodes.push(
                React.createElement('ul', { key: `ul-${blockIdx}`, className: "mb-2 pl-4 space-y-1" }, listItems)
            );
          }
       }
       return React.createElement('div', { key: blockIdx, className: "mb-4 last:mb-0" }, nodes);
    } else {
       // Regular block
       return React.createElement('div', { key: blockIdx, className: "mb-4 last:mb-0" }, 
          renderInline(block.trim(), `block-${blockIdx}`)
       );
    }
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
