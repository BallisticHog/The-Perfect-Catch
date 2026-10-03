import type { CatalogRepository } from "@the-perfect-catch/db";
import { CHAMPIONSHIP, type ImportIssue, type Race } from "@the-perfect-catch/domain";
import { createHash } from "node:crypto";
import { type FetchObservation, SourceFetcher, SourceFetchError } from "./fetcher";
import { parseOverview, PARSER_VERSION, parseRace, sourceUrlKey } from "./parser";
import type { SnapshotArchive } from "./snapshot-archive";

export type ImportRepository = Pick<
    CatalogRepository,
    | "startImport"
    | "finishImport"
    | "latestDocument"
    | "storeDocument"
    | "recordFetch"
    | "listAliases"
    | "getPublishedCatalog"
    | "publishImport"
>;

export async function importRegatta(
    repository: ImportRepository,
    options: {
        fetcher?: SourceFetcher;
        requestedBy?: string;
        dryRun?: boolean;
        snapshotArchive?: SnapshotArchive;
    } = {},
)
{
    const fetcher = options.fetcher ?? new SourceFetcher();
    const run = await repository.startImport(PARSER_VERSION, options.requestedBy);
    const issues: ImportIssue[] = [];
    const parsed: Race[] = [];
    const manifest: string[] = [PARSER_VERSION];
    let expected = 0;

    async function obtainDocument(url: string)
    {
        const previous = await repository.latestDocument(sourceUrlKey(url));
        async function archiveObservations(observations: FetchObservation[])
        {
            let latest: typeof previous | null = null;
            for (const observation of observations)
            {
                if (observation.document && options.snapshotArchive)
                {
                    await options.snapshotArchive.archive(observation.document, {
                        fetchedAt: observation.fetchedAt,
                        responseHeaders: observation.headers,
                    });
                }
                let document = observation.statusCode === 304 ? previous : null;
                if (observation.document)
                {
                    document = await repository.storeDocument(observation.document);
                }
                await repository.recordFetch({
                    importRunId: run.id,
                    documentId: document?.id,
                    url: observation.url,
                    statusCode: observation.statusCode,
                    responseHeaders: observation.headers,
                    error: observation.error,
                    fetchedAt: observation.fetchedAt,
                });
                if (
                    observation.statusCode === 304
                    || (observation.statusCode !== null && observation.statusCode >= 200
                        && observation.statusCode < 300)
                )
                {
                    latest = document;
                }
            }
            return latest;
        }
        let response;
        try
        {
            response = await fetcher.fetch(url, previous);
        }
        catch (error)
        {
            if (error instanceof SourceFetchError && error.observations.length)
            {
                await archiveObservations(error.observations);
            }
            else
            {
                await repository.recordFetch({
                    importRunId: run.id,
                    url,
                    error: error instanceof Error ? error.message : "Fetch failed",
                });
            }
            throw error;
        }
        const document = await archiveObservations(response.observations);
        if (
            !document
            || (response.statusCode !== 304 && (response.statusCode < 200 || response.statusCode >= 300))
        )
        {
            throw new Error(
                `Source HTTP ${response.statusCode}; usable cached body ${
                    previous ? "available" : "missing"
                }`,
            );
        }
        manifest.push(`${sourceUrlKey(url)}:${document.sha256}`);
        return document;
    }

    try
    {
        const aliases = await repository.listAliases();
        const previousCatalog = await repository.getPublishedCatalog();
        // Include approved identity mapping in the revision so alias corrections can produce a new catalog.
        manifest.push(JSON.stringify([...aliases].sort((a, b) => a.alias.localeCompare(b.alias))));
        const overview = await obtainDocument(CHAMPIONSHIP.sourceUrl);
        const links = parseOverview(overview.decodedHtml);
        expected = links.length;
        if (
            previousCatalog?.races.some((race) =>
                !links.some((link) => sourceUrlKey(link.url) === race.sourceKey)
            )
        )
        {
            throw new Error("Source index lost previously published races; manual review required");
        }
        for (const link of links)
        {
            const document = await obtainDocument(link.url);
            const result = parseRace(document.decodedHtml, link, aliases);
            result.race.sourceSnapshotId = document.id;
            issues.push(...result.issues);
            parsed.push(result.race);
        }
        issues.push(...validateCandidate(parsed, previousCatalog?.races ?? []));
        if (parsed.length !== expected || issues.some((issue) => issue.severity === "error"))
        {
            throw new Error("Import validation failed; published catalog was preserved");
        }
        const manifestHash = createHash("sha256").update(manifest.sort().join("\n")).digest("hex");
        if (options.dryRun)
        {
            await repository.finishImport(run.id, "validated", issues, expected, parsed.length);
            return {
                runId: run.id,
                status: "validated" as const,
                expectedRaces: expected,
                parsedRaces: parsed.length,
                issues,
                manifestHash,
            };
        }
        const publication = await repository.publishImport(run.id, manifestHash, parsed, issues);
        return {
            runId: run.id,
            ...publication,
            expectedRaces: expected,
            parsedRaces: parsed.length,
            issues,
            manifestHash,
        };
    }
    catch (error)
    {
        issues.push({
            severity: "error",
            code: "import-failed",
            sourceUrl: CHAMPIONSHIP.sourceUrl,
            message: error instanceof Error ? error.message : "Unexpected import failure",
        });
        await repository.finishImport(run.id, "failed", issues, expected, parsed.length);
        throw error;
    }
}

export function validateCandidate(races: Race[], previous: Race[]): ImportIssue[]
{
    const issues: ImportIssue[] = [];
    const sourceKeys = new Set<string>();
    const eventNames = new Map<string, string>();
    for (const race of races)
    {
        const error = (code: string, message: string) =>
            issues.push({ severity: "error", code, sourceUrl: race.sourceUrl, message });
        if (sourceKeys.has(race.sourceKey))
        {
            error("duplicate-race", "Candidate contains duplicate source race keys");
        }
        sourceKeys.add(race.sourceKey);
        if (eventNames.has(race.sourceEventId) && eventNames.get(race.sourceEventId) !== race.eventName)
        {
            error("event-identity-conflict", "One source event identifier has multiple event names");
        }
        eventNames.set(race.sourceEventId, race.eventName);
        if (new Set(race.results.map((result) => result.sourceKey)).size !== race.results.length)
        {
            error("duplicate-entry", "Candidate contains duplicate entry source keys");
        }
        const priorRace = previous.find((prior) => prior.sourceKey === race.sourceKey);
        if (priorRace && race.results.length < priorRace.results.length)
        {
            error(
                "result-count-decreased",
                "A previously published race lost result rows; manual review required",
            );
        }
        const timed = race.results.filter((result) =>
            result.status === "finished" && result.place !== null && result.finishMs !== null
        ).sort((a, b) => a.place! - b.place!);
        for (let index = 1; index < timed.length; index++)
        {
            if (
                timed[index].place! > timed[index - 1].place!
                && timed[index].finishMs! < timed[index - 1].finishMs!
            )
            {
                issues.push({
                    severity: "warning",
                    code: "placing-time-mismatch",
                    sourceUrl: race.sourceUrl,
                    message: "Source placing and finish durations disagree; review the source result",
                });
            }
        }
    }
    return issues;
}
