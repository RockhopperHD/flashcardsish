import { Card } from '../types';
import { generateId } from '../utils';

export interface RawImportOptions {
  termDefinitionSeparator: string;
  cardSeparator: string;
  useBulletMarker?: boolean;
  bulletMarker?: string;
  createId?: () => string;
}

export const COMMON_TERM_DEFINITION_SEPARATORS = ['/', ':', '-'];
export const COMMON_CARD_SEPARATORS = ['\\n\\n', '&&&', ';;;'];

export const parseRawImportCards = (
  rawText: string,
  options: RawImportOptions
): Partial<Card>[] => {
  if (!rawText.trim()) return [];

  const result: Partial<Card>[] = [];
  const resolvedCardSeparator = options.cardSeparator.replace(/\\n/g, '\n');
  const resolvedTermDefinitionSeparator = options.termDefinitionSeparator;
  const createId = options.createId || generateId;

  if (!resolvedCardSeparator || !resolvedTermDefinitionSeparator) return [];

  const rawCards = rawText.split(resolvedCardSeparator);

  rawCards.forEach(rawCard => {
    const trimmedCard = rawCard.trim();
    if (!trimmedCard) return;

    const bulletMarker = options.bulletMarker || '';
    if (options.useBulletMarker && bulletMarker && trimmedCard.startsWith(bulletMarker)) {
      if (result.length > 0) {
        const prevCard = result[result.length - 1];
        const bulletContent = trimmedCard.slice(bulletMarker.length).trim();

        if (prevCard.content) {
          prevCard.content += `\n- ${bulletContent}`;
        } else {
          prevCard.content = `- ${bulletContent}`;
        }
        return;
      }
    }

    let term = '';
    let definition = '';

    const parts = rawCard.split(resolvedTermDefinitionSeparator);
    if (parts.length > 0) {
      term = parts[0].trim();
      definition = parts.slice(1).join(resolvedTermDefinitionSeparator).trim();
    }

    if (options.useBulletMarker && bulletMarker && definition) {
      definition = definition.split('\n').map(line => {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith(bulletMarker)) {
          return `- ${trimmedLine.slice(bulletMarker.length).trim()}`;
        }
        return line;
      }).join('\n');
    }

    if (term || definition) {
      result.push({
        term: [term],
        content: definition,
        id: createId(),
        mastery: 0,
        star: false
      });
    }
  });

  return result;
};
