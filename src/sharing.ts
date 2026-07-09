import { doc, setDoc, getDoc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import { CardSet, CustomFieldDefinition } from '../types';
import { ShareValidationError, validateSetForSharing } from './shareValidation';

export { ShareValidationError, validateSetForSharing };

// Strip base64 data URIs; keep Google Drive file IDs and normal URLs
const sanitizeImage = (v?: string): string | undefined => {
  if (!v || v.startsWith('data:')) return undefined;
  return v;
};

export interface SharedSetSnapshot {
  name: string;
  cards: Array<{
    id: string;
    term: string[];
    content: string;
    year?: string;
    image?: string;
    termImage?: string;
    customFields?: { name: string; value: string }[];
    mastery: 0;
    star: false;
  }>;
  termLabel?: string;
  definitionLabel?: string;
  termSideFields?: CustomFieldDefinition[];
  defSideFields?: CustomFieldDefinition[];
  createdAt: Timestamp;
  expiresAt: Timestamp;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export const createSharedLink = async (set: CardSet): Promise<string> => {
  validateSetForSharing(set);
  const id = Array.from(crypto.getRandomValues(new Uint8Array(9)))
    .map(b => b.toString(36).padStart(2, '0'))
    .join('');

  const now = Timestamp.now();
  const expiresAt = Timestamp.fromMillis(now.toMillis() + SEVEN_DAYS_MS);

  const snapshot: SharedSetSnapshot = {
    name: set.name,
    cards: set.cards.map(c => ({
      id: c.id,
      term: c.term,
      content: c.content,
      ...(c.year ? { year: c.year } : {}),
      ...(sanitizeImage(c.image) ? { image: sanitizeImage(c.image) } : {}),
      ...(sanitizeImage(c.termImage) ? { termImage: sanitizeImage(c.termImage) } : {}),
      ...(c.customFields?.length ? { customFields: c.customFields } : {}),
      mastery: 0 as const,
      star: false as const,
    })),
    ...(set.termLabel ? { termLabel: set.termLabel } : {}),
    ...(set.definitionLabel ? { definitionLabel: set.definitionLabel } : {}),
    ...(set.termSideFields?.length ? { termSideFields: set.termSideFields } : {}),
    ...(set.defSideFields?.length ? { defSideFields: set.defSideFields } : {}),
    createdAt: now,
    expiresAt,
  };

  await setDoc(doc(db, 'shared_sets', id), snapshot);
  return id;
};

export const fetchSharedSet = async (id: string): Promise<SharedSetSnapshot | null> => {
  const snap = await getDoc(doc(db, 'shared_sets', id));
  if (!snap.exists()) return null;
  const data = snap.data() as SharedSetSnapshot;
  if (data.expiresAt.toMillis() < Date.now()) return null;
  return data;
};
