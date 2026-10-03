import { describe, expect, it } from "vitest";
import {
    contrastRatio,
    deriveSchoolTheme,
    resolveSchoolTheme,
    SCHOOL_THEME_ALGORITHM_VERSION,
} from "../src/school-theme";

describe("school profile themes", () =>
{
    it.each([
        ["#253573", "#996A28"],
        ["#009DBA", "#FFD100"],
        ["#FFFFFF", "#777777"],
    ])("derives accessible foregrounds for %s and %s", (primary, secondary) =>
    {
        const theme = deriveSchoolTheme(primary, secondary);
        expect(contrastRatio(theme.onAccent, theme.accent)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(theme.onAccentSoft, theme.accentSoft)).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(theme.onSecondary, theme.secondary)).toBeGreaterThanOrEqual(4.5);
    });

    it("rejects unsafe or injectable persisted tokens", () =>
    {
        const resolved = resolveSchoolTheme({
            primaryColor: "#253573",
            secondaryColor: "#996A28",
            themeAlgorithmVersion: SCHOOL_THEME_ALGORITHM_VERSION,
            accessibleTokens: {
                accent: "url(https://example.test)",
                onAccent: "#FFFFFF",
                accentSoft: "#FFFFFF",
                onAccentSoft: "#FFFFFF",
                secondary: "#996A28",
                onSecondary: "#FFFFFF",
            },
        });
        expect(resolved).toEqual(deriveSchoolTheme("#253573", "#996A28"));
    });

    it("keeps unknown algorithm versions on the current safe derivation", () =>
    {
        const resolved = resolveSchoolTheme({
            primaryColor: "#253573",
            secondaryColor: "#996A28",
            themeAlgorithmVersion: "future-version",
            accessibleTokens: {},
        });
        expect(resolved).toEqual(deriveSchoolTheme("#253573", "#996A28"));
    });
});
