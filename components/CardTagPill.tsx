import React from 'react';

interface CardTagPillProps {
  label: string;
  className?: string;
}

export const CardTagPill: React.FC<CardTagPillProps> = ({ label, className }) => {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-outline bg-panel-2 text-[10px] font-bold uppercase tracking-wider text-text ${className || ''}`}
    >
      {label}
    </span>
  );
};
