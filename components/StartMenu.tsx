import React, {
  useState,
  useRef,
  useMemo,
  useEffect,
  useCallback,
} from "react";
import {
  Trash2,
  Upload,
  Plus,
  Copy,
  ArrowLeft,
  Download,
  FileText,
  LayoutList,
  HelpCircle,
  Save,
  FolderOpen,
  ChevronDown,
  Play,
  Pencil,
  RotateCw,
  RotateCcw,
  X,
  Check,
  Image as ImageIcon,
  Link,
  ExternalLink,
  ArrowLeftRight,
  Combine,
  Settings2,
  GripVertical,
  Minus,
  HardDrive,
  CheckCircle2,
  BookOpen,
  Search,
  Brain,
} from "lucide-react";
import { FloatingToolbar } from "./FloatingToolbar";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
  DraggableProvided,
  DroppableProvided,
} from "@hello-pangea/dnd";
import {
  CardSet,
  Card,
  Settings,
  Folder,
  CustomFieldDefinition,
  CustomFieldType,
  Tag,
} from "../types";
import { CursorTooltip } from "./CursorTooltip";
import {
  parseInput,
  generateId,
  syncMultistudySet,
  downloadFile,
  renderMarkdown,
  renderInline,
  extractCategory,
  isValidImageFile,
  sanitizeImageUrl,
  getTagColor,
  getModifierKeyLabel,
  getSRSDueCount,
  isMacPlatform,
} from "../utils";
import { normalizeCardStar } from "../cardNormalization";
import { RichInput, RichInputRef } from "./RichInput";
import clsx from "clsx";
import { AddSetModal } from "./AddSetModal";
import { RawTextImport } from "./RawTextImport";
import BreathingLoader from "./BreathingLoader";
import { TagPill } from "./TagPill";
import { CardTagPill } from "./CardTagPill";
import { sanitizeStrings } from "../storageV2";

interface StartMenuProps {
  librarySets: CardSet[];
  setLibrarySets: React.Dispatch<React.SetStateAction<CardSet[]>>;
  folders: Folder[];
  setFolders: React.Dispatch<React.SetStateAction<Folder[]>>;
  onStartFromLibrary: (set: CardSet) => void;
  onResumeSession: (set: CardSet) => void;
  onSaveToLibrary: (set: CardSet) => void;
  onDeleteLibrarySet: (id: string) => void;
  onDeleteSession: (id: string) => void;
  onOpenSet: (set: CardSet) => void;
  settings: Settings;
  onUpdateSettings: (s: Settings) => void;
  lifetimeCorrect: number;
  onDuplicateLibrarySet: (id: string) => void;
  initialEditSetId?: string | null;
  onClearEditRequest?: () => void;
  onUploadImage?: (file: File) => Promise<string>;
  tags: Tag[];
  onUpdateTags: (tags: Tag[]) => void;
  appliedTags: string[];
  setAppliedTags: (tags: string[]) => void;
  onOpenSettings?: () => void;
  isCloudLoading?: boolean;
  uiAuditRequest?: UiAuditRequest | null;
  onUiAuditHandled?: () => void;
  onHomeScreenActiveChange?: (isActive: boolean) => void;
  homeNavigationNonce?: number;
  hasCompletedOnboarding?: boolean;
  onStartOnboardingTour?: () => void;
  signedInUserName?: string | null;
}

interface BuilderRow {
  id: string;
  term: string;
  def: string;
  year: string;
  image: string;
  termImage: string;
  customFields: { name: string; value: string }[];
  tags: string[]; // Kept for internal state if needed, but primarily derived from term
  originalCardId?: string;
  star: boolean;
}

const LEADING_TAG_REGEX = /^(\s*\([^)]+\)\s*)+/;

const getBuilderDuplicateKey = (term: string): string =>
  term.replace(LEADING_TAG_REGEX, "").trim().toLowerCase();

export type UiAuditRequest =
  | { type: "add-set" }
  | { type: "set-config" }
  | { type: "raw-import" }
  | { type: "unsaved-changes" }
  | { type: "delete-folder" }
  | { type: "image-modal" }
  | { type: "warning-modal" }
  | { type: "invalid-file" }
  | { type: "no-starred" }
  | { type: "markdown-help" }
  | { type: "create-folder" }
  | { type: "move-to-local" };

const BUILDER_STORAGE_KEY = "flashcard-builder-rows";
const AUTOSAVE_DRAFT_KEY = "flashcardsish-autosave-draft";
const ONBOARDING_PROMPT_DISMISSED_KEY = "flashcardsish-onboarding-prompt-dismissed-v1";
const UI_AUDIT_ID = "__ui-audit__";

interface AutosaveDraft {
  builderRows: BuilderRow[];
  setName: string;
  termLabel: string;
  definitionLabel: string;
  termSideFields: CustomFieldDefinition[];
  defSideFields: CustomFieldDefinition[];
  showYear: boolean;
  enableTermCards: boolean;
  editingSetId: string | null;
  appliedTags: string[];
  rawText: string;
  builderMode: "visual" | "raw";
  savedAt: number;
}

type SplashGreeting = {
  text: string;
  colorful?: boolean;
};

const GREETINGS: SplashGreeting[] = [
  { text: "What are we learning next?" },
  { text: "Who's excited to study?!" },
  { text: "<name> appears!" },
  { text: "You got this, <name>." },
  { text: "I believe in <name>!" },
  { text: "You got this!" },
  { text: "Step 1 is studying." },
  { text: "Lock in." },
  { text: "One more set?" },
  { text: "What's up?" },
  { text: "All you." },
  { text: "Greatness incoming?" },
  { text: "Hey, you're here." },
  { text: "Welcome... or welcome back." },
  { text: "Ready?" },
  { text: "Oh, didn't see you there." },
  { text: "You're in the right place." },
  { text: "Go team you!" },
  { text: "Onward." },
  { text: "To infinity and beyond!" },
  { text: "Heyo." },
  { text: "Flashcards! Hurrah!" },
  { text: "Flashcardsish!" },
  { text: "'SET' it up. Haha, get it?" },
  { text: "Practice makes... good." },
  { text: "Working hard... or hardly working?" },
  { text: "What'll it be?" },
  { text: "You can't be <h=b>blue</h> now!", colorful: true },
  { text: "Be **bold**!", colorful: true },
  { text: "Keep it <h=g>fresh</h>.", colorful: true },
  { text: "Need a <h=r>memory boost</h>?", colorful: true },
  { text: "This one is <h=y>important</h>.", colorful: true },
];

const LIBRARY_SORT_OPTIONS: Array<{
  value: "recent" | "name_asc" | "name_desc" | "cards_desc";
  label: string;
}> = [
    { value: "recent", label: "Most Recent" },
    { value: "name_asc", label: "Name (A-Z)" },
    { value: "name_desc", label: "Name (Z-A)" },
    { value: "cards_desc", label: "Most Cards" },
  ];

