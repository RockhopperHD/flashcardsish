import React, { useEffect, useState } from 'react';
import { ArrowLeft, Download, Loader2, AlertCircle } from 'lucide-react';
import { fetchSharedSet, SharedSetSnapshot } from '../src/sharing';
import { CardPreview } from './CardPreview';

interface SharedSetViewProps {
  shareId: string;
  onImport: (snapshot: SharedSetSnapshot) => void;
  onDismiss: () => void;
}

export const SharedSetView: React.FC<SharedSetViewProps> = ({ shareId, onImport, onDismiss }) => {
  const [snapshot, setSnapshot] = useState<SharedSetSnapshot | null>(null);
  const [status, setStatus] = useState<'loading' | 'found' | 'not_found' | 'error'>('loading');

  useEffect(() => {
    fetchSharedSet(shareId)
      .then(data => {
        if (data) {
          setSnapshot(data);
          setStatus('found');
        } else {
          setStatus('not_found');
        }
      })
      .catch(() => setStatus('error'));
  }, [shareId]);

  return (
    <div className="max-w-5xl mx-auto w-full pb-20 animate-in fade-in duration-500">
      <button
        onClick={onDismiss}
        className="mb-8 flex items-center gap-3 text-muted hover:text-text transition-colors font-bold uppercase text-xs tracking-wider group"
      >
        <div className="p-2 rounded-full border border-outline group-hover:bg-panel group-hover:border-accent transition-colors">
          <ArrowLeft size={16} />
        </div>
        Back to App
      </button>

      {status === 'loading' && (
        <div className="flex items-center justify-center py-32 text-muted gap-3">
          <Loader2 size={24} className="animate-spin" />
          <span>Loading shared set…</span>
        </div>
      )}

      {(status === 'not_found' || status === 'error') && (
        <div className="flex flex-col items-center justify-center py-32 gap-4 text-muted">
          <AlertCircle size={40} className="text-red/60" />
          <p className="text-lg font-bold text-text">
            {status === 'not_found' ? 'Link not found or expired' : 'Failed to load shared set'}
          </p>
          <p className="text-sm">
            {status === 'not_found'
              ? 'Shared links expire after 7 days.'
              : 'Something went wrong. Please try again.'}
          </p>
        </div>
      )}

      {status === 'found' && snapshot && (
        <>
          <div className="mb-6">
            <p className="text-xs font-bold text-accent uppercase tracking-widest mb-3">Shared Set</p>
            <h1
              className="text-4xl text-text tracking-tight mb-3"
              style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}
            >
              {snapshot.name}
            </h1>
            <p className="text-muted font-mono">{snapshot.cards.length} cards</p>
          </div>

          <div className="mb-8">
            <button
              onClick={() => onImport(snapshot)}
              className="flex items-center gap-2 px-5 py-3 bg-accent text-bg font-bold rounded-xl hover:bg-accent/90 transition-colors"
            >
              <Download size={18} />
              Add to My Library
            </button>
          </div>

          <div>
            <h2 className="text-xs font-bold text-muted uppercase tracking-widest mb-4 pl-1">
              Cards ({snapshot.cards.length})
            </h2>
            <div className="space-y-3">
              {snapshot.cards.map((card, index) => (
                <CardPreview
                  key={card.id || index}
                  card={card}
                  index={index}
                  showIndex={true}
                  termSideFields={snapshot.termSideFields}
                  defSideFields={snapshot.defSideFields}
                  termLabel={snapshot.termLabel}
                  definitionLabel={snapshot.definitionLabel}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
