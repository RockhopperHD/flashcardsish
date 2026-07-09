import { CardSet } from '../types';

export class ShareValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShareValidationError';
  }
}

export const validateSetForSharing = (set: CardSet): void => {
  if (set.cards.length > 150) {
    throw new ShareValidationError(`Sets with more than 150 cards cannot be shared (this set has ${set.cards.length}).`);
  }

  for (const card of set.cards) {
    for (const term of card.term) {
      if (term.length > 1500) {
        throw new ShareValidationError('A card term exceeds the 1,500 character limit.');
      }
    }
    if (card.content.length > 1500) {
      throw new ShareValidationError('A card definition exceeds the 1,500 character limit.');
    }
    if (card.customFields) {
      for (const cf of card.customFields) {
        if (cf.value.length > 300) {
          throw new ShareValidationError('A custom field value exceeds the 300 character limit.');
        }
      }
    }
  }
};
