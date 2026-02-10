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
  AlertCircle,
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
  downloadFile,
  renderMarkdown,
  renderInline,
  extractCategory,
  isValidImageFile,
  sanitizeImageUrl,
} from "../utils";
import { RichInput, RichInputRef } from "./RichInput";
import clsx from "clsx";
import { AddSetModal } from "./AddSetModal";
import { RawTextImport } from "./RawTextImport";
import BreathingLoader from "./BreathingLoader";

// Color map for preset tag colors (Tailwind 500 shades)
const TAG_COLOR_MAP: Record<string, string> = {
  red: '#ef4444',
  orange: '#f97316',
  amber: '#f59e0b',
  yellow: '#eab308',
  lime: '#84cc16',
  green: '#22c55e',
  emerald: '#10b981',
  teal: '#14b8a6',
  cyan: '#06b6d4',
  sky: '#0ea5e9',
  blue: '#3b82f6',
  indigo: '#6366f1',
  violet: '#8b5cf6',
  purple: '#a855f7',
  fuchsia: '#d946ef',
  pink: '#ec4899',
  rose: '#f43f5e',
  slate: '#64748b',
  gray: '#6b7280',
  zinc: '#71717a',
  neutral: '#737373',
  stone: '#78716c',
};
const getTagColor = (color: string) => color.startsWith('#') ? color : (TAG_COLOR_MAP[color] || '#3b82f6');

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

const BUILDER_STORAGE_KEY = "flashcard-builder-rows";

const GREETINGS = [
  "What are we learning next?",
  "Who's excited to study?!",
  "You got this!",
  "Step 1 is studying.",
  "Lock in.",
  "One more set?",
  "What's up?",
  "All you.",
  "Greatness incoming?",
  "Hey, you're here.",
  "Welcome... or welcome back.",
  "Ready?",
  "You're in the right place.",
  "Onward.",
  "Heyo.",
  "Flashcards! Hurrah!",
  "Flashcardsish!",
  "'SET' it up. Haha, get it?",
  "Practice makes... good.",
  "Working hard... or hardly working?",
  "What'll it be?",
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
        <p className="text-muted mb-6">
          You have unsaved work in the builder. What would you like to do?
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onSave}
            className="w-full py-3 bg-accent text-bg rounded-xl font-bold transition-transform"
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
            className="w-full py-3 text-muted hover:text-text font-medium"
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
        <p className="text-muted mb-6">
          This folder contains {setCount} set{setCount === 1 ? "" : "s"}. What
          would you like to do with them?
        </p>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => onConfirm("move")}
            className="w-full py-3 bg-accent text-bg rounded-xl font-bold transition-transform"
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
            className="w-full py-3 text-muted hover:text-text font-medium"
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