// Unsaved Changes Modal
const UnsavedChangesModal: React.FC<{
  isOpen: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}> = ({ isOpen, onSave, onDiscard, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in"
      onMouseDown={onCancel}
    >
      <div
        className="bg-panel border border-outline rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-text mb-2">Unsaved Changes</h3>
        <p className="text-text mb-6">
          You have unsaved work in the builder. What would you like to do?
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onSave}
            className="w-full py-3 bg-accent text-bg rounded-xl font-bold hover:bg-accent/90 transition-colors duration-150"
          >
            Save to Library
          </button>
          <button
            onClick={onDiscard}
            className="w-full py-3 bg-panel-2 border border-outline text-red rounded-xl font-bold hover:bg-red/10 transition-colors"
          >
            Leave without Saving
          </button>
          <button
            onClick={onCancel}
            className="w-full py-3 text-muted hover:text-text font-medium rounded-xl hover:bg-panel-2 transition-colors duration-150"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

const DeleteFolderModal: React.FC<{
  isOpen: boolean;
  folderName: string;
  setCount: number;
  onClose: () => void;
  onConfirm: (action: "move" | "delete") => void;
}> = ({ isOpen, folderName, setCount, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in"
      onMouseDown={onClose}
    >
      <div
        className="bg-panel border border-outline rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-text mb-2">
          Delete "{folderName}"?
        </h3>
        <p className="text-text mb-6">
          This folder contains {setCount} set{setCount === 1 ? "" : "s"}. What
          would you like to do with them?
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => onConfirm("move")}
            className="w-full py-3 bg-accent text-bg rounded-xl font-bold hover:bg-accent/90 transition-colors duration-150"
          >
            Delete Folder Only
          </button>

          <button
            onClick={() => onConfirm("delete")}
            className="w-full py-3 bg-panel-2 border border-outline text-red rounded-xl font-bold hover:bg-red/10 transition-colors"
          >
            Delete Folder & Sets
          </button>

          <button
            onClick={onClose}
            className="w-full py-3 text-muted hover:text-text font-medium rounded-xl hover:bg-panel-2 transition-colors duration-150"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// Image Modal
const ImageModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (url: string) => void;
  initialValue: string;
  onUploadImage?: (file: File) => Promise<string>;
  autoClose?: boolean;
}> = ({ isOpen, onClose, onSave, initialValue, onUploadImage, autoClose = false }) => {
  const [urlInput, setUrlInput] = useState(initialValue);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setUrlInput(initialValue);
      setUploadError(null);
      setIsUploading(false);
    }
  }, [isOpen, initialValue]);

  const handleFile = async (file: File) => {
    // Security: Validate file type to block SVG and other dangerous formats
    if (!isValidImageFile(file)) {
      console.warn('Blocked image upload: Invalid or potentially unsafe file type:', file.type);
      setUploadError('Invalid file type. Please use JPEG, PNG, GIF, or WebP.');
      return;
    }

    setUploadError(null);

    // If cloud upload is available, use it
    if (onUploadImage) {
      setIsUploading(true);
      try {
        const publicUrl = await onUploadImage(file);
        onSave(publicUrl);
        onClose();
      } catch (error) {
        console.error('Upload failed:', error);
        setUploadError(error instanceof Error ? error.message : 'Upload failed. Please try again.');
      } finally {
        setIsUploading(false);
      }
    } else {
      // Fallback to Base64 for guests
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          onSave(reader.result);
          onClose();
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (!isUploading && e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleSave = () => {
    onSave(urlInput);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !isUploading) {
      handleSave();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    if (autoClose && !isUploading) {
      // Wait a bit for the paste to complete, then auto-close
      setTimeout(() => {
        const input = e.currentTarget;
        if (input.value.trim()) {
          handleSave();
        }
      }, 10);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in"
      onMouseDown={isUploading ? undefined : onClose}
    >
      <div
        className="bg-panel border border-outline rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-text">Add Image</h3>
          <button onClick={onClose} disabled={isUploading} className={isUploading ? "opacity-50 cursor-not-allowed" : ""}>
            <X size={24} className="text-muted hover:text-text" />
          </button>
        </div>

        {/* Upload Section */}
        <div
          className={clsx(
            "border-2 border-dashed rounded-xl h-36 flex flex-col items-center justify-center transition-colors relative",
            isUploading
              ? "border-accent/50 bg-accent/5 cursor-wait"
              : dragActive
                ? "border-accent bg-accent/10 cursor-pointer"
                : "border-outline hover:border-accent hover:bg-panel-2 cursor-pointer",
          )}
          onDragEnter={(e) => {
            if (isUploading) return;
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(e) => {
            if (isUploading) return;
            e.preventDefault();
            setDragActive(false);
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp,image/avif,image/bmp"
            onChange={(e) => e.target.files && !isUploading && handleFile(e.target.files[0])}
            disabled={isUploading}
          />

          {isUploading ? (
            <>
              {/* Spinner */}
              <div className="w-8 h-8 border-3 border-accent/30 border-t-accent rounded-full animate-spin mb-2"></div>
              <p className="text-sm text-accent font-medium">
                Uploading...
              </p>
            </>
          ) : (
            <>
              <Upload size={32} className="text-muted mb-2" />
              <p className="text-sm text-muted font-medium">
                Drag & drop or click to upload
              </p>
            </>
          )}
        </div>

        {/* Error Message */}
        {uploadError && (
          <div className="mt-3 p-3 bg-red/10 border border-red/20 rounded-lg">
            <p className="text-sm text-red">{uploadError}</p>
          </div>
        )}

        <div className="flex items-center gap-4 my-5">
          <div className="h-px bg-outline flex-1"></div>
          <span className="text-muted text-xs font-bold uppercase tracking-wider opacity-60">
            OR
          </span>
          <div className="h-px bg-outline flex-1"></div>
        </div>

        {/* Link Section */}
        <div className="flex gap-2">
          <input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Paste image link..."
            className="flex-1 bg-panel-2 border border-outline rounded-xl px-4 py-3 focus:outline-none focus:border-accent transition-colors text-sm"
            disabled={isUploading}
          />
          <button
            onClick={handleSave}
            disabled={isUploading}
            className={clsx(
              "px-5 py-3 bg-panel-2 border border-outline rounded-xl font-bold transition-all text-sm whitespace-nowrap",
              isUploading
                ? "opacity-50 cursor-not-allowed"
                : "hover:bg-accent hover:text-bg"
            )}
          >
            Save
          </button>
        </div>

        {/* Remove Image Option */}
        {initialValue && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => {
                onSave("");
                onClose();
              }}
              className="text-muted text-xs font-bold hover:text-red transition-colors flex items-center gap-1"
            >
              <Trash2 size={12} /> Remove Current Image
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// Formatting Guide Modal
const MarkdownHelpModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  const highlightExamples = [
    { syntax: '<h=y>yellow</h>', label: 'yellow', className: 'bg-yellow/20 text-yellow' },
    { syntax: '<h=r>red</h>', label: 'red', className: 'bg-red/20 text-red' },
    { syntax: '<h=b>blue</h>', label: 'blue', className: 'bg-blue/20 text-blue' },
    { syntax: '<h=g>green</h>', label: 'green', className: 'bg-green/20 text-green' },
    { syntax: '<h=p>purple</h>', label: 'purple', className: 'bg-purple/20 text-purple' },
  ];

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/55 backdrop-blur-sm animate-in fade-in p-4 md:p-8"
      onMouseDown={onClose}
    >
      <div
        className="bg-panel border border-outline rounded-2xl p-0 w-full max-w-5xl shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-outline shrink-0 bg-panel-2 rounded-t-2xl">
          <div className="flex items-center justify-between gap-4">
            <h2
              className="text-3xl text-text"
              style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}
            >
              Formatting Guide
            </h2>
            <button onClick={onClose} className="text-muted hover:text-text p-2 rounded-lg hover:bg-panel-2 transition-colors">
              <X size={22} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-8">

          <section className="space-y-4">
            <div>
              <h3 className="text-2xl font-bold text-text">Basic Formatting</h3>
              <p className="text-sm text-muted mt-2">
                Type the markdown in the left column. The right column shows how it renders on the card.
              </p>
            </div>

            <div className="rounded-2xl border border-outline overflow-hidden bg-panel-2">
              <table className="w-full text-sm">
                <thead className="bg-panel">
                  <tr>
                    <th className="text-left px-5 py-3 font-bold text-muted uppercase tracking-[0.18em] text-[11px] w-[46%]">
                      You Type
                    </th>
                    <th className="text-left px-5 py-3 font-bold text-muted uppercase tracking-[0.18em] text-[11px]">
                      You Get
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline">
                  <tr>
                    <td className="px-5 py-4 align-top">
                      <code className="text-white text-[17px]" style={{ fontFamily: "Consolas, 'Courier New', monospace" }}>**bold**</code>
                    </td>
                    <td className="px-5 py-4 text-text align-top">
                      <strong>bold</strong>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-5 py-4 align-top">
                      <code className="text-white text-[17px]" style={{ fontFamily: "Consolas, 'Courier New', monospace" }}>*italic*</code>
                    </td>
                    <td className="px-5 py-4 text-text align-top">
                      <em>italic</em>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-5 py-4 align-top">
                      <code className="text-white text-[17px]" style={{ fontFamily: "Consolas, 'Courier New', monospace" }}>__underline__</code>
                    </td>
                    <td className="px-5 py-4 text-text align-top">
                      <u>underline</u>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-5 py-4 align-top">
                      <code className="text-white text-[17px]" style={{ fontFamily: "Consolas, 'Courier New', monospace" }}>~~strikethrough~~</code>
                    </td>
                    <td className="px-5 py-4 text-text align-top">
                      <s>strikethrough</s>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-5 py-4 align-top">
                      <code className="text-white text-[17px]" style={{ fontFamily: "Consolas, 'Courier New', monospace" }}>`code`</code>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <code className="bg-panel px-1.5 py-0.5 rounded text-accent">code</code>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-5 py-4 align-top">
                      <pre className="text-white text-[17px] whitespace-pre-wrap" style={{ fontFamily: "Consolas, 'Courier New', monospace" }}>- First item{"\n"}- Second item</pre>
                    </td>
                    <td className="px-5 py-4 text-text align-top">
                      <ul className="list-disc list-inside space-y-1">
                        <li>First item</li>
                        <li>Second item</li>
                      </ul>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-5 py-4 align-top">
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                        {highlightExamples.map((example) => (
                          <code key={example.syntax} className="text-white text-[17px]" style={{ fontFamily: "Consolas, 'Courier New', monospace" }}>
                            {example.syntax}
                          </code>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-4 align-top">
                      <div className="flex flex-col items-start gap-2">
                        {highlightExamples.map((example) => (
                          <span key={example.syntax} className={`${example.className} px-2 py-1 rounded`}>
                            {example.label}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-6">
            <div>
              <h3 className="text-2xl font-bold text-text">Flashcardsish Markdown</h3>
              <p className="text-sm text-muted mt-2 leading-relaxed max-w-3xl">
                Flashcardsish adds two special markdown patterns that change how information is laid out on a card: Cues and Slabs.
              </p>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-center">
              <div className="space-y-3">
                <h4 className="text-xl font-bold text-text">Cues</h4>
                <p className="text-sm text-muted leading-relaxed">
                  Write a cue by putting text in parentheses at the start of the term, like <code className="bg-panel px-1 rounded text-text">(Verb) to run</code>. When the card renders, that cue is pulled out of the line and displayed as a small label above the main text.
                </p>
                <p className="text-sm text-muted leading-relaxed">
                  This is useful when the extra information should guide the reader before they read the answer itself, such as part of speech, category, tense, or prompt type.
                </p>
              </div>

              <div className="rounded-2xl border border-outline bg-panel shadow-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-outline bg-panel-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Cue Example</span>

                </div>
                <div className="p-4">
                  <div className="rounded-xl border border-outline bg-panel-2 min-h-[170px] p-6 relative flex items-center justify-center">
                    <div className="absolute top-4 left-4">
                      <CardTagPill label="Verb" className="px-3 py-1.5 text-[13px]" />
                    </div>
                    <div className="text-2xl font-semibold text-text text-center">to run</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-center">
              <div className="space-y-3">
                <h4 className="text-xl font-bold text-text">Slabs</h4>
                <p className="text-sm text-muted leading-relaxed">
                  Write a slab with double square brackets, like <code className="bg-panel px-1 rounded text-text">[[bio-]]</code>. A slab stays inside the sentence and renders as a solid inline block, so it feels attached to the text around it.
                </p>
                <p className="text-sm text-muted leading-relaxed">
                  This works well for chunks that should stay visually locked into the phrase itself, like prefixes, suffixes, particles, or other compact units you want the learner to notice immediately.
                </p>
              </div>

              <div className="rounded-2xl border border-outline bg-panel shadow-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-outline bg-panel-2">
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted">Slab Example</span>

                </div>
                <div className="p-4">
                  <div className="rounded-xl border border-outline bg-panel-2 min-h-[170px] flex items-center justify-center p-6">
                    <div className="text-xl text-text leading-relaxed text-center">
                      The
                      <span
                        className="inline-block bg-[#1f2937] text-slate-300 px-2 py-0.5 rounded text-[0.9em] font-medium mx-1 border border-slate-600 align-middle"
                        style={{
                          backgroundImage:
                            "repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255,255,255,0.05) 5px, rgba(255,255,255,0.05) 10px)",
                        }}
                      >
                        bio-
                      </span>
                      prefix means life.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-outline bg-panel/80 px-5 py-4">
              <p className="text-sm text-muted">
                Quick rule of thumb: if the extra info should sit <span className="font-bold text-text">above</span> the text, use a Cue. If it should stay <span className="font-bold text-text">inside</span> the phrase, use a Slab.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

// Warning Modal
const WarningModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  message: string;
}> = ({ isOpen, onClose, onConfirm, message }) => {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in"
      onMouseDown={onClose}
    >
      <div
        className="bg-panel border border-outline rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4">
          <h3 className="text-lg font-bold text-text">Warning</h3>
        </div>
        <p className="text-text mb-6">{message}</p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="w-full py-3 rounded-xl bg-yellow text-bg font-bold transition-colors duration-150 hover:bg-yellow/90"
          >
            Confirm
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 text-muted hover:text-text font-medium rounded-xl hover:bg-panel-2 transition-colors duration-150"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// Invalid File Modal
const InvalidFileModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in"
      onMouseDown={onClose}
    >
      <div
        className="bg-panel border border-outline rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4">
          <h3 className="text-lg font-bold text-text">Invalid File</h3>
        </div>
        <p className="text-text mb-6">
          This file doesn't look like a valid flashcard set. Please check the
          file format and try again.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl bg-panel-2 hover:bg-panel-3 text-text font-bold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// No Starred Modal
const NoStarredModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onDisableAndPlay: () => void;
}> = ({ isOpen, onClose, onDisableAndPlay }) => {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in"
      onMouseDown={onClose}
    >
      <div
        className="bg-panel border border-outline rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4">
          <h3 className="text-lg font-bold text-text">No Starred Cards</h3>
        </div>
        <p className="text-text mb-6">
          You have "Study Starred Only" enabled, but this set has no starred
          cards.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onDisableAndPlay}
            className="w-full py-3 bg-accent text-bg rounded-xl font-bold transition-colors duration-150 hover:bg-accent/90"
          >
            Disable Filter & Play
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 text-muted hover:text-text font-medium rounded-xl hover:bg-panel-2 transition-colors duration-150"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper Tooltip Component
const HelperTooltip: React.FC<{
  text: React.ReactNode;
  show: boolean;
  position?: "top" | "bottom";
  type?: "default" | "error";
  hideTooltips: boolean;
}> = ({ text, show, position = "top", type = "default", hideTooltips }) => {
  if (!show || hideTooltips) return null;
  return (
    <div
      className={clsx(
        "absolute z-50 px-4 py-3 rounded-lg text-xs font-medium shadow-xl animate-in fade-in zoom-in-95 pointer-events-none w-64 text-center left-1/2 -translate-x-1/2",
        position === "top" ? "bottom-full mb-3" : "top-full mt-3",
        type === "default" &&
        "bg-[#422006] text-[#FEF3C7] border border-[#78350F]",
        type === "error" &&
        "bg-red text-white border border-red-700 shadow-red/20",
      )}
    >
      {text}
      <div
        className={clsx(
          "absolute left-1/2 -translate-x-1/2 w-3 h-3 rotate-45",
          position === "top" ? "bottom-[-5px]" : "top-[-5px]",
          type === "default" &&
          "bg-[#422006] border-r border-b border-[#78350F]",
          type === "error" && "bg-red",
        )}
      ></div>
    </div>
  );
};

// Field Row Component
const FieldRowComponent: React.FC<{
  field: CustomFieldDefinition;
  index: number;
  update: (index: number, updates: Partial<CustomFieldDefinition>) => void;
  remove: (index: number) => void;
  isLast: boolean;
  addNext: () => void;
  side: "term" | "def";
  activeFieldId: string | null;
  setActiveFieldId: (id: string | null) => void;
  termLabel: string;
  definitionLabel: string;
  hideTooltips: boolean;
  onSwap: () => void;
  dragHandleProps?: DraggableProvided['dragHandleProps'];
  draggableProps?: DraggableProvided['draggableProps'];
  innerRef?: (element: HTMLElement | null) => void;
  isDragging?: boolean;
}> = ({
  field,
  index,
  update,
  remove,
  isLast,
  addNext,
  side,
  activeFieldId,
  setActiveFieldId,
  termLabel,
  definitionLabel,
  hideTooltips,
  onSwap,
  dragHandleProps,
  draggableProps,
  innerRef,
  isDragging,
}) => {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown on click outside
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (
          dropdownRef.current &&
          !dropdownRef.current.contains(event.target as Node)
        ) {
          setIsDropdownOpen(false);
        }
      };
      document.addEventListener("mousedown", handleClickOutside, true);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside, true);
    }, []);

    const isFocused = activeFieldId === `${side}-${index}`;

    // Determine dynamic text for tooltip
    const sideName =
      side === "term" ? termLabel || "Terms" : definitionLabel || "Definitions";

    let suffix = "";
    if (field.type === "text") suffix = "text, using the label you choose here";
    else if (field.type === "number") suffix = "a number, using the label you choose here";
    else if (field.type === "ab") suffix = "one of the two options you label here";
    else if (field.type === "tf") suffix = "true or false";

    const tooltipContent = (
      <span>
        When studying <b>{sideName}</b>, you'll answer a prompt for{" "}
        <b>{field.name || "this field"}</b> with <b>{suffix}</b>.
      </span>
    );

    return (
      <div
        ref={innerRef}
        {...draggableProps}
        className="relative pt-2 pr-2"
      >
        {/* Delete button - top right corner */}
        <button
          onClick={() => remove(index)}
          className="absolute top-0 right-0 z-10 w-5 h-5 flex items-center justify-center bg-panel border border-outline rounded-full text-muted hover:text-white hover:border-red hover:bg-red transition-colors shadow-sm"
          title="Delete field"
        >
          <X size={10} />
        </button>

        <div
          className={clsx(
            "bg-panel-2 border rounded-xl p-3 transition-shadow",
            isDragging ? "border-accent shadow-2xl bg-panel" : "border-outline"
          )}
        >
          {/* Main row */}
          <div className="flex items-center gap-2">
            <div
              {...dragHandleProps}
              className="flex-shrink-0 text-muted hover:text-accent cursor-grab active:cursor-grabbing transition-colors p-1"
              title="Drag to reorder or move"
            >
              <GripVertical size={18} />
            </div>

            <input
              value={field.name}
              onChange={(e) => update(index, { name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addNext();
                }
              }}
              className="flex-1 bg-panel border border-outline rounded-lg px-3 py-2 text-sm focus:border-accent outline-none transition-colors"
              placeholder="Field Name"
              spellCheck={false}
              data-ms-editor="true"
            />

            <div className="relative w-28 flex-shrink-0" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full bg-panel border border-outline rounded-lg px-2 py-2 text-xs focus:border-accent outline-none transition-colors flex items-center justify-between gap-1"
              >
                <span className="capitalize truncate font-medium">
                  {field.type === "ab" ? "A/B" : field.type === "tf" ? "T/F" : field.type}
                </span>
                <ChevronDown size={10} className="opacity-50 flex-shrink-0" />
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full right-0 mt-1 w-full bg-panel border border-outline rounded-xl shadow-xl z-[60] overflow-hidden animate-in zoom-in-95">
                  {[
                    { val: "text", label: "Text" },
                    { val: "number", label: "Number" },
                    { val: "ab", label: "A/B" },
                    { val: "tf", label: "T/F" },
                  ].map((opt) => (
                    <button
                      key={opt.val}
                      onClick={() => {
                        const updates: any = { type: opt.val as CustomFieldType };
                        if (opt.val === "tf") {
                          updates.options = { a: "True", b: "False" };
                        }
                        update(index, updates);
                        setIsDropdownOpen(false);
                      }}
                      className={clsx(
                        "w-full text-left px-3 py-2 text-xs hover:bg-panel-2 transition-colors",
                        field.type === opt.val
                          ? "text-accent font-bold bg-accent/5"
                          : "text-text",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* A/B options row */}
          {field.type === "ab" && (
            <div className="flex gap-2 pl-7 mt-2">
              <input
                value={field.options?.a || ""}
                onChange={(e) =>
                  update(index, {
                    options: { a: e.target.value, b: field.options?.b || "" },
                  })
                }
                placeholder="Option A"
                className="flex-1 bg-panel border border-outline/50 rounded px-2 py-1.5 text-xs focus:border-accent outline-none transition-colors"
              />
              <input
                value={field.options?.b || ""}
                onChange={(e) =>
                  update(index, {
                    options: { a: field.options?.a || "", b: e.target.value },
                  })
                }
                placeholder="Option B"
                className="flex-1 bg-panel border border-outline/50 rounded px-2 py-1.5 text-xs focus:border-accent outline-none transition-colors"
              />
            </div>
          )}
        </div>
      </div>
    );
  };

// Set Configuration Modal (V2)
const SetConfigurationModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  termLabel: string;
  setTermLabel: (s: string) => void;
  definitionLabel: string;
  setDefinitionLabel: (s: string) => void;
  termSideFields: CustomFieldDefinition[];
  setTermSideFields: (f: CustomFieldDefinition[]) => void;
  defSideFields: CustomFieldDefinition[];
  setDefSideFields: (f: CustomFieldDefinition[]) => void;
  showYear: boolean;
  setShowYear: (b: boolean) => void;
  enableTermCards: boolean;
  setEnableTermCards: (b: boolean) => void;
  settings: Settings;
  importAppend?: boolean;
  setImportAppend?: (b: boolean) => void;
  importOverride?: "keep" | "duplicate" | "override";
  setImportOverride?: (s: "keep" | "duplicate" | "override") => void;
  rawText?: string;
  setRawText?: (s: string) => void;
  onImportContinue?: (cards: Partial<Card>[], append: boolean, overrideStrategy: 'keep' | 'duplicate' | 'override') => void;
  hideImportButton?: boolean;
  builderRows?: BuilderRow[];
  setBuilderRows?: (rows: BuilderRow[]) => void;
  tags: Tag[];
  onUpdateTags: (tags: Tag[]) => void;
  appliedTags: string[];
  setAppliedTags: (tags: string[]) => void;
  onManageTags?: () => void;
  initialMode?: "config" | "import";
}> = ({
  isOpen,
  onClose,
  termLabel,
  setTermLabel,
  definitionLabel,
  setDefinitionLabel,
  termSideFields,
  setTermSideFields,
  defSideFields,
  setDefSideFields,
  showYear,
  setShowYear,
  enableTermCards,
  setEnableTermCards,
  settings,
  rawText,
  setRawText,
  onImportContinue,
  hideImportButton,
  builderRows,
  setBuilderRows,
  tags,
  onUpdateTags,
  appliedTags,
  setAppliedTags,
  onManageTags,
  initialMode = "config",
}) => {
    const [mode, setMode] = useState<"config" | "import">("config");
    const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
    const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
    // const [isSwapMode, setIsSwapMode] = useState(false); // Removed
    const [draggingFrom, setDraggingFrom] = useState<string | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (!isOpen) return;
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsTagDropdownOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
      if (!isTagDropdownOpen) return;
      const closeDropdown = () => setIsTagDropdownOpen(false);
      window.addEventListener('scroll', closeDropdown, true);
      return () => window.removeEventListener('scroll', closeDropdown, true);
    }, [isTagDropdownOpen]);

    // Reset mode on open
    useEffect(() => {
      if (isOpen) {
        setMode(initialMode);
        setIsTagDropdownOpen(false);
      }
    }, [isOpen, initialMode]);

    useEffect(() => {
      if (!isOpen) {
        setIsTagDropdownOpen(false);
      }
    }, [isOpen]);

    useEffect(() => {
      if (mode !== "config") {
        setIsTagDropdownOpen(false);
      }
    }, [mode]);

    if (!isOpen) return null;

    const updateTermField = (
      index: number,
      updates: Partial<CustomFieldDefinition>,
    ) => {
      if (index < termSideFields.length) {
        const newArr = [...termSideFields];
        newArr[index] = { ...newArr[index], ...updates };
        // Auto-detect "Year" -> Number, only if changing name
        if (
          updates.name &&
          updates.name.toLowerCase() === "years" &&
          newArr[index].type === "text"
        ) {
          newArr[index].type = "number";
        }
        setTermSideFields(newArr);
      }
    };

    const addTermField = () => {
      if (termSideFields.length < 4) {
        setTermSideFields([...termSideFields, { id: generateId(), name: "", type: "text" }]);
      }
    };

    const deleteTermField = (index: number) => {
      setTermSideFields(termSideFields.filter((_, i) => i !== index));
    };

    const updateDefField = (
      index: number,
      updates: Partial<CustomFieldDefinition>,
    ) => {
      if (index < defSideFields.length) {
        const newArr = [...defSideFields];
        newArr[index] = { ...newArr[index], ...updates };
        // Auto-detect "Year" -> Number
        if (
          updates.name &&
          updates.name.toLowerCase() === "years" &&
          newArr[index].type === "text"
        ) {
          newArr[index].type = "number";
        }
        setDefSideFields(newArr);
      }
    };

    const addDefField = () => {
      if (defSideFields.length < 4) {
        setDefSideFields([...defSideFields, { id: generateId(), name: "", type: "text" }]);
      }
    };

    const deleteDefField = (index: number) => {
      setDefSideFields(defSideFields.filter((_, i) => i !== index));
    };

    const swapTermField = (index: number) => {
      if (defSideFields.length >= 4) {
        alert("Cannot move field. Destination side is full (max 4).");
        return;
      }
      const fieldToMove = termSideFields[index];
      setTermSideFields(termSideFields.filter((_, i) => i !== index));
      setDefSideFields([...defSideFields, fieldToMove]);
    };

    const swapDefField = (index: number) => {
      if (termSideFields.length >= 4) {
        alert("Cannot move field. Destination side is full (max 4).");
        return;
      }
      const fieldToMove = defSideFields[index];
      setDefSideFields(defSideFields.filter((_, i) => i !== index));
      setTermSideFields([...termSideFields, fieldToMove]);
    };

    // Drag and Drop Logic
    const onDragStart = (start: any) => {
      setDraggingFrom(start.source.droppableId);
    };

    const onDragEnd = (result: DropResult) => {
      setDraggingFrom(null);
      const { source, destination } = result;

      if (!destination) return;

      // Dropped in same spot
      if (
        source.droppableId === destination.droppableId &&
        source.index === destination.index
      ) {
        return;
      }

      const isSameList = source.droppableId === destination.droppableId;

      if (isSameList) {
        // Reorder within one list
        const list = source.droppableId === "term" ? [...termSideFields] : [...defSideFields];
        const setter = source.droppableId === "term" ? setTermSideFields : setDefSideFields;
        const [moved] = list.splice(source.index, 1);
        list.splice(destination.index, 0, moved);
        setter(list);
      } else {
        // Move between lists
        const srcList = source.droppableId === "term" ? [...termSideFields] : [...defSideFields];
        const dstList = destination.droppableId === "term" ? [...termSideFields] : [...defSideFields];

        if (dstList.length >= 4) return; // capacity guard

        const [moved] = srcList.splice(source.index, 1);
        dstList.splice(destination.index, 0, moved);

        if (source.droppableId === "term") {
          setTermSideFields(srcList);
          setDefSideFields(dstList);
        } else {
          setDefSideFields(srcList);
          setTermSideFields(dstList);
        }
      }
    };

    const handleClose = () => {
      setIsTagDropdownOpen(false);
      // Filter out fields with empty names
      const filteredTerm = termSideFields.filter((f) => f.name.trim() !== "");
      const filteredDef = defSideFields.filter((f) => f.name.trim() !== "");

      if (filteredTerm.length !== termSideFields.length) {
        setTermSideFields(filteredTerm);
      }
      if (filteredDef.length !== defSideFields.length) {
        setDefSideFields(filteredDef);
      }

      onClose();
    };



    if (mode === "import" && rawText !== undefined && setRawText && onImportContinue) {
      return (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in"
          onMouseDown={handleClose}
        >
          <div
            className="bg-panel border border-outline rounded-2xl p-0 w-full max-w-6xl h-[90vh] shadow-2xl animate-in zoom-in-95 flex flex-col overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <RawTextImport
              onClose={() => setMode('config')}
              onContinue={(cards, append, overrideStrategy) => {
                onImportContinue(cards, append, overrideStrategy);
                handleClose();
              }}
              rawText={rawText}
              setRawText={setRawText}
              settings={settings}
              isModal={true}
            />
          </div>
        </div>
      );
    }



    return (
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in"
        onMouseDown={handleClose}
      >
        <div
          className="bg-panel border border-outline rounded-2xl p-0 w-full max-w-4xl shadow-2xl animate-in zoom-in-95 max-h-[90vh] flex flex-col"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="p-6 border-b border-outline shrink-0 bg-panel-2 rounded-t-2xl">
            <div className="flex items-center justify-between gap-4">
              <h2
                className="text-3xl text-text"
                style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}
              >
                Set Configuration
              </h2>
              <button onClick={handleClose} className="text-muted hover:text-text p-2 rounded-lg hover:bg-panel-2 transition-colors">
                <X size={22} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <h4 className="text-lg font-bold text-text mb-2">Rename Sides</h4>
            <p className="text-text mb-6 text-sm leading-relaxed">
              You can optionally change the name of the Terms and Definitions sides. This is purely cosmetic and doesn't affect "gameplay" at all.
            </p>

            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <div className="uppercase text-xs font-bold text-muted tracking-widest">
                  Term Side
                </div>
                <div className="flex items-center gap-2 relative">
                  <input
                    value={termLabel}
                    onChange={(e) => setTermLabel(e.target.value)}
                    className="flex-1 bg-panel-2 border border-outline rounded-xl px-4 py-3 text-lg focus:border-accent outline-none font-bold text-accent placeholder-accent/30 transition-colors"
                    placeholder="Term"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <div className="uppercase text-xs font-bold text-muted tracking-widest text-right">
                  Definition Side
                </div>
                <div className="flex items-center gap-2 relative">
                  <input
                    value={definitionLabel}
                    onChange={(e) => setDefinitionLabel(e.target.value)}
                    className="flex-1 bg-panel-2 border border-outline rounded-xl px-4 py-3 text-lg focus:border-accent outline-none font-bold text-accent placeholder-accent/30 transition-colors"
                    placeholder="Definition"
                  />
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-outline/50">
              <h4 className="text-lg font-bold text-text mb-2">Custom Fields</h4>
              <p className="text-text mb-8 text-sm leading-relaxed">
                Add up to 4 custom fields per side for repeated information like
                category, date, source, or metadata. Leaving a field blank means
                that card won&apos;t require that field.
                <br /> <br />
                Custom fields can be text, number, a two-option choice, or
                true/false.
              </p>

              <DragDropContext onDragEnd={onDragEnd} onDragStart={onDragStart}>
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Term Side */}
                  <Droppable droppableId="term">
                    {(provided, snapshot) => (
                      <div
                        className={clsx(
                          "space-y-4 rounded-xl transition-colors",
                          snapshot.isDraggingOver ? "bg-accent/5 border-2 border-dashed border-accent/30" : "border-2 border-transparent"
                        )}
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                      >
                        <div className="uppercase text-xs font-bold text-muted tracking-widest flex items-center justify-between">
                          <span>{(termLabel || "Term")} Side Custom Fields</span>
                          <span className="text-xs font-normal tracking-normal normal-case">
                            {termSideFields.length}/4
                          </span>
                        </div>

                        <div className="flex flex-col gap-1 min-h-[50px]">
                          {termSideFields.map((field, i) => (
                            <Draggable
                              key={field.id || `term-${i}`}
                              draggableId={field.id || `term-${i}`}
                              index={i}
                            >
                              {(provided, snapshot) => (
                                <div className="group/field-row">
                                  <FieldRowComponent
                                    field={field}
                                    index={i}
                                    update={updateTermField}
                                    remove={deleteTermField}
                                    isLast={i === termSideFields.length - 1}
                                    addNext={addTermField}
                                    side="term"
                                    activeFieldId={activeFieldId}
                                    setActiveFieldId={setActiveFieldId}
                                    termLabel={termLabel}
                                    definitionLabel={definitionLabel}
                                    hideTooltips={settings.hideTooltips}
                                    onSwap={() => swapTermField(i)}
                                    innerRef={provided.innerRef}
                                    draggableProps={provided.draggableProps}
                                    dragHandleProps={provided.dragHandleProps}
                                    isDragging={snapshot.isDragging}
                                  />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                          {termSideFields.length < 4 && (
                            <button
                              onClick={addTermField}
                              className="w-full py-2 border border-dashed border-outline rounded-lg text-sm text-muted hover:text-accent hover:border-accent transition-colors flex items-center justify-center gap-2"
                            >
                              <Plus size={14} /> Add {(termLabel || "Term")} Field
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </Droppable>

                  {/* Definition Side */}
                  <Droppable droppableId="def">
                    {(provided, snapshot) => (
                      <div
                        className={clsx(
                          "space-y-4 rounded-xl transition-colors",
                          snapshot.isDraggingOver ? "bg-accent/5 border-2 border-dashed border-accent/30" : "border-2 border-transparent"
                        )}
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                      >
                        <div className="uppercase text-xs font-bold text-muted tracking-widest flex items-center justify-between">
                          <span>{(definitionLabel || "Definition")} Side Custom Fields</span>
                          <span className="text-xs font-normal tracking-normal normal-case">
                            {defSideFields.length}/4
                          </span>
                        </div>

                        <div className="flex flex-col gap-1 min-h-[50px]">
                          {defSideFields.map((field, i) => (
                            <Draggable
                              key={field.id || `def-${i}`}
                              draggableId={field.id || `def-${i}`}
                              index={i}
                            >
                              {(provided, snapshot) => (
                                <div className="group/field-row">
                                  <FieldRowComponent
                                    field={field}
                                    index={i}
                                    update={updateDefField}
                                    remove={deleteDefField}
                                    isLast={i === defSideFields.length - 1}
                                    addNext={addDefField}
                                    side="def"
                                    activeFieldId={activeFieldId}
                                    setActiveFieldId={setActiveFieldId}
                                    termLabel={termLabel}
                                    definitionLabel={definitionLabel}
                                    hideTooltips={settings.hideTooltips}
                                    onSwap={() => swapDefField(i)}
                                    innerRef={provided.innerRef}
                                    draggableProps={provided.draggableProps}
                                    dragHandleProps={provided.dragHandleProps}
                                    isDragging={snapshot.isDragging}
                                  />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                          {defSideFields.length < 4 && (
                            <button
                              onClick={addDefField}
                              className="w-full py-2 border border-dashed border-outline rounded-lg text-sm text-muted hover:text-accent hover:border-accent transition-colors flex items-center justify-center gap-2"
                            >
                              <Plus size={14} /> Add {(definitionLabel || "Definition")} Field
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </Droppable>
                </div>
              </DragDropContext>
            </div>

            {/* Set Data Section */}
            <div className="mt-8 pt-6 border-t border-outline/50">
              <h4 className="text-lg font-bold text-text mb-4">Set Data</h4>
              <div className="flex flex-col gap-4">
                {/* Applied Tags List */}
                {appliedTags.length > 0 && (
                  <div className="flex flex-col items-start gap-2">
                    {tags.filter(t => appliedTags.includes(t.id)).map(tag => (
                      <div key={tag.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-accent/20 bg-accent/5 text-text text-sm font-medium">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: getTagColor(tag.color) }}
                        />
                        {tag.name}
                        <button
                          onClick={() => setAppliedTags(appliedTags.filter(id => id !== tag.id))}
                          className="ml-1 text-muted hover:text-red transition-colors"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative" ref={dropdownRef}>
                    <button
                      onClick={() => setIsTagDropdownOpen(!isTagDropdownOpen)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-panel-2 border border-outline hover:border-accent text-sm font-bold text-muted hover:text-text transition-all"
                    >
                      <Plus size={16} />
                      Add Tag
                    </button>

                    {isTagDropdownOpen && (
                      <div className="absolute top-full left-0 mt-2 w-64 bg-panel border border-outline rounded-xl shadow-xl z-50 animate-in fade-in zoom-in-95 flex flex-col overflow-hidden">
                        <div className="max-h-60 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                          {tags.length === 0 ? (
                            <div className="p-4 text-center text-xs text-muted italic">No tags found.</div>
                          ) : (
                            tags.map(tag => {
                              const isSelected = appliedTags.includes(tag.id);
                              return (
                                <button
                                  key={tag.id}
                                  onClick={() => {
                                    if (isSelected) {
                                      setAppliedTags(appliedTags.filter(id => id !== tag.id));
                                    } else {
                                      setAppliedTags([...appliedTags, tag.id]);
                                    }
                                  }}
                                  className={clsx(
                                    "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
                                    isSelected ? "bg-accent/10 text-text" : "hover:bg-panel-2 text-muted hover:text-text"
                                  )}
                                >
                                  <div
                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: getTagColor(tag.color) }}
                                  />
                                  <span className="flex-1 truncate">{tag.name}</span>
                                  {isSelected && <Check size={14} className="text-accent" />}
                                </button>
                              );
                            })
                          )}
                        </div>

                        {/* Frozen Footer */}
                        <div className="p-2 border-t border-outline bg-panel-2">
                          <button
                            onClick={() => {
                              setIsTagDropdownOpen(false);
                              if (onManageTags) onManageTags();
                            }}
                            className="w-full text-center px-3 py-2 text-xs font-bold text-accent hover:underline transition-all"
                          >
                            Manage Tags
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {!hideImportButton && (
                    <button
                      onClick={() => setMode("import")}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-panel-2 border border-outline hover:border-accent text-sm font-bold text-muted hover:text-text transition-all"
                    >
                      <FileText size={14} />
                      Raw Text Import
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-outline/50">
              <h4 className="text-lg font-bold text-text mb-4">Misc.</h4>
              <div className="flex flex-col gap-6">
                <div className="flex items-center flex-wrap gap-4">
                  <CursorTooltip
                    content="Adds an image button to the term side of each card. When enabled, you can attach images to both sides of your flashcards."
                    isEnabled={!settings.hideTooltips}
                    tooltipClassName="w-80 max-w-[90vw]"
                  >
                    <label className="flex items-center gap-3 cursor-pointer select-none group">
                      <input
                        type="checkbox"
                        checked={enableTermCards}
                        onChange={() => {
                          const newValue = !enableTermCards;
                          setEnableTermCards(newValue);
                          // Clear term images when disabling
                          if (!newValue && builderRows && setBuilderRows) {
                            setBuilderRows(builderRows.map(row => ({ ...row, termImage: "" })));
                          }
                        }}
                        className="hidden"
                      />
                      <div
                        className={clsx(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                          enableTermCards
                            ? "bg-accent border-accent"
                            : "border-outline group-hover:border-accent",
                        )}
                      >
                        {enableTermCards && (
                          <div className="w-2.5 h-1.5 border-b-2 border-l-2 border-bg -rotate-45 -mt-0.5" />
                        )}
                      </div>
                      <div className="text-sm font-bold text-text">
                        Enable Term Images
                      </div>
                    </label>
                  </CursorTooltip>
                </div>
                <div className="pt-6 border-t border-outline/50 flex justify-end">
                  <button
                    onClick={() => {
                      // Filter out blank fields before closing
                      const cleanTermFields = termSideFields.filter(f => f.name.trim() !== "");
                      const cleanDefFields = defSideFields.filter(f => f.name.trim() !== "");

                      if (cleanTermFields.length !== termSideFields.length) {
                        setTermSideFields(cleanTermFields);
                      }
                      if (cleanDefFields.length !== defSideFields.length) {
                        setDefSideFields(cleanDefFields);
                      }

                      onClose();
                    }}
                    className="px-6 py-2.5 bg-accent text-bg font-bold rounded-xl hover:bg-accent/90 transition-colors duration-150"
                  >
                    OK
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };



// Builder Row Component
const BuilderRowItem: React.FC<{
  row: BuilderRow;
  index: number;
  termLabel: string;
  definitionLabel: string;
  isDuplicate: boolean;
  isLast: boolean;
  termSideFields: CustomFieldDefinition[];
  defSideFields: CustomFieldDefinition[];
  showYear: boolean;
  enableTermCards: boolean;
  updateRow: (id: string, field: keyof BuilderRow, value: any) => void;
  removeRow: (id: string) => void;
  onAddNext: () => void;
  onOpenImageModal: (id: string, field?: 'image' | 'termImage') => void;
  onDuplicate: (id: string) => void;
  onSwap: (id: string) => void;
  nextRowId?: string;
  onFocusRowTerm: (rowId: string) => void;
  tabSelectsEverythingInBuilder: boolean;
  draggableProps?: DraggableProvided["draggableProps"];
  dragHandleProps?: DraggableProvided["dragHandleProps"];
  innerRef?: (element: HTMLElement | null) => void;
  wysiwyg: boolean;
  saveHistory: () => void;
}> = React.memo(
  ({
    row,
    index,
    termLabel,
    definitionLabel,
    isDuplicate,
    isLast,
    termSideFields,
    defSideFields,
    showYear,
    enableTermCards,
    updateRow,
    removeRow,
    onAddNext,
    onOpenImageModal,
    onDuplicate,
    onSwap,
    nextRowId,
    onFocusRowTerm,
    tabSelectsEverythingInBuilder,
    draggableProps,
    dragHandleProps,
    innerRef,
    wysiwyg,
    saveHistory, // New prop
  }) => {
    const termData = useMemo(() => extractCategory(row.term), [row.term]);
    const defData = useMemo(() => extractCategory(row.def), [row.def]);
    const hasAnyTag = !!termData.category || !!defData.category;

    const [isEditingDef, setIsEditingDef] = useState(false);
    const [isEditingTerm, setIsEditingTerm] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const termTextareaRef = useRef<HTMLTextAreaElement>(null);
    const autoResizeTextarea = (element: HTMLTextAreaElement | null) => {
      if (!element) return;
      element.style.height = "0px";
      element.style.height = `${element.scrollHeight}px`;
    };

    // Highlight Toolbar State
    const [toolbarVisible, setToolbarVisible] = useState(false);
    const [toolbarPos, setToolbarPos] = useState({ top: 0, left: 0 });
    const activeToolbarRef = useRef<{
      field: "term" | "def";
      // We don't save range indices anymore for contentEditable, we rely on Window Selection
    } | null>(null);

    const termInputRef = useRef<RichInputRef>(null);
    const defInputRef = useRef<RichInputRef>(null);
    const handleSelectionChange = (
      e: React.SyntheticEvent,
      field: "term" | "def",
    ) => {
      // Use timeout to ensure selection is fully updated by the browser
      setTimeout(() => {
        // For ContentEditable, we use Window Selection
        const selection = window.getSelection();

        if (selection && !selection.isCollapsed) {
          // Check if selection is inside the correct element
          // We can check if the anchorNode is inside our field ref
          // const ref = field === 'term' ? termInputRef.current : defInputRef.current;

          activeToolbarRef.current = { field };

          // Calculate position based on selection range
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();

          // Ensure we don't position if rect is zero (invisible)
          if (rect.width === 0 && rect.height === 0) return;

          setToolbarPos({
            top: rect.top - 10, // Slightly higher
            left: rect.left + (rect.width / 2),
          });
          setToolbarVisible(true);
        } else {
          // If selection is collapsed, hide toolbar
          activeToolbarRef.current = null;
          setToolbarVisible(false);
        }
      }, 0);
    };


    // Handle Scroll (Dismiss)
    useEffect(() => {
      const handleScroll = () => {
        if (toolbarVisible) {
          activeToolbarRef.current = null;
          setToolbarVisible(false);
        }
      };
      window.addEventListener('scroll', handleScroll, true);
      return () => window.removeEventListener('scroll', handleScroll, true);
    }, [toolbarVisible]);

    // Global Mouse Up Listener for external releases (e.g. drag selection ending outside input)
    useEffect(() => {
      if (wysiwyg || (!isEditingTerm && !isEditingDef)) return;

      const handleGlobalMouseUp = (e: MouseEvent) => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;

        const anchor = selection.anchorNode;
        if (!anchor) return;

        // Check Term
        if (termInputRef.current) {
          const container = termInputRef.current.getContainer();
          if (container && container.contains(anchor)) {
            handleSelectionChange(e as any, "term");
            return;
          }
        }

        // Check Def
        if (defInputRef.current) {
          const container = defInputRef.current.getContainer();
          if (container && container.contains(anchor)) {
            handleSelectionChange(e as any, "def");
            return;
          }
        }
      };

      window.addEventListener('mouseup', handleGlobalMouseUp);
      return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, [isEditingTerm, isEditingDef, wysiwyg]);

    const applyFormat = (type: string, value?: string) => {
      if (!activeToolbarRef.current) return;

      const { field } = activeToolbarRef.current;
      const ref = field === 'term' ? termInputRef.current : defInputRef.current;

      if (ref) {
        saveHistory(); // Save before formatting
        ref.applyFormat(type, value);
      }

      // Keep toolbar open to allow multiple formats or color switching
      // It will close automatically when selection changes (collapse) or user types
    };

    // Auto-focus textarea when entering edit mode
    useEffect(() => {
      if (!isEditingDef) return;

      if (wysiwyg) {
        textareaRef.current?.focus();
        autoResizeTextarea(textareaRef.current);
        return;
      }

      if (defInputRef.current) {
        defInputRef.current.focus();
      }
    }, [isEditingDef, wysiwyg]);

    // Auto-focus term input when entering edit mode
    useEffect(() => {
      if (!isEditingTerm) return;

      if (wysiwyg) {
        termTextareaRef.current?.focus();
        autoResizeTextarea(termTextareaRef.current);
        return;
      }

      if (termInputRef.current) {
        termInputRef.current.focus();
      }
    }, [isEditingTerm, wysiwyg]);

    useEffect(() => {
      if (!wysiwyg) return;
      autoResizeTextarea(termTextareaRef.current);
    }, [row.term, wysiwyg]);

    useEffect(() => {
      if (!wysiwyg) return;
      autoResizeTextarea(textareaRef.current);
    }, [row.def, wysiwyg]);

    // Handle Term Keydown (Tab to Def)
    const handleTermKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLDivElement | HTMLTextAreaElement>) => {
      if (e.key === "Tab" && !e.shiftKey) {
        if (tabSelectsEverythingInBuilder) return;
        e.preventDefault();
        setIsEditingDef(true);
      }
      if (e.key === "Enter" && !e.shiftKey) {
        // keep default (newline)
      }
    };

    // Handle Definition Keydown (Bullets & Tab)
    const handleDefKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLDivElement | HTMLTextAreaElement>) => {
      if (e.key === "Enter") {
        // Auto-list handling for RichInput?
        // For now, let's keep it simple. RichInput splits text by divs/p logic.
        // Implementing auto-bullet in RichInput is complex without cursor control via ref exposed methods.
        // We'll skip auto-bullet logic for this iteration to prioritize highlighting stability.
      }

      if (e.key === "Tab" && !e.shiftKey) {
        if (tabSelectsEverythingInBuilder) return;
        e.preventDefault();
        // Def is the last field now.
        if (isLast) {
          onAddNext();
          return;
        }
        if (nextRowId) {
          onFocusRowTerm(nextRowId);
        }
      }
    };

    return (
      <div
        ref={innerRef}
        {...draggableProps}
        className={clsx(
          "relative group bg-panel border rounded-xl mb-6 shadow-sm transition-all",
          isDuplicate
            ? "border-red/70 bg-red/5 hover:border-red"
            : "border-outline hover:border-accent/50",
        )}
      >
        {/* Drag Handle - Floating Left */}
        <div
          {...dragHandleProps}
          className="absolute -left-10 top-1/2 -translate-y-1/2 text-muted hover:text-text cursor-grab active:cursor-grabbing p-1.5 rounded hover:bg-panel-2 transition-colors outline-none flex items-center justify-center opacity-40 group-hover:opacity-100"
          title="Drag to reorder"
        >
          <GripVertical size={20} />
        </div>

        {/* Card Header: ID & Actions */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-outline/50 bg-panel-2/30 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="text-xs font-bold text-accent font-mono select-none opacity-50">
              {index + 1}
            </div>
            {isDuplicate && (
              <div className="rounded-full border border-red/40 bg-red/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-red">
                Duplicate term
              </div>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Image Button (Only when Term Images are OFF) */}
            {!enableTermCards && (
              <>
                {sanitizeImageUrl(row.image) ? (
                  <button
                    onClick={() => onOpenImageModal(row.id, 'image')}
                    className="w-[26px] h-[26px] rounded overflow-hidden border border-accent/30 hover:border-accent transition-colors flex-shrink-0"
                    title="Change Image"
                  >
                    <img
                      src={sanitizeImageUrl(row.image)}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </button>
                ) : (
                  <button
                    onClick={() => onOpenImageModal(row.id, 'image')}
                    className={clsx(
                      "p-1.5 rounded-lg transition-colors text-muted hover:text-text hover:bg-panel-2 border border-transparent",
                    )}
                    title="Add Image"
                  >
                    <ImageIcon size={14} />
                  </button>
                )}
              </>
            )}

            <button
              onClick={() => onDuplicate(row.id)}
              className={clsx(
                "p-1.5 rounded-lg transition-colors text-muted hover:text-text hover:bg-panel-2 border border-transparent",
              )}
              title="Duplicate Card"
            >
              <Copy size={14} />
            </button>
            <button
              onClick={() => updateRow(row.id, "star", !row.star)}
              className={clsx(
                "p-1.5 rounded-lg transition-colors border border-transparent",
                row.star
                  ? "text-yellow bg-yellow/10 border-yellow/20"
                  : "text-muted hover:text-text hover:bg-panel-2",
              )}
              title="Star Card"
            >
              <div className={row.star ? "fill-current" : ""}>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill={row.star ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
              </div>
            </button>
            <button
              onClick={() => onSwap(row.id)}
              className={clsx(
                "p-1.5 rounded-lg transition-colors text-muted hover:text-text hover:bg-panel-2 border border-transparent",
              )}
              title="Swap Term & Definition"
            >
              <ArrowLeftRight size={14} />
            </button>

            <div className="w-px h-4 bg-outline/50 mx-1" />

            <button
              onClick={() => removeRow(row.id)}
              className={clsx(
                "p-1.5 rounded-lg transition-colors text-muted hover:text-red hover:bg-red/10 border border-transparent",
              )}
              title="Delete Row"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="p-6">


          {/* Main Content Grid */}
          {/* Main Content Grid - Standardized to match CardPreview */}
          <div className="flex flex-col md:flex-row gap-4 items-stretch">
            {/* Term Column */}
            <div
              className="relative group/term flex flex-col gap-3 flex-1 min-w-0"
              data-tour={index === 0 ? "builder-first-term" : undefined}
              data-tour-filled={index === 0 ? (row.term.trim() ? "true" : "false") : undefined}
            >
              <div className="flex items-center gap-2 ml-1 min-h-[24px]">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">
                  {termLabel}
                </label>
                {termData.category && (
                  <span className="inline-block bg-accent/10 border border-accent/20 text-accent px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">
                    {termData.category}
                  </span>
                )}
              </div>

              {isEditingTerm ? (
                <div className="bg-panel-2 border border-accent rounded-xl min-h-[50px] relative p-1 shadow-sm flex-1 flex h-full">
                  {wysiwyg ? (
                    <textarea
                      id={`term-${row.id}`}
                      ref={termTextareaRef}
                      value={row.term}
                      onChange={(e) => {
                        updateRow(row.id, "term", e.target.value);
                        autoResizeTextarea(e.currentTarget);
                      }}
                      onBlur={() => {
                        setToolbarVisible(false);
                        setIsEditingTerm(false);
                      }}
                      onKeyDown={handleTermKeyDown}
                      className="w-full bg-transparent border-none focus:outline-none px-4 py-3 text-base min-h-[40px] block leading-relaxed font-normal text-text resize-none overflow-hidden"
                      placeholder="Enter term..."
                    />
                  ) : (
                    <RichInput
                      id={`term-${row.id}`}
                      ref={termInputRef}
                      value={row.term}
                      onChange={(val) => updateRow(row.id, "term", val)}
                      onBlur={() => {
                        setToolbarVisible(false);
                        setIsEditingTerm(false);
                      }}
                      onMouseUp={(e) => handleSelectionChange(e, "term")}
                      onKeyUp={(e) => handleSelectionChange(e, "term")}
                      onKeyDown={handleTermKeyDown}
                      className="w-full bg-transparent border-none focus:outline-none px-4 py-3 text-base min-h-[40px] block leading-relaxed font-normal text-text h-full"
                      placeholder="Enter term..."
                    />
                  )}
                </div>
              ) : (
                <div
                  id={`term-${row.id}`}
                  tabIndex={0}
                  onFocus={() => {
                    saveHistory();
                    setToolbarVisible(false);
                    setIsEditingTerm(true);
                  }}
                  onClick={() => {
                    setToolbarVisible(false);
                    setIsEditingTerm(true);
                  }}
                  className={clsx(
                    "w-full min-h-[50px] px-4 py-3 text-base bg-panel-2 border rounded-xl cursor-text hover:border-accent/50 transition-colors focus:outline-none focus:border-accent leading-relaxed break-words font-normal flex-1 h-full",
                    row.term
                      ? "border-outline"
                      : "border-outline text-muted italic",
                    isDuplicate && "border-red/70 hover:border-red focus:border-red",
                  )}
                >
                  {row.term ? (wysiwyg ? termData.body : renderMarkdown(termData.body)) : "Enter term..."}
                </div>
              )}

              {/* Term Image Button */}
              {enableTermCards && (
                <div className="mt-2 flex justify-start">
                  {sanitizeImageUrl(row.termImage) ? (
                    <button
                      onClick={() => onOpenImageModal(row.id, 'termImage')}
                      className="w-[32px] h-[32px] rounded overflow-hidden border border-accent/30 hover:border-accent transition-colors flex-shrink-0"
                      title="Change Term Image"
                    >
                      <img
                        src={sanitizeImageUrl(row.termImage)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ) : (
                    <button
                      onClick={() => onOpenImageModal(row.id, 'termImage')}
                      className="p-1.5 rounded-lg transition-colors border border-outline text-muted hover:text-text hover:bg-panel-2 text-xs flex items-center gap-1"
                      title="Add Term Image"
                    >
                      <ImageIcon size={14} />
                    </button>
                  )}
                </div>
              )}

              {/* Term Side Custom Fields & Year */}
              {(showYear || termSideFields.length > 0) && (
                <div className="mt-4 space-y-4">
                  {showYear && (
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                      <label className="text-xs font-bold text-muted uppercase tracking-wider ml-1">
                        Year
                      </label>
                      <input
                        value={row.year}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "" || /^\d+$/.test(val)) {
                            updateRow(row.id, "year", val);
                          }
                        }}
                        placeholder="Year..."
                        className="w-full bg-panel-2 border border-outline rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors placeholder:text-muted/50"
                      />
                    </div>
                  )}
                  {termSideFields.map((field) => (
                    <CustomFieldInput
                      key={`term-${field.name}`}
                      field={field}
                      row={row}
                      updateRow={updateRow}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Divider (Desktop only) */}
            <div className="hidden md:block w-px bg-outline self-stretch" />

            {/* Definition Column */}
            <div
              className="relative group/def flex flex-col gap-3 flex-1 min-w-0"
              data-tour={index === 0 ? "builder-first-definition" : undefined}
              data-tour-filled={index === 0 ? (row.def.trim() ? "true" : "false") : undefined}
            >
              <div className="flex items-center gap-2 mr-1 justify-end min-h-[24px]">
                <label className="text-xs font-bold text-muted uppercase tracking-wider">
                  {definitionLabel}
                </label>
                {defData.category && (
                  <span className="inline-block bg-accent/10 border border-accent/20 text-accent px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">
                    {defData.category}
                  </span>
                )}
              </div>
              {isEditingDef ? (
                <div className="bg-panel-2 border border-accent rounded-xl min-h-[50px] relative p-1 shadow-sm flex-1 flex h-full">
                  {wysiwyg ? (
                    <textarea
                      ref={textareaRef}
                      value={row.def}
                      onChange={(e) => {
                        updateRow(row.id, "def", e.target.value);
                        autoResizeTextarea(e.currentTarget);
                      }}
                      onBlur={() => {
                        setToolbarVisible(false);
                        setIsEditingDef(false);
                      }}
                      onKeyDown={handleDefKeyDown}
                      className="w-full bg-transparent border-none focus:outline-none px-4 py-3 text-base min-h-[40px] block leading-relaxed font-normal text-text resize-none overflow-hidden"
                      placeholder="Enter definition..."
                    />
                  ) : (
                    <RichInput
                      ref={defInputRef}
                      value={row.def}
                      onChange={(val) => updateRow(row.id, "def", val)}
                      onBlur={() => {
                        setToolbarVisible(false);
                        setIsEditingDef(false);
                      }}
                      onMouseUp={(e) => handleSelectionChange(e, "def")}
                      onKeyUp={(e) => handleSelectionChange(e, "def")}
                      onKeyDown={handleDefKeyDown}
                      className="w-full bg-transparent border-none focus:outline-none px-4 py-3 text-base min-h-[40px] block leading-relaxed font-normal text-text h-full"
                      placeholder="Enter definition..."
                    />
                  )}
                </div>
              ) : (
                <div
                  tabIndex={0}
                  onFocus={() => {
                    saveHistory();
                    setToolbarVisible(false);
                    setIsEditingDef(true);
                  }}
                  onClick={() => {
                    setToolbarVisible(false);
                    setIsEditingDef(true);
                  }}
                  className={clsx(
                    "w-full min-h-[50px] px-4 py-3 text-base bg-panel-2 border rounded-xl cursor-text hover:border-accent/50 transition-colors focus:outline-none focus:border-accent leading-relaxed break-words font-normal text-text flex-1 h-full",
                    row.def
                      ? "border-outline"
                      : "border-outline text-muted italic",
                  )}
                >
                  {row.def
                    ? (wysiwyg ? defData.body : renderMarkdown(defData.body))
                    : "Enter definition..."}
                </div>
              )}

              {/* Definition Image Button (Only if Term Images are ON) */}
              {enableTermCards && (
                <div className="mt-2 flex justify-start">
                  {sanitizeImageUrl(row.image) ? (
                    <button
                      onClick={() => onOpenImageModal(row.id, 'image')}
                      className="w-[32px] h-[32px] rounded overflow-hidden border border-accent/30 hover:border-accent transition-colors flex-shrink-0"
                      title="Change Definition Image"
                    >
                      <img
                        src={sanitizeImageUrl(row.image)}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ) : (
                    <button
                      onClick={() => onOpenImageModal(row.id, 'image')}
                      className="p-1.5 rounded-lg transition-colors border border-outline text-muted hover:text-text hover:bg-panel-2 text-xs flex items-center gap-1"
                      title="Add Definition Image"
                    >
                      <ImageIcon size={14} />
                    </button>
                  )}
                </div>
              )}

              {/* Def Side Custom Fields */}
              {defSideFields.length > 0 && (
                <div className="mt-4 space-y-4">
                  {defSideFields.map((field) => (
                    <CustomFieldInput
                      key={`def-${field.name}`}
                      field={field}
                      row={row}
                      updateRow={updateRow}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>


        </div>
        <FloatingToolbar
          visible={!wysiwyg && toolbarVisible}
          position={toolbarPos}
          onFormat={applyFormat}
        />
      </div>
    );
  },
);

const CustomFieldInput: React.FC<{
  field: CustomFieldDefinition;
  row: BuilderRow;
  updateRow: (id: string, field: keyof BuilderRow, value: any) => void;
}> = ({ field, row, updateRow }) => {
  const val =
    row.customFields.find((f) => f.name === field.name)?.value || "";

  const handleCustomChange = (newValue: string) => {
    const newFields = row.customFields.filter(
      (f) => f.name !== field.name,
    );
    if (newValue || field.type === "ab" || field.type === "tf") {
      newFields.push({ name: field.name, value: newValue });
    }
    updateRow(row.id, "customFields", newFields);
  };

  if (field.type === "ab" || field.type === "tf") {
    const isTF = field.type === "tf";
    const optionA = isTF ? "True" : field.options?.a || "A";
    const optionB = isTF ? "False" : field.options?.b || "B";
    const isA = val === optionA;
    const isB = val === optionB;

    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label
          className="text-xs font-bold text-muted uppercase tracking-wider ml-1 truncate"
          title={field.name}
        >
          {field.name}
        </label>
        <div className="flex flex-row gap-1.5 w-full bg-transparent p-0 relative">
          <button
            onClick={() => handleCustomChange(optionA)}
            className={clsx(
              "flex-1 text-center px-2 py-2 rounded-lg border text-sm transition-all font-medium leading-relaxed break-words whitespace-normal min-w-0",
              val === optionA
                ? "bg-accent border-accent text-bg shadow-sm"
                : "bg-panel-2 border-outline text-text hover:border-accent/50"
            )}
            title={optionA}
          >
            {optionA}
          </button>

          <button
            onClick={() => handleCustomChange("")}
            className={clsx(
              "flex-shrink-0 flex items-center justify-center px-3 py-2 rounded-lg border text-sm transition-all font-medium",
              !val || (val !== optionA && val !== optionB)
                ? "bg-accent/10 border-accent text-accent shadow-sm"
                : "bg-panel-2 border-transparent text-muted hover:text-text hover:bg-panel-2"
            )}
            title="Clear Selection"
          >
            <Minus size={14} strokeWidth={2.5} />
          </button>

          <button
            onClick={() => handleCustomChange(optionB)}
            className={clsx(
              "flex-1 text-center px-2 py-2 rounded-lg border text-sm transition-all font-medium leading-relaxed break-words whitespace-normal min-w-0",
              val === optionB
                ? "bg-accent border-accent text-bg shadow-sm"
                : "bg-panel-2 border-outline text-text hover:border-accent/50"
            )}
            title={optionB}
          >
            {optionB}
          </button>
        </div>
      </div>
    );
  }

  // Text / Number
  const isInvalidNumber =
    field.type === "number" && val !== "" && isNaN(Number(val));

  return (
    <div className="flex flex-col gap-2 relative group/field">
      <label className="text-xs font-bold text-muted uppercase tracking-wider ml-1 flex justify-between items-center truncate">
        <span title={field.name}>{field.name}</span>
        {isInvalidNumber && (
          <span className="text-white bg-red px-1.5 py-0.5 rounded text-[9px] uppercase font-bold tracking-wide animate-pulse shadow-sm shadow-red/20">
            #
          </span>
        )}
      </label>
      <input
        value={val}
        onChange={(e) => handleCustomChange(e.target.value)}
        placeholder={field.name}
        className={clsx(
          "w-full bg-panel-2 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-accent transition-colors placeholder:text-muted/50",
          isInvalidNumber
            ? "border-red text-red focus:border-red"
            : "border-outline",
        )}
        title={isInvalidNumber ? "Numbers only" : field.name}
      />
    </div>
  );
};

export const StartMenu: React.FC<StartMenuProps> = ({
  isCloudLoading,
  librarySets,
  onStartFromLibrary,
  onResumeSession,
  onSaveToLibrary,
  onDeleteLibrarySet,
  onDeleteSession,
  onOpenSet,
  settings,
  onUpdateSettings,
  lifetimeCorrect,
  onDuplicateLibrarySet,
  setLibrarySets,
  folders,
  setFolders,
  initialEditSetId,
  onClearEditRequest,
  onUploadImage,
  tags,
  onUpdateTags,
  appliedTags,
  setAppliedTags,
  onOpenSettings,
  uiAuditRequest,
  onUiAuditHandled,
  onHomeScreenActiveChange,
  homeNavigationNonce,
  hasCompletedOnboarding = false,
  onStartOnboardingTour,
  signedInUserName,
}) => {
  const topAnchorRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<"menu" | "builder" | "raw-text">("menu");
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [showAddSetModal, setShowAddSetModal] = useState(false);
  const [builderMode, setBuilderMode] = useState<"visual" | "raw">("visual"); // Deprecated?
  const [wysiwyg, setWysiwyg] = useState(false);
  const [showWysiwygHelp, setShowWysiwygHelp] = useState(false);
  const [showMarkdownHelp, setShowMarkdownHelp] = useState(false);
  const modKeyLabel = getModifierKeyLabel();
  const isMac = isMacPlatform();

  useEffect(() => {
    if (onHomeScreenActiveChange) {
      onHomeScreenActiveChange(view === "menu");
    }
  }, [view, onHomeScreenActiveChange]);

  // V2 Set Configuration State
  const [termLabel, setTermLabel] = useState("Term");
  const [definitionLabel, setDefinitionLabel] = useState("Definition");
  const [termSideFields, setTermSideFields] = useState<CustomFieldDefinition[]>(
    [],
  );
  const [defSideFields, setDefSideFields] = useState<CustomFieldDefinition[]>(
    [],
  );
  const [showYear, setShowYear] = useState(false);
  const [enableTermCards, setEnableTermCards] = useState(false);

  // UI State for Config Modal
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [configModalMode, setConfigModalMode] = useState<"config" | "import">("config");

  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const [showInvalidFileModal, setShowInvalidFileModal] = useState(false);

  // Image Modal State
  const [showImageModal, setShowImageModal] = useState(false);
  const [editingImageRowId, setEditingImageRowId] = useState<string | null>(
    null,
  );
  const [editingImageField, setEditingImageField] = useState<'image' | 'termImage'>('image');

  const [editingSetId, setEditingSetId] = useState<string | null>(null);

  // Warning Modal State
  const [warningModal, setWarningModal] = useState<{
    isOpen: boolean;
    message: string;
    onConfirm: () => void;
  }>({ isOpen: false, message: "", onConfirm: () => { } });
  const [noStarredModalSet, setNoStarredModalSet] = useState<CardSet | null>(
    null,
  );
  const [moveToLocalModal, setMoveToLocalModal] = useState<{
    setId: string;
    setName: string;
    toLocal: boolean;
  } | null>(null);




  // Builder State
  const [builderRows, setBuilderRows] = useState<BuilderRow[]>(() => {
    const saved = localStorage.getItem(BUILDER_STORAGE_KEY);
    try {
      return saved
        ? JSON.parse(saved)
        : [
          {
            id: "1",
            term: "",
            def: "",
            year: "",
            image: "",
            termImage: "",
            customFields: [],
            tags: [],
            star: false,
          },
          {
            id: "2",
            term: "",
            def: "",
            year: "",
            image: "",
            termImage: "",
            customFields: [],
            tags: [],
            star: false,
          },
          {
            id: "3",
            term: "",
            def: "",
            year: "",
            image: "",
            termImage: "",
            customFields: [],
            tags: [],
            star: false,
          },
        ];
    } catch {
      return [
        {
          id: "1",
          term: "",
          def: "",
          year: "",
          image: "",
          termImage: "",
          customFields: [],
          tags: [],
          star: false,
        },
        {
          id: "2",
          term: "",
          def: "",
          year: "",
          image: "",
          termImage: "",
          customFields: [],
          tags: [],
          star: false,
        },
        {
          id: "3",
          term: "",
          def: "",
          year: "",
          image: "",
          termImage: "",
          customFields: [],
          tags: [],
          star: false,
        },
      ];
    }
  });

  // Undo/Redo System
  const [past, setPast] = useState<BuilderRow[][]>([]);
  const [future, setFuture] = useState<BuilderRow[][]>([]);
  const builderRowsRef = useRef(builderRows);

  useEffect(() => {
    builderRowsRef.current = builderRows;
  }, [builderRows]);

  const saveToHistory = useCallback(() => {
    setPast((prev) => {
      // Dedup check: if current state is same as last saved state, don't save
      if (prev.length > 0) {
        const lastState = prev[prev.length - 1];
        if (JSON.stringify(lastState) === JSON.stringify(builderRowsRef.current)) {
          return prev;
        }
      }

      const newHistory = [...prev, builderRowsRef.current];
      // Cap history at 30
      if (newHistory.length > 30) {
        return newHistory.slice(newHistory.length - 30);
      }
      return newHistory;
    });
    setFuture([]);
  }, []);

  const undo = useCallback(() => {
    setPast((prev) => {
      if (prev.length === 0) return prev;
      const newPast = [...prev];
      const previous = newPast.pop();
      if (previous) {
        setFuture((f) => [builderRowsRef.current, ...f]);
        setBuilderRows(previous);
      }
      return newPast;
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((prev) => {
      if (prev.length === 0) return prev;
      const newFuture = [...prev];
      const next = newFuture.shift();
      if (next) {
        setPast((p) => [...p, builderRowsRef.current]);
        setBuilderRows(next);
      }
      return newFuture;
    });
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (view !== "builder") return;

      const modKeyPressed = isMac ? e.metaKey : e.ctrlKey;
      if (modKeyPressed && (e.key === "z" || e.key === "Z")) {
        const isInput = (e.target as HTMLElement).matches(
          'input, textarea, [contenteditable="true"]',
        );
        if (isInput) return;

        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      }
      if (modKeyPressed && (e.key === "y" || e.key === "Y")) {
        const isInput = (e.target as HTMLElement).matches(
          'input, textarea, [contenteditable="true"]',
        );
        if (isInput) return;
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [view, undo, redo, isMac]);
  const [rawText, setRawText] = useState("");
  const [setName, setSetName] = useState("");

  // Tooltip State for Disabled Buttons
  const [hoveredButton, setHoveredButton] = useState<"save" | "study" | null>(
    null,
  );

  const missingRequirements = useMemo(() => {
    const list: string[] = [];
    if (!setName.trim()) list.push("Add a set name");

    let hasCards = false;
    if (builderMode === "visual") {
      hasCards = builderRows.some((r) => r.term.trim() || r.def.trim());
    } else {
      hasCards = rawText.trim().length > 0;
    }

    if (!hasCards) list.push("Add at least one term");

    return list;
  }, [setName, builderRows, builderMode, rawText]);

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) {
      return;
    }

    const items = Array.from(builderRows);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    saveToHistory();
    setBuilderRows(items);
  };

  // Custom Fields Dropdown State
  const [isCustomFieldsOpen, setIsCustomFieldsOpen] = useState(false);
  const customFieldsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        customFieldsRef.current &&
        !customFieldsRef.current.contains(event.target as Node)
      ) {
        setIsCustomFieldsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus Management for new rows
  const prevRowCount = useRef(builderRows.length);
  useEffect(() => {
    if (builderRows.length > prevRowCount.current) {
      // Row added, find the last row's term input and focus it
      const lastRow = builderRows[builderRows.length - 1];
      const el = document.getElementById(`term-${lastRow.id}`);
      if (el) el.focus();
    }
    prevRowCount.current = builderRows.length;
  }, [builderRows.length]);

  // Delete Confirmation State
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [ongoingDeleteConfirmId, setOngoingDeleteConfirmId] = useState<
    string | null
  >(null);
  const [selectedSetIds, setSelectedSetIds] = useState<Set<string>>(new Set());
  const [batchDeleteClicks, setBatchDeleteClicks] = useState(0);

  // Folder State
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [deleteFolderModal, setDeleteFolderModal] = useState<{
    id: string;
    name: string;
    count: number;
  } | null>(null);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState("");
  const [movingSetId, setMovingSetId] = useState<string | null>(null);
  const [draggingSelectedSetIds, setDraggingSelectedSetIds] = useState<string[] | null>(null);
  const [folderDropTargetId, setFolderDropTargetId] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] =
    useState<Folder["color"]>("brown");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [librarySearchQuery, setLibrarySearchQuery] = useState("");
  const [librarySortMode, setLibrarySortMode] = useState<"recent" | "name_asc" | "name_desc" | "cards_desc">("recent");
  const [isLibrarySortOpen, setIsLibrarySortOpen] = useState(false);
  const [activeLibraryTagFilter, setActiveLibraryTagFilter] = useState<string | null>(null);
  const librarySortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (view === "menu") {
      setCurrentFolderId(null);
    }
    setIsLibrarySortOpen(false);
  }, [homeNavigationNonce, view]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        librarySortRef.current &&
        !librarySortRef.current.contains(event.target as Node)
      ) {
        setIsLibrarySortOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside, true);
    return () => document.removeEventListener("mousedown", handleClickOutside, true);
  }, []);

  useEffect(() => {
    if (!isLibrarySortOpen) return;
    const closeSort = () => setIsLibrarySortOpen(false);
    window.addEventListener("scroll", closeSort, true);
    return () => window.removeEventListener("scroll", closeSort, true);
  }, [isLibrarySortOpen]);

  useEffect(() => {
    if (!uiAuditRequest) return;

    const sampleSet: CardSet = librarySets[0]
      ? { ...librarySets[0], id: UI_AUDIT_ID, name: `${librarySets[0].name} (Preview)` }
      : {
        id: UI_AUDIT_ID,
        name: "Sample Set",
        cards: [],
        lastPlayed: Date.now(),
        elapsedTime: 0,
        topStreak: 0,
      };

    switch (uiAuditRequest.type) {
      case "add-set":
        setShowAddSetModal(true);
        break;
      case "set-config":
        setConfigModalMode("config");
        setIsConfigModalOpen(true);
        break;
      case "raw-import":
        setConfigModalMode("import");
        setIsConfigModalOpen(true);
        break;
      case "unsaved-changes":
        setShowUnsavedModal(true);
        break;
      case "delete-folder":
        setDeleteFolderModal({ id: UI_AUDIT_ID, name: "Sample Folder", count: 3 });
        break;
      case "image-modal":
        setEditingImageRowId(null);
        setEditingImageField("image");
        setShowImageModal(true);
        break;
      case "warning-modal":
        setWarningModal({
          isOpen: true,
          message: "This is a preview of the warning modal. No actions will be taken.",
          onConfirm: () => setWarningModal((prev) => ({ ...prev, isOpen: false })),
        });
        break;
      case "invalid-file":
        setShowInvalidFileModal(true);
        break;
      case "no-starred":
        setNoStarredModalSet(sampleSet);
        break;
      case "markdown-help":
        setShowMarkdownHelp(true);
        break;
      case "create-folder":
        setIsCreatingFolder(true);
        break;
      case "move-to-local":
        setMoveToLocalModal({
          setId: UI_AUDIT_ID,
          setName: "Sample Set",
          toLocal: true,
        });
        break;
      default:
        break;
    }

    onUiAuditHandled?.();
  }, [uiAuditRequest, librarySets, onUiAuditHandled]);
  const [moveToMenuOpen, setMoveToMenuOpen] = useState(false);

  // === AUTOSAVE STATE ===
  const [autosaveStatus, setAutosaveStatus] = useState<'idle' | 'saving' | 'saved' | 'saved_faded'>('idle');
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveFadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showDraftRecoveryBanner, setShowDraftRecoveryBanner] = useState(false);
  const [showOnboardingPromptBanner, setShowOnboardingPromptBanner] = useState(false);
  const draftRecoveryDataRef = useRef<AutosaveDraft | null>(null);

  // Autosave: save draft to localStorage (debounced - 2s after last change)
  useEffect(() => {
    // Only autosave when in builder or raw-text view
    if (view !== "builder" && view !== "raw-text") return;

    // Check if there's actually content worth saving
    const hasContent = builderRows.some((r) => r.term.trim() || r.def.trim()) || rawText.trim().length > 0;
    if (!hasContent && !setName.trim()) return;

    if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);

    autosaveTimeoutRef.current = setTimeout(() => {
      const draft: AutosaveDraft = {
        builderRows,
        setName,
        termLabel,
        definitionLabel,
        termSideFields,
        defSideFields,
        showYear,
        enableTermCards,
        editingSetId,
        appliedTags,
        rawText,
        builderMode,
        savedAt: Date.now(),
      };
      try {
        localStorage.setItem(AUTOSAVE_DRAFT_KEY, JSON.stringify(draft));
        setAutosaveStatus('saved');

        // Fade after 3 seconds
        if (autosaveFadeTimeoutRef.current) clearTimeout(autosaveFadeTimeoutRef.current);
        autosaveFadeTimeoutRef.current = setTimeout(() => setAutosaveStatus('saved_faded'), 3000);
      } catch (e) {
        console.warn('[Autosave] Failed to save draft:', e);
      }
    }, 2000);

    // Show "saving" indicator immediately on change
    setAutosaveStatus('saving');

    return () => {
      if (autosaveTimeoutRef.current) clearTimeout(autosaveTimeoutRef.current);
    };
  }, [view, builderRows, setName, termLabel, definitionLabel, termSideFields, defSideFields, showYear, enableTermCards, editingSetId, appliedTags, rawText, builderMode]);

  // Autosave: immediate save on beforeunload (safety net for tab close / battery die)
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (view !== "builder" && view !== "raw-text") return;
      const hasContent = builderRows.some((r) => r.term.trim() || r.def.trim()) || rawText.trim().length > 0;
      if (!hasContent && !setName.trim()) return;

      const draft: AutosaveDraft = {
        builderRows,
        setName,
        termLabel,
        definitionLabel,
        termSideFields,
        defSideFields,
        showYear,
        enableTermCards,
        editingSetId,
        appliedTags,
        rawText,
        builderMode,
        savedAt: Date.now(),
      };
      try {
        localStorage.setItem(AUTOSAVE_DRAFT_KEY, JSON.stringify(draft));
      } catch (e) {
        // Best effort
      }

      // Guard against closing while work is still in the builder.
      e.preventDefault();
      e.returnValue = '';
      return '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [view, builderRows, setName, termLabel, definitionLabel, termSideFields, defSideFields, showYear, enableTermCards, editingSetId, appliedTags, rawText, builderMode]);

  // Autosave: check for recoverable draft on component mount
  useEffect(() => {
    try {
      const savedDraft = localStorage.getItem(AUTOSAVE_DRAFT_KEY);
      if (savedDraft) {
        const draft: AutosaveDraft = JSON.parse(savedDraft);
        // Only offer recovery if draft has actual content and is less than 7 days old
        const hasContent = draft.builderRows?.some((r) => r.term?.trim() || r.def?.trim()) || draft.rawText?.trim()?.length > 0;
        const isRecent = Date.now() - draft.savedAt < 7 * 24 * 60 * 60 * 1000;
        if (hasContent && isRecent) {
          draftRecoveryDataRef.current = draft;
          setShowDraftRecoveryBanner(true);
        } else {
          // Old or empty draft, clean up
          localStorage.removeItem(AUTOSAVE_DRAFT_KEY);
        }
      }
    } catch (e) {
      console.warn('[Autosave] Failed to parse draft:', e);
      localStorage.removeItem(AUTOSAVE_DRAFT_KEY);
    }
  }, []);

  // Autosave helper: clear the saved draft
  const clearAutosaveDraft = useCallback(() => {
    localStorage.removeItem(AUTOSAVE_DRAFT_KEY);
    setAutosaveStatus('idle');
    setShowDraftRecoveryBanner(false);
    draftRecoveryDataRef.current = null;
  }, []);

  // Autosave: recover draft into builder
  const recoverDraft = useCallback(() => {
    const draft = draftRecoveryDataRef.current;
    if (!draft) return;

    setBuilderRows(draft.builderRows || []);
    setSetName(draft.setName || "");
    setTermLabel(draft.termLabel || "Term");
    setDefinitionLabel(draft.definitionLabel || "Definition");
    setTermSideFields(draft.termSideFields || []);
    setDefSideFields(draft.defSideFields || []);
    setShowYear(draft.showYear || false);
    setEnableTermCards(draft.enableTermCards || false);
    setEditingSetId(draft.editingSetId || null);
    setAppliedTags(draft.appliedTags || []);
    setRawText(draft.rawText || "");
    setBuilderMode(draft.builderMode || "visual");
    setView("builder");
    setShowDraftRecoveryBanner(false);
  }, [setAppliedTags]);

  useEffect(() => {
    if (hasCompletedOnboarding) {
      setShowOnboardingPromptBanner(false);
      return;
    }

    try {
      const dismissed = localStorage.getItem(ONBOARDING_PROMPT_DISMISSED_KEY) === "true";
      setShowOnboardingPromptBanner(!dismissed);
    } catch (e) {
      setShowOnboardingPromptBanner(true);
    }
  }, [hasCompletedOnboarding]);

  const dismissOnboardingPromptForSession = useCallback(() => {
    setShowOnboardingPromptBanner(false);
  }, []);

  const dismissOnboardingPromptPermanently = useCallback(() => {
    try {
      localStorage.setItem(ONBOARDING_PROMPT_DISMISSED_KEY, "true");
    } catch (e) {
      // Best effort
    }
    setShowOnboardingPromptBanner(false);
  }, []);

  // Loading State for "Load Everything" strategy
  const [isBuilderReady, setIsBuilderReady] = useState(false);

  useEffect(() => {
    if (view === "builder" && builderMode === "visual") {
      setIsBuilderReady(false);
      // Give browser a moment to render the loader before blasting the DOM with rows
      const timer = setTimeout(() => {
        setIsBuilderReady(true);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setIsBuilderReady(true);
    }
  }, [view, builderMode, editingSetId]);

  useEffect(() => {
    if (view !== "builder" && view !== "raw-text") return;

    const frame = window.requestAnimationFrame(() => {
      topAnchorRef.current?.scrollIntoView({ block: "start" });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [view, editingSetId]);

  // Handle edit request from SetDetail
  useEffect(() => {
    if (initialEditSetId && onClearEditRequest) {
      const setToEdit = librarySets.find((s) => s.id === initialEditSetId);
      if (setToEdit) {
        handleLoadSetToBuilder(setToEdit);
        onClearEditRequest();
      }
    }
  }, [initialEditSetId]);

  // Close move menu when selection is cleared
  useEffect(() => {
    if (selectedSetIds.size === 0) {
      setMoveToMenuOpen(false);
    }
  }, [selectedSetIds.size]);

  // Derived Lists
  const currentFolder = folders.find((f) => f.id === currentFolderId);
  const tagsById = useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]);
  const normalizedLibrarySearch = librarySearchQuery.trim().toLowerCase();
  const includeAllSetsAtRoot =
    !currentFolderId && (normalizedLibrarySearch.length > 0 || !!activeLibraryTagFilter);

  // If in a folder, show sets in that folder.
  // If at root, show root sets (no folderId) AND folders.
  // Multistudy sets are always at root in their own section.

  // Separate local and cloud sets
  const rootCloudSets = includeAllSetsAtRoot
    ? librarySets.filter((s) => !s.isMultistudy && !s.isLocalOnly)
    : librarySets.filter((s) => !s.isMultistudy && !s.folderId && !s.isLocalOnly);
  const rootLocalSets = librarySets.filter((s) => !s.isMultistudy && s.isLocalOnly);

  const cloudSets = currentFolderId
    ? librarySets.filter((s) => s.folderId === currentFolderId && !s.isLocalOnly)
    : rootCloudSets;

  const localSets = currentFolderId ? [] : rootLocalSets;

  const setMatchesLibraryFilters = useCallback(
    (set: CardSet): boolean => {
      if (activeLibraryTagFilter && !(set.tags || []).includes(activeLibraryTagFilter)) {
        return false;
      }

      if (!normalizedLibrarySearch) return true;

      const matchesName = set.name.toLowerCase().includes(normalizedLibrarySearch);
      if (matchesName) return true;

      const matchesTagName = (set.tags || []).some((tagId) =>
        tagsById.get(tagId)?.name?.toLowerCase().includes(normalizedLibrarySearch)
      );

      return matchesTagName;
    },
    [activeLibraryTagFilter, normalizedLibrarySearch, tagsById]
  );

  const sortLibrarySets = useCallback(
    (sets: CardSet[]): CardSet[] => {
      const sorted = [...sets];
      switch (librarySortMode) {
        case "name_asc":
          sorted.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
          break;
        case "name_desc":
          sorted.sort((a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: "base" }));
          break;
        case "cards_desc":
          sorted.sort((a, b) => b.cards.length - a.cards.length || b.lastPlayed - a.lastPlayed);
          break;
        case "recent":
        default:
          sorted.sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));
          break;
      }
      return sorted;
    },
    [librarySortMode]
  );

  // For compatibility, displayedSets shows cloud sets by default
  const displayedSets = sortLibrarySets(cloudSets.filter(setMatchesLibraryFilters));
  const displayedLocalSets = sortLibrarySets(localSets.filter(setMatchesLibraryFilters));

  const displayedFolders = currentFolderId || includeAllSetsAtRoot ? [] : folders;
  const allVisibleSetIds = [...displayedSets, ...displayedLocalSets].map((set) => set.id);
  const selectedVisibleCount = allVisibleSetIds.filter((id) => selectedSetIds.has(id)).length;
  const activeTag = activeLibraryTagFilter ? tagsById.get(activeLibraryTagFilter) : undefined;
  const selectedLibrarySortOption = LIBRARY_SORT_OPTIONS.find((option) => option.value === librarySortMode) || LIBRARY_SORT_OPTIONS[0];

  const formatLastStudied = (timestamp?: number): string => {
    if (!timestamp || timestamp <= 0) return "Never studied";

    const diff = Date.now() - timestamp;
    if (diff < 60_000) return "Last studied just now";
    if (diff < 3_600_000) {
      const mins = Math.floor(diff / 60_000);
      return `Last studied ${mins} minute${mins === 1 ? "" : "s"} ago`;
    }
    if (diff < 86_400_000) {
      const hours = Math.floor(diff / 3_600_000);
      return `Last studied ${hours} hour${hours === 1 ? "" : "s"} ago`;
    }
    const days = Math.floor(diff / 86_400_000);
    return `Last studied ${days} day${days === 1 ? "" : "s"} ago`;
  };

  const multistudySets = librarySets.filter((s) => s.isMultistudy);

  // Ongoing Sessions - filter for active sessions and sort by most recent
  const ongoingSessions = librarySets
    .filter((s) => s.isSessionActive)
    .sort((a, b) => (b.lastPlayed || 0) - (a.lastPlayed || 0));

  // Selection Logic
  const handleToggleSelect = (id: string) => {
    const newSet = new Set(selectedSetIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedSetIds(newSet);
    setBatchDeleteClicks(0);
  };

  const handleSelectAll = () => {
    if (allVisibleSetIds.length === 0) return;

    const next = new Set(selectedSetIds);
    const isAllVisibleSelected = selectedVisibleCount === allVisibleSetIds.length;

    if (isAllVisibleSelected) {
      allVisibleSetIds.forEach((id) => next.delete(id));
    } else {
      allVisibleSetIds.forEach((id) => next.add(id));
    }

    setSelectedSetIds(next);
  };

  const handleCreateFolder = () => {
    setNewFolderColor("brown");
    setIsCreatingFolder(true);
  };

  const focusRowTerm = useCallback((rowId: string) => {
    window.requestAnimationFrame(() => {
      const el = document.getElementById(`term-${rowId}`) as HTMLElement | null;
      if (el) el.focus();
    });
  }, []);

  const confirmCreateFolder = (color: Folder["color"] = "brown") => {
    const newFolder: Folder = {
      id: generateId(),
      name: newFolderName || "New Folder",
      color,
      setIds: Array.from(selectedSetIds),
    };

    setFolders((prev) => [...prev, newFolder]);
    setLibrarySets((prev) =>
      prev.map((s) =>
        selectedSetIds.has(s.id) ? { ...s, folderId: newFolder.id } : s,
      ),
    );

    setSelectedSetIds(new Set());
    setNewFolderName("");
    setIsCreatingFolder(false);
  };

  const handleMoveSet = (setId: string, folderId: string | undefined) => {
    setLibrarySets((prev) =>
      prev.map((s) => (s.id === setId ? { ...s, folderId } : s)),
    );
    setMovingSetId(null);
  };

  const moveSetIdsToFolder = useCallback(
    (setIds: Iterable<string>, folderId: string | undefined) => {
      const setIdLookup = new Set(setIds);
      if (setIdLookup.size === 0) return;
      setLibrarySets((prev) =>
        prev.map((s) => (setIdLookup.has(s.id) ? { ...s, folderId } : s)),
      );
    },
    [setLibrarySets],
  );

  const handleDeleteFolder = (folderId: string) => {
    const folderSets = librarySets.filter((s) => s.folderId === folderId);
    if (folderSets.length > 0) {
      const folder = folders.find((f) => f.id === folderId);
      if (folder) {
        setDeleteFolderModal({
          id: folderId,
          name: folder.name,
          count: folderSets.length,
        });
      }
      return;
    }

    // Empty folder, just delete
    setFolders((prev) => prev.filter((f) => f.id !== folderId));
    if (currentFolderId === folderId) setCurrentFolderId(null);
  };

  const confirmDeleteFolder = (action: "move" | "delete") => {
    if (!deleteFolderModal) return;
    if (deleteFolderModal.id === UI_AUDIT_ID) {
      setDeleteFolderModal(null);
      return;
    }

    if (action === "move") {
      // Move sets to library (remove folderId)
      setLibrarySets((prev) =>
        prev.map((s) =>
          s.folderId === deleteFolderModal.id
            ? { ...s, folderId: undefined }
            : s,
        ),
      );
    } else {
      // Delete sets
      const setsToDelete = librarySets
        .filter((s) => s.folderId === deleteFolderModal.id)
        .map((s) => s.id);
      setsToDelete.forEach((id) => onDeleteLibrarySet(id));
    }

    setFolders((prev) => prev.filter((f) => f.id !== deleteFolderModal.id));
    if (currentFolderId === deleteFolderModal.id) setCurrentFolderId(null);
    setDeleteFolderModal(null);
  };

  const handleStartRenameFolder = (folder: Folder) => {
    setEditingFolderId(folder.id);
    setEditingFolderName(folder.name);
  };

  const handleSaveRenameFolder = () => {
    if (editingFolderId && editingFolderName.trim()) {
      setFolders((prev) =>
        prev.map((f) =>
          f.id === editingFolderId
            ? { ...f, name: editingFolderName.trim() }
            : f,
        ),
      );
    }
    setEditingFolderId(null);
    setEditingFolderName("");
  };

  const handleMultistudyFolder = (folderId: string) => {
    const folderSets = librarySets.filter((s) => s.folderId === folderId);
    if (folderSets.length === 0) return;

    let newSet: CardSet = {
      id: generateId(),
      name: `Folder Study: ${folders.find((f) => f.id === folderId)?.name}`,
      cards: [],
      lastPlayed: Date.now(),
      elapsedTime: 0,
      topStreak: 0,
      isSessionActive: true,
      isMultistudy: true,
      sourceSetIds: folderSets.map((s) => s.id),
      customFieldNames: [],
    };

    const allCustomFields = new Set<string>();
    folderSets.forEach((s) =>
      s.customFieldNames?.forEach((n) => allCustomFields.add(n)),
    );
    newSet.customFieldNames = Array.from(allCustomFields);

    newSet = syncMultistudySet(newSet, librarySets);

    handlePlaySet(newSet);
  };

  const handleMoveSelectedToFolder = (folderId: string | undefined) => {
    moveSetIdsToFolder(selectedSetIds, folderId);
    setSelectedSetIds(new Set());
    setMovingSetId(null); // Close any move UI if open
    setMoveToMenuOpen(false); // Close the move menu
    setDraggingSelectedSetIds(null);
    setFolderDropTargetId(null);
  };

  const handleSelectedSetDragStart = (
    e: React.DragEvent<HTMLDivElement>,
    setId: string,
  ) => {
    const dragOrigin = e.target as HTMLElement;
    if (dragOrigin.closest("button, input, textarea, a")) {
      e.preventDefault();
      return;
    }

    if (selectedSetIds.size === 0 || !selectedSetIds.has(setId)) {
      e.preventDefault();
      return;
    }

    const draggedIds = Array.from(selectedSetIds);
    setDraggingSelectedSetIds(draggedIds);
    setFolderDropTargetId(null);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(
      "application/x-flashcardsish-set-ids",
      JSON.stringify(draggedIds),
    );
    e.dataTransfer.setData(
      "text/plain",
      `${draggedIds.length} set${draggedIds.length === 1 ? "" : "s"}`,
    );
  };

  const handleSelectedSetDragEnd = () => {
    setDraggingSelectedSetIds(null);
    setFolderDropTargetId(null);
  };

  const handleFolderDragOver = (
    e: React.DragEvent<HTMLDivElement>,
    folderId: string,
  ) => {
    if (!draggingSelectedSetIds || draggingSelectedSetIds.length === 0) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (folderDropTargetId !== folderId) {
      setFolderDropTargetId(folderId);
    }
  };

  const handleFolderDragLeave = (
    e: React.DragEvent<HTMLDivElement>,
    folderId: string,
  ) => {
    const nextTarget = e.relatedTarget as Node | null;
    if (!e.currentTarget.contains(nextTarget)) {
      setFolderDropTargetId((prev) => (prev === folderId ? null : prev));
    }
  };

  const handleFolderDropSelectedSets = (
    e: React.DragEvent<HTMLDivElement>,
    folderId: string,
  ) => {
    if (!draggingSelectedSetIds || draggingSelectedSetIds.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    moveSetIdsToFolder(draggingSelectedSetIds, folderId);
    setSelectedSetIds(new Set());
    setMovingSetId(null);
    setMoveToMenuOpen(false);
    setDraggingSelectedSetIds(null);
    setFolderDropTargetId(null);
  };

  const handleCreateMultistudy = () => {
    const selectedSets = librarySets.filter((s) => selectedSetIds.has(s.id));
    if (selectedSets.length < 2) {
      alert("Please select at least 2 sets for a Multistudy session.");
      return;
    }

    let newSet: CardSet = {
      id: generateId(),
      name: `Multistudy (${selectedSets.length} Sets)`,
      cards: [],
      lastPlayed: Date.now(),
      elapsedTime: 0,
      topStreak: 0,
      isSessionActive: true,
      isMultistudy: true,
      sourceSetIds: selectedSets.map(s => s.id),
      customFieldNames: [], // Merge custom fields? Complex. Let's leave empty for now or try to merge unique ones.
    };

    // Merge custom field names
    const allCustomFields = new Set<string>();
    selectedSets.forEach((s) =>
      s.customFieldNames?.forEach((n) => allCustomFields.add(n)),
    );
    newSet.customFieldNames = Array.from(allCustomFields);

    newSet = syncMultistudySet(newSet, librarySets);

    handlePlaySet(newSet);
    setSelectedSetIds(new Set());
  };

  const handleCombineSets = () => {
    const selectedSets = librarySets.filter((s) => selectedSetIds.has(s.id));
    if (selectedSets.length === 0) return;

    const allCards: Card[] = [];
    selectedSets.forEach((set) => {
      set.cards.forEach((card) => {
        allCards.push({
          ...card,
          id: generateId(), // New ID for combined set
          originalSetId: set.id,
          originalSetName: set.name,
          mastery: 0, // Reset mastery for the new set
        });
      });
    });

    // Merge custom field names
    const allCustomFields = new Set<string>();
    selectedSets.forEach((s) =>
      s.customFieldNames?.forEach((n) => allCustomFields.add(n)),
    );

    const newSet: CardSet = {
      id: generateId(),
      name: `Combined (${selectedSets.length} Sets)`,
      cards: allCards,
      lastPlayed: Date.now(),
      elapsedTime: 0,
      topStreak: 0,
      isSessionActive: false,
      isMultistudy: false,
      customFieldNames: Array.from(allCustomFields),
    };

    // Add to library
    onSaveToLibrary(newSet);
    setSelectedSetIds(new Set());
  };

  const handleBatchDelete = () => {
    if (batchDeleteClicks < 2) {
      setBatchDeleteClicks((prev) => prev + 1);
    } else {
      // Execute Delete
      selectedSetIds.forEach((id) => handleDeleteClick(id, "library")); // Reusing existing delete logic which might be single-item focused.
      // Actually handleDeleteClick sets a confirm ID. We need direct delete.
      // We need a prop for batch delete or expose setLibrarySets?
      // The prop `onDeleteLibrarySet` is available.
      selectedSetIds.forEach((id) => onDeleteLibrarySet(id));
      setSelectedSetIds(new Set());
      setBatchDeleteClicks(0);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const normalizedSignedInName = (signedInUserName || "").trim();
  const greetingPool = useMemo(
    () =>
      GREETINGS.filter(
        (entry) =>
          normalizedSignedInName.length > 0 || !entry.text.includes("<name>"),
      ),
    [normalizedSignedInName],
  );
  const greeting = useMemo(() => {
    const pool = greetingPool.length > 0 ? greetingPool : GREETINGS;
    return pool[Math.floor(Math.random() * pool.length)];
  }, [greetingPool, homeNavigationNonce]);
  const greetingText = useMemo(
    () => greeting.text.replace(/<name>/gi, normalizedSignedInName),
    [greeting, normalizedSignedInName],
  );
  const currentDate = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // Persist builder rows only in visual mode
  useEffect(() => {
    if (builderMode === "visual") {
      localStorage.setItem(BUILDER_STORAGE_KEY, JSON.stringify(builderRows));
    }
  }, [builderRows, builderMode]);

  const startBuilderScratch = () => {
    setSetName("");
    setEditingSetId(null);
    setTermLabel("Term");
    setDefinitionLabel("Definition");
    setTermLabel("Term");
    setDefinitionLabel("Definition");
    setTermSideFields([]);
    setDefSideFields([]);
    setAppliedTags([]);
    setBuilderRows([
      {
        id: "1",
        term: "",
        def: "",
        year: "",
        image: "",
        termImage: "",
        customFields: [],
        tags: [],
        star: false,
      },
      {
        id: "2",
        term: "",
        def: "",
        year: "",
        image: "",
        termImage: "",
        customFields: [],
        tags: [],
        star: false,
      },
      {
        id: "3",
        term: "",
        def: "",
        year: "",
        image: "",
        termImage: "",
        customFields: [],
        tags: [],
        star: false,
      },
    ]);
    const defaultName =
      "New Set " +
      new Date()
        .toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
        .replace(",", "");
    setSetName(defaultName);
    setView("builder");
    setBuilderMode("visual");
    clearAutosaveDraft();
    setPast([]);
    setFuture([]);
  };

  const startRawImport = () => {
    // Initialize builder state just in case, or just switch view?
    // Better to initialize so we have a clean slate if we cancel or something?
    // No, raw import page is separate.
    // But we should probably set the default name etc.
    setSetName("");
    setEditingSetId(null);
    setTermLabel("Term");
    setDefinitionLabel("Definition");
    setTermSideFields([]);
    setDefSideFields([]);
    setRawText("");
    // We don't set builderRows yet.

    const defaultName =
      "New Set " +
      new Date()
        .toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
        .replace(",", "");
    setSetName(defaultName);

    setView("raw-text");
  };

  const handleCreateNew = () => {
    setShowAddSetModal(true);
  };

  const handleRawTextContinue = (cards: Partial<Card>[], append: boolean = true, overrideStrategy: 'keep' | 'duplicate' | 'override' = 'keep') => {
    // Convert cards to BuilderRows
    const newRows: BuilderRow[] = cards.map((c, i) => {
      let term = c.term?.[0] || "";
      // Cues handling if needed... (assuming raw text import parses cues? not yet implemented in RawTextImport but let's assume safely)
      return {
        id: generateId() + "_imported_" + i,
        term: term,
        def: c.content || "",
        year: c.year || "",
        image: c.image || "",
        termImage: c.termImage || "",
        customFields: c.customFields || [],
        tags: c.tags || [],
        star: normalizeCardStar(c.star)
      };
    });

    // Auto-enable Years if detected in import
    if (cards.some((c) => c.year && c.year.trim())) setShowYear(true);

    // Merge Logic based on importAppend & importOverride
    if (!append) {
      // If not appending, replace entirely
      setBuilderRows(newRows);
    } else {
      // Append mode
      setBuilderRows(prev => {
        const result = [...prev];
        const strategy = overrideStrategy || 'keep';

        newRows.forEach(row => {
          // Check for duplicate by term
          // Note: This matches exact case. If we ignored case, it would be checking settings.ignoreCapitalization?
          // For builder, we usually stick to exact string match for overrides.
          const existingIndex = result.findIndex(r => r.term === row.term);

          if (existingIndex === -1) {
            // No match, just add
            result.push(row);
          } else {
            // Match found
            if (strategy === 'duplicate') {
              result.push(row);
            } else if (strategy === 'override') {
              // Replace existing with new
              result[existingIndex] = row;
            }
            // if 'keep', we ignore the new row
          }
        });
        return result;
      });
    }

    setView("builder");
    setBuilderMode("visual");
  };

  const handleBackToLibrary = () => {
    // Check for unsaved changes
    let isDirty = false;
    if (builderMode === "raw") {
      isDirty = !!rawText.trim();
    } else {
      isDirty = builderRows.some((r) => r.term.trim() || r.def.trim());
    }

    if (isDirty) {
      setShowUnsavedModal(true);
    } else {
      setView("menu");
    }
  };

  const handleDiscard = () => {
    setShowUnsavedModal(false);
    setView("menu");
    setSetName("");
    setBuilderRows([]); // Reset handled by next enter
    setRawText("");
    clearAutosaveDraft();
  };

  const handleSaveAndExit = () => {
    handleSaveToLibrary();
    setShowUnsavedModal(false);
  };

  // --- BUILDER SYNC LOGIC ---

  const syncToRaw = () => {
    const text = builderRows
      .filter((r) => r.term.trim() || r.def.trim())
      .map((r) => {
        // Prepend cues to term if they exist (though in visual mode, cues are likely already in term if typed manually)
        // But if we have cues in r.tags (from loading), we should ensure they are in the raw text.
        // However, if the user typed "(Cue) Term" in the input, r.term already has it.
        // If we separate them, we need to reconstruct.
        // Let's assume r.term is the source of truth for visual builder.

        let line = `${r.term.trim()} / ${r.def.trim()}`;
        if (r.year.trim()) line += ` /// ${r.year.trim()}`;
        if (r.image.trim()) line += ` ||| ${r.image.trim()}`;

        // Add Custom Fields
        if (r.customFields.length > 0) {
          if (!r.image.trim()) line += ` ||| `;
          line += ` , `;
          r.customFields.forEach((f) => {
            line += `(${f.name})(${f.value})`;
          });
        }

        // Cues are now part of the term in markdown, so we don't need %%TAGS%% syntax anymore for export/raw
        // unless we want to support legacy? No, user said "use markdown to add cues".

        if (r.star) {
          line += ` %%STAR%%`;
        }

        return line;
      })
      .join("\n\n&&&\n\n"); // New Separator
    setRawText(text);
  };

  const syncToRows = () => {
    const parsed = parseInput(rawText);
    const rows: BuilderRow[] = parsed.map((c, i) => {
      // When syncing to rows, we put the cues back into the term for visual editing
      let term = c.term?.[0] || "";
      if (c.tags && c.tags.length > 0) {
        const tagPrefix = c.tags.map((t) => `(${t})`).join(" ");
        term = `${tagPrefix} ${term}`;
      }

      return {
        id: generateId() + i,
        term: term,
        def: c.content || "",
        year: c.year || "",
        image: c.image || "",
        termImage: c.termImage || "",
        customFields: c.customFields || [],
        tags: c.tags || [],
        star: normalizeCardStar(c.star),
      };
    });

    // Auto-enable Years if detected
    if (rows.some((r) => r.year.trim())) {
      setShowYear(true);
    }

    // Extract unique custom field names from parsed rows
    const allNames = new Set<string>();
    rows.forEach((r) => r.customFields.forEach((f) => allNames.add(f.name)));

    // Identify which fields are already known in the current configuration
    const currentFieldNames = new Set([
      ...termSideFields.map((f) => f.name),
      ...defSideFields.map((f) => f.name),
    ]);

    // Find new fields that appeared in raw text but aren't in config
    const newFields = Array.from(allNames)
      .filter((name) => !currentFieldNames.has(name))
      .map((name) => ({ id: generateId(), name, type: "text" } as CustomFieldDefinition));

    // If there are new fields, add them to defSideFields (default location)
    if (newFields.length > 0) {
      setDefSideFields((prev) => [...prev, ...newFields]);
    }

    // Ensure at least 3 rows
    while (rows.length < 3) {
      rows.push({
        id: generateId(),
        term: "",
        def: "",
        year: "",
        image: "",
        termImage: "",
        customFields: [],
        tags: [],
        star: false,
      });
    }
    setBuilderRows(rows);
  };

  const switchMode = (newMode: "visual" | "raw") => {
    if (newMode === builderMode) return;

    if (newMode === "raw") {
      syncToRaw();
    } else {
      syncToRows();
    }
    setBuilderMode(newMode);
  };

  const handleLoadSetToBuilder = (set: CardSet) => {
    setSetName(set.name);
    setEditingSetId(set.id);
    const rows = set.cards.map((c, i) => {
      let term = c.term[0] || "";
      if (c.tags && c.tags.length > 0) {
        const tagPrefix = c.tags.map((t) => `(${t})`).join(" ");
        term = `${tagPrefix} ${term}`;
      }

      return {
        id: generateId() + i,
        term: term,
        def: c.content || "",
        year: c.year || "",
        image: c.image || "",
        termImage: c.termImage || "",
        customFields: c.customFields || [],
        tags: c.tags || [],
        originalCardId: c.id,
        star: normalizeCardStar(c.star),
      };
    });

    // Extract custom field names
    // Initialize V2 Configuration
    setTermLabel(set.termLabel || "Term");
    setDefinitionLabel(set.definitionLabel || "Definition");

    if (set.termSideFields || set.defSideFields) {
      // Need to handle if they are string[] (legacy runtime) or CustomFieldDefinition[]
      // We can check the first item's type
      const mapFields = (fields: any[]): CustomFieldDefinition[] => {
        if (!fields || fields.length === 0) return [];
        if (typeof fields[0] === "string") {
          return fields.map((name) => ({ id: generateId(), name, type: "text" }));
        }
        return fields.map((f: any) => ({ ...f, id: f.id || generateId() }));
      };

      setTermSideFields(mapFields(set.termSideFields || []));
      setDefSideFields(mapFields(set.defSideFields || []));
    } else {
      // Legacy migration
      const allNames = new Set<string>();
      if (set.customFieldNames) {
        set.customFieldNames.forEach((n) => allNames.add(n));
      } else {
        rows.forEach((r) =>
          r.customFields.forEach((f) => allNames.add(f.name)),
        );
      }
      setTermSideFields([]);
      setDefSideFields(
        Array.from(allNames).map((name) => ({ id: generateId(), name, type: "text" })),
      ); // Default to def side text
    }

    if (rows.some((r) => r.year.trim())) setShowYear(true);
    else setShowYear(false);

    setEnableTermCards(set.enableTermCards || false);
    setAppliedTags(set.tags || []);
    setBuilderRows(rows);
    setView("builder");
    setBuilderMode("visual");
    setPast([]);
    setFuture([]);
  };

  // --- ACTIONS ---

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsProcessingFile(true);
      try {
        const text = await e.target.files[0].text();
        const cleanText = sanitizeStrings(text);
        // Basic validation: if text is empty or binary-looking (though text() cleans up some)
        if (!cleanText.trim()) {
          throw new Error("Empty file");
        }

        // Detect if it's JSON or TXT
        let loadedName = e.target.files[0].name
          .replace(".json", "")
          .replace(".flashcards", "")
          .replace(".txt", "");
        let parsedCards: Partial<Card>[] = [];

        try {
          const json = JSON.parse(cleanText);
          if (json.name) loadedName = json.name;
          parsedCards = parseInput(cleanText); // parseInput handles both JSON structure and raw
        } catch {
          // Raw text fallback
          parsedCards = parseInput(cleanText);
        }

        // If no cards found, or parser return empty
        if (parsedCards.length === 0) {
          setShowInvalidFileModal(true);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }

        // Extract V2 Metadata if JSON
        try {
          const json = JSON.parse(cleanText);
          if (json.version >= 2 || json.termLabel || json.definitionLabel) {
            const mapJsonFields = (fields: any[]) => {
              if (!fields) return [];
              return fields.map((f: any) =>
                typeof f === "string" ? { id: generateId(), name: f, type: "text" } : { ...f, id: f.id || generateId() },
              );
            };

            setTermLabel(json.termLabel || "Term");
            setDefinitionLabel(json.definitionLabel || "Definition");
            setTermSideFields(mapJsonFields(json.termSideFields));
            setDefSideFields(mapJsonFields(json.defSideFields));
          } else if (json.customFieldNames) {
            // Legacy JSON migration
            setTermLabel("Term");
            setDefinitionLabel("Definition");
            setTermSideFields([]);
            setDefSideFields(
              json.customFieldNames.map((name: string) => ({
                id: generateId(),
                name,
                type: "text",
              })),
            );
          } else {
            // Reset if raw text or no metadata
            setTermLabel("Term");
            setDefinitionLabel("Definition");
            setTermSideFields([]);
            setDefSideFields([]);
          }
        } catch {
          // Not JSON, reset defaults
          setTermLabel("Term");
          setDefinitionLabel("Definition");
          setTermSideFields([]);
          setDefSideFields([]);
        }

        // Populate Builder
        const rows = parsedCards.map((c, i) => {
          let term = c.term?.[0] || "";
          if (c.tags && c.tags.length > 0) {
            const tagPrefix = c.tags.map((t) => `(${t})`).join(" ");
            term = `${tagPrefix} ${term}`;
          }
          return {
            id: generateId() + i,
            term: term,
            def: c.content || "",
            year: c.year || "",
            image: c.image || "",
            termImage: c.termImage || "",
            customFields: c.customFields || [],
            tags: c.tags || [],
            originalCardId: c.id,
            star: normalizeCardStar(c.star),
          };
        });

        setBuilderRows(rows);
        setRawText(cleanText);

        setSetName(loadedName);
        setView("builder");
        setBuilderMode("visual");
      } catch (error) {
        console.error("Upload failed", error);
        setShowInvalidFileModal(true);
        if (fileInputRef.current) fileInputRef.current.value = "";
      } finally {
        setIsProcessingFile(false);
      }
    }
  };

  const getCardsFromState = (): (Partial<Card> & {
    originalCardId?: string;
  })[] => {
    if (builderMode === "visual") {
      return builderRows
        .filter((r) => r.term.trim() || r.def.trim())
        .map((r) => {
          // Parse cues from term string for the Card object
          let termRaw = r.term; // Don't trim yet
          let tags: string[] = [];

          const tagRegex = /^(\s*\([^)]+\)\s*)+/;
          const tagMatch = termRaw.match(tagRegex);

          if (tagMatch) {
            const fullTagString = tagMatch[0];
            const extractedTags =
              fullTagString
                .match(/\(([^)]+)\)/g)
                ?.map((t) => t.slice(1, -1).trim()) || [];
            tags = extractedTags;
            termRaw = termRaw.replace(tagRegex, "");
          }

          termRaw = termRaw.trim();

          return {
            term: [termRaw],
            content: r.def.trim(),
            year: r.year.trim() || undefined,
            image: r.image.trim() || undefined,
            customFields: r.customFields,
            tags: tags, // Use extracted cues
            star: r.star,
            mastery: 0,
            originalCardId: r.originalCardId,
          };
        });
    } else {
      return parseInput(rawText);
    }
  };

  const handleStartSessionNow = () => {
    const cards = getCardsFromState();
    if (cards.length === 0) return;

    if (!setName.trim()) {
      alert("Please enter a set name.");
      return;
    }

    // Validation: Check for empty terms or definitions
    const hasEmptyFields = cards.some(
      (c) => !c.term?.[0]?.trim() || !c.content?.trim(),
    );
    if (hasEmptyFields) {
      setWarningModal({
        isOpen: true,
        message:
          "Some cards have empty terms or definitions. Are you sure you want to start?",
        onConfirm: () => {
          proceedStartSession(cards);
        },
      });
      return;
    }

    proceedStartSession(cards);
  };

  const proceedStartSession = (
    cards: (Partial<Card> & { originalCardId?: string })[],
  ) => {
    const fullCards: Card[] = cards.map((c, i) => ({
      id: generateId() + i,
      term: c.term || ["?"],
      content: c.content || "",
      year: c.year,
      image: c.image,
      mastery: 0,
      star: normalizeCardStar(c.star),
      customFields: c.customFields || [],
      tags: c.tags || [],
    }));

    const newSet: CardSet = {
      id: generateId(),
      name: setName || "Untitled Set",
      cards: fullCards,
      version: 2,
      termLabel,
      definitionLabel,
      termSideFields,
      defSideFields,
      lastPlayed: Date.now(),
      elapsedTime: 0,
      topStreak: 0,
      isSessionActive: true,
    };

    handlePlaySet(newSet);
  };

  const handleSaveToLibrary = () => {
    if (!setName.trim()) {
      alert("Please name your set!");
      return;
    }

    if (duplicateInfo.labels.length > 0) {
      alert(
        `Duplicate card terms found in the visual editor: ${duplicateInfo.labels.join(", ")}. Please remove or rename them before saving.`,
      );
      return;
    }

    const usedCardIds = new Set<string>();
    const getStableCardId = (candidate?: string): string => {
      if (candidate && !usedCardIds.has(candidate)) {
        usedCardIds.add(candidate);
        return candidate;
      }
      let nextId = generateId();
      while (usedCardIds.has(nextId)) {
        nextId = generateId();
      }
      usedCardIds.add(nextId);
      return nextId;
    };

    const cards: Card[] = builderRows
      .filter((row) => row.term.trim() || row.def.trim())
      .map((row) => {
        // Parse cues from term string
        let termRaw = row.term.trim();
        let tags: string[] = [];

        const tagRegex = /^(\s*\([^)]+\)\s*)+/;
        const tagMatch = termRaw.match(tagRegex);

        if (tagMatch) {
          const fullTagString = tagMatch[0];
          const extractedTags =
            fullTagString
              .match(/\(([^)]+)\)/g)
              ?.map((t) => t.slice(1, -1).trim()) || [];
          tags = extractedTags;
          termRaw = termRaw.replace(tagRegex, "").trim();
        }

        const normalizedCustomFields = row.customFields
          .map((f) => ({ name: (f.name || "").trim(), value: f.value ?? "" }))
          .filter((f) => f.name.length > 0);

        return {
          id: getStableCardId(row.originalCardId),
          term: [termRaw],
          content: row.def.trim(),
          year: row.year.trim(),
          image: row.image,
          customFields: normalizedCustomFields.length > 0 ? normalizedCustomFields : undefined,
          mastery: 0,
          star: row.star,
          tags: tags,
          originalSetId: editingSetId || undefined,
          originalSetName: setName,
        };
      });

    if (cards.length === 0) {
      alert("Please add at least one card!");
      return;
    }

    const newSet: CardSet = {
      id: editingSetId || generateId(),
      name: setName,
      cards,
      lastPlayed: Date.now(),
      elapsedTime: 0,
      topStreak: 0,
      version: 2,
      termLabel,
      definitionLabel,
      termSideFields,
      defSideFields,
      enableTermCards,
      folderId: currentFolderId || undefined,
      tags: appliedTags,
    };

    if (editingSetId) {
      const oldSet = librarySets.find((s) => s.id === editingSetId);
      if (oldSet) {
        newSet.folderId = oldSet.folderId;
      }
    }

    onSaveToLibrary(newSet);

    setBuilderRows([
      {
        id: "1",
        term: "",
        def: "",
        year: "",
        image: "",
        termImage: "",
        customFields: [],
        tags: [],
        star: false,
      },
      {
        id: "2",
        term: "",
        def: "",
        year: "",
        image: "",
        termImage: "",
        customFields: [],
        tags: [],
        star: false,
      },
      {
        id: "3",
        term: "",
        def: "",
        year: "",
        image: "",
        termImage: "",
        customFields: [],
        tags: [],
        star: false,
      },
    ]);
    setSetName("");
    setEditingSetId(null);
    setView("menu");
    setShowUnsavedModal(false);
    clearAutosaveDraft();
  };

  const handleDownloadFlashcards = () => {
    const cards: Card[] = builderRows
      .filter((row) => row.term.trim() || row.def.trim())
      .map((row) => {
        // Parse cues from term string
        let termRaw = row.term.trim();
        let tags: string[] = [];

        const tagRegex = /^(\s*\([^)]+\)\s*)+/;
        const tagMatch = termRaw.match(tagRegex);

        if (tagMatch) {
          const fullTagString = tagMatch[0];
          const extractedTags =
            fullTagString
              .match(/\(([^)]+)\)/g)
              ?.map((t) => t.slice(1, -1).trim()) || [];
          tags = extractedTags;
          termRaw = termRaw.replace(tagRegex, "").trim();
        }

        const normalizedCustomFields = row.customFields
          .map((f) => ({ name: (f.name || "").trim(), value: f.value ?? "" }))
          .filter((f) => f.name.length > 0);

        return {
          id: generateId(),
          term: [termRaw],
          content: row.def.trim(),
          year: row.year.trim(),
          image: row.image,
          customFields: normalizedCustomFields.length > 0 ? normalizedCustomFields : undefined,
          mastery: 0,
          star: row.star,
          tags: tags,
          originalSetId: editingSetId || undefined,
          originalSetName: setName,
        };
      });

    const exportSet: CardSet = {
      id: editingSetId || generateId(),
      name: setName || "Untitled Set",
      cards,
      lastPlayed: Date.now(),
      elapsedTime: 0,
      topStreak: 0,
      version: 2,
      termLabel,
      definitionLabel,
      termSideFields,
      defSideFields,
      enableTermCards,
      folderId: currentFolderId || undefined,
      tags: appliedTags,
    };

    downloadFile(
      (setName || "deck") + ".flashcards",
      JSON.stringify(exportSet, null, 2),
      "json",
    );
  };

  const handleCopyCode = () => {
    let content = rawText;
    if (builderMode === "visual") {
      content = builderRows
        .filter((r) => r.term.trim() || r.def.trim())
        .map((r) => {
          let line = `${r.term.trim()} / ${r.def.trim()}`;
          if (r.year.trim()) line += ` /// ${r.year.trim()}`;
          if (r.image.trim()) line += ` ||| ${r.image.trim()}`;

          if (r.customFields.length > 0) {
            if (!r.image.trim()) line += ` ||| `;
            line += ` , `;
            r.customFields.forEach((f) => {
              line += `(${f.name})(${f.value})`;
            });
          }

          if (r.star) {
            line += ` %%STAR%%`;
          }
          return line;
        })
        .join("\n\n&&&\n\n");
    }
    navigator.clipboard.writeText(content);
    alert("Copied to clipboard!");
  };

  // --- HELPER FOR VISUAL BUILDER ---

  const addRow = useCallback(() => {
    saveToHistory();
    setBuilderRows((prev) => [
      ...prev,
      {
        id: generateId(),
        term: "",
        def: "",
        year: "",
        image: "",
        termImage: "",
        customFields: [],
        tags: [],
        star: false,
      },
    ]);
  }, []);

  const updateRow = useCallback(
    (id: string, field: keyof BuilderRow, value: any) => {
      setBuilderRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)),
      );
    },
    [],
  );

  const duplicateRow = (id: string) => {
    saveToHistory();
    setBuilderRows((prev) => {
      const index = prev.findIndex((r) => r.id === id);
      if (index === -1) return prev;
      const rowToClone = prev[index];
      const newRow: BuilderRow = {
        ...rowToClone,
        id: generateId(),
        // Clear originalCardId so it's treated as a new card
        originalCardId: undefined,
      };
      const newRows = [...prev];
      newRows.splice(index + 1, 0, newRow);
      return newRows;
    });
  };

  const removeRow = useCallback((id: string) => {
    saveToHistory();
    setBuilderRows((prev) => {
      if (prev.length <= 1) {
        // Don't delete last row, just clear it
        return [
          {
            id: generateId(),
            term: "",
            def: "",
            year: "",
            image: "",
            termImage: "",
            customFields: [],
            tags: [],
            star: false,
          },
        ];
      }
      return prev.filter((r) => r.id !== id);
    });
  }, [saveToHistory]);

  const openImageModal = useCallback((rowId: string, field: 'image' | 'termImage' = 'image') => {
    setEditingImageRowId(rowId);
    setEditingImageField(field);
    setShowImageModal(true);
  }, []);

  const swapRow = useCallback((id: string) => {
    saveToHistory();
    setBuilderRows((prev) =>
      prev.map((r) => {
        if (r.id === id) {
          return { ...r, term: r.def, def: r.term };
        }
        return r;
      }),
    );
  }, []);

  const handleSaveImage = (url: string) => {
    if (editingImageRowId) {
      updateRow(editingImageRowId, editingImageField, url);
    }
  };

  const duplicateInfo = useMemo(() => {
    const counts = new Map<string, number>();
    const labels = new Map<string, string>();
    const ids = new Set<string>();

    builderRows.forEach((row) => {
      const key = getBuilderDuplicateKey(row.term);
      if (!key) return;
      counts.set(key, (counts.get(key) || 0) + 1);
      if (!labels.has(key)) {
        labels.set(key, row.term.replace(LEADING_TAG_REGEX, "").trim() || row.term.trim());
      }
    });

    builderRows.forEach((row) => {
      const key = getBuilderDuplicateKey(row.term);
      if (key && (counts.get(key) || 0) > 1) {
        ids.add(row.id);
      }
    });

    return {
      ids,
      labels: Array.from(counts.entries())
        .filter(([, count]) => count > 1)
        .map(([key]) => labels.get(key) || key),
    };
  }, [builderRows]);

  const handleDeleteClick = (id: string, type: "session" | "library") => {
    if (deleteConfirmId === id) {
      if (type === "session") onDeleteSession(id);
      else onDeleteLibrarySet(id);
      setDeleteConfirmId(null);
    } else {
      setDeleteConfirmId(id);
      setTimeout(() => setDeleteConfirmId(null), 3000);
    }
  };

  // Check for uploaded images (Base64)
  const hasUploadedImages = useMemo(() => {
    return builderRows.some((r) => r.image && r.image.startsWith("data:"));
  }, [builderRows]);

  const handlePlaySet = (set: CardSet) => {
    if (settings.starredOnly) {
      const hasStarred = set.cards.some((c) => c.star);
      if (!hasStarred) {
        setNoStarredModalSet(set);
        return;
      }
    }
    onStartFromLibrary(set);
  };

  const handleResumeSet = (set: CardSet) => {
    if (settings.starredOnly) {
      const hasStarred = set.cards.some((c) => c.star);
      if (!hasStarred) {
        setNoStarredModalSet(set);
        return;
      }
    }
    onResumeSession(set);
  };

  const handleMoveToLocal = (setId: string, toLocal: boolean) => {
    const set = librarySets.find(s => s.id === setId);
    if (!set) return;

    setMoveToLocalModal({
      setId,
      setName: set.name,
      toLocal
    });
  };

  const confirmMoveToLocal = async () => {
    if (!moveToLocalModal) return;
    if (moveToLocalModal.setId === UI_AUDIT_ID) {
      setMoveToLocalModal(null);
      return;
    }

    const { setId, toLocal } = moveToLocalModal;
    const set = librarySets.find(s => s.id === setId);
    if (!set) return;

    // Local-only sets belong in the root Local section (not cloud folders).
    const updatedSet = { ...set, isLocalOnly: toLocal, folderId: toLocal ? undefined : set.folderId };

    // If moving to cloud, we need to ensure it gets uploaded
    // If moving to local, we need to delete from cloud
    if (!toLocal) {
      // Moving to cloud - the writeFlashcardSet will handle upload
      onSaveToLibrary(updatedSet);
    } else {
      // Moving to local - need to delete from cloud and update locally
      const { deleteSetFromCloud } = await import('../storageV2');
      await deleteSetFromCloud(setId);
      onSaveToLibrary(updatedSet);
    }

    setMoveToLocalModal(null);
  };

  return (
    <div
      ref={topAnchorRef}
      className="max-w-5xl mx-auto w-full pb-20 animate-in fade-in duration-700"
    >
      <SetConfigurationModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        initialMode={configModalMode}
        termLabel={termLabel}
        setTermLabel={setTermLabel}
        definitionLabel={definitionLabel}
        setDefinitionLabel={setDefinitionLabel}
        termSideFields={termSideFields}
        settings={settings} // Pass settings
        setTermSideFields={setTermSideFields}
        defSideFields={defSideFields}
        setDefSideFields={setDefSideFields}
        showYear={showYear}
        setShowYear={setShowYear}
        enableTermCards={enableTermCards}
        setEnableTermCards={setEnableTermCards}
        rawText={rawText}
        setRawText={setRawText}
        onImportContinue={handleRawTextContinue}
        hideImportButton={view === "raw-text"}
        builderRows={builderRows}
        setBuilderRows={setBuilderRows}
        tags={tags}
        onUpdateTags={onUpdateTags}
        appliedTags={appliedTags}
        setAppliedTags={setAppliedTags}
        onManageTags={onOpenSettings}
      />

      <AddSetModal
        isOpen={showAddSetModal}
        onClose={() => setShowAddSetModal(false)}
        onStartScratch={startBuilderScratch}
        onStartRaw={startRawImport}
        onImportFile={() => {
          setShowAddSetModal(false);
          fileInputRef.current?.click();
        }}
      />

      <UnsavedChangesModal
        isOpen={showUnsavedModal}
        onSave={handleSaveAndExit}
        onDiscard={handleDiscard}
        onCancel={() => setShowUnsavedModal(false)}
      />

      <ImageModal
        isOpen={showImageModal}
        onClose={() => setShowImageModal(false)}
        onSave={handleSaveImage}
        initialValue={
          editingImageRowId
            ? builderRows.find((r) => r.id === editingImageRowId)?.[editingImageField] || ""
            : ""
        }
        onUploadImage={onUploadImage}
        autoClose={settings.autoCloseImageWindow}
      />

      <WarningModal
        isOpen={warningModal.isOpen}
        onClose={() => setWarningModal((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={warningModal.onConfirm}
        message={warningModal.message}
      />

      <InvalidFileModal
        isOpen={showInvalidFileModal}
        onClose={() => setShowInvalidFileModal(false)}
      />

      <NoStarredModal
        isOpen={!!noStarredModalSet}
        onClose={() => setNoStarredModalSet(null)}
        onDisableAndPlay={() => {
          if (noStarredModalSet) {
            if (noStarredModalSet.id === UI_AUDIT_ID) {
              setNoStarredModalSet(null);
              return;
            }
            onUpdateSettings({ ...settings, starredOnly: false });
            if (noStarredModalSet.isSessionActive) {
              onResumeSession(noStarredModalSet);
            } else {
              onStartFromLibrary(noStarredModalSet);
            }
            setNoStarredModalSet(null);
          }
        }}
      />

      <DeleteFolderModal
        isOpen={!!deleteFolderModal}
        folderName={deleteFolderModal?.name || ""}
        setCount={deleteFolderModal?.count || 0}
        onClose={() => setDeleteFolderModal(null)}
        onConfirm={confirmDeleteFolder}
      />

      <MarkdownHelpModal
        isOpen={showMarkdownHelp}
        onClose={() => setShowMarkdownHelp(false)}
      />

      <WarningModal
        isOpen={!!moveToLocalModal}
        onClose={() => setMoveToLocalModal(null)}
        onConfirm={confirmMoveToLocal}
        message={
          moveToLocalModal?.toLocal
            ? `Move "${moveToLocalModal.setName}" to Local Storage? This will remove it from your Google Drive and it will only be accessible on this device.`
            : `Move "${moveToLocalModal?.setName}" to Cloud Storage? This will upload it to your Google Drive and make it accessible from other devices.`
        }
      />

      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Header */}
      {/* Header */}
      <div className="mb-10 text-left">
        {/* Back Button for separate views */}
        {(view === "builder" || view === "raw-text") && (
          <button
            onClick={handleBackToLibrary}
            data-tour="builder-back-to-library"
            className="mb-4 flex items-center gap-3 text-muted hover:text-text transition-colors font-bold uppercase text-xs tracking-wider group"
          >
            <div className="p-2 rounded-full border border-outline group-hover:bg-panel group-hover:border-accent transition-colors">
              <ArrowLeft size={16} />
            </div>
            Back to Library
          </button>
        )}

        {/* Date/Subtitle */}
        {view === "menu" ? (
          <>
            <div className="text-accent font-mono text-sm mb-1 tracking-widest uppercase opacity-80">
              {currentDate}
            </div>
            <div className="flex items-center justify-between">
              <h1
                className={clsx(
                  "text-4xl text-text tracking-tight mb-2 splash-greeting-text",
                  greeting.colorful && "splash-greeting--colorful",
                )}
                style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}
              >
                {renderInline(greetingText, "home-greeting")}
              </h1>
            </div>
            <p className="text-muted text-lg">
              Study a deck or create a new one below.
            </p>
          </>
        ) : (
          <div className="flex items-start justify-between">
            <div>
              <h1
                className="text-4xl text-text tracking-tight mb-2"
                style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}
              >
                List Builder
              </h1>
              <p className="text-accent font-bold text-2xl animate-in slide-in-from-left-2 fade-in duration-500">
                {view === "raw-text" ? "Raw Text Import" : "Visual Editor"}
              </p>
            </div>

            {/* Autosave Indicator */}
            {autosaveStatus !== 'idle' && (
              <div
                className={clsx(
                  "flex items-center gap-2 px-3 py-1.5 bg-panel-2 border border-outline rounded-lg text-xs font-bold transition-all duration-500 select-none mt-1 shadow-sm",
                  autosaveStatus === 'saving' && "text-amber-400 border-amber-400/30",
                  autosaveStatus === 'saved' && "text-emerald-400 border-emerald-400/30",
                  autosaveStatus === 'saved_faded' && "text-muted opacity-50",
                )}
                title="Autosave saves your draft locally on this device. It is not synced to the cloud. Drafts expire after 7 days."
              >
                {autosaveStatus === 'saving' && (
                  <RotateCw size={14} className="animate-spin" />
                )}
                {(autosaveStatus === 'saved' || autosaveStatus === 'saved_faded') && (
                  <CheckCircle2 size={14} />
                )}
                <span>
                  {autosaveStatus === 'saving' ? 'Saving...' : 'Draft saved'}
                </span>
                <div className="w-px h-3 bg-outline mx-0.5"></div>
                <HardDrive size={12} className="opacity-60" />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="space-y-12">
        {/* MENU MODE */}
        {view === "menu" && (
          <div
            className="max-w-4xl mx-auto"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileUpload({ target: { files: e.dataTransfer.files } } as any);
              }
            }}
          >
            {/* AUTOSAVE DRAFT RECOVERY BANNER */}
            {showDraftRecoveryBanner && draftRecoveryDataRef.current && (
              <div className="mb-6 bg-panel border border-amber-500/30 rounded-2xl p-5 shadow-lg animate-in slide-in-from-top-2 fade-in duration-500">
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 mt-0.5">
                    <HardDrive size={20} className="text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-text text-sm mb-1">Unsaved Draft Found</h4>
                    <p className="text-muted text-xs leading-relaxed">
                      You have an unsaved draft
                      {draftRecoveryDataRef.current.setName ? ` "${draftRecoveryDataRef.current.setName}"` : ''} from{' '}
                      {(() => {
                        const age = Date.now() - draftRecoveryDataRef.current!.savedAt;
                        const mins = Math.floor(age / 60000);
                        const hours = Math.floor(age / 3600000);
                        const days = Math.floor(age / 86400000);
                        if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
                        if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
                        if (mins > 0) return `${mins} minute${mins > 1 ? 's' : ''} ago`;
                        return 'just now';
                      })()}
                      . Would you like to restore it?
                    </p>
                    <div className="flex items-center gap-2 mt-3">
                      <button
                        onClick={recoverDraft}
                        className="px-4 py-1.5 bg-amber-500 text-bg font-bold text-xs rounded-lg hover:bg-amber-400 transition-colors"
                      >
                        Restore Draft
                      </button>
                      <button
                        onClick={clearAutosaveDraft}
                        className="px-4 py-1.5 text-muted hover:text-text text-xs font-bold transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {showOnboardingPromptBanner && !hasCompletedOnboarding && (
              <div className="mb-6 bg-panel border border-green/30 rounded-2xl p-5 shadow-lg animate-in slide-in-from-top-2 fade-in duration-500">
                <div className="flex items-start gap-4">
                  <div className="p-2.5 rounded-xl bg-green/10 border border-green/20 mt-0.5">
                    <BookOpen size={20} className="text-green" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-text text-sm mb-1">Learn the First-Set Flow</h4>
                    <p className="text-muted text-xs leading-relaxed">
                      See exactly how to create a set, fill your first card, and find the save and study buttons. You can always reopen the tour from Settings later.
                    </p>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <button
                        onClick={() => {
                          setShowOnboardingPromptBanner(false);
                          onStartOnboardingTour?.();
                        }}
                        className="px-4 py-1.5 bg-green text-bg font-bold text-xs rounded-lg hover:bg-green/90 transition-colors"
                      >
                        Start Tutorial
                      </button>
                      <button
                        onClick={dismissOnboardingPromptForSession}
                        className="px-4 py-1.5 text-muted hover:text-text text-xs font-bold transition-colors"
                      >
                        Later
                      </button>
                      <button
                        onClick={dismissOnboardingPromptPermanently}
                        className="px-4 py-1.5 text-muted hover:text-red text-xs font-bold transition-colors"
                      >
                        Don&apos;t Show Again
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ONGOING SESSIONS */}
            {!currentFolderId && ongoingSessions.length > 0 && (
              <div className="mb-8">
                <h3 className="text-xs font-bold text-muted uppercase tracking-widest pl-2 mb-4">
                  Ongoing
                </h3>
                <div className="overflow-x-auto pb-2 -mx-2 px-2 scrollbar-thin scrollbar-thumb-outline scrollbar-track-transparent">
                  <div
                    className="flex gap-4"
                    style={{ minWidth: "min-content" }}
                  >
                    {ongoingSessions.map((session) => {
                      const masteredCount = session.cards.filter(
                        (c) => c.mastery >= 2,
                      ).length;
                      const learningCount = session.cards.filter(
                        (c) => c.mastery === 1,
                      ).length;
                      const unseenCount = session.cards.filter(
                        (c) => c.mastery === 0,
                      ).length;
                      const isDeletePending =
                        ongoingDeleteConfirmId === session.id;

                      return (
                        <div
                          key={session.id}
                          className={clsx(
                            "relative flex-shrink-0 w-64 h-48 bg-panel-2 border border-outline rounded-2xl p-5 transition-all hover:border-accent group flex flex-col",
                            session.isMultistudy && "overflow-hidden",
                          )}
                        >
                          {/* Multistudy stripes background */}
                          {session.isMultistudy && (
                            <>
                              <div
                                className="absolute inset-0 opacity-[0.15] pointer-events-none"
                                style={{
                                  backgroundImage:
                                    "repeating-linear-gradient(45deg, #000 0, #000 20px, transparent 20px, transparent 40px)",
                                }}
                              ></div>
                              <div className="absolute top-0 left-0 w-1 h-full bg-accent/50"></div>
                            </>
                          )}

                          <div className="relative z-10 flex flex-col h-full">
                            {/* Header */}
                            <div className="mb-2">
                              <div className="text-[10px] font-bold uppercase tracking-widest text-accent mb-1">
                                {session.isMultistudy ? "Multistudy" : "Learn"}
                              </div>
                              <div className="font-bold text-text truncate">
                                {session.name}
                              </div>
                            </div>

                            {/* Progress or Set List - fixed height with flex-1 */}
                            <div className="flex-1 overflow-hidden">
                              {session.isMultistudy ? (
                                // Multistudy: show bullet list of source sets with scroll
                                <ul className="text-xs text-muted space-y-1 h-full overflow-y-auto scrollbar-thin scrollbar-thumb-outline scrollbar-track-transparent pr-1">
                                  {session.cards
                                    .reduce((acc, card) => {
                                      if (
                                        card.originalSetName &&
                                        !acc.includes(card.originalSetName)
                                      ) {
                                        acc.push(card.originalSetName);
                                      }
                                      return acc;
                                    }, [] as string[])
                                    .map((setName, i) => (
                                      <li
                                        key={i}
                                        className="flex items-center gap-1.5"
                                      >
                                        <span className="text-accent">&bull;</span>
                                        <span className="truncate">
                                          {setName}
                                        </span>
                                      </li>
                                    ))}
                                </ul>
                              ) : (
                                // Learn: show progress squares
                                <div className="flex gap-1.5 flex-wrap">
                                  {/* Unseen */}
                                  <div className="flex items-center gap-1 px-2 py-1 bg-panel-3 border border-outline rounded-lg">
                                    <div className="flex flex-col gap-0.5">
                                      <div className="w-1.5 h-1.5 rounded-full bg-outline"></div>
                                      <div className="w-1.5 h-1.5 rounded-full bg-outline"></div>
                                    </div>
                                    <span className="text-xs font-mono text-muted">
                                      {unseenCount}
                                    </span>
                                  </div>
                                  {/* Learning */}
                                  <div className="flex items-center gap-1 px-2 py-1 bg-yellow/10 border border-yellow/20 rounded-lg">
                                    <div className="flex flex-col gap-0.5">
                                      <div className="w-1.5 h-1.5 rounded-full bg-yellow"></div>
                                      <div className="w-1.5 h-1.5 rounded-full bg-outline"></div>
                                    </div>
                                    <span className="text-xs font-mono text-yellow">
                                      {learningCount}
                                    </span>
                                  </div>
                                  {/* Mastered */}
                                  <div className="flex items-center gap-1 px-2 py-1 bg-green/10 border border-green/20 rounded-lg">
                                    <div className="flex flex-col gap-0.5">
                                      <div className="w-1.5 h-1.5 rounded-full bg-green"></div>
                                      <div className="w-1.5 h-1.5 rounded-full bg-green"></div>
                                    </div>
                                    <span className="text-xs font-mono text-green">
                                      {masteredCount}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Actions - always at bottom */}
                            <div className="flex gap-2 mt-auto pt-3">
                              <button
                                onClick={() => onResumeSession(session)}
                                className="flex-1 px-3 py-2 bg-accent text-bg text-xs font-bold rounded-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-1.5"
                              >
                                <Play size={12} fill="currentColor" /> Resume
                              </button>
                              <button
                                onClick={() => {
                                  if (isDeletePending) {
                                    if (session.isMultistudy) {
                                      onDeleteLibrarySet(session.id);
                                    } else {
                                      onDeleteSession(session.id);
                                    }
                                    setOngoingDeleteConfirmId(null);
                                  } else {
                                    setOngoingDeleteConfirmId(session.id);
                                    setTimeout(
                                      () => setOngoingDeleteConfirmId(null),
                                      3000,
                                    );
                                  }
                                }}
                                className={clsx(
                                  "px-3 py-2 border rounded-lg transition-all flex items-center justify-center",
                                  isDeletePending
                                    ? "bg-red text-bg border-red"
                                    : "bg-panel-3 border-outline text-muted hover:text-red hover:border-red",
                                )}
                                title="End Session"
                              >
                                {isDeletePending ? (
                                  <span className="text-[10px] font-bold uppercase">
                                    Sure?
                                  </span>
                                ) : (
                                  <Trash2 size={12} />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* LIBRARY COLUMN */}
            <div className="space-y-4">
              <div className="flex justify-between items-center gap-3 flex-wrap">
                {currentFolderId ? (
                  <div className="flex items-center gap-3 pl-2">
                    <button
                      onClick={() => setCurrentFolderId(null)}
                      className="flex items-center gap-2 text-muted hover:text-text transition-colors font-bold uppercase text-xs tracking-wider group"
                    >
                      <div className="p-2 rounded-full border border-outline group-hover:bg-panel group-hover:border-accent transition-colors">
                        <ArrowLeft size={16} />
                      </div>
                      Back
                    </button>
                    {currentFolder?.name && (
                      <span className="text-text text-sm font-bold normal-case tracking-normal">
                        {currentFolder.name}
                      </span>
                    )}
                  </div>
                ) : (
                  <h3 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-2 pl-2">
                    Library
                  </h3>
                )}
                <div className="flex gap-2 flex-wrap">
                  {currentFolderId && (
                    <button
                      onClick={() => handleMultistudyFolder(currentFolderId)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 text-accent border border-accent/20 rounded-lg text-xs font-bold hover:bg-accent/20 transition-colors"
                    >
                      <Play size={14} /> Study Folder
                    </button>
                  )}
                  <button
                    onClick={handleCreateFolder}
                    className="flex items-center gap-2 px-4 py-2 bg-panel-2 border border-outline text-text rounded-lg text-sm font-bold hover:border-accent hover:text-accent transition-all shadow-lg"
                  >
                    <Plus size={16} /> Folder
                  </button>
                  <button
                    onClick={handleCreateNew}
                    data-tour="menu-add-set"
                    className="flex items-center gap-2 px-4 py-2 bg-text text-bg rounded-lg text-sm font-bold hover:scale-105 active:scale-95 transition-all shadow-lg"
                  >
                    <Plus size={16} /> Add
                  </button>
                </div>
              </div>

              <div className="bg-panel border border-outline rounded-2xl p-3 flex flex-col md:flex-row md:items-center gap-3">
                <label className="flex items-center gap-2 flex-1 min-w-[220px] bg-panel-2 border border-outline rounded-lg px-3 py-2">
                  <Search size={14} className="text-muted" />
                  <input
                    value={librarySearchQuery}
                    onChange={(e) => setLibrarySearchQuery(e.target.value)}
                    placeholder="Search by set name or tag..."
                    className="bg-transparent text-sm w-full outline-none text-text placeholder:text-muted"
                  />
                </label>

                <div className="relative min-w-[170px]" ref={librarySortRef}>
                  <button
                    onClick={() => setIsLibrarySortOpen((prev) => !prev)}
                    className="w-full bg-panel-2 border border-outline rounded-lg px-3 py-2 text-sm focus:border-accent outline-none transition-colors flex items-center justify-between gap-2 hover:border-accent"
                  >
                    <span className="truncate text-text">{selectedLibrarySortOption.label}</span>
                    <ChevronDown size={14} className={clsx("opacity-60 flex-shrink-0 transition-transform", isLibrarySortOpen && "rotate-180")} />
                  </button>

                  {isLibrarySortOpen && (
                    <div className="absolute top-full left-0 mt-2 w-full bg-panel border border-outline rounded-xl shadow-xl z-50 overflow-hidden animate-in zoom-in-95">
                      {LIBRARY_SORT_OPTIONS.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setLibrarySortMode(option.value);
                            setIsLibrarySortOpen(false);
                          }}
                          className={clsx(
                            "w-full text-left px-3 py-2 text-sm hover:bg-panel-2 transition-colors",
                            librarySortMode === option.value
                              ? "text-accent font-bold bg-accent/5"
                              : "text-text"
                          )}
                        >
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {(librarySearchQuery || activeLibraryTagFilter) && (
                  <button
                    onClick={() => {
                      setLibrarySearchQuery("");
                      setActiveLibraryTagFilter(null);
                      setIsLibrarySortOpen(false);
                    }}
                    className="px-3 py-2 text-xs font-bold border border-outline rounded-lg hover:border-accent hover:text-accent transition-colors"
                  >
                    Clear Filters
                  </button>
                )}
              </div>

              {activeTag && (
                <div className="flex items-center gap-2 pl-2">
                  <span className="text-xs text-muted uppercase tracking-wider">Filtered by tag:</span>
                  <button
                    onClick={() => setActiveLibraryTagFilter(null)}
                    className="flex items-center gap-1"
                    title="Remove tag filter"
                  >
                    <TagPill tag={activeTag} />
                    <X size={12} className="text-muted hover:text-red transition-colors" />
                  </button>
                </div>
              )}

              {librarySets.length === 0 ? (
                isCloudLoading || isProcessingFile ? (
                  <BreathingLoader
                    statusText={
                      isCloudLoading
                        ? "Syncing your library with Google Drive. This should only take a moment."
                        : undefined
                    }
                  />
                ) : (
                  <div className="py-16 border border-dashed border-outline rounded-2xl bg-panel/30 text-center">
                    <p className="text-muted mb-2">
                      Your library will appear here when you upload or create
                      sets.
                    </p>
                    <p className="text-muted italic text-sm">
                      "Sets are like life: they come, go, and are covered in
                      colorful highlights." -Tudio, Flashcardsish mascot
                    </p>
                  </div>
                )
              ) : (
                <div className="space-y-8">
                  {/* Folders Section */}
                  {!currentFolderId && displayedFolders.length > 0 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                      {displayedFolders.map((folder) => {
                        const folderSets = librarySets.filter(
                          (s) => s.folderId === folder.id && !s.isLocalOnly,
                        );
                        const colorMap = {
                          brown: "bg-accent/20 border-accent text-accent",
                          red: "bg-red/20 border-red text-red",
                          blue: "bg-blue/20 border-blue text-blue",
                          yellow: "bg-yellow/20 border-yellow text-yellow",
                          green: "bg-green/20 border-green text-green",
                          purple: "bg-purple/20 border-purple text-purple",
                        };

                        return (
                          <div
                            key={folder.id}
                            className={clsx(
                              "border rounded-2xl p-4 transition-all cursor-pointer hover:scale-[1.02]",
                              colorMap[folder.color],
                              movingSetId
                                ? "ring-2 ring-offset-2 ring-offset-bg ring-accent"
                                : "",
                              folderDropTargetId === folder.id &&
                                "ring-2 ring-offset-2 ring-offset-bg ring-accent scale-[1.02]",
                            )}
                            onDragEnter={(e) => handleFolderDragOver(e, folder.id)}
                            onDragOver={(e) => handleFolderDragOver(e, folder.id)}
                            onDragLeave={(e) => handleFolderDragLeave(e, folder.id)}
                            onDrop={(e) => handleFolderDropSelectedSets(e, folder.id)}
                            onClick={() => {
                              if (editingFolderId === folder.id) return;
                              if (movingSetId)
                                handleMoveSet(movingSetId, folder.id);
                              else setCurrentFolderId(folder.id);
                            }}
                          >
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2 font-bold flex-1">
                                <FolderOpen size={18} />
                                {editingFolderId === folder.id ? (
                                  <input
                                    type="text"
                                    value={editingFolderName}
                                    onChange={(e) =>
                                      setEditingFolderName(e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter")
                                        handleSaveRenameFolder();
                                      if (e.key === "Escape")
                                        setEditingFolderId(null);
                                    }}
                                    onBlur={handleSaveRenameFolder}
                                    autoFocus
                                    className="bg-transparent border-b border-current outline-none w-full"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                ) : (
                                  <span>{folder.name}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <span className="text-xs opacity-70 font-mono mr-2">
                                  {folderSets.length} sets
                                </span>

                                {(() => {
                                  const totalDue = folderSets.reduce((acc, s) => acc + getSRSDueCount(s.cards), 0);
                                  if (totalDue === 0) return null;
                                  return (
                                    <span className="flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-black/20 mr-1">
                                      <Brain size={9} />
                                      {totalDue}
                                    </span>
                                  );
                                })()}

                                {selectedSetIds.size === 0 && (
                                  <>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStartRenameFolder(folder);
                                      }}
                                      className="p-1 hover:bg-black/10 rounded"
                                      title="Rename Folder"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteFolder(folder.id);
                                      }}
                                      className="p-1 hover:bg-black/10 rounded"
                                      title="Delete Folder"
                                    >
                                      <X size={14} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {/* Sets List */}
                  <div className="space-y-3">
                    {movingSetId && (
                      <div
                        className="bg-panel-2 border border-dashed border-accent p-4 rounded-xl text-center mb-4 cursor-pointer hover:bg-accent/10 transition-colors"
                        onClick={() => handleMoveSet(movingSetId, undefined)}
                      >
                        <span className="text-sm font-bold text-accent">
                          Move here (Remove from folder)
                        </span>
                      </div>
                    )}

                    {displayedSets.map((set) => (
                      <div
                        key={set.id}
                        className={clsx(
                          "relative group/row",
                          selectedSetIds.size > 0 &&
                            selectedSetIds.has(set.id) &&
                            "cursor-grab active:cursor-grabbing",
                        )}
                        draggable={
                          selectedSetIds.size > 0 && selectedSetIds.has(set.id)
                        }
                        onDragStart={(e) => handleSelectedSetDragStart(e, set.id)}
                        onDragEnd={handleSelectedSetDragEnd}
                      >
                        {/* Checkbox - Left Wing */}
                        <div className="absolute -left-12 top-1/2 -translate-y-1/2 w-12 flex justify-center">
                          <div
                            onClick={() => handleToggleSelect(set.id)}
                            className={clsx(
                              "w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all",
                              selectedSetIds.has(set.id)
                                ? "bg-accent border-accent"
                                : "border-outline hover:border-accent",
                            )}
                          >
                            {selectedSetIds.has(set.id) && (
                              <div className="w-2.5 h-1.5 border-b-2 border-l-2 border-bg -rotate-45 -mt-0.5" />
                            )}
                          </div>
                        </div>

                        <div className="group bg-panel border border-outline p-5 rounded-2xl hover:border-accent transition-all shadow-sm flex flex-col justify-between h-full">
                          <div className="flex justify-between items-start mb-4">
                            <div>
                              <div className="font-bold text-lg text-text group-hover:text-accent transition-colors">
                                {set.name}
                              </div>
                              <div className="text-muted text-xs font-mono group-hover:text-accent/80 transition-colors">
                                {set.cards.length} card{set.cards.length === 1 ? "" : "s"}
                              </div>
                              <div
                                className="text-muted text-[11px] mt-0.5 group-hover:text-accent/80 transition-colors"
                                title={set.lastPlayed ? new Date(set.lastPlayed).toLocaleString() : "Never studied"}
                              >
                                {formatLastStudied(set.lastPlayed)}
                              </div>

                              {/* Tags */}
                              {set.tags && set.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {set.tags.map(tagId => {
                                    const tag = tags.find(t => t.id === tagId);
                                    if (!tag) return null;
                                    return (
                                      <button
                                        key={tagId}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveLibraryTagFilter((prev) => (prev === tagId ? null : tagId));
                                          if (currentFolderId) setCurrentFolderId(null);
                                        }}
                                        title={activeLibraryTagFilter === tagId ? "Clear tag filter" : `Filter by ${tag.name}`}
                                      >
                                        <TagPill
                                          tag={tag}
                                          className={activeLibraryTagFilter === tagId ? "ring-1 ring-accent" : ""}
                                        />
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {/* SRS due badge */}
                              {(() => {
                                const dueCount = getSRSDueCount(set.cards);
                                if (dueCount === 0) return null;
                                return (
                                  <div className="flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-accent text-[11px] font-bold w-fit">
                                    <Brain size={10} />
                                    {dueCount} due for review
                                  </div>
                                );
                              })()}
                            </div>
                            <div className="flex items-center gap-1">
                              {selectedSetIds.size === 0 && (
                                <>
                                  <button
                                    onClick={() => setMovingSetId(set.id)}
                                    className={clsx(
                                      "p-1.5 rounded hover:bg-panel-2 transition-all",
                                      movingSetId === set.id
                                        ? "text-accent animate-pulse"
                                        : "text-muted hover:text-text",
                                    )}
                                    title="Move to Folder"
                                  >
                                    <FolderOpen size={16} />
                                  </button>
                                  {!set.isMultistudy && (
                                    <button
                                      onClick={() => handleLoadSetToBuilder(set)}
                                      className="p-1.5 text-muted hover:text-text rounded hover:bg-panel-2 transition-all"
                                      title="Edit"
                                    >
                                      <Pencil size={16} />
                                    </button>
                                  )}

                                  <button
                                    onClick={() => handleMoveToLocal(set.id, !set.isLocalOnly)}
                                    className={clsx(
                                      "p-1.5 rounded hover:bg-panel-2 transition-all",
                                      set.isLocalOnly ? "text-blue hover:text-blue" : "text-muted hover:text-text"
                                    )}
                                    title={set.isLocalOnly ? "Move to Cloud Storage" : "Move to Local Storage"}
                                  >
                                    {set.isLocalOnly ? (
                                      <Upload size={16} />
                                    ) : (
                                      <ArrowLeftRight size={16} />
                                    )}
                                  </button>

                                  <button
                                    onClick={() =>
                                      downloadFile(
                                        set.name + ".flashcards",
                                        JSON.stringify(set, null, 2),
                                        "json",
                                      )
                                    }
                                    className="p-1.5 text-muted hover:text-text rounded hover:bg-panel-2 transition-all"
                                    title="Export JSON"
                                  >
                                    <Download size={16} />
                                  </button>
                                  <button
                                    onClick={() =>
                                      onDuplicateLibrarySet(set.id)
                                    }
                                    className="p-1.5 text-muted hover:text-text rounded hover:bg-panel-2 transition-all"
                                    title="Duplicate Set"
                                  >
                                    <Copy size={16} />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteClick(set.id, "library");
                                    }}
                                    className={clsx(
                                      "p-1.5 rounded transition-all flex items-center justify-center",
                                      deleteConfirmId === set.id
                                        ? "bg-red text-bg w-12"
                                        : "text-muted hover:text-red hover:border-red",
                                    )}
                                    title="Delete Set"
                                  >
                                    {deleteConfirmId === set.id ? (
                                      <span className="text-[10px] font-bold uppercase">
                                        Sure?
                                      </span>
                                    ) : (
                                      <Trash2 size={16} />
                                    )}
                                  </button>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="pt-2 mt-2 flex gap-2 relative z-10">
                            <button
                              onClick={() => onOpenSet(set)}
                              data-tour="library-open-set"
                              className="w-full px-4 py-2 bg-panel-2 border border-outline hover:border-accent text-text text-sm font-bold rounded-lg hover:bg-accent hover:text-bg transition-all flex items-center justify-center gap-2"
                            >
                              <ExternalLink size={14} /> Open
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {displayedSets.length === 0 &&
                    displayedLocalSets.length === 0 &&
                    displayedFolders.length === 0 &&
                    (librarySearchQuery || activeLibraryTagFilter) && (
                      <div className="border border-dashed border-outline rounded-2xl bg-panel/30 p-8 text-center">
                        <p className="text-sm text-muted">No sets match your current library filters.</p>
                      </div>
                    )}

                  {/* Local Sets Section */}
                  {displayedLocalSets.length > 0 && !currentFolderId && (
                    <div className="mt-10">
                      <h4 className="text-xs font-bold text-muted uppercase tracking-widest pl-2 mb-4 flex items-center gap-2">
                        <Download size={14} />
                        Local Storage Only
                      </h4>
                      <div className="space-y-3">
                        {displayedLocalSets.map((set) => (
                          <div
                            key={set.id}
                            className={clsx(
                              "relative group/row",
                              selectedSetIds.size > 0 &&
                                selectedSetIds.has(set.id) &&
                                "cursor-grab active:cursor-grabbing",
                            )}
                            draggable={
                              selectedSetIds.size > 0 &&
                              selectedSetIds.has(set.id)
                            }
                            onDragStart={(e) =>
                              handleSelectedSetDragStart(e, set.id)
                            }
                            onDragEnd={handleSelectedSetDragEnd}
                          >
                            <div className="absolute -left-12 top-1/2 -translate-y-1/2 w-12 flex justify-center">
                              <div
                                onClick={() => handleToggleSelect(set.id)}
                                className={clsx(
                                  "w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-all",
                                  selectedSetIds.has(set.id)
                                    ? "bg-accent border-accent"
                                    : "border-outline hover:border-accent",
                                )}
                              >
                                {selectedSetIds.has(set.id) && (
                                  <div className="w-2.5 h-1.5 border-b-2 border-l-2 border-bg -rotate-45 -mt-0.5" />
                                )}
                              </div>
                            </div>

                            <div className="group bg-panel border border-blue/30 p-5 rounded-2xl hover:border-blue transition-all shadow-sm flex flex-col justify-between h-full">
                              <div className="flex justify-between items-start mb-4">
                                <div>
                                  <div className="font-bold text-lg text-text group-hover:text-accent transition-colors flex items-center gap-2">
                                    {set.name}
                                    <span className="text-[9px] font-mono text-blue border border-blue/30 px-1.5 py-0.5 rounded bg-blue/10">LOCAL</span>
                                  </div>
                                  <div className="text-muted text-xs font-mono group-hover:text-accent/80 transition-colors">
                                    {set.cards.length} card{set.cards.length === 1 ? "" : "s"}
                                  </div>
                                  <div
                                    className="text-muted text-[11px] mt-0.5 group-hover:text-accent/80 transition-colors"
                                    title={set.lastPlayed ? new Date(set.lastPlayed).toLocaleString() : "Never studied"}
                                  >
                                    {formatLastStudied(set.lastPlayed)}
                                  </div>

                                  {set.tags && set.tags.length > 0 && (
                                    <div className="flex flex-wrap gap-1 mt-2">
                                      {set.tags.map(tagId => {
                                        const tag = tags.find(t => t.id === tagId);
                                        if (!tag) return null;
                                        return (
                                          <button
                                            key={tagId}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setActiveLibraryTagFilter((prev) => (prev === tagId ? null : tagId));
                                              if (currentFolderId) setCurrentFolderId(null);
                                            }}
                                            title={activeLibraryTagFilter === tagId ? "Clear tag filter" : `Filter by ${tag.name}`}
                                          >
                                            <TagPill
                                              tag={tag}
                                              className={activeLibraryTagFilter === tagId ? "ring-1 ring-accent" : ""}
                                            />
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}

                                  {/* SRS due badge (local sets) */}
                                  {(() => {
                                    const dueCount = getSRSDueCount(set.cards);
                                    if (dueCount === 0) return null;
                                    return (
                                      <div className="flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full bg-accent/15 border border-accent/30 text-accent text-[11px] font-bold w-fit">
                                        <Brain size={10} />
                                        {dueCount} due for review
                                      </div>
                                    );
                                  })()}
                                </div>
                                <div className="flex items-center gap-1">
                                  {selectedSetIds.size === 0 && (
                                    <>
                                      <button
                                        onClick={() => setMovingSetId(set.id)}
                                        className={clsx(
                                          "p-1.5 rounded hover:bg-panel-2 transition-all",
                                          movingSetId === set.id
                                            ? "text-accent animate-pulse"
                                            : "text-muted hover:text-text",
                                        )}
                                        title="Move to Folder"
                                      >
                                        <FolderOpen size={16} />
                                      </button>
                                      <button
                                        onClick={() => handleLoadSetToBuilder(set)}
                                        className="p-1.5 text-muted hover:text-text rounded hover:bg-panel-2 transition-all"
                                        title="Edit"
                                      >
                                        <Pencil size={16} />
                                      </button>

                                      <button
                                        onClick={() => handleMoveToLocal(set.id, false)}
                                        className="p-1.5 text-blue hover:text-blue rounded hover:bg-panel-2 transition-all"
                                        title="Move to Cloud Storage"
                                      >
                                        <Upload size={16} />
                                      </button>

                                      <button
                                        onClick={() =>
                                          downloadFile(
                                            set.name + ".flashcards",
                                            JSON.stringify(set, null, 2),
                                            "json",
                                          )
                                        }
                                        className="p-1.5 text-muted hover:text-text rounded hover:bg-panel-2 transition-all"
                                        title="Export JSON"
                                      >
                                        <Download size={16} />
                                      </button>
                                      <button
                                        onClick={() =>
                                          onDuplicateLibrarySet(set.id)
                                        }
                                        className="p-1.5 text-muted hover:text-text rounded hover:bg-panel-2 transition-all"
                                        title="Duplicate Set"
                                      >
                                        <Copy size={16} />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteClick(set.id, "library");
                                        }}
                                        className={clsx(
                                          "p-1.5 rounded transition-all flex items-center justify-center",
                                          deleteConfirmId === set.id
                                            ? "bg-red text-bg w-12"
                                            : "text-muted hover:text-red hover:border-red",
                                        )}
                                        title="Delete Set"
                                      >
                                        {deleteConfirmId === set.id ? (
                                          <span className="text-[10px] font-bold uppercase">
                                            Sure?
                                          </span>
                                        ) : (
                                          <Trash2 size={16} />
                                        )}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="pt-2 mt-2 flex gap-2 relative z-10">
                                <button
                                  onClick={() => onOpenSet(set)}
                                  data-tour="library-open-set"
                                  className="w-full px-4 py-2 bg-panel-2 border border-outline hover:border-accent text-text text-sm font-bold rounded-lg hover:bg-accent hover:text-bg transition-all flex items-center justify-center gap-2"
                                >
                                  <ExternalLink size={14} /> Open
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Floating Action Bar */}
                  {selectedSetIds.size > 0 && (
                    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex max-w-[calc(100vw-1.5rem)] items-center gap-3 overflow-x-auto rounded-2xl border border-outline bg-panel p-2 shadow-2xl animate-in slide-in-from-bottom-4">
                      <div className="shrink-0 whitespace-nowrap pl-4 pr-2 text-sm font-bold text-text">
                        {selectedSetIds.size} selected
                      </div>
                      <div className="h-6 w-px shrink-0 bg-outline"></div>
                      <button
                        onClick={handleCreateMultistudy}
                        className="shrink-0 whitespace-nowrap rounded-xl border border-accent bg-accent px-6 py-2 font-bold text-bg shadow-lg transition-all duration-150 hover:-translate-y-0.5 hover:bg-accent/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 active:translate-y-0 active:scale-95"
                      >
                        Multistudy
                      </button>
                      <button
                        onClick={handleCombineSets}
                        className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-accent bg-panel-2 px-6 py-2 font-bold text-accent shadow-lg transition-all duration-150 hover:-translate-y-0.5 hover:bg-accent hover:text-bg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 active:translate-y-0"
                        title="Create a new set by combining all selected sets"
                      >
                        <Combine size={16} /> Combine
                      </button>
                      <button
                        onClick={handleCreateFolder}
                        className="shrink-0 whitespace-nowrap rounded-xl border border-outline bg-panel-2 px-6 py-2 font-bold text-text shadow-lg transition-all duration-150 hover:-translate-y-0.5 hover:border-accent hover:bg-accent/10 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 active:translate-y-0"
                      >
                        New Folder
                      </button>
                      <div className="relative shrink-0">
                        <button
                          onClick={() => setMoveToMenuOpen(!moveToMenuOpen)}
                          className={clsx(
                            "flex items-center gap-2 whitespace-nowrap rounded-xl border bg-panel-2 px-6 py-2 font-bold text-text shadow-lg transition-all duration-150 hover:-translate-y-0.5 hover:bg-accent/10 hover:text-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 active:translate-y-0",
                            moveToMenuOpen ? "border-accent" : "border-outline"
                          )}
                        >
                          Move to...
                        </button>
                        {moveToMenuOpen && (
                          <>
                            {/* Invisible overlay to catch clicks outside */}
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setMoveToMenuOpen(false)}
                            />
                            <div className="absolute bottom-full left-0 mb-2 w-64 max-h-60 overflow-y-auto bg-panel border border-outline rounded-xl shadow-xl p-2 z-50 animate-in fade-in slide-in-from-bottom-2">
                              {/* Main Library Option */}
                              <button
                                onClick={() => handleMoveSelectedToFolder(undefined)}
                                className="w-full text-left px-3 py-2 rounded-lg hover:bg-panel-2 text-sm font-medium flex items-center gap-2 border-b border-outline mb-1 pb-2"
                              >
                                <div className="w-2 h-2 rounded-full bg-muted" />
                                Main Library
                              </button>
                              {folders.map((f) => (
                                <button
                                  key={f.id}
                                  onClick={() => handleMoveSelectedToFolder(f.id)}
                                  className="w-full text-left px-3 py-2 rounded-lg hover:bg-panel-2 text-sm font-medium flex items-center gap-2"
                                >
                                  <div
                                    className={clsx("w-2 h-2 rounded-full", {
                                      "bg-accent": f.color === "brown",
                                      "bg-red": f.color === "red",
                                      "bg-blue": f.color === "blue",
                                      "bg-yellow": f.color === "yellow",
                                      "bg-green": f.color === "green",
                                      "bg-purple": f.color === "purple",
                                    })}
                                  />
                                  {f.name}
                                </button>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                      <button
                        onClick={handleBatchDelete}
                        className={clsx(
                          "shrink-0 whitespace-nowrap rounded-xl border px-6 py-2 font-bold shadow-lg transition-all duration-150 focus:outline-none focus-visible:ring-2",
                          batchDeleteClicks > 0
                            ? "border-red bg-red text-bg animate-pulse focus-visible:ring-red/60"
                            : "border-outline bg-panel-2 text-red hover:-translate-y-0.5 hover:border-red/50 hover:bg-red/10 focus-visible:ring-red/60",
                        )}
                      >
                        {batchDeleteClicks === 0
                          ? "Delete"
                          : batchDeleteClicks === 1
                            ? "Click 2x"
                            : "Click 1x"}
                      </button>
                    </div>
                  )}
                  {/* Folder Creation Modal */}
                  {isCreatingFolder && (
                    <div
                      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in"
                      onClick={() => setIsCreatingFolder(false)}
                    >
                      <div
                        className="bg-panel border border-outline rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-in zoom-in-95"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <h3 className="text-lg font-bold text-text mb-4">
                          Create Folder
                        </h3>
                        <input
                          autoFocus
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          placeholder="Folder Name"
                          className="w-full bg-panel-2 border border-outline rounded-xl px-4 py-3 text-text mb-6 focus:outline-none focus:border-accent font-bold"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") confirmCreateFolder();
                          }}
                        />
                        <div className="grid grid-cols-6 gap-4 mb-6 w-fit mx-auto justify-items-center">
                          {(
                            [
                              "brown",
                              "red",
                              "blue",
                              "yellow",
                              "green",
                              "purple",
                            ] as const
                          ).map((color) => (
                            <button
                              key={color}
                              onClick={() => setNewFolderColor(color)}
                              className={clsx(
                                "w-8 h-8 rounded-full border-2 transition-all",
                                color === "brown" && "bg-accent border-accent",
                                color === "red" && "bg-red border-red",
                                color === "blue" && "bg-blue border-blue",
                                color === "yellow" && "bg-yellow border-yellow",
                                color === "green" && "bg-green border-green",
                                color === "purple" && "bg-purple border-purple",
                                newFolderColor === color
                                  ? "scale-110 ring-2 ring-offset-2 ring-offset-panel ring-text"
                                  : "opacity-70 hover:opacity-100",
                              )}
                              title={color}
                            />
                          ))}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                          <button
                            onClick={() => confirmCreateFolder(newFolderColor)}
                            className="w-full py-3 bg-text text-bg font-bold rounded-lg hover:bg-text/90 transition-colors duration-150"
                          >
                            OK
                          </button>
                          <button
                            onClick={() => setIsCreatingFolder(false)}
                            className="w-full py-3 text-muted hover:text-text rounded-lg hover:bg-panel-2 transition-colors duration-150"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}{" "}
                </div>
              )}
            </div>
          </div>
        )}

        {/* RAW TEXT IMPORT MODE */}
        {view === "raw-text" && (
          <RawTextImport
            onClose={() => {
              if (rawText.trim()) setShowUnsavedModal(true);
              else handleBackToLibrary();
            }}
            onContinue={handleRawTextContinue}
            rawText={rawText}
            setRawText={setRawText}
            settings={settings}
          />
        )}

        {view === "builder" && (
          <div className="animate-in zoom-in-95 duration-300 space-y-6">
            <p className="text-sm text-text leading-relaxed max-w-4xl">
              Build your set here. Use markdown for formatting, drag handles to reorder cards, and card actions to star, duplicate, or swap content. Open Set Configuration to rename labels, add year/custom fields, and tune import behavior.
            </p>


            {/* 1. Header Panel (Floating Container) */}
            <div className="bg-panel border border-outline rounded-2xl p-6 shadow-lg">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <input
                  value={setName}
                  onChange={(e) => setSetName(e.target.value)}
                  data-tour="builder-set-name"
                  placeholder="Set Name"
                  className="bg-panel-2 border border-outline rounded-xl px-4 py-2 text-text w-full md:w-auto min-w-[300px] focus:outline-none focus:border-accent transition-colors font-bold"
                />

                <div className="flex items-center gap-6">
                  {/* WYSIWYG Toggle */}
                  <CursorTooltip
                    content="Toggle whether the card previews are shown as Markdown or formatted."
                    isEnabled={!settings.hideTooltips}
                  >
                    <label className="flex items-center gap-2 cursor-pointer select-none group" data-tour="builder-wysiwyg">
                      <div
                        className={clsx(
                          "w-5 h-5 rounded border-2 flex items-center justify-center transition-all",
                          !wysiwyg ? "bg-accent border-accent" : "border-outline group-hover:border-accent",
                        )}
                      >
                        {!wysiwyg && (
                          <div className="w-2.5 h-1.5 border-b-2 border-l-2 border-bg -rotate-45 -mt-0.5" />
                        )}
                      </div>
                      <input
                        type="checkbox"
                        checked={!wysiwyg}
                        onChange={(e) => setWysiwyg(!e.target.checked)}
                        className="hidden"
                      />
                      <span className="text-sm font-bold text-muted group-hover:text-text transition-colors">WYSIWYG</span>
                    </label>
                  </CursorTooltip>

                  <div className="flex items-center bg-panel-2 border border-outline rounded-lg p-1 mr-2 h-[38px]" data-tour="builder-history-controls">
                    <button
                      onClick={undo}
                      disabled={past.length === 0}
                      className="w-8 h-full flex items-center justify-center rounded hover:bg-panel-3 disabled:opacity-30 disabled:hover:bg-transparent text-text transition-colors"
                      title={`Undo (${modKeyLabel}+Z)`}
                    >
                      <RotateCcw size={16} />
                    </button>
                    <div className="w-px h-4 bg-outline mx-1" />
                    <button
                      onClick={redo}
                      disabled={future.length === 0}
                      className="w-8 h-full flex items-center justify-center rounded hover:bg-panel-3 disabled:opacity-30 disabled:hover:bg-transparent text-text transition-colors"
                      title={`Redo (${modKeyLabel}+Shift+Z)`}
                    >
                      <RotateCw size={16} />
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      setConfigModalMode("config");
                      setIsConfigModalOpen(true);
                    }}
                    data-tour="builder-set-config"
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-panel-2 border border-outline hover:border-accent text-sm font-bold text-muted hover:text-text transition-all"
                  >
                    <Settings2 size={16} />
                    Set Configuration
                  </button>


                </div>
              </div>
            </div>

            {/* 2. Content Area (Cards on Background) */}
            <div className="min-h-[200px]">
              {builderMode === "visual" ? (
                <div className="space-y-6">
                  {duplicateInfo.labels.length > 0 && (
                    <div className="rounded-2xl border border-red/30 bg-red/10 px-4 py-3 text-sm text-red">
                      <span className="font-bold">Duplicate card terms detected.</span>{" "}
                      Rename or remove these before saving: {duplicateInfo.labels.join(", ")}.
                    </div>
                  )}
                  <div className="flex justify-end mb-2">
                    <button
                      onClick={() => setShowMarkdownHelp(true)}
                      data-tour="builder-markdown-help"
                      className="text-xs text-muted hover:text-accent flex items-center gap-1"
                    >
                      <HelpCircle size={12} /> Formatting Guide
                    </button>
                  </div>

                  {!isBuilderReady ? (
                    <div className="flex flex-col items-center justify-center h-[400px] gap-4">
                      <RotateCw
                        className="animate-spin text-accent"
                        size={48}
                      />
                      <div className="text-muted font-bold animate-pulse">
                        Loading Builder...
                      </div>
                    </div>
                  ) : (
                    <>
                      <DragDropContext onDragEnd={onDragEnd}>
                        <Droppable droppableId="builder-rows">
                          {(provided) => (
                            <div
                              {...provided.droppableProps}
                              ref={provided.innerRef}
                              data-tour="builder-card-list"
                              className="space-y-6"
                            >
                              {builderRows.map((row, index) => (
                                <Draggable
                                  key={row.id}
                                  draggableId={row.id}
                                  index={index}
                                >
                                  {(provided) => (
                                    <BuilderRowItem
                                      key={row.id}
                                      row={row}
                                      index={index}
                                      termLabel={termLabel}
                                      definitionLabel={definitionLabel}
                                      isDuplicate={duplicateInfo.ids.has(row.id)}
                                      isLast={index === builderRows.length - 1}
                                      termSideFields={termSideFields}
                                      defSideFields={defSideFields}
                                      showYear={showYear}
                                      enableTermCards={enableTermCards}
                                      updateRow={updateRow}
                                      removeRow={removeRow}
                                      onAddNext={addRow}
                                      onOpenImageModal={openImageModal}
                                      onDuplicate={duplicateRow}
                                      onSwap={swapRow}
                                      nextRowId={builderRows[index + 1]?.id}
                                      onFocusRowTerm={focusRowTerm}
                                      tabSelectsEverythingInBuilder={!!settings.tabSelectsEverythingInBuilder}
                                      draggableProps={provided.draggableProps}
                                      dragHandleProps={provided.dragHandleProps}
                                      innerRef={provided.innerRef}
                                      wysiwyg={wysiwyg}
                                      saveHistory={saveToHistory}
                                    />
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </DragDropContext>
                      <button
                        onClick={addRow}
                        data-tour="builder-add-card"
                        className="w-full py-4 border-2 border-dashed border-outline rounded-xl text-muted hover:text-accent hover:border-accent hover:bg-panel-2 transition-all flex items-center justify-center gap-2 text-sm font-bold mt-4"
                      >
                        <Plus size={16} /> Add Card
                      </button>
                    </>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <div className="flex justify-end mb-2">
                    <button
                      onClick={() => setShowMarkdownHelp(true)}
                      data-tour="builder-markdown-help"
                      className="text-xs text-muted hover:text-accent flex items-center gap-1"
                    >
                      <HelpCircle size={12} /> Formatting Guide
                    </button>
                  </div>
                  {/* Raw Text also gets a panel since it's one big input */}
                  <div className="bg-panel border border-outline rounded-2xl p-6 shadow-lg">
                    <textarea
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      placeholder={`Term / Definition /// Year ||| ImageURL\n\n&&&\n\nNext Term / Definition`}
                      className="w-full bg-panel-2 border border-outline rounded-xl p-4 min-h-[400px] font-mono text-sm focus:outline-none focus:border-accent resize-y leading-relaxed"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* 3. Footer Panel (Actions) */}
            <div className="bg-panel border border-outline rounded-2xl p-6 shadow-lg flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex gap-2 w-full md:w-auto" data-tour="builder-export-tools">
                <button
                  onClick={handleCopyCode}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 text-muted hover:text-text font-medium transition-colors rounded-lg hover:bg-panel-2"
                >
                  <Copy size={18} />
                  <span className="inline">Copy</span>
                </button>
                <button
                  onClick={handleDownloadFlashcards}
                  className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2 text-muted hover:text-text font-medium transition-colors rounded-lg hover:bg-panel-2"
                >
                  <Download size={18} />
                  <span className="inline">.flashcards</span>
                </button>
              </div>

              <div
                className="flex flex-col md:flex-row gap-3 w-full md:w-auto"
                data-tour="builder-save-study"
                data-tour-has-card={builderRows.some((row) => row.term.trim() && row.def.trim()) ? "true" : "false"}
              >
                <div
                  className="relative"
                  onMouseEnter={() => setHoveredButton("save")}
                  onMouseLeave={() => setHoveredButton(null)}
                >
                  <HelperTooltip
                    show={
                      hoveredButton === "save" && missingRequirements.length > 0
                    }
                    hideTooltips={false}
                    type="error"
                    position="top"
                    text={
                      <div className="text-left px-2">
                        <div className="font-bold mb-1">Set Incomplete:</div>
                        <ul className="list-disc pl-4 space-y-0.5">
                          {missingRequirements.map((req, i) => (
                            <li key={i}>{req}</li>
                          ))}
                        </ul>
                      </div>
                    }
                  />
                  <button
                    onClick={
                      missingRequirements.length === 0
                        ? handleSaveToLibrary
                        : undefined
                    }
                    data-tour="builder-save-library"
                    className={clsx(
                      "flex items-center justify-center gap-2 px-6 py-3 bg-panel-2 border border-outline rounded-xl font-bold text-text transition-all w-full md:w-auto",
                      missingRequirements.length > 0
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:border-accent",
                    )}
                  >
                    <FolderOpen size={18} /> Save to Library
                  </button>
                </div>

                <div
                  className="relative"
                  onMouseEnter={() => setHoveredButton("study")}
                  onMouseLeave={() => setHoveredButton(null)}
                >
                  <HelperTooltip
                    show={
                      hoveredButton === "study" && missingRequirements.length > 0
                    }
                    hideTooltips={false}
                    type="error"
                    position="top"
                    text={
                      <div className="text-left px-2">
                        <div className="font-bold mb-1">Set Incomplete:</div>
                        <ul className="list-disc pl-4 space-y-0.5">
                          {missingRequirements.map((req, i) => (
                            <li key={i}>{req}</li>
                          ))}
                        </ul>
                      </div>
                    }
                  />
                  <button
                    onClick={
                      missingRequirements.length === 0
                        ? handleStartSessionNow
                        : undefined
                    }
                    data-tour="builder-study-now"
                    className={clsx(
                      "flex items-center justify-center gap-2 px-8 py-3 rounded-xl font-bold transition-all shadow-lg w-full md:w-auto",
                      missingRequirements.length === 0
                        ? "bg-accent text-bg hover:scale-105 active:scale-95"
                        : "bg-accent/50 text-bg/80 cursor-not-allowed shadow-none",
                    )}
                  >
                    <Play size={18} fill="currentColor" /> Study Now
                  </button>
                </div>
              </div>
            </div>

            {/* 4. Warning Text */}
            <div className="text-center mt-6 text-sm opacity-80 space-y-1">
              <p className="text-red font-bold">
                Cards are saved per device in local storage: if you clear your
                cookies, you can lose them. It is highly recommended you
                download important sets!
              </p>
              {hasUploadedImages && (
                <p className="text-blue font-bold">
                  You've uploaded images directly to this set. If you download
                  your set, they won't be saved. To save them, put images in
                  your set with image URLs.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
