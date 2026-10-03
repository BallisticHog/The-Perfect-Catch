import { LIVE_REGATTA, type LiveRace, type LiveSchedule, type LiveState } from "@the-perfect-catch/domain";
import { parseLiveOverview, parseLiveRace } from "@the-perfect-catch/ingestion";

export function applyLiveOverview(state: LiveState, html: string, now: number): void
{
    const parsed = parseLiveOverview(html);
    const existing = new Map(state.races.map((race) => [race.key, race]));
    // A truncated upload must not silently remove the tail of the programme.
    if (parsed.races.length < state.races.filter((race) => race.listed).length)
    {
        throw new Error("The published programme is shorter; keeping the previous schedule until reviewed");
    }
    const timestamp = new Date(now).toISOString();
    const continuous = state.indexValidAt !== null && now - Date.parse(state.indexValidAt) <= 90_000;
    const races = parsed.races.map((schedule): LiveRace =>
    {
        const old = existing.get(schedule.key);
        const transitioned = old && !old.publishedResults && schedule.publishedResults;
        const changed = old
            && (old.status !== schedule.status || old.scheduledAt !== schedule.scheduledAt
                || old.raceLabel !== schedule.raceLabel);
        return {
            entries: [],
            detailStatus: null,
            detailScheduledAt: null,
            checkedAt: null,
            validAt: null,
            changedAt: null,
            error: null,
            failures: 0,
            nextCheckAt: 0,
            firstResultAt: null,
            timingEligible: false,
            revision: 0,
            ...old,
            ...schedule,
            listed: true,
            ...(transitioned
                ? {
                    firstResultAt: timestamp,
                    timingEligible: continuous && old.scheduledAt === schedule.scheduledAt,
                }
                : {}),
            ...(old && old.scheduledAt !== schedule.scheduledAt ? { timingEligible: false } : {}),
            ...(changed ? { nextCheckAt: 0, changedAt: timestamp } : {}),
        };
    });
    for (const old of state.races)
    {
        if (!races.some((race) => race.key === old.key))
        {
            races.push({ ...old, listed: false, timingEligible: false });
        }
    }
    state.races = races;
    state.sourceUpdatedRaw = parsed.updated;
    state.indexValidAt = timestamp;
    state.indexError = null;
}

export function applyLiveDetail(race: LiveRace, html: string, now: number): void
{
    const detail = parseLiveRace(html, race);
    if (
        race.entries.some((entry) => entry.finishMs !== null)
        && !detail.entries.some((entry) => entry.finishMs !== null)
        && !/cancel|scratch|withdraw/i.test(detail.status)
    )
    {
        throw new Error("Publisher temporarily reverted results to a draw; keeping the last results");
    }
    const changed = JSON.stringify([race.entries, race.detailStatus, race.detailScheduledAt])
        !== JSON.stringify([detail.entries, detail.status, detail.scheduledAt]);
    const timestamp = new Date(now).toISOString();
    const hasResults = detail.entries.some((entry) => entry.finishMs !== null);
    if (hasResults && !race.firstResultAt)
    {
        race.firstResultAt = timestamp;
        race.timingEligible = race.validAt !== null && now - Date.parse(race.validAt) <= 90_000
            && !race.entries.some((entry) => entry.finishMs !== null);
    }
    race.entries = detail.entries;
    race.detailStatus = detail.status;
    race.detailScheduledAt = detail.scheduledAt;
    race.validAt = timestamp;
    race.checkedAt = timestamp;
    race.error = null;
    race.failures = 0;
    if (changed)
    {
        race.revision++;
        race.changedAt = timestamp;
    }
}

export function detailInterval(race: LiveSchedule, now: number): number
{
    const distance = Date.parse(race.scheduledAt) - now;
    if (new Date(now).toISOString().slice(0, 10) !== LIVE_REGATTA.date)
    {
        return 300_000;
    }
    if (race.publishedResults)
    {
        return 60_000;
    }
    return distance < 20 * 60_000 && distance > -120 * 60_000 ? 5_000 : 120_000;
}

export function nextLiveRace(state: LiveState, now: number): LiveRace | undefined
{
    return state.races.filter((race) => race.listed && race.nextCheckAt <= now).sort((a, b) =>
        a.nextCheckAt - b.nextCheckAt || a.scheduledAt.localeCompare(b.scheduledAt)
    )[0];
}