// Markdown Help Modal
const MarkdownHelpModal: React.FC<{ isOpen: boolean; onClose: () => void }> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in"
      onMouseDown={onClose}
    >
      <div
        className="bg-panel border border-outline rounded-2xl p-8 w-full max-w-2xl shadow-2xl animate-in zoom-in-95"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6">
          <h3 className="font-bold text-2xl text-text">Formatting Guide</h3>
          <button onClick={onClose}>
            <X size={24} className="text-muted hover:text-text" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[70vh] pr-2 custom-scrollbar space-y-8">
          {/* Markdown Basics */}
          <div>
            <h4 className="text-lg font-bold mb-3 text-text">
              Markdown Basics
            </h4>
            <div className="bg-panel-2 border border-outline rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-panel">
                  <tr>
                    <th className="text-left px-4 py-3 text-muted font-medium">
                      You Type
                    </th>
                    <th className="text-right px-4 py-3 text-muted font-medium">
                      You Get
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline">
                  <tr>
                    <td className="px-4 py-3 font-mono text-muted">**bold**</td>
                    <td className="px-4 py-3 text-right text-text">
                      <strong>bold</strong>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-muted">*italic*</td>
                    <td className="px-4 py-3 text-right text-text">
                      <em>italic</em>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-muted">`code`</td>
                    <td className="px-4 py-3 text-right">
                      <code className="bg-panel px-1.5 py-0.5 rounded text-accent">
                        code
                      </code>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-muted">
                      ~~strikethrough~~
                    </td>
                    <td className="px-4 py-3 text-right text-text">
                      <s>strikethrough</s>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-muted">
                      __underline__
                    </td>
                    <td className="px-4 py-3 text-right text-text">
                      <u>underline</u>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-muted">
                      (Tag) Text
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span className="inline-block bg-accent/10 text-accent px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide">
                          Tag
                        </span>
                        <span className="text-text">Text</span>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Highlights */}
          <div>
            <h4 className="text-lg font-bold mb-3 text-text">Highlights</h4>
            <div className="bg-panel-2 border border-outline rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-panel">
                  <tr>
                    <th className="text-left px-4 py-3 text-muted font-medium">
                      You Type
                    </th>
                    <th className="text-right px-4 py-3 text-muted font-medium">
                      You Get
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline">
                  <tr>
                    <td className="px-4 py-3 font-mono text-muted">
                      &lt;h=y&gt;yellow&lt;/h&gt;
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="bg-yellow/20 text-yellow px-1 rounded">
                        yellow
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-muted">
                      &lt;h=r&gt;red&lt;/h&gt;
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="bg-red/20 text-red px-1 rounded">
                        red
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-muted">
                      &lt;h=b&gt;blue&lt;/h&gt;
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="bg-blue/20 text-blue px-1 rounded">
                        blue
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-muted">
                      &lt;h=g&gt;green&lt;/h&gt;
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="bg-green/20 text-green px-1 rounded">
                        green
                      </span>
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-muted">
                      &lt;h=p&gt;purple&lt;/h&gt;
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="bg-purple/20 text-purple px-1 rounded">
                        purple
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Raw Text Tips */}
          <div>
            <h4 className="text-lg font-bold mb-3 text-text">
              Raw Text Extras
            </h4>
            <div className="bg-panel-2 border border-outline rounded-xl p-4 text-sm space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted font-bold text-accent">
                  Image Link
                </span>
                <span className="font-mono text-yellow text-right">
                  ... ||| http://link/image.jpg
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <span className="text-muted font-bold text-accent">Year</span>
                <span className="font-mono text-yellow text-right">
                  ... /// Year
                </span>
              </div>
            </div>
          </div>
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
        <div className="flex items-center gap-3 mb-4 text-yellow">
          <AlertCircle size={24} />
          <h3 className="text-lg font-bold text-text">Warning</h3>
        </div>
        <p className="text-muted mb-6">{message}</p>
        <div className="flex flex-col gap-3">
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className="w-full py-3 rounded-xl bg-yellow text-bg font-bold transition-transform"
          >
            Confirm
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 text-muted hover:text-text font-medium"
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
        <div className="flex items-center gap-3 mb-4 text-red">
          <AlertCircle size={24} />
          <h3 className="text-lg font-bold text-text">Invalid File</h3>
        </div>
        <p className="text-muted mb-6">
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
        <div className="flex items-center gap-3 mb-4 text-yellow">
          <AlertCircle size={24} />
          <h3 className="text-lg font-bold text-text">No Starred Cards</h3>
        </div>
        <p className="text-muted mb-6">
          You have "Study Starred Only" enabled, but this set has no starred
          cards.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={onDisableAndPlay}
            className="w-full py-3 bg-accent text-bg rounded-xl font-bold transition-transform"
          >
            Disable Filter & Play
          </button>
          <button
            onClick={onClose}
            className="w-full py-3 text-muted hover:text-text font-medium"
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
      // CursorTooltip moved to specific icon
      <div
        key={index}
        className="relative group/field-row"
        onFocus={() => setActiveFieldId(`${side}-${index}`)}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setActiveFieldId(null);
          }
        }}
      >
        <div className="flex flex-col gap-2 mb-3 bg-panel-2 border border-outline rounded-xl p-3">
          <div className="flex items-center gap-2">
            <CursorTooltip
              content={tooltipContent}
              isEnabled={!hideTooltips}
            >
              <HelpCircle
                size={16}
                className="text-muted hover:text-accent cursor-help flex-shrink-0 transition-colors"
              />
            </CursorTooltip>

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
              autoFocus={!field.name}
              spellCheck={false}
              data-ms-editor="true"
            />

            {/* Custom Dropdown */}
            <div className="relative w-32 flex-shrink-0" ref={dropdownRef}>
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full h-full bg-panel border border-outline rounded-lg px-3 py-2 text-sm focus:border-accent outline-none transition-colors flex items-center justify-between gap-2"
              >
                <span className="capitalize truncate">
                  {field.type === "ab" ? "A/B" : field.type === "tf" ? "True/False" : field.type}
                </span>
                <ChevronDown size={12} className="opacity-50 flex-shrink-0" />
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
                        "w-full text-left px-4 py-2 text-sm hover:bg-panel-2 transition-colors",
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

            <button
              onClick={() => remove(index)}
              className="p-2 text-muted hover:text-red transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          {field.type === "ab" && (
            <div className="flex gap-2">
              <input
                value={field.options?.a || ""}
                onChange={(e) =>
                  update(index, {
                    options: { a: e.target.value, b: field.options?.b || "" },
                  })
                }
                placeholder="Option A"
                className="flex-1 bg-panel border-b border-outline/50 bg-transparent px-2 py-1 text-xs focus:border-accent outline-none transition-colors"
              />
              <input
                value={field.options?.b || ""}
                onChange={(e) =>
                  update(index, {
                    options: { a: field.options?.a || "", b: e.target.value },
                  })
                }
                placeholder="Option B"
                className="flex-1 bg-panel border-b border-outline/50 bg-transparent px-2 py-1 text-xs focus:border-accent outline-none transition-colors"
                onFocus={() => setActiveFieldId(`${side}-${index}`)} // Ensure focus triggers specific row
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
  onImportContinue?: (cards: Partial<Card>[]) => void;
  hideImportButton?: boolean;
  builderRows?: BuilderRow[];
  setBuilderRows?: (rows: BuilderRow[]) => void;
  tags: Tag[];
  onUpdateTags: (tags: Tag[]) => void;
  appliedTags: string[];
  setAppliedTags: (tags: string[]) => void;
  onManageTags?: () => void;
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
  importAppend,
  setImportAppend,
  importOverride,
  setImportOverride,
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
}) => {
    const [mode, setMode] = useState<"config" | "import">("config");
    const [activeFieldId, setActiveFieldId] = useState<string | null>(null);
    const [isTagDropdownOpen, setIsTagDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
          setIsTagDropdownOpen(false);
        }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    const [activeLabelSide, setActiveLabelSide] = useState<"term" | "def" | null>(null);

    // Reset mode on open
    useEffect(() => {
      if (isOpen) setMode("config");
    }, [isOpen]);

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
        setTermSideFields([...termSideFields, { name: "", type: "text" }]);
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
        setDefSideFields([...defSideFields, { name: "", type: "text" }]);
      }
    };

    const deleteDefField = (index: number) => {
      setDefSideFields(defSideFields.filter((_, i) => i !== index));
    };



    if (mode === "import" && rawText !== undefined && setRawText && onImportContinue) {
      return (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in"
          onMouseDown={onClose}
        >
          <div
            className="bg-panel border border-outline rounded-2xl p-6 w-full max-w-6xl h-[90vh] shadow-2xl animate-in zoom-in-95 flex flex-col overflow-hidden"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <RawTextImport
              onClose={() => setMode('config')}
              onContinue={(cards) => {
                onImportContinue(cards);
                onClose();
              }}
              rawText={rawText}
              setRawText={setRawText}
              isModal={true}
            />
          </div>
        </div>
      );
    }



    return (
      <div
        className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in"
        onMouseDown={onClose}
      >
        <div
          className="bg-panel border border-outline rounded-2xl p-8 w-full max-w-4xl shadow-2xl animate-in zoom-in-95 max-h-[90vh] overflow-y-auto custom-scrollbar"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-2xl font-bold text-text" style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}>Set Configuration</h3>
            {!hideImportButton && (
              <button
                onClick={() => setMode("import")}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-panel-2 border border-outline hover:border-accent text-xs font-bold text-muted hover:text-text transition-all"
              >
                <FileText size={14} />
                Import Raw Text
              </button>
            )}
          </div>
          <h4 className="text-lg font-bold text-text mb-2">Custom Fields</h4>
          <p className="text-muted mb-8 text-sm leading-relaxed">
            You can tailor your flashcards set by renaming the main fields and
            adding up to 4 custom fields per side. <br /> <br />
            If you're repeating the same type of data in every card, like what category something falls into, this feature allows you to make the entry process for every one of those consistent. Regardless of how many custom fields you specify, leaving them blank or on their neutral option means that card won't ask for or have data for that custom field.
            <br /> <br /> Custom fields can be text, a number, a choice between two custom options, or a choice between true or false.
          </p>
          <div className="grid md:grid-cols-2 gap-8">
            {/* Term Side */}
            <div className="space-y-4">
              <div className="uppercase text-xs font-bold text-muted tracking-widest">
                Terms Side
              </div>

              <div className="flex items-center gap-2 relative">
                <HelperTooltip
                  show={activeLabelSide === "term"}
                  hideTooltips={settings.hideTooltips}
                  text={
                    <span>
                      When you’re studying <b>Terms</b>, we’ll call the{" "}
                      <b>Terms</b> side this word. You can put a language here, a
                      special title, or anything else.
                    </span>
                  }
                />
                <input
                  value={termLabel}
                  onChange={(e) => setTermLabel(e.target.value)}
                  onFocus={() => setActiveLabelSide("term")}
                  onBlur={() => setActiveLabelSide(null)}
                  className="flex-1 bg-panel-2 border border-outline rounded-xl px-4 py-3 text-lg focus:border-accent outline-none font-bold text-accent placeholder-accent/30 transition-colors"
                  placeholder="Term"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-text mb-2 block flex justify-between">
                  Custom Fields
                  <span className="text-xs font-normal text-muted">
                    {termSideFields.length}/4
                  </span>
                </label>
                <div className="space-y-1">
                  {termSideFields.map((field, i) => (
                    <FieldRowComponent
                      key={`term-${i}`}
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
                    />
                  ))}
                  {termSideFields.length < 4 && (
                    <button
                      onClick={addTermField}
                      className="w-full py-2 border border-dashed border-outline rounded-lg text-sm text-muted hover:text-accent hover:border-accent transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus size={14} /> Add Field
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Definition Side */}
            <div className="space-y-4">
              <div className="uppercase text-xs font-bold text-muted tracking-widest text-right">
                Definitions Side
              </div>

              <div className="flex items-center gap-2 relative">
                <HelperTooltip
                  show={activeLabelSide === "def"}
                  hideTooltips={settings.hideTooltips}
                  text={
                    <span>
                      When you’re studying <b>Definitions</b>, we’ll call the{" "}
                      <b>Definitions</b> side this word. You can put a language
                      here, a special title, or anything else.
                    </span>
                  }
                />
                <input
                  value={definitionLabel}
                  onChange={(e) => setDefinitionLabel(e.target.value)}
                  onFocus={() => setActiveLabelSide("def")}
                  onBlur={() => setActiveLabelSide(null)}
                  className="flex-1 bg-panel-2 border border-outline rounded-xl px-4 py-3 text-lg focus:border-accent outline-none font-bold text-accent placeholder-accent/30 transition-colors"
                  placeholder="Definition"
                />
              </div>

              <div>
                <label className="text-sm font-bold text-text mb-2 block flex justify-between">
                  Custom Fields
                  <span className="text-xs font-normal text-muted">
                    {defSideFields.length}/4
                  </span>
                </label>
                <div className="space-y-1">
                  {defSideFields.map((field, i) => (
                    <FieldRowComponent
                      key={`def-${i}`}
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
                    />
                  ))}
                  {defSideFields.length < 4 && (
                    <button
                      onClick={addDefField}
                      className="w-full py-2 border border-dashed border-outline rounded-lg text-sm text-muted hover:text-accent hover:border-accent transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus size={14} /> Add Field
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tags Section */}
          <div className="mt-8 pt-6 border-t border-outline/50">
            <h4 className="text-lg font-bold text-text mb-4">Tags</h4>
            <div className="flex flex-col gap-4">
              {/* Applied Tags List */}
              {appliedTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
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
            </div>
          </div>

          <div className="mt-8 pt-6 border-t border-outline/50">
            <h4 className="text-lg font-bold text-text mb-4">Misc.</h4>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <CursorTooltip
                  content="Adds an extra custom field for putting the year in. Goes on the term side."
                  isEnabled={!settings.hideTooltips}
                  tooltipClassName="w-80 max-w-[90vw]"
                >
                  <label className="flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={showYear}
                      onChange={() => setShowYear(!showYear)}
                      className="hidden"
                    />
                    <div
                      className={clsx(
                        "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                        showYear
                          ? "bg-accent border-accent text-bg"
                          : "bg-panel-2 border-outline",
                      )}
                    >
                      {showYear && <Check size={14} strokeWidth={4} />}
                    </div>
                    <div className="text-sm font-bold text-text">
                      Enable Year Field
                    </div>
                  </label>
                </CursorTooltip>

                <CursorTooltip
                  content="Adds an image button to the term side of each card. When enabled, you can attach images to both sides of your flashcards."
                  isEnabled={!settings.hideTooltips}
                  tooltipClassName="w-80 max-w-[90vw]"
                >
                  <label className="flex items-center gap-3 cursor-pointer select-none">
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
                        "w-5 h-5 rounded border flex items-center justify-center transition-colors",
                        enableTermCards
                          ? "bg-accent border-accent text-bg"
                          : "bg-panel-2 border-outline",
                      )}
                    >
                      {enableTermCards && <Check size={14} strokeWidth={4} />}
                    </div>
                    <div className="text-sm font-bold text-text">
                      Enable Term Images
                    </div>
                  </label>
                </CursorTooltip>
              </div>

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
                className="px-6 py-2.5 bg-accent text-bg font-bold rounded-xl hover:scale-105 transition-transform"
              >
                OK
              </button>
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
  draggableProps?: DraggableProvided["draggableProps"];
  dragHandleProps?: DraggableProvided["dragHandleProps"];
  innerRef?: (element: HTMLElement | null) => void;
  wysiwyg: boolean;
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
    draggableProps,
    dragHandleProps,
    innerRef,
    wysiwyg, // New prop
  }) => {
    const termData = useMemo(() => extractCategory(row.term), [row.term]);
    const defData = useMemo(() => extractCategory(row.def), [row.def]);
    const hasAnyTag = !!termData.category || !!defData.category;

    const [isEditingDef, setIsEditingDef] = useState(false);
    const [isEditingTerm, setIsEditingTerm] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const termTextareaRef = useRef<HTMLTextAreaElement>(null);

    // Highlight Toolbar State
    const [toolbarVisible, setToolbarVisible] = useState(false);
    const [toolbarPos, setToolbarPos] = useState({ top: 0, left: 0 });
    const activeToolbarRef = useRef<{
      field: "term" | "def";
      // We don't save range indices anymore for contentEditable, we rely on Window Selection
    } | null>(null);

    const termInputRef = useRef<RichInputRef>(null);
    const defInputRef = useRef<RichInputRef>(null);
    const handleMouseUp = (
      e: React.MouseEvent,
      field: "term" | "def",
    ) => {
      // For ContentEditable, we use Window Selection
      const selection = window.getSelection();
      if (selection && !selection.isCollapsed) {

        // Ensure the selection is actually inside OUR input
        // Just verify event target context
        activeToolbarRef.current = { field };

        // Calculate position based on selection range
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        setToolbarPos({
          top: rect.top - 20, // Relative to viewport, fixed toolbar uses fixed pos
          left: rect.left + (rect.width / 2),
        });
        setToolbarVisible(true);
      } else {
        activeToolbarRef.current = null;
        setToolbarVisible(false);
      }
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

    const applyFormat = (type: string, value?: string) => {
      if (!activeToolbarRef.current) return;

      const { field } = activeToolbarRef.current;
      const ref = field === 'term' ? termInputRef.current : defInputRef.current;

      if (ref) {
        ref.applyFormat(type, value);
      }

      activeToolbarRef.current = null;
      setToolbarVisible(false);
    };

    // Auto-focus textarea when entering edit mode
    useEffect(() => {
      if (isEditingDef && defInputRef.current) {
        defInputRef.current.focus();
      }
    }, [isEditingDef]);

    // Auto-focus term input when entering edit mode
    useEffect(() => {
      if (isEditingTerm && termInputRef.current) {
        termInputRef.current.focus();
      }
    }, [isEditingTerm]);

    // Handle Term Keydown (Tab to Def)
    const handleTermKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLDivElement>) => {
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        setIsEditingDef(true);
      }
      if (e.key === "Enter" && !e.shiftKey) {
        // keep default (newline)
      }
    };

    // Handle Definition Keydown (Bullets & Tab)
    const handleDefKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLDivElement>) => {
      if (e.key === "Enter") {
        // Auto-list handling for RichInput? 
        // For now, let's keep it simple. RichInput splits text by divs/p logic.
        // Implementing auto-bullet in RichInput is complex without cursor control via ref exposed methods.
        // We'll skip auto-bullet logic for this iteration to prioritize highlighting stability.
      }

      if (e.key === "Tab" && !e.shiftKey) {
        // Def is the last field now.
        if (isLast) {
          e.preventDefault();
          onAddNext();
        }
      }
    };

    return (
      <div
        ref={innerRef}
        {...draggableProps}
        className="relative group bg-panel border border-outline rounded-xl mb-6 shadow-sm hover:border-accent/50 transition-all"
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {/* Term Column */}
            <div className="relative group/term flex flex-col gap-3">
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
                  <RichInput
                    ref={termInputRef}
                    value={row.term}
                    onChange={(val) => updateRow(row.id, "term", val)}
                    onBlur={() => {
                      setToolbarVisible(false);
                      setIsEditingTerm(false);
                    }}
                    onMouseUp={(e) => handleMouseUp(e, "term")}
                    onKeyDown={handleTermKeyDown}
                    className="w-full bg-transparent border-none focus:outline-none px-4 py-3 text-base min-h-[40px] block leading-relaxed font-bold text-text h-full"
                    placeholder="Enter term..."
                  />
                </div>
              ) : (
                <div
                  tabIndex={0}
                  onFocus={() => setIsEditingTerm(true)}
                  onClick={() => setIsEditingTerm(true)}
                  className={clsx(
                    "w-full min-h-[50px] px-4 py-3 text-base bg-panel-2 border rounded-xl cursor-text hover:border-accent/50 transition-colors focus:outline-none focus:border-accent leading-relaxed break-words font-medium flex-1 h-full",
                    row.term
                      ? "border-outline"
                      : "border-outline text-muted italic",
                  )}
                >
                  {row.term ? (wysiwyg ? renderMarkdown(termData.body) : termData.body) : "Enter term..."}
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
            </div>

            {/* Definition Column */}
            <div className="relative group/def flex flex-col gap-3">
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
                  <RichInput
                    ref={defInputRef}
                    value={row.def}
                    onChange={(val) => updateRow(row.id, "def", val)}
                    onBlur={() => {
                      setToolbarVisible(false);
                      setIsEditingDef(false);
                    }}
                    onMouseUp={(e) => handleMouseUp(e, "def")}
                    onKeyDown={handleDefKeyDown}
                    className="w-full bg-transparent border-none focus:outline-none px-4 py-3 text-base min-h-[40px] block leading-relaxed font-medium text-text h-full"
                    placeholder="Enter definition..."
                  />
                </div>
              ) : (
                <div
                  tabIndex={0}
                  onFocus={() => setIsEditingDef(true)}
                  onClick={() => setIsEditingDef(true)}
                  className={clsx(
                    "w-full min-h-[50px] px-4 py-3 text-base bg-panel-2 border rounded-xl cursor-text hover:border-accent/50 transition-colors focus:outline-none focus:border-accent leading-relaxed break-words font-medium text-text flex-1 h-full",
                    row.def
                      ? "border-outline"
                      : "border-outline text-muted italic",
                  )}
                >
                  {row.def
                    ? (wysiwyg ? renderMarkdown(defData.body) : defData.body)
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
            </div>
          </div>

          {/* Bottom Row: Metadata Grid (Horizontal) */}
          {(showYear ||
            termSideFields.length > 0 ||
            defSideFields.length > 0) && (
              <div className="mt-6 pt-4 border-t border-outline/50 grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-1">
                {/* Term Side Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">
                  {/* Year */}
                  {showYear && (
                    <div className="flex flex-col gap-2">
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

                {/* Def Side Fields */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 content-start">
                  {defSideFields.map((field) => (
                    <CustomFieldInput
                      key={`def-${field.name}`}
                      field={field}
                      row={row}
                      updateRow={updateRow}
                    />
                  ))}
                </div>
              </div>
            )}
        </div>
        <FloatingToolbar
          visible={toolbarVisible}
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
      <div className="flex flex-col gap-2">
        <label
          className="text-xs font-bold text-muted uppercase tracking-wider ml-1 truncate"
          title={field.name}
        >
          {field.name}
        </label>
        <div className="flex w-full bg-panel-2 border border-outline rounded-lg p-1 relative h-[38px]">
          <div
            className="absolute top-1 bottom-1 bg-accent rounded transition-all duration-300 ease-out shadow-sm"
            style={{
              width: "calc((100% - 8px) / 3)",
              left: `calc(4px + (100% - 8px) / 3 * ${val === optionA ? 0 : val === optionB ? 2 : 1
                })`,
            }}
          />

          <button
            onClick={() => handleCustomChange(optionA)}
            className={clsx(
              "flex-1 relative z-10 flex items-center justify-center font-bold text-xs transition-colors",
              val === optionA
                ? "text-bg"
                : "text-muted hover:text-text",
            )}
            title={optionA}
          >
            {optionA}
          </button>

          <button
            onClick={() => handleCustomChange("")}
            className={clsx(
              "flex-1 relative z-10 flex items-center justify-center font-bold text-xs transition-colors",
              !val || (val !== optionA && val !== optionB)
                ? "text-bg"
                : "text-muted hover:text-text",
            )}
          >
            <Minus size={14} strokeWidth={3} />
          </button>

          <button
            onClick={() => handleCustomChange(optionB)}
            className={clsx(
              "flex-1 relative z-10 flex items-center justify-center font-bold text-xs transition-colors",
              val === optionB
                ? "text-bg"
                : "text-muted hover:text-text",
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
}) => {
  const [view, setView] = useState<"menu" | "builder" | "raw-text">("menu");
  const [showAddSetModal, setShowAddSetModal] = useState(false);
  const [importAppend, setImportAppend] = useState(true);
  const [importOverride, setImportOverride] = useState<'keep' | 'duplicate' | 'override'>('keep');
  const [builderMode, setBuilderMode] = useState<"visual" | "raw">("visual"); // Deprecated?
  const [wysiwyg, setWysiwyg] = useState(true);
  const [showWysiwygHelp, setShowWysiwygHelp] = useState(false);
  const [showMarkdownHelp, setShowMarkdownHelp] = useState(false);

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
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderColor, setNewFolderColor] =
    useState<Folder["color"]>("brown");
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [moveToMenuOpen, setMoveToMenuOpen] = useState(false);

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

  // If in a folder, show sets in that folder.
  // If at root, show root sets (no folderId) AND folders.
  // Multistudy sets are always at root in their own section.

  const displayedSets = currentFolderId
    ? librarySets.filter((s) => s.folderId === currentFolderId)
    : librarySets.filter((s) => !s.isMultistudy && !s.folderId);

  const displayedFolders = currentFolderId ? [] : folders;

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
    if (selectedSetIds.size === displayedSets.length) {
      setSelectedSetIds(new Set());
    } else {
      setSelectedSetIds(new Set(displayedSets.map((s) => s.id)));
    }
  };

  const handleCreateFolder = () => {
    if (selectedSetIds.size === 0) return;
    setNewFolderColor("brown");
    setIsCreatingFolder(true);
  };

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

    // Select all sets in folder and trigger multistudy creation logic
    // But we can just reuse the logic directly
    const allCards: Card[] = [];
    folderSets.forEach((set) => {
      set.cards.forEach((card) => {
        allCards.push({
          ...card,
          originalSetId: set.id,
          originalSetName: set.name,
        });
      });
    });

    const newSet: CardSet = {
      id: generateId(),
      name: `Folder Study: ${folders.find((f) => f.id === folderId)?.name}`,
      cards: allCards,
      lastPlayed: Date.now(),
      elapsedTime: 0,
      topStreak: 0,
      isSessionActive: true,
      isMultistudy: true,
      customFieldNames: [],
    };

    const allCustomFields = new Set<string>();
    folderSets.forEach((s) =>
      s.customFieldNames?.forEach((n) => allCustomFields.add(n)),
    );
    newSet.customFieldNames = Array.from(allCustomFields);

    handlePlaySet(newSet);
  };

  const handleMoveSelectedToFolder = (folderId: string | undefined) => {
    setLibrarySets((prev) =>
      prev.map((s) => (selectedSetIds.has(s.id) ? { ...s, folderId } : s)),
    );
    setSelectedSetIds(new Set());
    setMovingSetId(null); // Close any move UI if open
    setMoveToMenuOpen(false); // Close the move menu
  };

  const handleCreateMultistudy = () => {
    const selectedSets = librarySets.filter((s) => selectedSetIds.has(s.id));
    if (selectedSets.length < 2) {
      alert("Please select at least 2 sets for a Multistudy session.");
      return;
    }

    const allCards: Card[] = [];
    selectedSets.forEach((set) => {
      set.cards.forEach((card) => {
        allCards.push({
          ...card,
          originalSetId: set.id,
          originalSetName: set.name,
        });
      });
    });

    // Shuffle cards? Or keep order? Usually multistudy implies shuffling.
    // Let's shuffle them for good measure, or let the game handle it.
    // The game shuffles anyway.

    const newSet: CardSet = {
      id: generateId(),
      name: `Multistudy (${selectedSets.length} Sets)`,
      cards: allCards,
      lastPlayed: Date.now(),
      elapsedTime: 0,
      topStreak: 0,
      isSessionActive: true,
      isMultistudy: true,
      customFieldNames: [], // Merge custom fields? Complex. Let's leave empty for now or try to merge unique ones.
    };

    // Merge custom field names
    const allCustomFields = new Set<string>();
    selectedSets.forEach((s) =>
      s.customFieldNames?.forEach((n) => allCustomFields.add(n)),
    );
    newSet.customFieldNames = Array.from(allCustomFields);

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
  const greeting = useMemo(
    () => GREETINGS[Math.floor(Math.random() * GREETINGS.length)],
    [],
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

  const handleRawTextContinue = (cards: Partial<Card>[]) => {
    // Convert cards to BuilderRows
    const newRows: BuilderRow[] = cards.map((c, i) => {
      let term = c.term?.[0] || "";
      // Tags handling if needed... (assuming raw text import parses tags? not yet implemented in RawTextImport but let's assume safely)
      return {
        id: generateId() + "_imported_" + i,
        term: term,
        def: c.content || "",
        year: c.year || "",
        image: c.image || "",
        termImage: c.termImage || "",
        customFields: c.customFields || [],
        tags: c.tags || [],
        star: c.star || false
      };
    });

    // Auto-enable Years if detected in import
    if (cards.some((c) => c.year && c.year.trim())) setShowYear(true);

    // Merge Logic based on importAppend & importOverride
    if (!settings.importAppend) {
      // If not appending, replace entirely
      setBuilderRows(newRows);
    } else {
      // Append mode
      setBuilderRows(prev => {
        const result = [...prev];
        const strategy = settings.importOverride || 'keep';

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
        // Prepend tags to term if they exist (though in visual mode, tags are likely already in term if typed manually)
        // But if we have tags in r.tags (from loading), we should ensure they are in the raw text.
        // However, if the user typed "(Tag) Term" in the input, r.term already has it.
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

        // Tags are now part of the term in markdown, so we don't need %%TAGS%% syntax anymore for export/raw
        // unless we want to support legacy? No, user said "use markdown to add tags".

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
      // When syncing to rows, we put the tags back into the term for visual editing
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
        star: c.star || false,
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
      .map((name) => ({ name, type: "text" } as CustomFieldDefinition));

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
        star: c.star || false,
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
          return fields.map((name) => ({ name, type: "text" }));
        }
        return fields;
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
        Array.from(allNames).map((name) => ({ name, type: "text" })),
      ); // Default to def side text
    }

    if (rows.some((r) => r.year.trim())) setShowYear(true);
    else setShowYear(false);

    setEnableTermCards(set.enableTermCards || false);
    setAppliedTags(set.tags || []);
    setBuilderRows(rows);
    setView("builder");
    setBuilderMode("visual");
  };

  // --- ACTIONS ---

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const text = await e.target.files[0].text();
        // Basic validation: if text is empty or binary-looking (though text() cleans up some)
        if (!text.trim()) {
          throw new Error("Empty file");
        }

        // Detect if it's JSON or TXT
        let loadedName = e.target.files[0].name
          .replace(".json", "")
          .replace(".flashcards", "")
          .replace(".txt", "");
        let parsedCards: Partial<Card>[] = [];

        try {
          const json = JSON.parse(text);
          if (json.name) loadedName = json.name;
          parsedCards = parseInput(text); // parseInput handles both JSON structure and raw
        } catch {
          // Raw text fallback
          parsedCards = parseInput(text);
        }

        // If no cards found, or parser return empty
        if (parsedCards.length === 0) {
          setShowInvalidFileModal(true);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }

        // Extract V2 Metadata if JSON
        try {
          const json = JSON.parse(text);
          if (json.version >= 2 || json.termLabel || json.definitionLabel) {
            const mapJsonFields = (fields: any[]) => {
              if (!fields) return [];
              return fields.map((f: any) =>
                typeof f === "string" ? { name: f, type: "text" } : f,
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
            star: c.star || false,
          };
        });

        setBuilderRows(rows);
        setRawText(text);

        setSetName(loadedName);
        setView("builder");
        setBuilderMode("visual");
      } catch (error) {
        console.error("Upload failed", error);
        setShowInvalidFileModal(true);
        if (fileInputRef.current) fileInputRef.current.value = "";
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
          // Parse tags from term string for the Card object
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
            tags: tags, // Use extracted tags
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
      star: c.star || false,
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

    const cards: Card[] = builderRows
      .filter((row) => row.term.trim() || row.def.trim())
      .map((row) => {
        // Parse tags from term string
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

        return {
          id: generateId(),
          term: [termRaw],
          content: row.def.trim(),
          year: row.year.trim(),
          image: row.image,
          customFields: row.customFields.filter(f =>
            [...termSideFields, ...defSideFields].some(def => def.name === f.name)
          ),
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
  };

  const handleDownloadFlashcards = () => {
    const cards: Card[] = builderRows
      .filter((row) => row.term.trim() || row.def.trim())
      .map((row) => {
        // Parse tags from term string
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

        return {
          id: generateId(),
          term: [termRaw],
          content: row.def.trim(),
          year: row.year.trim(),
          image: row.image,
          customFields: row.customFields.filter((f) =>
            [...termSideFields, ...defSideFields].some(
              (def) => def.name === f.name,
            ),
          ),
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
  }, []);

  const openImageModal = useCallback((rowId: string, field: 'image' | 'termImage' = 'image') => {
    setEditingImageRowId(rowId);
    setEditingImageField(field);
    setShowImageModal(true);
  }, []);

  const swapRow = useCallback((id: string) => {
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

  const duplicateIds = useMemo(() => {
    const counts = new Map<string, number>();
    const ids = new Set<string>();
    builderRows.forEach((r) => {
      const t = r.term.trim().toLowerCase();
      if (!t) return;
      counts.set(t, (counts.get(t) || 0) + 1);
    });
    builderRows.forEach((r) => {
      const t = r.term.trim().toLowerCase();
      if (t && (counts.get(t) || 0) > 1) {
        ids.add(r.id);
      }
    });
    return ids;
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

  return (
    <div className="max-w-5xl mx-auto w-full pb-20 animate-in fade-in duration-700">
      <SetConfigurationModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
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
        importAppend={importAppend}
        setImportAppend={setImportAppend}
        importOverride={importOverride}
        setImportOverride={setImportOverride}
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
      <MarkdownHelpModal
        isOpen={showMarkdownHelp}
        onClose={() => setShowMarkdownHelp(false)}
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
                className="text-4xl text-text tracking-tight mb-2"
                style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}
              >
                {greeting}
              </h1>
            </div>
            <p className="text-muted text-lg">
              Study a deck or create a new one below.
            </p>
          </>
        ) : (
          <>
            <h1
              className="text-4xl text-text tracking-tight mb-2"
              style={{ fontFamily: "'Red Hat Display', sans-serif", fontWeight: 800 }}
            >
              List Builder
            </h1>
            <p className="text-accent font-bold text-2xl animate-in slide-in-from-left-2 fade-in duration-500">
              {view === "raw-text" ? "Import Raw Text" : "Visual Editor"}
            </p>
          </>
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
            {/* ONGOING SESSIONS */}
            {ongoingSessions.length > 0 && (
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
                                        <span className="text-accent">•</span>
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
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-bold text-muted uppercase tracking-widest flex items-center gap-2 pl-2">
                  {currentFolderId ? (
                    <button
                      onClick={() => setCurrentFolderId(null)}
                      className="flex items-center gap-1 hover:text-text transition-colors"
                    >
                      <ArrowLeft size={14} /> {currentFolder?.name}
                    </button>
                  ) : (
                    "Library"
                  )}
                </h3>
                <div className="flex gap-2">
                  {currentFolderId && (
                    <button
                      onClick={() => handleMultistudyFolder(currentFolderId)}
                      className="flex items-center gap-2 px-3 py-1.5 bg-accent/10 text-accent border border-accent/20 rounded-lg text-xs font-bold hover:bg-accent/20 transition-colors"
                    >
                      <Play size={14} /> Study Folder
                    </button>
                  )}
                  <button
                    onClick={handleCreateNew}
                    className="flex items-center gap-2 px-3 py-1.5 bg-text text-bg rounded-lg text-xs font-bold hover:scale-105 active:scale-95 transition-all shadow-lg"
                  >
                    <Plus size={14} /> Add
                  </button>
                </div>
              </div>

              {librarySets.length === 0 ? (
                isCloudLoading ? (
                  <BreathingLoader />
                ) : (
                  <div className="py-16 border border-dashed border-outline rounded-2xl bg-panel/30 text-center">
                    <p className="text-muted italic mb-4">
                      Your library is empty.
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
                          (s) => s.folderId === folder.id,
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
                            )}
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
                      <div key={set.id} className="relative group/row">
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
                              <div className="text-xs text-muted font-mono">
                                {set.cards.length} card
                                {set.cards.length === 1 ? "" : "s"}
                              </div>
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
                              className="w-full px-4 py-2 bg-panel-2 border border-outline hover:border-accent text-text text-sm font-bold rounded-lg hover:bg-accent hover:text-bg transition-all flex items-center justify-center gap-2"
                            >
                              <ExternalLink size={14} /> Open
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Floating Action Bar */}
                  {selectedSetIds.size > 0 && (
                    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-panel border border-outline shadow-2xl p-2 rounded-2xl animate-in slide-in-from-bottom-4">
                      <div className="pl-4 pr-2 text-sm font-bold text-text">
                        {selectedSetIds.size} selected
                      </div>
                      <div className="h-6 w-px bg-outline"></div>
                      <button
                        onClick={handleCreateMultistudy}
                        className="px-6 py-2 bg-accent text-bg font-bold rounded-xl hover:scale-105 active:scale-95 transition-all shadow-lg"
                      >
                        Multistudy
                      </button>
                      <button
                        onClick={handleCombineSets}
                        className="px-6 py-2 bg-panel-2 border border-accent text-accent font-bold rounded-xl hover:bg-accent hover:text-bg transition-all shadow-lg flex items-center gap-2"
                        title="Create a new set by combining all selected sets"
                      >
                        <Combine size={16} /> Combine
                      </button>
                      <button
                        onClick={handleCreateFolder}
                        className="px-6 py-2 bg-panel-2 border border-outline text-text font-bold rounded-xl hover:bg-panel-3 transition-all shadow-lg"
                      >
                        New Folder
                      </button>
                      <div className="relative">
                        <button
                          onClick={() => setMoveToMenuOpen(!moveToMenuOpen)}
                          className={clsx(
                            "px-6 py-2 bg-panel-2 border text-text font-bold rounded-xl hover:bg-panel-3 transition-all shadow-lg flex items-center gap-2",
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
                          "px-6 py-2 font-bold rounded-xl transition-all border border-transparent",
                          batchDeleteClicks > 0
                            ? "bg-red text-bg animate-pulse"
                            : "bg-panel-2 text-red hover:bg-red/10",
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
                        <div className="grid grid-cols-6 gap-2 mb-6">
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
                                  : "opacity-70 hover:opacity-100 hover:scale-105",
                              )}
                              title={color}
                            />
                          ))}
                        </div>
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => setIsCreatingFolder(false)}
                            className="px-4 py-2 text-muted hover:text-text"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => confirmCreateFolder(newFolderColor)}
                            className="px-6 py-2 bg-text text-bg font-bold rounded-lg hover:bg-text/90 transition-colors"
                          >
                            OK
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
          />
        )}

        {view === "builder" && (
          <div className="animate-in zoom-in-95 duration-300 space-y-6">
            <p className="text-sm text-text/60 leading-relaxed max-w-4xl">
              Use this menu to build your set. Use markdown to format your cards and buttons on screen to star cards or swap them. You can drag cards using the left-side handles to change their order. Use Set Configuration to adjust and add custom fields.
            </p>


            {/* 1. Header Panel (Floating Container) */}
            <div className="bg-panel border border-outline rounded-2xl p-6 shadow-lg">
              <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <input
                  value={setName}
                  onChange={(e) => setSetName(e.target.value)}
                  placeholder="Set Name"
                  className="bg-panel-2 border border-outline rounded-xl px-4 py-2 text-text w-full md:w-auto min-w-[300px] focus:outline-none focus:border-accent transition-colors font-bold"
                />

                <div className="flex items-center gap-6">
                  {/* WYSIWYG Toggle */}
                  <CursorTooltip
                    content="Toggle whether the card previews are shown as Markdown or formatted."
                    isEnabled={!settings.hideTooltips}
                  >
                    <label className="flex items-center gap-2 cursor-pointer select-none group">
                      <div className={clsx("w-5 h-5 rounded border flex items-center justify-center transition-colors", wysiwyg ? "bg-accent border-accent text-bg" : "bg-panel-2 border-outline group-hover:border-text")}>
                        {wysiwyg && <Check size={14} strokeWidth={4} />}
                      </div>
                      <input
                        type="checkbox"
                        checked={wysiwyg}
                        onChange={(e) => setWysiwyg(e.target.checked)}
                        className="hidden"
                      />
                      <span className="text-sm font-bold text-muted group-hover:text-text transition-colors">WYSIWYG</span>
                    </label>
                  </CursorTooltip>

                  <button
                    onClick={() => setIsConfigModalOpen(true)}
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
                  <div className="flex justify-end mb-2">
                    <button
                      onClick={() => setShowMarkdownHelp(true)}
                      className="text-xs text-muted hover:text-accent flex items-center gap-1"
                    >
                      <HelpCircle size={12} /> Formatting Help
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
                                      isDuplicate={duplicateIds.has(row.id)}
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
                                      draggableProps={provided.draggableProps}
                                      dragHandleProps={provided.dragHandleProps}
                                      innerRef={provided.innerRef}
                                      wysiwyg={wysiwyg}
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
                      className="text-xs text-muted hover:text-accent flex items-center gap-1"
                    >
                      <HelpCircle size={12} /> Formatting Help
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
              <div className="flex gap-2 w-full md:w-auto">
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

              <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
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
