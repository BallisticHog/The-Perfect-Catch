import { z } from "zod";

export const CHAMPIONSHIP = {
    slug: "2026-sa-schools-championships",
    name: "2026 SA Schools Championships",
    sourceTitle: "2026 SA Schools Champs 6 7 8 Mar 2026",
    sourceUrl: "https://www.regattaresults.co.za/Results/Results2026/2026-Feb-SASChamps/results.htm",
    startsOn: "2026-03-06",
    endsOn: "2026-03-08",
    venue: "Roodeplaat Dam",
    timezone: "Africa/Johannesburg",
} as const;

export type RowingVenueKey = "roodeplaat" | "germiston";

export type RowingVenueProfile = {
    key: RowingVenueKey;
    name: string;
    shortName: string;
    locality: string;
    timezone: "Africa/Johannesburg";
    courseDistanceMetres: number | null;
    observedLaneCount: number | null;
    geometryStatus: "schematic" | "awaiting-survey";
    evidenceNote: string;
};

export const ROWING_VENUES: Record<RowingVenueKey, RowingVenueProfile> = {
    roodeplaat: {
        key: "roodeplaat",
        name: "Roodeplaat Dam",
        shortName: "Roodeplaat",
        locality: "Pretoria, Gauteng",
        timezone: "Africa/Johannesburg",
        courseDistanceMetres: 2_000,
        observedLaneCount: 9,
        geometryStatus: "schematic",
        evidenceNote: "Lane numbers 1 to 9 are observed in the imported 2026 championship results.",
    },
    germiston: {
        key: "germiston",
        name: "Germiston Lake at Victoria Lake Club",
        shortName: "Germiston",
        locality: "Germiston, Gauteng",
        timezone: "Africa/Johannesburg",
        courseDistanceMetres: null,
        observedLaneCount: null,
        geometryStatus: "awaiting-survey",
        evidenceNote:
            "Course distance, lane count, bearing, and shoreline geometry await reviewed venue evidence.",
    },
};

export function pacePer500Milliseconds(durationMilliseconds: number, distanceMetres: number): number | null
{
    if (!Number.isFinite(durationMilliseconds) || durationMilliseconds <= 0)
    {
        return null;
    }
    if (!Number.isFinite(distanceMetres) || distanceMetres <= 0)
    {
        return null;
    }
    return Math.round(durationMilliseconds * 500 / distanceMetres);
}

export const resultStatusSchema = z.enum(["finished", "dns", "dnf", "scratch", "dsq", "unknown"]);
export const appearanceSchema = z.object(
    {
        rawName: z.string(),
        displayName: z.string().min(1),
        seat: z.number().int().positive().nullable(),
        isCox: z.boolean(),
        rawAnnotation: z.string().nullable(),
    },
);
export const resultSchema = z.object(
    {
        sourceKey: z.string().min(1),
        rowIndex: z.number().int().nonnegative(),
        schoolRaw: z.string().min(1),
        schoolKey: z.string().nullable(),
        boatRaw: z.string(),
        laneRaw: z.string(),
        lane: z.number().int().positive().nullable(),
        placeRaw: z.string(),
        place: z.number().int().positive().nullable(),
        finishRaw: z.string(),
        finishMs: z.number().int().nonnegative().nullable(),
        splitRaw: z.string(),
        deltaRaw: z.string(),
        statusRaw: z.string(),
        status: resultStatusSchema,
        athletesRaw: z.string(),
        appearances: z.array(appearanceSchema),
        rawCells: z.array(z.string()),
    },
);
export const raceSchema = z.object(
    {
        sourceKey: z.string().min(1),
        sourceUrl: z.url(),
        sourceSnapshotId: z.string().optional(),
        sourceEventId: z.string().min(1),
        eventNameRaw: z.string().min(1),
        eventName: z.string().min(1),
        gender: z.enum(["boys", "girls", "mixed", "unknown"]),
        ageGroup: z.string().nullable(),
        boatClass: z.string().nullable(),
        raceNumber: z.number().int().positive().nullable(),
        roundRaw: z.string(),
        round: z.enum(["heat", "semifinal", "repechage", "final-a", "final-b", "final-c", "unknown"]),
        dateRaw: z.string(),
        timeRaw: z.string(),
        scheduledAt: z.string().nullable(),
        statusRaw: z.string(),
        official: z.boolean(),
        progressionRaw: z.string(),
        results: z.array(resultSchema).min(1),
    },
);
export type Race = z.infer<typeof raceSchema>;
export type Result = z.infer<typeof resultSchema>;
export type Appearance = z.infer<typeof appearanceSchema>;
export type SchoolAlias = { alias: string; schoolKey: string; displayName: string; };
export type ImportIssue = {
    severity: "warning" | "error";
    code: string;
    sourceUrl: string;
    message: string;
};

