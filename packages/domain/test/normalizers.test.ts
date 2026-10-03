import { describe, expect, it } from "vitest";
import {
    classifyEvent,
    exactAliasKey,
    matchSchool,
    normalizeGrantedEmail,
    normalizeResultStatus,
    normalizeRound,
    pacePer500Milliseconds,
    parseAppearances,
    parseFinishTime,
    parseSouthAfricanDate,
} from "../src/index";

describe("source-preserving rowing normalizers", () =>
{
    it("parses absolute times but never source deltas", () =>
    {
        expect(parseFinishTime("4:37.48")).toBe(277480);
        expect(parseFinishTime("+ .35")).toBeNull();
        expect(parseFinishTime("4:99.00")).toBeNull();
    });
    it("does not guess unknown rounds or aliases", () =>
    {
        expect(normalizeRound("SF 1")).toBe("semifinal");
        expect(normalizeRound("Unclassified")).toBe("unknown");
        expect(
            matchSchool("St Benedicts", [{
                alias: "St Benedicts College (RSA)",
                schoolKey: "bennies",
                displayName: "St Benedict's College",
            }]),
        ).toBeNull();
    });
    it("normalizes punctuation and apostrophes deterministically and keeps scratch distinct", () =>
    {
        expect(exactAliasKey("St Dunstan\u2019s College")).toBe(exactAliasKey("St Dunstan's College"));
        expect(exactAliasKey("St Dunstans College")).toBe(exactAliasKey("St Dunstan's College"));
        expect(normalizeResultStatus("Scratch")).toBe("scratch");
    });
    it("preserves appearance names and explicit seats", () =>
    {
        const raw = "Smith, Alex (Bow); Jones, Sam (Stroke); May, Jo (Coxswain)";
        const rows = parseAppearances(raw);
        expect(rows.map((row) => row.seat)).toEqual([1, 2, null]);
        expect(rows[0].rawName).toBe("Smith, Alex (Bow)");
        expect(rows[2].isCox).toBe(true);
        expect(rows[0].displayName).toBe("Alex Smith");
    });
    it("handles source event labels and South African local time", () =>
    {
        expect(classifyEvent("JW/GU14 1x")).toEqual({ gender: "girls", ageGroup: "U14", boatClass: "1x" });
        expect(parseSouthAfricanDate("Friday, 06 March 2026", "12:50:00")).toBe("2026-03-06T10:50:00.000Z");
    });
});

describe("access grant email normalization", () =>
{
    it("normalizes case, surrounding whitespace, and Unicode composition", () =>
    {
        expect(normalizeGrantedEmail("  COACH@Example.COM  ")).toBe("coach@example.com");
        expect(normalizeGrantedEmail("te\u0301st@example.com")).toBe("t\u00e9st@example.com");
    });

    it("does not rewrite provider-specific mailbox syntax", () =>
    {
        expect(normalizeGrantedEmail("first.last+rowing@gmail.com")).toBe("first.last+rowing@gmail.com");
    });
});

describe("training pace normalization", () =>
{
    it("normalizes common rowing distances to a 500 metre pace", () =>
    {
        expect(pacePer500Milliseconds(4 * 60_000, 1_000)).toBe(2 * 60_000);
        expect(pacePer500Milliseconds(8 * 60_000, 2_000)).toBe(2 * 60_000);
        expect(pacePer500Milliseconds(6 * 60_000, 1_500)).toBe(2 * 60_000);
    });

    it("rejects missing or impossible observations", () =>
    {
        expect(pacePer500Milliseconds(0, 1_000)).toBeNull();
        expect(pacePer500Milliseconds(240_000, 0)).toBeNull();
        expect(pacePer500Milliseconds(Number.NaN, 1_000)).toBeNull();
    });
});
