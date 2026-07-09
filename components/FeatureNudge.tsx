import React from 'react';
import { Sparkles, X } from 'lucide-react';
import { FeatureDiscoveryPrompt } from '../src/featureDiscovery';

interface FeatureNudgeProps {
  prompt: FeatureDiscoveryPrompt | null;
  onAction: () => void;
  onDismiss: () => void;
  className?: string;
}

export const FeatureNudge: React.FC<FeatureNudgeProps> = ({
  prompt,
  onAction,
  onDismiss,
  className = ''
}) => {
  if (!prompt) return null;

  return (
    <div className={`rounded-lg border border-accent/25 bg-accent/10 px-4 py-3 shadow-sm ${className}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md border border-accent/20 bg-accent/10 p-1.5 text-accent">
          <Sparkles size={16} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-text">{prompt.title}</div>
          <div className="mt-0.5 text-xs leading-relaxed text-muted">{prompt.body}</div>
          <button
            type="button"
            onClick={onAction}
            className="mt-2 rounded-md border border-accent/30 bg-panel px-3 py-1.5 text-xs font-bold text-accent transition-colors hover:bg-accent hover:text-bg"
          >
            {prompt.actionLabel}
          </button>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md p-1 text-muted transition-colors hover:bg-panel-2 hover:text-text"
          aria-label="Dismiss feature tip"
          title="Dismiss"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};