export type EventRound = {
    round: Race["round"];
    races: Race[];
};

export type EventSummary =
    & Pick<Race, "sourceEventId" | "eventNameRaw" | "eventName" | "gender" | "ageGroup" | "boatClass">
    & {
        races: Race[];
        rounds: EventRound[];
        publishedCrewEntries: number;
        schoolKeys: string[];
    };

export type SchoolResultStatistics = {
    // Every result row explicitly mapped to this school, including DNS and scratch entries.
    publishedCrewEntries: number;
    // Only finished and DNF results evidence a start. DSQ and unknown labels do not prove a start.
    evidencedCrewStarts: number;
    // Distinct source races containing at least one evidenced start by this school.
    racesContested: number;
    // Distinct source races with at least one finished result explicitly placed first.
    raceWins: number;
    // Published crew entries in any A, B, or C final, including crews listed as DNS or scratched.
    finalCrewEntries: number;
    // Finished crew results explicitly placed first, second, or third in an A final.
    finalAPodiums: number;
    // Source appearance records across all mapped entries, including coxes and repeated names.
    publishedSeatAppearances: number;
    // Known boat classes of mapped entries, in first source appearance order.
    boatClasses: string[];
};

export type RowerRecordAppearance = {
    race: Race;
    result: Result;
    appearance: Appearance;
};

export type RegattaRowerRecord = {
    identityKey: string;
    displayName: string;
    schoolKey: string | null;
    schoolName: string;
    appearances: RowerRecordAppearance[];
    raceCount: number;
    eventIds: string[];
    boatClasses: string[];
    roles: string[];
};

const roundOrder: Record<Race["round"], number> = {
    heat: 0,
    repechage: 1,
    semifinal: 2,
    "final-a": 3,
    "final-b": 4,
    "final-c": 5,
    unknown: 6,
};

export function sortEventRaces(races: readonly Race[]): Race[]
{
    // Stable sorting retains supplied source order within a round and does not mutate the input.
    return [...races].sort((left, right) => roundOrder[left.round] - roundOrder[right.round]);
}

export function groupRacesByEvent(races: readonly Race[]): EventSummary[]
{
    // Call with one regatta only: source event numbers are not global identifiers.
    const groups = new Map<string, EventSummary>();
    for (const race of races)
    {
        let event = groups.get(race.sourceEventId);
        if (!event)
        {
            event = {
                sourceEventId: race.sourceEventId,
                eventNameRaw: race.eventNameRaw,
                eventName: race.eventName,
                gender: race.gender,
                ageGroup: race.ageGroup,
                boatClass: race.boatClass,
                races: [],
                rounds: [],
                publishedCrewEntries: 0,
                schoolKeys: [],
            };
            groups.set(race.sourceEventId, event);
        }
        event.races.push(race);
        event.publishedCrewEntries += race.results.length;
    }

    for (const event of groups.values())
    {
        const schools = new Set<string>();
        for (const race of event.races)
        {
            for (const result of race.results)
            {
                if (result.schoolKey !== null)
                {
                    schools.add(result.schoolKey);
                }
            }
        }
        event.schoolKeys = [...schools];
        event.races = sortEventRaces(event.races);
        const rounds = new Map<Race["round"], EventRound>();
        for (const race of event.races)
        {
            let round = rounds.get(race.round);
            if (!round)
            {
                round = { round: race.round, races: [] };
                rounds.set(race.round, round);
            }
            round.races.push(race);
        }
        event.rounds = [...rounds.values()];
    }
    return [...groups.values()];
}

export function summarizeSchoolResults(races: readonly Race[], schoolId: string): SchoolResultStatistics
{
    const statistics: SchoolResultStatistics = {
        publishedCrewEntries: 0,
        evidencedCrewStarts: 0,
        racesContested: 0,
        raceWins: 0,
        finalCrewEntries: 0,
        finalAPodiums: 0,
        publishedSeatAppearances: 0,
        boatClasses: [],
    };
    const contestedRaces = new Set<string>();
    const wonRaces = new Set<string>();
    const boatClasses = new Set<string>();
    for (const race of races)
    {
        for (const result of race.results)
        {
            if (result.schoolKey !== schoolId)
            {
                continue;
            }
            statistics.publishedCrewEntries += 1;
            statistics.publishedSeatAppearances += result.appearances.length;
            if (race.boatClass !== null)
            {
                boatClasses.add(race.boatClass);
            }
            if (result.status === "finished" || result.status === "dnf")
            {
                statistics.evidencedCrewStarts += 1;
                contestedRaces.add(race.sourceUrl);
            }
            if (result.status === "finished" && result.place === 1)
            {
                wonRaces.add(race.sourceUrl);
            }
            if (race.round === "final-a" || race.round === "final-b" || race.round === "final-c")
            {
                statistics.finalCrewEntries += 1;
            }
            if (
                race.round === "final-a" && result.status === "finished" && result.place !== null
                && result.place <= 3
            )
            {
                statistics.finalAPodiums += 1;
            }
        }
    }
    statistics.racesContested = contestedRaces.size;
    statistics.raceWins = wonRaces.size;
    statistics.boatClasses = [...boatClasses];
    return statistics;
}

