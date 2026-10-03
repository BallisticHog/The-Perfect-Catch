import type { StoredDocument } from "@the-perfect-catch/db";
import { CHAMPIONSHIP, type Race } from "@the-perfect-catch/domain";
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { SourceFetcher } from "../src/fetcher";
import { importRegatta, type ImportRepository } from "../src/pipeline";

const raceUrl = new URL("1_SF%201.htm", CHAMPIONSHIP.sourceUrl).href;
const raceBytes = readFileSync(new URL("./fixtures/2026-event-1-semifinal-1.html", import.meta.url));
const overviewBytes = Buffer.from(
    `<html><title>${CHAMPIONSHIP.sourceTitle}</title><table id="table1"><tr><td>Event ID</td><td>Event Name</td><td>Race</td><td>Details</td></tr><tr><td>1</td><td>JM/BU14 1x</td><td>69 - SF 1</td><td><a href="1_SF 1.htm">Results</a></td></tr></table></html>`,
);

function fixtureRepository()
{
    type Snapshot = StoredDocument & { id: string; sourceDocumentId: string; fetchedAt: Date; };
    const snapshots = new Map<string, Snapshot>();
    const latest = new Map<string, Snapshot>();
    const publications = new Map<string, Race[]>();
    const runs: Array<{ id: string; status: string; }> = [];
    const fetches: Array<{ statusCode?: number | null; documentId?: string | null; }> = [];
    let activeHash: string | null = null;
    let failPublish = false;
    const repository = {
        startImport: async () =>
        {
            const run = { id: `run-${runs.length}`, status: "running" };
            runs.push(run);
            return run;
        },
        finishImport: async (id: string, status: string) =>
        {
            runs.find((run) => run.id === id)!.status = status;
        },
        latestDocument: async (sourceKey: string) => latest.get(sourceKey) ?? null,
        storeDocument: async (document: StoredDocument) =>
        {
            const key = `${document.sourceKey}:${document.sha256}`;
            if (!snapshots.has(key))
            {
                snapshots.set(key, {
                    ...document,
                    id: `snapshot-${snapshots.size}`,
                    sourceDocumentId: document.sourceKey,
                    fetchedAt: new Date(),
                });
            }
            return snapshots.get(key)!;
        },
        recordFetch: async (input: { statusCode?: number | null; documentId?: string | null; }) =>
        {
            fetches.push(input);
            const snapshot = [...snapshots.values()].find((row) => row.id === input.documentId);
            if (
                snapshot
                && (input.statusCode === 304
                    || (input.statusCode !== null && input.statusCode !== undefined && input.statusCode >= 200
                        && input.statusCode < 300))
            )
            {
                latest.set(snapshot.sourceKey, snapshot);
            }
        },
        listAliases: async () => [{
            alias: "St Dunstans College",
            schoolKey: "st-dunstans-college",
            displayName: "St Dunstan's College",
        }],
        getPublishedCatalog: async () => activeHash ? { races: publications.get(activeHash)! } : null,
        publishImport: async (runId: string, hash: string, races: Race[]) =>
        {
            if (failPublish)
            {
                throw new Error("Injected transactional publication failure");
            }
            const status = hash === activeHash ? "unchanged" : "published";
            if (!publications.has(hash))
            {
                publications.set(hash, structuredClone(races));
            }
            activeHash = hash;
            runs.find((run) => run.id === runId)!.status = status;
            return { status, versionId: hash };
        },
    } as unknown as ImportRepository;
    return {
        repository,
        snapshots,
        publications,
        runs,
        fetches,
        active: () => activeHash,
        failPublish: () =>
        {
            failPublish = true;
        },
    };
}

function fixtureFetcher(responses: Array<Response | Error>)
{
    let clock = 0;
    const fetchImpl = vi.fn<typeof fetch>(async () =>
    {
        const next = responses.shift();
        if (next instanceof Error)
        {
            throw next;
        }
        if (!next)
        {
            throw new Error("Unexpected fixture request");
        }
        return next;
    });
    return {
        fetchImpl,
        fetcher: new SourceFetcher({
            fetchImpl,
            userAgent: "ArchiveFixture/1 (mailto:test@example.test)",
            now: () => clock,
            sleep: async (ms) =>
            {
                clock += ms;
            },
        }),
    };
}

function successResponses(body = raceBytes)
{
    return [
        new Response(overviewBytes, { headers: { etag: "overview-A" } }),
        new Response(body, { headers: { etag: body.equals(raceBytes) ? "race-A" : "race-B" } }),
    ];
}

