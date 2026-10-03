import { LIVE_REGATTA, type LiveState, newLiveState } from "@the-perfect-catch/domain";
import {
    type FetchResult,
    FileSnapshotArchive,
    liveSourceUrl,
    SourceFetcher,
    SourceFetchError,
} from "@the-perfect-catch/ingestion";
import { appendFile, mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyLiveDetail, applyLiveOverview, detailInterval, nextLiveRace } from "./live-monitor";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const directory = process.env.CATCH_LIVE_ROOT ?? path.join(root, ".data", "live");
const sourceDirectory = process.env.CATCH_LIVE_SNAPSHOT_ROOT ?? path.join(directory, "sources");
const file = path.join(directory, "state.json");
const lockFile = path.join(directory, "worker.lock");
await mkdir(directory, { recursive: true });
let lock;
try
{
    lock = await open(lockFile, "wx");
}
catch
{
    throw new Error(
        "Live monitor already has a lock. Close its window first. After a PC restart, use live-reset.bat to clear a stale lock safely.",
    );
}
await lock.writeFile(String(process.pid));
const archive = new FileSnapshotArchive(sourceDirectory);
const fetcher = new SourceFetcher({
    approveUrl: liveSourceUrl,
    minimumIntervalMs: 1000,
    timeoutMs: 10_000,
    userAgent: process.env.REGATTA_RESULTS_USER_AGENT
        ?? "TheCatch/0.1 (+https://github.com/BallisticHog/The-Perfect-Catch)",
});
const cache = new Map<string, NonNullable<FetchResult["document"]>>();
let state: LiveState;
try
{
    state = JSON.parse(await readFile(file, "utf8")) as LiveState;
    if (state.formatVersion !== 1 || state.regatta.sourceUrl !== LIVE_REGATTA.sourceUrl)
    {
        throw new Error("Different live state version or regatta");
    }
    for (const race of state.races)
    {
        race.nextCheckAt = 0;
        race.timingEligible = false;
    }
    state.indexValidAt = null;
    state.monitorStatus = "monitoring";
}
catch (error)
{
    if ((error as NodeJS.ErrnoException).code !== "ENOENT")
    {
        await lock.close();
        await unlink(lockFile);
        throw error;
    }
    state = newLiveState();
}

let stop = false;
process.on("SIGINT", () =>
{
    stop = true;
});
process.on("SIGTERM", () =>
{
    stop = true;
});
let hostBackoffUntil = 0;

async function capture(url: string): Promise<NonNullable<FetchResult["document"]>>
{
    let result: FetchResult;
    try
    {
        result = await fetcher.fetch(url, cache.get(url));
    }
    catch (error)
    {
        if (error instanceof SourceFetchError)
        {
            await appendFile(
                path.join(directory, "requests.jsonl"),
                `${JSON.stringify({ at: new Date().toISOString(), url, error: error.message })}\n`,
            );
        }
        throw error;
    }
    for (const observation of result.observations)
    {
        if (observation.document)
        {
            await archive.archive(observation.document, {
                fetchedAt: observation.fetchedAt,
                responseHeaders: observation.headers,
            });
        }
        await appendFile(
            path.join(directory, "requests.jsonl"),
            `${
                JSON.stringify({
                    at: observation.fetchedAt,
                    url,
                    status: observation.statusCode,
                    headers: observation.headers,
                    sha256: observation.document?.sha256 ?? null,
                })
            }\n`,
        );
    }
    if ([429, 503].includes(result.statusCode))
    {
        const retry = result.headers["retry-after"];
        let requested = 60_000;
        if (retry && /^\d+$/.test(retry))
        {
            requested = Number(retry) * 1000;
        }
        else if (retry)
        {
            requested = Date.parse(retry) - Date.now();
        }
        hostBackoffUntil = Date.now() + Math.max(60_000, Number.isFinite(requested) ? requested : 60_000);
    }
    const document = result.statusCode === 304 ? cache.get(url) : result.document;
    if (!document || (result.statusCode !== 200 && result.statusCode !== 304))
    {
        throw new Error(`Publisher HTTP ${result.statusCode}; retrying automatically`);
    }
    return document;
}