export function normalizeSourceRowerName(value: string): string
{
    // Keep matching narrow. Do not reorder names, remove punctuation, or fuzzy match people.
    return normalizeWhitespace(value.normalize("NFC")).toLocaleLowerCase("en-ZA");
}

export function sourceRowerIdentityKey(
    displayName: string,
    schoolKey: string | null,
    schoolRaw: string,
): string
{
    const schoolIdentity = schoolKey ? `school:${schoolKey}` : `source-school:${exactAliasKey(schoolRaw)}`;
    return `${normalizeSourceRowerName(displayName)}\u0000${schoolIdentity}`;
}

export function appearanceRoleLabel(appearance: Appearance): string
{
    return appearance.isCox ? "Cox" : appearance.seat ? `Seat ${appearance.seat}` : "Crew";
}

export function groupRowerAppearances(races: readonly Race[]): RegattaRowerRecord[]
{
    // Call with one regatta only. These records are not canonical people and must not cross regatta boundaries.
    const records = new Map<string, RegattaRowerRecord>();
    for (const race of races)
    {
        for (const result of race.results)
        {
            for (const appearance of result.appearances)
            {
                const identityKey = sourceRowerIdentityKey(
                    appearance.displayName,
                    result.schoolKey,
                    result.schoolRaw,
                );
                let record = records.get(identityKey);
                if (!record)
                {
                    record = {
                        identityKey,
                        displayName: appearance.displayName,
                        schoolKey: result.schoolKey,
                        schoolName: result.schoolRaw,
                        appearances: [],
                        raceCount: 0,
                        eventIds: [],
                        boatClasses: [],
                        roles: [],
                    };
                    records.set(identityKey, record);
                }
                record.appearances.push({ race, result, appearance });
                if (!record.eventIds.includes(race.sourceEventId))
                {
                    record.eventIds.push(race.sourceEventId);
                }
                if (race.boatClass && !record.boatClasses.includes(race.boatClass))
                {
                    record.boatClasses.push(race.boatClass);
                }
                const role = appearanceRoleLabel(appearance);
                if (!record.roles.includes(role))
                {
                    record.roles.push(role);
                }
            }
        }
    }
    for (const record of records.values())
    {
        record.raceCount = new Set(record.appearances.map((item) => item.race.sourceKey)).size;
    }
    return [...records.values()].sort((left, right) =>
        left.displayName.localeCompare(right.displayName, "en-ZA")
        || left.schoolName.localeCompare(right.schoolName, "en-ZA")
    );
}

export function normalizeWhitespace(value: string): string
{
    return value.replace(/\s+/g, " ").trim();
}

export function normalizeGrantedEmail(value: string): string
{
    // Preserve mailbox semantics. In particular, do not remove dots or plus suffixes.
    return value.trim().normalize("NFC").toLowerCase();
}

export function exactAliasKey(value: string): string
{
    // Deterministic punctuation normalization applies to registered aliases only, never similarity matching.
    const withoutCountry = value.normalize("NFKC").replace(/\s*\([A-Z]{2,3}\)\s*$/i, "");
    const normalizedPunctuation = withoutCountry
        .replace(/[\u0027\u2018\u2019\u02bc]/g, "")
        .replace(/[\p{P}\p{S}]/gu, " ");

    return normalizeWhitespace(normalizedPunctuation).toLocaleLowerCase("en-ZA");
}

export function matchSchool(value: string, aliases: readonly SchoolAlias[]): SchoolAlias | null
{
    const key = exactAliasKey(value);
    const matches = aliases.filter((alias) => exactAliasKey(alias.alias) === key);
    if (new Set(matches.map((alias) => alias.schoolKey)).size > 1)
    {
        throw new Error(`Conflicting explicit school aliases: ${value}`);
    }
    return matches[0] ?? null;
}

export function parseFinishTime(value: string): number | null
{
    const match = normalizeWhitespace(value).match(/^(?:(\d+):)?([0-5]?\d)\.(\d{1,3})$/);
    if (!match)
    {
        return null;
    }
    const minutes = match[1] ?? "0";
    const seconds = match[2];
    const fraction = match[3];
    if (!seconds || !fraction)
    {
        return null;
    }
    return Number(minutes) * 60_000 + Number(seconds) * 1000 + Number(fraction.padEnd(3, "0"));
}

