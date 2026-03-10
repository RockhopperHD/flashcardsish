const MAX_CARD_MASTERY = 2;

export const normalizeCardMastery = (value: unknown): number => {
  let parsed: number | null = null;

  if (typeof value === "number") {
    parsed = value;
  } else if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) {
      parsed = numeric;
    }
  }

  if (parsed === null || !Number.isFinite(parsed)) {
    return 0;
  }

  return Math.min(MAX_CARD_MASTERY, Math.max(0, Math.trunc(parsed)));
};

export const normalizeCardStar = (value: unknown): boolean => value === true;