async function save(): Promise<void>
{
    state.heartbeatAt = new Date().toISOString();
    await writeFile(`${file}.tmp`, JSON.stringify(state));
    await rename(`${file}.tmp`, file);
}

let nextIndexAt = 0;
let indexFailures = 0;
const once = process.argv.includes("--once");
const captured = new Set<string>();
console.info(`Following ${LIVE_REGATTA.name}. Keep this window open. Ctrl+C stops polling.`);
try
{
    while (!stop)
    {
        const now = Date.now();
        // Stop network activity after regatta day; retain the captured results for browsing.
        if (!once && now > Date.parse(`${LIVE_REGATTA.date}T22:00:00Z`))
        {
            state.monitorStatus = "complete";
            await save();
            console.info("Regatta monitoring window has ended. Captured results remain available.");
            while (!stop)
            {
                await new Promise((resolve) => setTimeout(resolve, 30_000));
                await save();
            }
            break;
        }
        if (now < hostBackoffUntil)
        {
            await save();
            await new Promise((resolve) => setTimeout(resolve, 1000));
            continue;
        }
        if (now >= nextIndexAt && (!once || state.indexCheckedAt === null || captured.size === 0))
        {
            state.indexCheckedAt = new Date(now).toISOString();
            try
            {
                const document = await capture(LIVE_REGATTA.sourceUrl);
                applyLiveOverview(state, document.decodedHtml, Date.now());
                cache.set(LIVE_REGATTA.sourceUrl, document);
                indexFailures = 0;
            }
            catch (error)
            {
                state.indexError = error instanceof Error ? error.message : "Publisher schedule unavailable";
                indexFailures++;
                cache.delete(LIVE_REGATTA.sourceUrl);
                console.info(state.indexError);
            }
            const active = now >= Date.parse(`${LIVE_REGATTA.date}T05:30:00Z`);
            let interval = 60_000;
            if (indexFailures)
            {
                interval = Math.min(60_000, 5000 * 2 ** Math.min(indexFailures, 4));
            }
            else if (active)
            {
                interval = 5000;
            }
            nextIndexAt = Date.now() + interval;
            await save();
            if (once && state.indexError)
            {
                throw new Error(state.indexError);
            }
        }
        else
        {
            const race = nextLiveRace(state, now);
            if (race)
            {
                const previousRevision = race.revision;
                try
                {
                    const document = await capture(race.url);
                    applyLiveDetail(race, document.decodedHtml, Date.now());
                    cache.set(race.url, document);
                    race.nextCheckAt = Date.now() + detailInterval(race, now);
                    if (race.revision !== previousRevision)
                    {
                        await appendFile(
                            path.join(directory, "revisions.jsonl"),
                            `${
                                JSON.stringify({ observedAt: race.validAt, sha256: document.sha256, race })
                            }\n`,
                        );
                    }
                }
                catch (error)
                {
                    race.checkedAt = new Date().toISOString();
                    race.error = error instanceof Error ? error.message : "Publisher race page unavailable";
                    race.failures++;
                    race.nextCheckAt = Date.now()
                        + Math.min(60_000, 5000 * 2 ** Math.min(race.failures - 1, 4));
                    cache.delete(race.url);
                }
                captured.add(race.key);
                await save();
                console.info(
                    `${race.raceLabel}: ${
                        race.error ?? `${race.entries.length} crews, ${race.detailStatus}`
                    }`,
                );
            }
        }
        if (once && state.races.length && captured.size >= state.races.filter((race) => race.listed).length)
        {
            break;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
    }
}
finally
{
    await save();
    await lock.close();
    await unlink(lockFile);
}
