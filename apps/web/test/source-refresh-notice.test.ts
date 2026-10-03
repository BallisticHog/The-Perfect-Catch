import { describe, expect, it } from "vitest";
import { sourceRefreshMessage } from "../src/components/source-refresh-notice";

const publishedAt = new Date("2026-03-08T17:00:00.000Z");

describe("source refresh notice", () =>
{
    it("keeps the last reviewed catalog visible while a refresh runs", () =>
    {
        expect(sourceRefreshMessage({
            status: "running",
            startedAt: new Date("2026-03-09T08:00:00.000Z"),
            finishedAt: null,
        }, publishedAt)).toContain("last reviewed results remain available");
    });

    it("warns only when the latest failed refresh is newer than the publication", () =>
    {
        expect(sourceRefreshMessage({
            status: "failed",
            startedAt: new Date("2026-03-09T08:00:00.000Z"),
            finishedAt: new Date("2026-03-09T08:01:00.000Z"),
        }, publishedAt)).toContain("last reviewed results");
        expect(sourceRefreshMessage({
            status: "failed",
            startedAt: new Date("2026-03-08T08:00:00.000Z"),
            finishedAt: new Date("2026-03-08T08:01:00.000Z"),
        }, publishedAt)).toBeNull();
    });

    it("stays quiet after a completed or unchanged refresh", () =>
    {
        expect(sourceRefreshMessage({
            status: "unchanged",
            startedAt: publishedAt,
            finishedAt: publishedAt,
        }, publishedAt)).toBeNull();
        expect(sourceRefreshMessage(null, publishedAt)).toBeNull();
    });
});
