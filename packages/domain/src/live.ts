export const LIVE_REGATTA = {
    id: "2026-st-marys-october",
    name: "St Mary's U16, U19 and Masters",
    sourceTitle: "2026 GSRF St Marys U16 U19 Mast 3 Oct",
    sourceUrl: "https://www.regattaresults.co.za/Results/Results2026/2026-Oct-Mary1619M/results.htm",
    date: "2026-10-03",
    venue: "Roodeplaat",
} as const;

export interface LiveEntry
{
    lane: string;
    boat: string;
    school: string;
    athletes: string;
    place: string;
    time: string;
    finishMs: number | null;
    status: string;
}

export interface LiveSchedule
{
    key: string;
    url: string;
    eventId: string;
    eventName: string;
    raceLabel: string;
    scheduledAt: string;
    status: string;
    progression: string;
    publishedResults: boolean;
}

export interface LiveRace extends LiveSchedule
{
    entries: LiveEntry[];
    detailStatus: string | null;
    detailScheduledAt: string | null;
    checkedAt: string | null;
    validAt: string | null;
    changedAt: string | null;
    error: string | null;
    failures: number;
    nextCheckAt: number;
    listed: boolean;
    firstResultAt: string | null;
    timingEligible: boolean;
    revision: number;
}

export interface LiveState
{
    formatVersion: 1;
    monitorStatus: "monitoring" | "complete";
    regatta: typeof LIVE_REGATTA;
    startedAt: string;
    heartbeatAt: string;
    indexCheckedAt: string | null;
    indexValidAt: string | null;
    indexError: string | null;
    sourceUpdatedRaw: string | null;
    races: LiveRace[];
}

export interface PublicationDelay
{
    lowerMinutes: number;
    upperMinutes: number;
    sampleCount: number;
    latestAt: string;
}

export function estimatePublicationDelay(races: LiveRace[], now = Date.now()): PublicationDelay | null
{
    // Publication delay includes both racing delay and the publisher's upload time.
    const samples = races.filter((race) =>
        race.listed && race.timingEligible && race.firstResultAt && race.validAt && !race.error
        && now - Date.parse(race.firstResultAt) >= 0
        && now - Date.parse(race.firstResultAt) < 30 * 60_000
        && race.detailScheduledAt === race.scheduledAt
        && /\bJ\s*[MW]\s*(16|19)\b/i.test(race.eventName)
    ).flatMap((race) =>
    {
        const finishes = race.entries.map((entry) => entry.finishMs).filter((time): time is number =>
            time !== null && time > 0
        );
        if (!finishes.length)
        {
            return [];
        }
        const delay = (Date.parse(race.firstResultAt!) - Date.parse(race.scheduledAt) - Math.min(...finishes))
            / 60_000;
        return delay >= 0 && delay <= 180 ? [{ delay, at: race.firstResultAt! }] : [];
    }).sort((a, b) => b.at.localeCompare(a.at)).slice(0, 7);
    // A batch upload cannot establish a useful programme-wide timing trend.
    const distinctWindows = new Set(samples.map((sample) => Math.floor(Date.parse(sample.at) / 60_000)));
    if (samples.length < 3 || distinctWindows.size < 3)
    {
        return null;
    }
    const delays = samples.map((sample) => sample.delay).sort((a, b) => a - b);
    const low = delays[Math.floor((delays.length - 1) * 0.25)]!;
    const high = delays[Math.ceil((delays.length - 1) * 0.75)]!;
    return {
        lowerMinutes: Math.max(0, Math.floor((low - 2) / 5) * 5),
        upperMinutes: Math.ceil((high + 2) / 5) * 5,
        sampleCount: samples.length,
        latestAt: samples[0]!.at,
    };
}

export function newLiveState(now = new Date().toISOString()): LiveState
{
    return {
        formatVersion: 1,
        monitorStatus: "monitoring",
        regatta: LIVE_REGATTA,
        startedAt: now,
        heartbeatAt: now,
        indexCheckedAt: null,
        indexValidAt: null,
        indexError: null,
        sourceUpdatedRaw: null,
        races: [],
    };
}
