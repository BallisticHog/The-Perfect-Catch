import type { SchoolPresentation } from "@the-perfect-catch/db";
import { CHAMPIONSHIP, type Race, type Result } from "@the-perfect-catch/domain";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const schoolNames = {
    "st-dunstans-college": "St Dunstan's College",
    "jeppe-high-school-for-boys": "Jeppe High School for Boys",
    "king-edward-vii-school": "King Edward VII School",
    "st-andrews-school-for-girls": "St Andrew's School for Girls",
} as const;

function makeResult(
    raceNumber: number,
    rowIndex: number,
    schoolKey: keyof typeof schoolNames | null,
    finishMs: number | null,
    status: Result["status"] = "finished",
): Result
{
    const place = status === "finished" ? rowIndex + 1 : null;
    const lane = [4, 3, 5, 2, 6, 1][rowIndex] ?? rowIndex + 1;
    const schoolRaw = schoolKey ? schoolNames[schoolKey] : "Independent Composite";
    return {
        sourceKey: `review-race-${raceNumber}-entry-${rowIndex + 1}`,
        rowIndex,
        schoolRaw,
        schoolKey,
        boatRaw: `${schoolRaw} A`,
        laneRaw: String(lane),
        lane,
        placeRaw: place ? String(place) : status.toUpperCase(),
        place,
        finishRaw: finishMs
            ? `${Math.floor(finishMs / 60_000)}:${((finishMs % 60_000) / 1000).toFixed(2).padStart(5, "0")}`
            : status.toUpperCase(),
        finishMs,
        splitRaw: "",
        deltaRaw: rowIndex ? `+${(rowIndex * 1.37).toFixed(2)}` : "",
        statusRaw: status === "finished" ? "Official" : status.toUpperCase(),
        status,
        athletesRaw: `Review Rower ${rowIndex + 1}; Review Partner ${rowIndex + 1}`,
        appearances: [
            {
                rawName: `Review Rower ${rowIndex + 1} (bow)`,
                displayName: `Review Rower ${rowIndex + 1}`,
                seat: 1,
                isCox: false,
                rawAnnotation: "bow",
            },
            {
                rawName: `Review Partner ${rowIndex + 1} (stroke)`,
                displayName: `Review Partner ${rowIndex + 1}`,
                seat: 2,
                isCox: false,
                rawAnnotation: "stroke",
            },
        ],
        rawCells: [],
    };
}

function makeRace(
    raceNumber: number,
    sourceEventId: string,
    eventName: string,
    round: Race["round"],
    roundRaw: string,
    scheduledAt: string,
    progressionRaw: string,
): Race
{
    const baseTime = 438_120 + raceNumber * 25;
    const schoolKeys: Array<keyof typeof schoolNames | null> = [
        "st-dunstans-college",
        "jeppe-high-school-for-boys",
        "king-edward-vii-school",
        "st-andrews-school-for-girls",
        null,
        "st-dunstans-college",
    ];
    return {
        sourceKey: `review-race-${raceNumber}`,
        sourceUrl: `${CHAMPIONSHIP.sourceUrl}#review-race-${raceNumber}`,
        sourceSnapshotId: "00000000-0000-4000-8000-000000000001",
        sourceEventId,
        eventNameRaw: eventName,
        eventName,
        gender: eventName.startsWith("JW") ? "girls" : "boys",
        ageGroup: "U19",
        boatClass: eventName.endsWith("1x") ? "1x" : "2-",
        raceNumber,
        roundRaw,
        round,
        dateRaw: scheduledAt.startsWith("2026-03-07") ? "Saturday, 7 March 2026" : "Friday, 6 March 2026",
        timeRaw: scheduledAt.slice(11, 19),
        scheduledAt,
        statusRaw: "Official",
        official: true,
        progressionRaw,
        results: schoolKeys.map((schoolKey, rowIndex) =>
            makeResult(
                raceNumber,
                rowIndex,
                schoolKey,
                rowIndex === 5 ? null : baseTime + rowIndex * 1_370,
                rowIndex === 5 ? "dns" : "finished",
            )
        ),
    };
}

const races: Race[] = [
    makeRace(
        101,
        "24",
        "JM19 2-",
        "heat",
        "Heat 1",
        "2026-03-06T06:00:00.000Z",
        "First three crews advance to the semi final.",
    ),
    makeRace(
        118,
        "24",
        "JM19 2-",
        "semifinal",
        "Semi Final 1",
        "2026-03-06T10:30:00.000Z",
        "First three crews advance to Final A.",
    ),
    makeRace(137, "24", "JM19 2-", "final-a", "Final A", "2026-03-07T08:30:00.000Z", "Final classification."),
    makeRace(141, "31", "JW19 1x", "final-a", "Final A", "2026-03-07T09:15:00.000Z", "Final classification."),
    makeRace(145, "35", "JM19 1x", "final-a", "Final A", "2026-03-07T10:00:00.000Z", "Final classification."),
];

