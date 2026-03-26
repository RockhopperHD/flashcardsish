import React from 'react';
import clsx from 'clsx';

interface StudyModeOptionCardProps {
  title: string;
  description: string;
  onClick?: () => void;
  disabled?: boolean;
  topLeft?: React.ReactNode;
  topRight?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

export const StudyModeOptionCard: React.FC<StudyModeOptionCardProps> = ({
  title,
  description,
  onClick,
  disabled = false,
  topLeft,
  topRight,
  footer,
  className
}) => {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      className={clsx(
        'group relative bg-panel border-2 rounded-2xl p-8 transition-all text-left',
        disabled
          ? 'border-outline/50 opacity-60 cursor-not-allowed'
          : 'border-outline hover:border-accent hover:scale-[1.02] hover:shadow-xl hover:shadow-accent/10',
        className
      )}
    >
      {topLeft && <div className="absolute top-4 left-4">{topLeft}</div>}
      {topRight && <div className="absolute top-4 right-4">{topRight}</div>}

      <div>
        <h3 className={clsx('text-2xl font-bold mb-2', disabled ? 'text-text/50' : 'text-text')}>{title}</h3>
        <p className={clsx('text-sm leading-relaxed', disabled ? 'text-muted/50' : 'text-muted')}>{description}</p>
      </div>

      {footer && <div className="mt-6 flex flex-wrap gap-2">{footer}</div>}
    </button>
  );
};
