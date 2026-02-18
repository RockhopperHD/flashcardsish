import React from 'react';
import clsx from 'clsx';
import { Tag } from '../types';
import { getTagColor } from '../utils';

interface TagPillProps {
  tag: Tag;
  className?: string;
}

export const TagPill: React.FC<TagPillProps> = ({ tag, className }) => {
  const color = getTagColor(tag.color);
  return (
    <div
      className={clsx(
        "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border transition-colors",
        className
      )}
      style={{
        backgroundColor: `${color}15`,
        borderColor: `${color}30`,
        color: color,
      }}
    >
      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
      {tag.name}
    </div>
  );
};