const fallbackLocalReviewSchools: SchoolPresentation[] = [
    {
        id: "st-dunstans-college",
        name: schoolNames["st-dunstans-college"],
        shortName: "St Dunstan's",
        description: "Published championship results for St Dunstan's College.",
        crestAssetId: null,
        primaryColor: "#253573",
        secondaryColor: "#996A28",
        accessibleTokens: {},
        paletteSourceUrl: "https://stdunstans.co.za/vision",
        confidence: "low",
        inferred: true,
        themeAlgorithmVersion: "derive-at-render",
    },
    {
        id: "jeppe-high-school-for-boys",
        name: schoolNames["jeppe-high-school-for-boys"],
        shortName: "Jeppe",
        description: "Published championship results for Jeppe High School for Boys.",
        crestAssetId: null,
        primaryColor: "#111111",
        secondaryColor: "#F4F4F4",
        accessibleTokens: {},
        paletteSourceUrl: null,
        confidence: "low",
        inferred: true,
        themeAlgorithmVersion: "derive-at-render",
    },
    {
        id: "king-edward-vii-school",
        name: schoolNames["king-edward-vii-school"],
        shortName: "KES",
        description: null,
        crestAssetId: null,
        primaryColor: "#C6202E",
        secondaryColor: "#FFFFFF",
        accessibleTokens: {},
        paletteSourceUrl: null,
        confidence: "low",
        inferred: true,
        themeAlgorithmVersion: "derive-at-render",
    },
    {
        id: "st-andrews-school-for-girls",
        name: schoolNames["st-andrews-school-for-girls"],
        shortName: "St Andrew's",
        description: null,
        crestAssetId: null,
        primaryColor: "#164B36",
        secondaryColor: "#E4C76A",
        accessibleTokens: {},
        paletteSourceUrl: null,
        confidence: "low",
        inferred: true,
        themeAlgorithmVersion: "derive-at-render",
    },
];

const fallbackLocalReviewCatalog = {
    regatta: {
        id: CHAMPIONSHIP.slug,
        name: CHAMPIONSHIP.name,
        sourceName: CHAMPIONSHIP.sourceTitle,
        sourceUrl: CHAMPIONSHIP.sourceUrl,
        startsOn: CHAMPIONSHIP.startsOn,
        endsOn: CHAMPIONSHIP.endsOn,
        venue: CHAMPIONSHIP.venue,
        activeVersionId: "00000000-0000-4000-8000-000000000002",
        updatedAt: new Date("2026-03-08T17:00:00.000Z"),
    },
    version: {
        id: "00000000-0000-4000-8000-000000000002",
        importRunId: "00000000-0000-4000-8000-000000000003",
        regattaKey: CHAMPIONSHIP.slug,
        manifestHash: "local-review-fixture",
        createdAt: new Date("2026-03-08T17:00:00.000Z"),
    },
    latestRefresh: {
        status: "unchanged" as const,
        startedAt: new Date("2026-03-08T17:00:00.000Z"),
        finishedAt: new Date("2026-03-08T17:00:05.000Z"),
    },
    races,
};

type GeneratedLocalCatalog = {
    regatta: typeof fallbackLocalReviewCatalog.regatta;
    version: typeof fallbackLocalReviewCatalog.version;
    latestRefresh: {
        status: "running" | "validated" | "published" | "unchanged" | "failed";
        startedAt: string;
        finishedAt: string | null;
    };
    races: Race[];
    schools: SchoolPresentation[];
};

function generatedCatalogPath(): string | null
{
    if (process.env.CATCH_USE_FULL_LOCAL_CATALOG !== "true")
    {
        return null;
    }
    const candidates = [
        process.env.CATCH_LOCAL_CATALOG_PATH,
        path.resolve(process.cwd(), ".data/local-review-catalog.json"),
        path.resolve(process.cwd(), "../../.data/local-review-catalog.json"),
    ].filter((candidate): candidate is string => Boolean(candidate));
    return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function loadGeneratedCatalog(): GeneratedLocalCatalog | null
{
    const file = generatedCatalogPath();
    if (!file)
    {
        return null;
    }
    return JSON.parse(readFileSync(/* turbopackIgnore: true */ file, "utf8")) as GeneratedLocalCatalog;
}

const generated = loadGeneratedCatalog();

export const localReviewSchools: SchoolPresentation[] = generated?.schools ?? fallbackLocalReviewSchools;

export const localReviewCatalog = generated
    ? {
        regatta: {
            ...generated.regatta,
            updatedAt: new Date(generated.regatta.updatedAt),
        },
        version: {
            ...generated.version,
            createdAt: new Date(generated.version.createdAt),
        },
        latestRefresh: {
            ...generated.latestRefresh,
            startedAt: new Date(generated.latestRefresh.startedAt),
            finishedAt: generated.latestRefresh.finishedAt
                ? new Date(generated.latestRefresh.finishedAt)
                : null,
        },
        races: generated.races,
    }
    : fallbackLocalReviewCatalog;

export function localReviewCatalogFor(state: "ready" | "stale" | "empty")
{
    if (state === "empty")
    {
        return null;
    }
    if (state === "stale")
    {
        return {
            ...localReviewCatalog,
            latestRefresh: {
                status: "failed" as const,
                startedAt: new Date("2026-03-09T08:00:00.000Z"),
                finishedAt: new Date("2026-03-09T08:01:00.000Z"),
            },
        };
    }
    return localReviewCatalog;
}
