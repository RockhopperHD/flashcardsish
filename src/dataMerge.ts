import { normalizeCardMastery } from '../cardNormalization';
import { CardSet, Settings, Tag, Folder } from '../types';

export interface FlashcardsishExportFile {
  exportedAt: string;
  version: 'flashcardsish-export-v1';
  librarySets?: CardSet[];
  folders?: Folder[];
  settings?: Partial<Settings>;
  stats?: { lifetimeCorrect?: number };
  tags?: Tag[];
}

export const parseExportData = (raw: string): FlashcardsishExportFile => {
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Backup file is not valid JSON data.');
  }

  if (parsed.version !== 'flashcardsish-export-v1') {
    throw new Error('Unsupported backup version. Expected flashcardsish-export-v1.');
  }

  return parsed as FlashcardsishExportFile;
};

const dedupeStrings = (values: string[] = []): string[] => Array.from(new Set(values));

const normalizeStringArrayForSignature = (values: string[] = []): string[] =>
  Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));

const normalizeCustomFieldsForSignature = (fields: { name: string; value: string }[] = []) =>
  fields
    .map(field => ({ name: field.name || '', value: field.value || '' }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.value.localeCompare(b.value));

const cardContentSignature = (card: CardSet['cards'][number]): string => JSON.stringify({
  term: Array.isArray(card.term) ? card.term : [],
  content: card.content || '',
  year: card.year || '',
  image: card.image || '',
  termImage: card.termImage || '',
  customFields: normalizeCustomFieldsForSignature(card.customFields || []),
  tags: normalizeStringArrayForSignature(card.tags || [])
});

const stableHash = (value: string): string => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
};

const createConflictCardId = (baseId: string, signature: string, usedIds: Set<string>): string => {
  const base = `${baseId}__merge_${stableHash(signature)}`;
  if (!usedIds.has(base)) return base;

  let counter = 2;
  let candidate = `${base}_${counter}`;
  while (usedIds.has(candidate)) {
    counter += 1;
    candidate = `${base}_${counter}`;
  }
  return candidate;
};

export interface MergeSetOptions {
  normalizeSet?: (set: CardSet) => CardSet;
}

export const mergeSetWithoutLosingCards = (
  localSet: CardSet,
  cloudSet: CardSet,
  options: MergeSetOptions = {}
): CardSet => {
  const localCards = localSet.cards || [];
  const cloudCards = cloudSet.cards || [];
  const mergedCards = localCards.map(card => ({ ...card }));
  const usedIds = new Set(mergedCards.map(card => card.id));
  const localIndexById = new Map<string, number>();
  const signatureToIndex = new Map<string, number>();

  const mergeProgressFields = (
    preferredContent: CardSet['cards'][number],
    localCard: CardSet['cards'][number],
    cloudCard: CardSet['cards'][number]
  ): CardSet['cards'][number] => ({
    ...preferredContent,
    mastery: Math.max(normalizeCardMastery(localCard.mastery), normalizeCardMastery(cloudCard.mastery)),
    star: localCard.star === true || cloudCard.star === true,
    originalSetId: preferredContent.originalSetId || localCard.originalSetId || cloudCard.originalSetId,
    originalSetName: preferredContent.originalSetName || localCard.originalSetName || cloudCard.originalSetName
  });

  mergedCards.forEach((card, index) => {
    localIndexById.set(card.id, index);
    const signature = cardContentSignature(card);
    if (!signatureToIndex.has(signature)) {
      signatureToIndex.set(signature, index);
    }
  });

  for (const cloudCard of cloudCards) {
    const cloudSignature = cardContentSignature(cloudCard);
    const localIndex = localIndexById.get(cloudCard.id);

    if (localIndex !== undefined) {
      const localCard = mergedCards[localIndex];
      const localSignature = cardContentSignature(localCard);

      mergedCards[localIndex] = mergeProgressFields(localCard, localCard, cloudCard);

      if (localSignature !== cloudSignature && !signatureToIndex.has(cloudSignature)) {
        const conflictId = createConflictCardId(cloudCard.id, cloudSignature, usedIds);
        const conflictCard = mergeProgressFields(
          { ...cloudCard, id: conflictId },
          localCard,
          cloudCard
        );
        mergedCards.push(conflictCard);
        const newIndex = mergedCards.length - 1;
        usedIds.add(conflictId);
        localIndexById.set(conflictId, newIndex);
        signatureToIndex.set(cloudSignature, newIndex);
      }
      continue;
    }

    const existingBySignature = signatureToIndex.get(cloudSignature);
    if (existingBySignature !== undefined) {
      const existingCard = mergedCards[existingBySignature];
      mergedCards[existingBySignature] = mergeProgressFields(existingCard, existingCard, cloudCard);
      continue;
    }

    let nextId = cloudCard.id;
    if (usedIds.has(nextId)) {
      nextId = createConflictCardId(cloudCard.id, cloudSignature, usedIds);
    }
    const mergedCloudCard = { ...cloudCard, id: nextId };
    mergedCards.push(mergedCloudCard);
    const newIndex = mergedCards.length - 1;
    usedIds.add(nextId);
    localIndexById.set(nextId, newIndex);
    signatureToIndex.set(cloudSignature, newIndex);
  }

  const useLocalMetadata = (localSet.lastPlayed || 0) > (cloudSet.lastPlayed || 0);
  const metadataSource = useLocalMetadata ? localSet : cloudSet;

  const mergedSet: CardSet = {
    ...cloudSet,
    name: metadataSource.name,
    sourceId: metadataSource.sourceId ?? cloudSet.sourceId,
    version: metadataSource.version ?? cloudSet.version,
    termLabel: metadataSource.termLabel ?? cloudSet.termLabel,
    definitionLabel: metadataSource.definitionLabel ?? cloudSet.definitionLabel,
    termSideFields: metadataSource.termSideFields ?? cloudSet.termSideFields,
    defSideFields: metadataSource.defSideFields ?? cloudSet.defSideFields,
    enableTermCards: metadataSource.enableTermCards ?? cloudSet.enableTermCards,
    customFieldNames: dedupeStrings([
      ...(cloudSet.customFieldNames || []),
      ...(localSet.customFieldNames || [])
    ]),
    tags: dedupeStrings([...(cloudSet.tags || []), ...(localSet.tags || [])]),
    isMultistudy: metadataSource.isMultistudy ?? cloudSet.isMultistudy,
    sourceSetIds: metadataSource.sourceSetIds ?? cloudSet.sourceSetIds,
    lastPlayed: Math.max(localSet.lastPlayed || 0, cloudSet.lastPlayed || 0),
    elapsedTime: Math.max(localSet.elapsedTime || 0, cloudSet.elapsedTime || 0),
    topStreak: Math.max(localSet.topStreak || 0, cloudSet.topStreak || 0),
    isSessionActive: Boolean(localSet.isSessionActive || cloudSet.isSessionActive),
    learnSessionStats: metadataSource.learnSessionStats ?? cloudSet.learnSessionStats ?? localSet.learnSessionStats,
    isLocalOnly: false,
    folderId: cloudSet.folderId ?? (localSet.isLocalOnly ? undefined : localSet.folderId),
    cards: mergedCards
  };

  return options.normalizeSet ? options.normalizeSet(mergedSet) : mergedSet;
};