export function normalizeResultStatus(value: string): Result["status"]
{
    const statuses: Record<string, Result["status"]> = {
        FINISHED: "finished",
        DNS: "dns",
        SCRATCH: "scratch",
        DNF: "dnf",
        DSQ: "dsq",
        DQ: "dsq",
    };
    return statuses[normalizeWhitespace(value).toUpperCase()] ?? "unknown";
}

export function classifyEvent(value: string): Pick<Race, "gender" | "ageGroup" | "boatClass">
{
    const label = normalizeWhitespace(value).toUpperCase();
    const age = label.match(/(?:U|JM|JW|BU|GU)(1[4-9])/);
    const boat = label.match(/\b(1X|2X|4X\+?|8X\+?|2[+-]|4[+-]|8[+-])$/);
    let gender: Race["gender"] = "unknown";
    if (/\b(?:JW|GU|GIRLS|WOMEN)/.test(label))
    {
        gender = "girls";
    }
    else if (/\b(?:JM|BU|BOYS|MEN)/.test(label))
    {
        gender = "boys";
    }
    else if (/\b(?:MX|MIXED)/.test(label))
    {
        gender = "mixed";
    }
    return { gender, ageGroup: age?.[1] ? `U${age[1]}` : null, boatClass: boat?.[1]?.toLowerCase() ?? null };
}

export function normalizeRound(value: string): Race["round"]
{
    const label = normalizeWhitespace(value).toUpperCase();
    if (/\bHEAT\b/.test(label))
    {
        return "heat";
    }
    if (/\b(?:SF|SEMI[ -]?FINAL)\b/.test(label))
    {
        return "semifinal";
    }
    if (/\b(?:REP|REPECHAGE)\b/.test(label))
    {
        return "repechage";
    }
    if (/\b(?:B FINAL|FINAL B)\b/.test(label))
    {
        return "final-b";
    }
    if (/\b(?:C FINAL|FINAL C)\b/.test(label))
    {
        return "final-c";
    }
    return /\bFINAL\b/.test(label) ? "final-a" : "unknown";
}

export function parseAppearances(value: string): Appearance[]
{
    const segments = value.split(";").filter((part) => normalizeWhitespace(part));
    const rowerCount =
        segments.filter((part) => !/\((?:coxswain|cox|c)\)\s*$/i.test(part) && !/^cox\s*:/i.test(part))
            .length;
    return segments.map((rawName) =>
    {
        let working = normalizeWhitespace(rawName);
        const annotation = working.match(/\(([^)]+)\)\s*$/)?.[1] ?? null;
        const isCox = /^(?:coxswain|cox|c)$/i.test(annotation ?? "") || /^cox\s*:/i.test(working);
        let seat: number | null = null;
        if (/^\d+$/.test(annotation ?? ""))
        {
            seat = Number(annotation);
        }
        else if (/^bow$/i.test(annotation ?? ""))
        {
            seat = 1;
        }
        else if (/^stroke$/i.test(annotation ?? ""))
        {
            seat = rowerCount;
        }
        if (annotation && (isCox || seat !== null))
        {
            working = working.replace(/\([^)]+\)\s*$/, "").trim();
        }
        working = working.replace(/^cox\s*:\s*/i, "");
        const commaParts = working.split(",").map(normalizeWhitespace);
        const displayName = commaParts.length === 2 ? `${commaParts[1]} ${commaParts[0]}` : working;
        return { rawName, displayName, seat, isCox, rawAnnotation: annotation };
    });
}

export function parseSouthAfricanDate(dateRaw: string, timeRaw: string): string | null
{
    const match = normalizeWhitespace(dateRaw).match(/^(?:\w+,\s*)?(\d{1,2})\s+(\w+)\s+(\d{4})$/);
    const months = [
        "january",
        "february",
        "march",
        "april",
        "may",
        "june",
        "july",
        "august",
        "september",
        "october",
        "november",
        "december",
    ];
    if (!match || !/^\d{2}:\d{2}:\d{2}$/.test(timeRaw))
    {
        return null;
    }
    const day = match[1];
    const monthName = match[2];
    const year = match[3];
    if (!day || !monthName || !year)
    {
        return null;
    }
    const month = months.indexOf(monthName.toLowerCase()) + 1;
    const iso = `${year}-${String(month).padStart(2, "0")}-${day.padStart(2, "0")}T${timeRaw}+02:00`;
    const date = new Date(iso);
    return month && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
}
export * from "./live";
