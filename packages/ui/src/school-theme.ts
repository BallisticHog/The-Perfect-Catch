const WHITE = "#FFFFFF";
const BLACK = "#000000";
const CATCH_NAVY = "#062B5B";

export const SCHOOL_THEME_ALGORITHM_VERSION = "wcag-aa-v1";

export interface SchoolThemeTokens
{
    accent: string;
    onAccent: string;
    accentSoft: string;
    onAccentSoft: string;
    secondary: string;
    onSecondary: string;
    canvas: string;
    canvasStrong: string;
    secondarySoft: string;
}

export interface StoredSchoolTheme
{
    primaryColor: string | null;
    secondaryColor: string | null;
    accessibleTokens: Record<string, string>;
    themeAlgorithmVersion: string;
}

function normalizeHex(value: string | null | undefined): string | null
{
    return value && /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : null;
}

function channels(value: string): [number, number, number]
{
    return [
        Number.parseInt(value.slice(1, 3), 16),
        Number.parseInt(value.slice(3, 5), 16),
        Number.parseInt(value.slice(5, 7), 16),
    ];
}

function luminance(value: string): number
{
    const [red, green, blue] = channels(value).map((channel) =>
    {
        const normalized = channel / 255;
        return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    }) as [number, number, number];
    return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(foreground: string, background: string): number
{
    const lighter = Math.max(luminance(foreground), luminance(background));
    const darker = Math.min(luminance(foreground), luminance(background));
    return (lighter + 0.05) / (darker + 0.05);
}

function accessibleForeground(background: string): string
{
    return contrastRatio(WHITE, background) >= contrastRatio(BLACK, background) ? WHITE : BLACK;
}

function mixWithWhite(value: string, amount: number): string
{
    const mixed = channels(value).map((channel) => Math.round(channel * amount + 255 * (1 - amount)));
    return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

export function deriveSchoolTheme(
    primaryColor: string | null,
    secondaryColor: string | null,
): SchoolThemeTokens
{
    const accent = normalizeHex(primaryColor) ?? CATCH_NAVY;
    const secondary = normalizeHex(secondaryColor) ?? accent;
    const accentSoft = mixWithWhite(accent, 0.12);
    const canvas = mixWithWhite(accent, 0.055);
    const canvasStrong = mixWithWhite(accent, 0.12);
    const secondarySoft = mixWithWhite(secondary, 0.08);
    const onAccentSoft = contrastRatio(CATCH_NAVY, accentSoft) >= 4.5 ? CATCH_NAVY : BLACK;
    return {
        accent,
        onAccent: accessibleForeground(accent),
        accentSoft,
        onAccentSoft,
        secondary,
        onSecondary: accessibleForeground(secondary),
        canvas,
        canvasStrong,
        secondarySoft,
    };
}

export function resolveSchoolTheme(profile: StoredSchoolTheme | null): SchoolThemeTokens
{
    const derived = deriveSchoolTheme(profile?.primaryColor ?? null, profile?.secondaryColor ?? null);
    if (!profile || profile.themeAlgorithmVersion !== SCHOOL_THEME_ALGORITHM_VERSION)
    {
        return derived;
    }
    const candidate = {
        accent: normalizeHex(profile.accessibleTokens.accent),
        onAccent: normalizeHex(profile.accessibleTokens.onAccent),
        accentSoft: normalizeHex(profile.accessibleTokens.accentSoft),
        onAccentSoft: normalizeHex(profile.accessibleTokens.onAccentSoft),
        secondary: normalizeHex(profile.accessibleTokens.secondary),
        onSecondary: normalizeHex(profile.accessibleTokens.onSecondary),
    };
    if (
        !candidate.accent || !candidate.onAccent || !candidate.accentSoft || !candidate.onAccentSoft
        || !candidate.secondary || !candidate.onSecondary || candidate.accent !== derived.accent
        || candidate.secondary !== derived.secondary
        || contrastRatio(candidate.onAccent, candidate.accent) < 4.5
        || contrastRatio(candidate.onAccentSoft, candidate.accentSoft) < 4.5
        || contrastRatio(candidate.onSecondary, candidate.secondary) < 4.5
    )
    {
        return derived;
    }
    return {
        ...candidate,
        canvas: derived.canvas,
        canvasStrong: derived.canvasStrong,
        secondarySoft: derived.secondarySoft,
    } as SchoolThemeTokens;
}

export function schoolThemeProperties(tokens: SchoolThemeTokens): Record<string, string>
{
    return {
        "--school-accent": tokens.accent,
        "--school-on-accent": tokens.onAccent,
        "--school-accent-soft": tokens.accentSoft,
        "--school-on-accent-soft": tokens.onAccentSoft,
        "--school-secondary": tokens.secondary,
        "--school-on-secondary": tokens.onSecondary,
        "--school-canvas": tokens.canvas,
        "--school-canvas-strong": tokens.canvasStrong,
        "--school-secondary-soft": tokens.secondarySoft,
    };
}
