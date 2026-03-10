import React from 'react';

interface CardTagPillProps {
  label: string;
  className?: string;
}

export const CardTagPill: React.FC<CardTagPillProps> = ({ label, className }) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-outline bg-panel-2 text-[11px] leading-none font-bold uppercase tracking-[0.18em] text-text ${className || ''}`}
    >
      {label}
    </span>
  );
};
