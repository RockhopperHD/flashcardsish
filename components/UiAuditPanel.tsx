import React, { useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, ChevronUp, MessageSquare, LayoutGrid } from 'lucide-react';
import type { UiAuditRequest } from './StartMenu';
import { Tag } from '../types';
import { TagPill } from './TagPill';
import { CardTagPill } from './CardTagPill';

interface UiAuditPanelProps {
  isMenuActive: boolean;
  onOpenSettings: () => void;
  onOpenUser: () => void;
  onOpenPrivacy: () => void;
  onOpenTerms: () => void;
  onOpenKeybinds: () => void;
  onOpenAiSetup: () => void;
  onOpenCorruptionPopup: () => void;
  onRequestMenuModal: (request: UiAuditRequest) => void;
  onShowToast: () => void;
  sampleTag?: Tag | null;
}

export const UiAuditPanel: React.FC<UiAuditPanelProps> = ({
  isMenuActive,
  onOpenSettings,
  onOpenUser,
  onOpenPrivacy,
  onOpenTerms,
  onOpenKeybinds,
  onOpenAiSetup,
  onOpenCorruptionPopup,
  onRequestMenuModal,
  onShowToast,
  sampleTag,
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const tag = sampleTag || { id: 'sample', name: 'Sample Tag', color: 'blue' };

  const menuButtonClass = (enabled: boolean) =>
    clsx(
      "px-2.5 py-2 rounded-lg text-xs font-bold transition-colors border",
      enabled
        ? "bg-panel-2 border-outline text-text hover:border-accent hover:text-accent"
        : "bg-panel-2 border-outline/50 text-muted cursor-not-allowed"
    );

  return (
    <div className="fixed bottom-6 right-6 z-[40] w-[320px]">
      <div className="bg-panel border border-outline rounded-2xl shadow-2xl overflow-hidden">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full px-4 py-3 bg-panel-2 border-b border-outline flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <LayoutGrid size={14} className="text-accent" />
            <span className="text-xs font-bold uppercase tracking-widest text-text">UI Audit</span>
          </div>
          {isOpen ? <ChevronDown size={16} className="text-muted" /> : <ChevronUp size={16} className="text-muted" />}
        </button>

        {isOpen && (
          <div className="p-4 space-y-5 text-sm">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Modals</div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={onOpenSettings} className={menuButtonClass(true)}>Settings</button>
                <button onClick={onOpenUser} className={menuButtonClass(true)}>Account</button>
                <button onClick={onOpenPrivacy} className={menuButtonClass(true)}>Privacy</button>
                <button onClick={onOpenTerms} className={menuButtonClass(true)}>Terms</button>
                <button onClick={onOpenKeybinds} className={menuButtonClass(true)}>Keybinds</button>
                <button onClick={onOpenAiSetup} className={menuButtonClass(true)}>AI Setup</button>
                <button onClick={onOpenCorruptionPopup} className={menuButtonClass(true)}>Recovery Popup</button>
                <button
                  onClick={() => onRequestMenuModal({ type: "add-set" })}
                  className={menuButtonClass(isMenuActive)}
                  disabled={!isMenuActive}
                >
                  Add Set
                </button>
                <button
                  onClick={() => onRequestMenuModal({ type: "set-config" })}
                  className={menuButtonClass(isMenuActive)}
                  disabled={!isMenuActive}
                >
                  Set Config
                </button>
                <button
                  onClick={() => onRequestMenuModal({ type: "raw-import" })}
                  className={menuButtonClass(isMenuActive)}
                  disabled={!isMenuActive}
                >
                  Raw Import
                </button>
                <button
                  onClick={() => onRequestMenuModal({ type: "unsaved-changes" })}
                  className={menuButtonClass(isMenuActive)}
                  disabled={!isMenuActive}
                >
                  Unsaved
                </button>
                <button
                  onClick={() => onRequestMenuModal({ type: "delete-folder" })}
                  className={menuButtonClass(isMenuActive)}
                  disabled={!isMenuActive}
                >
                  Delete Folder
                </button>
                <button
                  onClick={() => onRequestMenuModal({ type: "image-modal" })}
                  className={menuButtonClass(isMenuActive)}
                  disabled={!isMenuActive}
                >
                  Image
                </button>
                <button
                  onClick={() => onRequestMenuModal({ type: "warning-modal" })}
                  className={menuButtonClass(isMenuActive)}
                  disabled={!isMenuActive}
                >
                  Warning
                </button>
                <button
                  onClick={() => onRequestMenuModal({ type: "invalid-file" })}
                  className={menuButtonClass(isMenuActive)}
                  disabled={!isMenuActive}
                >
                  Invalid File
                </button>
                <button
                  onClick={() => onRequestMenuModal({ type: "no-starred" })}
                  className={menuButtonClass(isMenuActive)}
                  disabled={!isMenuActive}
                >
                  No Starred
                </button>
                <button
                  onClick={() => onRequestMenuModal({ type: "markdown-help" })}
                  className={menuButtonClass(isMenuActive)}
                  disabled={!isMenuActive}
                >
                  Markdown Help
                </button>
                <button
                  onClick={() => onRequestMenuModal({ type: "create-folder" })}
                  className={menuButtonClass(isMenuActive)}
                  disabled={!isMenuActive}
                >
                  Create Folder
                </button>
                <button
                  onClick={() => onRequestMenuModal({ type: "move-to-local" })}
                  className={menuButtonClass(isMenuActive)}
                  disabled={!isMenuActive}
                >
                  Move Storage
                </button>
              </div>
              {!isMenuActive && (
                <div className="text-[10px] text-muted mt-2">
                  Menu modals are available on the Home screen.
                </div>
              )}
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Toasts</div>
              <button onClick={onShowToast} className={menuButtonClass(true)}>
                <span className="inline-flex items-center gap-2">
                  <MessageSquare size={12} /> Corruption Toast
                </span>
              </button>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Headings</div>
              <div className="space-y-2">
                <div>
                  <div className="text-[10px] text-muted uppercase tracking-widest">H1 / Page</div>
                  <div className="text-2xl text-text" style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}>
                    Page Title
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-muted uppercase tracking-widest">H2 / Section</div>
                  <div className="text-xl text-text font-bold">Section Header</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted uppercase tracking-widest">H3 / Subsection</div>
                  <div className="text-base text-text font-bold">Subsection</div>
                </div>
                <div>
                  <div className="text-[10px] text-muted uppercase tracking-widest">Label</div>
                  <div className="text-xs text-text font-bold uppercase tracking-widest">Label Text</div>
                </div>
              </div>
            </div>

            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Tags</div>
              <div className="flex flex-wrap gap-2">
                <TagPill tag={tag} />
                <CardTagPill label="Cue" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
