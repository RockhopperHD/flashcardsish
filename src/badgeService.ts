import { Badge, BadgeBenefit, BadgeDrawInstructions } from '../types';

const runtimeConfig = (globalThis as any).__FLASHCARDSISH_CONFIG__ ?? {};

const BADGE_FUNCTION_URL = String(
    runtimeConfig.badgesFunctionUrl ??
    import.meta.env.VITE_BADGES_FUNCTION_URL ??
    ''
).trim();

const BADGE_FUNCTION_API_KEY = String(
    runtimeConfig.badgesFunctionApiKey ??
    import.meta.env.VITE_BADGES_FUNCTION_API_KEY ??
    ''
).trim();

const BADGE_TIMEOUT_MS = Number(
    runtimeConfig.badgesRequestTimeoutMs ??
    import.meta.env.VITE_BADGES_REQUEST_TIMEOUT_MS ??
    8000
);

const CACHE_PREFIX = 'flashcardsish-badges-v1:';
const CACHE_TTL_MS = 5 * 60 * 1000;
const SAFE_COLOR_PATTERN = /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%]+\)|hsla?\([\d\s.,%]+\)|var\(--[a-zA-Z0-9-_]+\)|[a-zA-Z]+)$/;

export type BadgeLookupStatus = 'disabled' | 'success' | 'error';

export interface BadgeLookupResult {
    status: BadgeLookupStatus;
    badges: Badge[];
    fetchedAt: number | null;
    fromCache: boolean;
    error?: string;
}

interface BadgeCacheEntry {
    badges: Badge[];
    fetchedAt: number;
}

const isConfigReady = (): boolean => {
    return Boolean(BADGE_FUNCTION_URL);
};

const normalizeEmail = (email: string): string => {
    return email.trim().toLowerCase();
};

const slugify = (value: string): string => {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
};

const safeText = (value: unknown): string | null => {
    if (typeof value !== 'string') return null;
    const normalized = value.trim();
    return normalized.length ? normalized : null;
};

const safeColor = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim();
    if (!normalized.length) return undefined;
    return SAFE_COLOR_PATTERN.test(normalized) ? normalized : undefined;
};

const safeIcon = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const normalized = value.trim();
    if (!normalized.length) return undefined;
    return /^[a-zA-Z0-9_-]+$/.test(normalized) ? normalized : undefined;
};

const normalizeBenefits = (badgeId: string, input: unknown): BadgeBenefit[] => {
    if (!Array.isArray(input)) return [];

    return input
        .map((entry, index) => {
            if (typeof entry === 'string') {
                const label = safeText(entry);
                if (!label) return null;
                return {
                    id: `${badgeId}-benefit-${index + 1}`,
                    label,
                } satisfies BadgeBenefit;
            }

            if (typeof entry === 'object' && entry !== null) {
                const obj = entry as Record<string, unknown>;
                const label =
                    safeText(obj.label) ??
                    safeText(obj.title) ??
                    safeText(obj.name) ??
                    safeText(obj.text);

                if (!label) return null;

                return {
                    id: safeText(obj.id) ?? `${badgeId}-benefit-${index + 1}`,
                    label,
                    description: safeText(obj.description) ?? undefined,
                } satisfies BadgeBenefit;
            }

            return null;
        })
        .filter((value): value is BadgeBenefit => Boolean(value));
};

const normalizeDrawInstructions = (input: unknown): BadgeDrawInstructions => {
    const obj = (typeof input === 'object' && input !== null)
        ? (input as Record<string, unknown>)
        : {};

    return {
        backgroundColor: safeColor(obj.backgroundColor ?? obj.bgColor ?? obj.bg),
        textColor: safeColor(obj.textColor ?? obj.fgColor ?? obj.color),
        borderColor: safeColor(obj.borderColor ?? obj.strokeColor ?? obj.outlineColor),
        icon: safeIcon(obj.icon),
        emoji: safeText(obj.emoji) ?? undefined,
    };
};

const normalizeBadge = (input: unknown, index: number): Badge | null => {
    if (typeof input !== 'object' || input === null) return null;

    const raw = input as Record<string, unknown>;
    const name =
        safeText(raw.name) ??
        safeText(raw.label) ??
        safeText(raw.title);

    if (!name) return null;

    const fallbackId = slugify(name) || `badge-${index + 1}`;
    const id = safeText(raw.id) ?? fallbackId;

    const drawSource = raw.draw ?? raw.instructions ?? raw.render ?? raw.style;
    const draw = normalizeDrawInstructions(drawSource);

    if (!draw.icon) {
        draw.icon = safeIcon(raw.icon) ?? undefined;
    }
    if (!draw.backgroundColor) {
        draw.backgroundColor = safeColor(raw.backgroundColor ?? raw.bgColor ?? raw.color);
    }

    const benefits = normalizeBenefits(
        id,
        raw.benefits ?? raw.perks ?? raw.grants ?? raw.features
    );

    const description =
        safeText(raw.description) ??
        safeText(raw.details) ??
        safeText(raw.summary) ??
        undefined;

    const earnedAtInput = raw.earnedAt ?? raw.grantedAt ?? raw.awardedAt;
    const earnedAt = typeof earnedAtInput === 'number'
        ? earnedAtInput
        : Number.parseInt(String(earnedAtInput ?? ''), 10);

    return {
        id,
        name,
        description,
        icon: draw.icon,
        color: draw.backgroundColor,
        draw,
        benefits,
        earnedAt: Number.isFinite(earnedAt) ? earnedAt : undefined,
    };
};