describe("complete import contract with an in-memory persistence boundary", () =>
{
    it("validates a complete dry run without creating or changing a publication", async () =>
    {
        const fixture = fixtureRepository();
        fixture.failPublish();
        const result = await importRegatta(fixture.repository, {
            fetcher: fixtureFetcher(successResponses()).fetcher,
            dryRun: true,
        });
        expect(result.status).toBe("validated");
        expect(result.expectedRaces).toBe(1);
        expect(result.parsedRaces).toBe(1);
        expect(fixture.runs.at(-1)?.status).toBe("validated");
        expect(fixture.snapshots.size).toBe(2);
        expect(fixture.publications.size).toBe(0);
        expect(fixture.active()).toBeNull();
    });
    it("imports every discovered detail, preserves bytes, and reuses 304 bodies without duplicate snapshots or publications", async () =>
    {
        const fixture = fixtureRepository();
        const initial = fixtureFetcher(successResponses());
        const first = await importRegatta(fixture.repository, { fetcher: initial.fetcher });
        expect(first.status).toBe("published");
        expect(first.parsedRaces).toBe(1);
        expect(initial.fetchImpl.mock.calls.map((call) => call[0])).toEqual([
            CHAMPIONSHIP.sourceUrl,
            raceUrl,
        ]);
        expect([...fixture.snapshots.values()].some((snapshot) => snapshot.rawBytes.equals(raceBytes))).toBe(
            true,
        );
        const unchanged = fixtureFetcher([
            new Response(null, { status: 304 }),
            new Response(null, { status: 304 }),
        ]);
        const second = await importRegatta(fixture.repository, { fetcher: unchanged.fetcher });
        expect(second.status).toBe("unchanged");
        expect(fixture.snapshots.size).toBe(2);
        expect(fixture.publications.size).toBe(1);
        expect(unchanged.fetchImpl.mock.calls[1][1]?.headers).toMatchObject({ "If-None-Match": "race-A" });
        expect(
            fixture.fetches.filter((entry) => entry.statusCode === 304).every((entry) =>
                Boolean(entry.documentId)
            ),
        ).toBe(true);
    });
    it("changes and reverts a source revision without duplicating prior bodies", async () =>
    {
        const fixture = fixtureRepository();
        const original = await importRegatta(fixture.repository, {
            fetcher: fixtureFetcher(successResponses()).fetcher,
        });
        const changedBytes = Buffer.from(raceBytes.toString("utf8").replace("4:37.48", "4:37.49"));
        const changed = await importRegatta(fixture.repository, {
            fetcher: fixtureFetcher(successResponses(changedBytes)).fetcher,
        });
        expect(changed.manifestHash).not.toBe(original.manifestHash);
        const reverted = await importRegatta(fixture.repository, {
            fetcher: fixtureFetcher(successResponses()).fetcher,
        });
        expect(reverted.manifestHash).toBe(original.manifestHash);
        expect(fixture.active()).toBe(original.manifestHash);
        expect(fixture.snapshots.size).toBe(3);
        expect(fixture.publications.size).toBe(2);
        const conditional = fixtureFetcher([
            new Response(null, { status: 304 }),
            new Response(null, { status: 304 }),
        ]);
        await importRegatta(fixture.repository, { fetcher: conditional.fetcher });
        expect(conditional.fetchImpl.mock.calls[1][1]?.headers).toMatchObject({ "If-None-Match": "race-A" });
    });
    it.each(["missing", "malformed", "crew-header", "publish"])(
        "preserves the prior publication after %s failure",
        async (failure) =>
        {
            const fixture = fixtureRepository();
            await importRegatta(fixture.repository, { fetcher: fixtureFetcher(successResponses()).fetcher });
            const active = fixture.active();
            const responses = successResponses();
            if (failure === "missing")
            {
                responses[1] = new Response("Not found", { status: 404 });
            }
            if (failure === "malformed")
            {
                responses[1] = new Response("<html>missing result table</html>");
            }
            if (failure === "crew-header")
            {
                responses[1] = new Response(
                    Buffer.from(raceBytes.toString("utf8").replace(">Athlete<", ">Crew<")),
                );
            }
            if (failure === "publish")
            {
                fixture.failPublish();
            }
            await expect(importRegatta(fixture.repository, { fetcher: fixtureFetcher(responses).fetcher }))
                .rejects.toThrow();
            expect(fixture.active()).toBe(active);
            expect(fixture.runs.at(-1)?.status).toBe("failed");
            expect(fixture.publications.size).toBe(1);
        },
    );
    it("does not parse 304 without an archived body", async () =>
    {
        const fixture = fixtureRepository();
        await expect(
            importRegatta(fixture.repository, {
                fetcher: fixtureFetcher([new Response(null, { status: 304 })]).fetcher,
            }),
        ).rejects.toThrow("cached body missing");
        expect(fixture.publications.size).toBe(0);
    });
});
