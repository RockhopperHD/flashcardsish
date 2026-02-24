import React from 'react';
import clsx from 'clsx';
import { Star } from 'lucide-react';
import { Card, CustomFieldDefinition } from '../types';
import { renderMarkdown, renderInline, sanitizeImageUrl } from '../utils';

interface CardPreviewProps {
  card: Partial<Card>;
  index?: number;
  showIndex?: boolean;
  showStarToggle?: boolean;
  onToggleStar?: () => void;
  showMastery?: boolean;
  className?: string;
  termSideFields?: (string | CustomFieldDefinition)[];
  defSideFields?: (string | CustomFieldDefinition)[];
  termLabel?: string;
  definitionLabel?: string;
}

export const CardPreview: React.FC<CardPreviewProps> = ({
  card,
  index,
  showIndex = false,
  showStarToggle = false,
  onToggleStar,
  showMastery = false,
  className,
  termSideFields = [],
  defSideFields = [],
  termLabel,
  definitionLabel,
}) => {
  const imageUrl = sanitizeImageUrl(card.image);
  const hasTerm = !!card.term?.length && card.term.join(' / ').trim().length > 0;
  const hasContent = !!card.content?.trim();

  // Helper to normalize field names from the mixed array type
  const getFieldNames = (fields: (string | CustomFieldDefinition)[] | undefined): string[] => {
    if (!fields) return [];
    return fields.map(f => typeof f === 'string' ? f : f.name);
  };

  const termFieldNames = getFieldNames(termSideFields);
  const defFieldNames = getFieldNames(defSideFields);

  // Group fields
  const allFields = card.customFields || [];
  const leftFields = allFields.filter(f => termFieldNames.includes(f.name));
  const rightFields = allFields.filter(f => defFieldNames.includes(f.name));

  // If no side config is provided (termFieldNames/defFieldNames empty), 
  // we might want to default everything to right or left, or split?
  // User didn't specify behavior for legacy sets, but SetDetail usually provides them now.
  // Fallback: if both empty, put all remaining fields on the right (definition side) as generic metadata?
  // Or actually, if both empty, we might just put them all on the right to simulate "Content" + "Metadata".
  const orphanFields = allFields.filter(f => !termFieldNames.includes(f.name) && !defFieldNames.includes(f.name));

  // If we have explicit configs, orphans go where? Currently ignoring or adding to right?
  // Let's add orphans to the right side by default if no config, or if they just aren't mapped.
  const effectiveRightFields = [...rightFields, ...orphanFields];

  return (
    <div
      className={clsx(
        "group flex gap-4 p-4 bg-panel border border-outline rounded-xl transition-all",
        className
      )}
    >
      {showIndex && (
        <div className="text-xs font-mono text-muted pt-1 w-8 text-center shrink-0">
          {(index || 0) + 1}
        </div>
      )}

      {imageUrl && (
        <div className="w-16 h-16 shrink-0 rounded-lg overflow-hidden border border-outline bg-panel-2 flex items-center justify-center">
          <img src={imageUrl} alt="Card" className="w-full h-full object-cover" loading="lazy" />
        </div>
      )}

      {/* Main Container - Flex Row with Divider */}
      <div className="flex-1 min-w-0 flex items-stretch gap-4">

        {/* Left Column: Term + Term Fields */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted">
            {termLabel || "Term"}
          </div>
          <div className="text-text text-base leading-relaxed">
            {hasTerm ? <>{renderInline(card.term!.join(' / '))}</> : <span className="text-muted italic">Empty Term</span>}
          </div>

          {card.year && (
            <div className="inline-flex items-center px-2 py-0.5 rounded bg-panel-2 border border-outline text-xs font-mono text-text self-start">
              {card.year}
            </div>
          )}

          {leftFields.length > 0 && (
            <div className="space-y-4 pt-2">
              {leftFields.map((cf, i) => (
                <div key={`term-field-${i}`} className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted">
                    {cf.name}
                  </div>
                  <div className="text-sm text-text">
                    {cf.value ? <>{renderInline(cf.value as string)}</> : <span className="text-muted italic">Empty</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Divider - Full Height */}
        <div className="w-px bg-outline self-stretch" />

        {/* Right Column: Definition + Def Fields + Year */}
        <div className="flex-1 min-w-0 flex flex-col gap-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted">
            {definitionLabel || "Definition"}
          </div>
          <div className="text-base text-text leading-relaxed prose-content">
            {hasContent
              ? renderMarkdown(card.content || '', { compact: true })
              : <span className="text-muted italic">Empty Definition</span>}
          </div>

          {effectiveRightFields.length > 0 && (
            <div className="space-y-4 pt-2">
              {effectiveRightFields.map((cf, i) => (
                <div key={`def-field-${i}`} className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted">
                    {cf.name}
                  </div>
                  <div className="text-sm text-text">
                    {cf.value ? <>{renderInline(cf.value as string)}</> : <span className="text-muted italic">Empty</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {showMastery && typeof card.mastery === 'number' && (
        <div className="pt-0.5 shrink-0">
          {card.mastery >= 2 ? (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-green/10 border border-green/20 rounded-lg">
              <div className="flex flex-col gap-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-green"></div>
              </div>
              <span className="text-[10px] font-bold uppercase text-green">Done</span>
            </div>
          ) : card.mastery === 1 ? (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-panel-2 border border-outline rounded-lg">
              <div className="flex flex-col gap-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-accent"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-outline"></div>
              </div>
              <span className="text-[10px] font-bold uppercase text-text">In Progress</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 px-2 py-1 bg-panel-3 border border-outline rounded-lg">
              <div className="flex flex-col gap-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-outline"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-outline"></div>
              </div>
              <span className="text-[10px] font-bold uppercase text-muted">New</span>
            </div>
          )}
        </div>
      )}

      {showStarToggle && (
        <button
          onClick={onToggleStar}
          className="pt-1 shrink-0 transition-transform hover:scale-110 text-muted hover:text-text"
          title={card.star ? 'Unstar' : 'Star'}
        >
          <Star
            size={18}
            className={card.star ? "text-accent" : "text-muted"}
            fill={card.star ? "currentColor" : "none"}
          />
        </button>
      )}
    </div>
  );
};