const getCacheKey = (email: string): string => {
    return `${CACHE_PREFIX}${normalizeEmail(email)}`;
};

const readCache = (email: string): BadgeCacheEntry | null => {
    try {
        const raw = localStorage.getItem(getCacheKey(email));
        if (!raw) return null;
        const parsed = JSON.parse(raw) as BadgeCacheEntry;
        if (!Array.isArray(parsed.badges) || typeof parsed.fetchedAt !== 'number') {
            return null;
        }
        return parsed;
    } catch {
        return null;
    }
};

const writeCache = (email: string, entry: BadgeCacheEntry): void => {
    try {
        localStorage.setItem(getCacheKey(email), JSON.stringify(entry));
    } catch {
        // Ignore quota/storage errors. Badges are optional metadata.
    }
};

// Firebase backends can reply in different envelopes:
// - HTTP function: { badges: [...] }
// - callable-like: { result: { badges: [...] } }
// - wrapped JSON APIs: { data: { badges: [...] } }
const unwrapPayload = (responseBody: any): Record<string, unknown> => {
    const candidates: unknown[] = [
        responseBody,
        responseBody?.data,
        responseBody?.result,
        responseBody?.result?.data,
        responseBody?.data?.result,
    ];

    for (const candidate of candidates) {
        if (typeof candidate === 'object' && candidate !== null) {
            return candidate as Record<string, unknown>;
        }
    }

    return {};
};

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number): Promise<Response> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        return await fetch(url, {
            ...options,
            signal: controller.signal,
        });
    } finally {
        clearTimeout(timeout);
    }
};

export const isBadgeServiceConfigured = (): boolean => isConfigReady();

export const fetchBadgesForEmail = async (email: string, forceRefresh: boolean = false): Promise<BadgeLookupResult> => {
    const normalizedEmail = normalizeEmail(email);

    if (!normalizedEmail) {
        return {
            status: 'error',
            badges: [],
            fetchedAt: null,
            fromCache: false,
            error: 'Missing email for badge lookup',
        };
    }

    if (!isConfigReady()) {
        return {
            status: 'disabled',
            badges: [],
            fetchedAt: null,
            fromCache: false,
            error: 'Badge endpoint not configured',
        };
    }

    const cache = readCache(normalizedEmail);
    const now = Date.now();

    if (!forceRefresh && cache && now - cache.fetchedAt <= CACHE_TTL_MS) {
        return {
            status: 'success',
            badges: cache.badges,
            fetchedAt: cache.fetchedAt,
            fromCache: true,
        };
    }

    const payload = {
        email: normalizedEmail,
        source: 'flashcardsish-web',
        requestedAt: new Date().toISOString(),
        // Include callable-compatible shape and plain shape so both endpoint styles work.
        data: {
            email: normalizedEmail,
            source: 'flashcardsish-web',
        },
    };

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
    };

    if (BADGE_FUNCTION_API_KEY) {
        headers['x-api-key'] = BADGE_FUNCTION_API_KEY;
    }

    try {
        const response = await fetchWithTimeout(
            BADGE_FUNCTION_URL,
            {
                method: 'POST',
                headers,
                body: JSON.stringify(payload),
            },
            Number.isFinite(BADGE_TIMEOUT_MS) ? BADGE_TIMEOUT_MS : 8000
        );

        const bodyText = await response.text();
        let json: any = {};
        try {
            json = bodyText ? JSON.parse(bodyText) : {};
        } catch {
            json = { message: bodyText };
        }

        if (!response.ok) {
            throw new Error(
                safeText(json?.error?.message) ??
                safeText(json?.message) ??
                `Badge request failed with status ${response.status}`
            );
        }

        const payloadRoot = unwrapPayload(json);
        const rawBadges = Array.isArray(payloadRoot.badges)
            ? payloadRoot.badges
            : Array.isArray((payloadRoot as any).items)
                ? (payloadRoot as any).items
                : [];

        const badges = rawBadges
            .map((entry, index) => normalizeBadge(entry, index))
            .filter((value): value is Badge => Boolean(value));

        const result: BadgeLookupResult = {
            status: 'success',
            badges,
            fetchedAt: Date.now(),
            fromCache: false,
        };

        writeCache(normalizedEmail, {
            badges,
            fetchedAt: result.fetchedAt,
        });

        return result;
    } catch (error: any) {
        if (cache) {
            return {
                status: 'success',
                badges: cache.badges,
                fetchedAt: cache.fetchedAt,
                fromCache: true,
                error: error?.message || 'Badge request failed; using cached badges',
            };
        }

        return {
            status: 'error',
            badges: [],
            fetchedAt: null,
            fromCache: false,
            error: error?.message || 'Badge request failed',
        };
    }
};
