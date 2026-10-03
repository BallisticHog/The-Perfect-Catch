import { CHAMPIONSHIP } from "@the-perfect-catch/domain";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { decodeHtml, PARSER_VERSION, parseRace } from "../src/parser";

const manifest = JSON.parse(
    readFileSync(new URL("./fixtures/2026-live-structure.json", import.meta.url), "utf8"),
);

describe("PII-free live structural evidence", () =>
{
    it("allows only verification metadata, counts, and whole-document or structural digests", () =>
    {
        const strings = {
            evidenceKind: "live-private-dry-parse",
            sourceUrl: CHAMPIONSHIP.sourceUrl,
            parserVersion: PARSER_VERSION,
            userAgent: "The-Catch/0.1 (+https://github.com/BallisticHog/The-Perfect-Catch)",
            status: "validated",
            sourceBytesRetention: "process-memory-only",
            encoding: "windows-1252",
        };
        const flags = ["databaseUsed", "publicationAttempted"];
        const dates = ["startedAt", "completedAt"];
        const counts = [
            "configuredMinimumIntervalMs",
            "minimumObservedIntervalMs",
            "networkAttempts",
            "documentCount",
            "discoveredDetailCount",
            "parsedRaceCount",
            "eventCount",
            "resultCount",
            "appearanceCount",
            "officialRaceCount",
            "aliasCount",
        ];
        const digests = [
            "overviewSha256",
            "sourceKeysSha256",
            "sourceBodiesSha256",
            "raceStructureSha256",
            "importManifestSha256",
        ];
        const histograms = {
            httpStatusCounts: ["200"],
            roundCounts: ["final-a", "heat", "semifinal"],
            resultStatusCounts: ["dnf", "dns", "finished", "scratch", "unknown"],
            issueCodeCounts: ["unknown-result-status", "unmapped-school"],
        };
        expect(Object.keys(manifest).sort()).toEqual([
            ...Object.keys(strings),
            ...flags,
            ...dates,
            ...counts,
            ...digests,
            ...Object.keys(histograms),
        ].sort());
        for (const [key, value] of Object.entries(strings))
        {
            expect(manifest[key]).toBe(value);
        }
        for (const key of flags)
        {
            expect(manifest[key]).toBe(false);
        }
        for (const key of dates)
        {
            expect(new Date(manifest[key]).toISOString()).toBe(manifest[key]);
        }
        for (const key of counts)
        {
            expect(Number.isSafeInteger(manifest[key]) && manifest[key] >= 0).toBe(true);
        }
        for (const key of digests)
        {
            expect(manifest[key]).toMatch(/^[0-9a-f]{64}$/);
        }
        for (const [key, categories] of Object.entries(histograms))
        {
            expect(Object.keys(manifest[key]).sort()).toEqual(categories);
            for (const value of Object.values(manifest[key]))
            {
                expect(typeof value === "number" && Number.isSafeInteger(value) && value >= 0).toBe(true);
            }
        }
    });

    it("records complete detail coverage and reconciles aggregate counts", () =>
    {
        const total = (counts: Record<string, number>) =>
            Object.values(counts).reduce((sum, count) => sum + count, 0);
        expect(manifest.documentCount).toBe(manifest.discoveredDetailCount + 1);
        expect(manifest.parsedRaceCount).toBe(manifest.discoveredDetailCount);
        expect(manifest.officialRaceCount).toBe(manifest.parsedRaceCount);
        expect(total(manifest.roundCounts)).toBe(manifest.parsedRaceCount);
        expect(total(manifest.resultStatusCounts)).toBe(manifest.resultCount);
        expect(total(manifest.httpStatusCounts)).toBe(manifest.networkAttempts);
        expect(manifest.networkAttempts).toBe(manifest.documentCount);
        expect(manifest.minimumObservedIntervalMs).toBeGreaterThanOrEqual(
            manifest.configuredMinimumIntervalMs,
        );
        expect(manifest.configuredMinimumIntervalMs).toBeGreaterThanOrEqual(1000);
        expect(Date.parse(manifest.completedAt)).toBeGreaterThan(Date.parse(manifest.startedAt));
        expect(manifest.issueCodeCounts["unknown-result-status"]).toBe(manifest.resultStatusCounts.unknown);
        expect(manifest.aliasCount).toBe(0);
        expect(manifest.issueCodeCounts["unmapped-school"]).toBe(manifest.resultCount);
    });

    it("keeps the sanitized fixture separate from the full live championship counts", () =>
    {
        const bytes = readFileSync(new URL("./fixtures/2026-event-1-semifinal-1.html", import.meta.url));
        const result = parseRace(decodeHtml(bytes).html, {
            url: new URL("1_SF%201.htm", CHAMPIONSHIP.sourceUrl).href,
            eventId: "1",
            eventName: "JM/BU14 1x",
            raceLabel: "69 - SF 1",
        });
        expect(result.race.results).toHaveLength(8);
        expect(result.race.results.reduce((count, entry) => count + entry.appearances.length, 0)).toBe(8);
        expect(manifest.resultCount).toBeGreaterThan(result.race.results.length);
        expect(manifest.parsedRaceCount).toBeGreaterThan(1);
    });
});
