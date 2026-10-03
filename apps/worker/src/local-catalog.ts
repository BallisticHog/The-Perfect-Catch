import type { SchoolPresentation } from "@the-perfect-catch/db";
import { CHAMPIONSHIP, exactAliasKey, type Race } from "@the-perfect-catch/domain";
import {
    MAX_RACE_LINKS,
    parseOverview,
    PARSER_VERSION,
    parseRace,
    SourceFetcher,
    validateCandidate,
} from "@the-perfect-catch/ingestion";
import { createHash } from "node:crypto";
import { mkdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));
const dataRoot = path.join(repositoryRoot, ".data");
const snapshotRoot = path.join(dataRoot, "source-snapshots");
const mediaRoot = path.join(dataRoot, "local-review-media");
const maximumAggregateBytes = 128 * 1024 * 1024;

const knownSchools = [
    {
        id: "st-dunstans-college",
        name: "St Dunstan's College",
        aliases: [
            "St Dunstans College",
            "St Dunstans High School",
            "St Dunstan's College",
            "St Dunstan's High School",
        ],
        primaryColor: "#253573",
        secondaryColor: "#996A28",
        paletteSourceUrl: "https://stdunstans.co.za/vision",
    },
    {
        id: "jeppe-high-school-for-boys",
        name: "Jeppe High School for Boys",
        aliases: ["Jeppe High School for Boys", "Jeppe Boys High School", "Jeppe Boys"],
        primaryColor: "#161616",
        secondaryColor: "#E8ECEF",
        paletteSourceUrl: null,
    },
    {
        id: "king-edward-vii-school",
        name: "King Edward VII School",
        aliases: ["King Edward VII School", "KES"],
        primaryColor: "#A6192E",
        secondaryColor: "#F4C430",
        paletteSourceUrl: null,
    },
    {
        id: "st-andrews-school-for-girls",
        name: "St Andrew's School for Girls",
        aliases: ["St Andrews School for Girls", "St Andrew's School for Girls"],
        primaryColor: "#164B36",
        secondaryColor: "#D6B95E",
        paletteSourceUrl: null,
    },
    {
        id: "st-albans-college",
        name: "St Alban's College",
        aliases: [
            "St Albans College",
            "St Alban's College",
            "St Albans College Boat Club",
            "St Alban's College Boat Club",
        ],
        primaryColor: "#063A6B",
        secondaryColor: "#E7EDF2",
        paletteSourceUrl: null,
    },
] as const;

const provisionalPalettes = [
    ["#123B5D", "#B98B2F"],
    ["#124B3A", "#D0A53D"],
    ["#5A2433", "#D5B56B"],
    ["#2E3E72", "#C4CBDD"],
    ["#604019", "#E2C792"],
    ["#234D5A", "#D56C43"],
    ["#3F315E", "#C9A9D8"],
    ["#6B2F28", "#E3B44C"],
] as const;

function sha256(value: string | Uint8Array): string
{
    return createHash("sha256").update(value).digest("hex");
}

function uuidFrom(value: string): string
{
    const hash = sha256(value);
    return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${
        hash.slice(20, 32)
    }`;
}

function slugify(value: string): string
{
    return value.normalize("NFKD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("en-ZA")
        .replace(/\(rsa\)/giu, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "school";
}

function abbreviation(value: string): string
{
    return value.replace(/['’]/g, "").split(/\s+/).filter((part) =>
        !/^(school|college|high|for|of|the|boys|girls)$/i.test(part)
    ).slice(0, 3).map((part) => part[0]).join("").toUpperCase() || "SC";
}

function xml(value: string): string
{
    return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
        .replaceAll("\"", "&quot;").replaceAll("'", "&apos;");
}

function knownSchool(rawName: string)
{
    const key = exactAliasKey(rawName);
    return knownSchools.find((school) => school.aliases.some((alias) => exactAliasKey(alias) === key));
}

function schoolIdentity(rawName: string): string
{
    const known = knownSchool(rawName);
    return known ? `known:${known.id}` : `source:${exactAliasKey(rawName)}`;
}

function preferredSourceName(names: Map<string, number>): string
{
    return [...names.entries()].sort((left, right) =>
        right[1] - left[1] || left[0].localeCompare(right[0])
    )[0]?.[0]
        ?? "School not recorded";
}

async function createPreviewBadge(
    schoolId: string,
    name: string,
    primaryColor: string,
    secondaryColor: string,
)
{
    const assetId = uuidFrom(`local-review-school-badge:${schoolId}`);
    const initials = abbreviation(name).slice(0, 3);
    const badgeFill = xml(primaryColor);
    const badgeStroke = xml(secondaryColor);
    const badgeInitials = xml(initials);
    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
            <path d="M34 22h188v112c0 53-38 87-94 106-56-19-94-53-94-106z" fill="${badgeFill}" stroke="${badgeStroke}" stroke-width="12"/>
            <path d="M53 45h150v82c0 40-25 67-75 86-50-19-75-46-75-86z" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="3"/>
            <text x="128" y="144" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="58" font-weight="700">${badgeInitials}</text>
        </svg>`;
    const bytes = await sharp(Buffer.from(svg)).png().toBuffer();
    const hash = sha256(bytes);
    const storageKey = `${hash}.png`;
    await writeFile(path.join(mediaRoot, storageKey), bytes, { flag: "wx" }).catch((error: unknown) =>
    {
        if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST")
        {
            throw error;
        }
    });
    return {
        id: assetId,
        schoolId,
        storageKey,
        mimeType: "image/png",
        byteSize: bytes.byteLength,
        sha256: hash,
        altText: `${name} private preview badge`,
        kind: "generated_private_preview_badge" as const,
    };
}

async function main()
{
    await Promise.all([mkdir(snapshotRoot, { recursive: true }), mkdir(mediaRoot, { recursive: true })]);
    const fetcher = new SourceFetcher({
        minimumIntervalMs: 1100,
        userAgent: process.env.REGATTA_RESULTS_USER_AGENT
            ?? "ThePerfectCatchPrivateBeta/0.1 (+https://github.com/BallisticHog/The-Perfect-Catch)",
    });
    let aggregateBytes = 0;

    async function fetchDocument(url: string)
    {
        const response = await fetcher.fetch(url);
        const document = response.document;
        if (!document || response.statusCode < 200 || response.statusCode >= 300)
        {
            throw new Error(`Could not capture ${url}: HTTP ${response.statusCode}`);
        }
        aggregateBytes += document.rawBytes.byteLength;
        if (aggregateBytes > maximumAggregateBytes)
        {
            throw new Error("Source capture exceeded the reviewed aggregate byte limit");
        }
        const capturedAt = new Date().toISOString();
        await Promise.all([
            writeFile(path.join(snapshotRoot, `${document.sha256}.html`), document.rawBytes, { flag: "wx" })
                .catch((error: unknown) =>
                {
                    if (!(error instanceof Error) || !("code" in error) || error.code !== "EEXIST")
                    {
                        throw error;
                    }
                }),
            writeFile(
                path.join(snapshotRoot, `${document.sha256}.json`),
                `${
                    JSON.stringify(
                        {
                            url: document.url,
                            sha256: document.sha256,
                            encoding: document.encoding,
                            responseHeaders: document.responseHeaders,
                            capturedAt,
                        },
                        null,
                        2,
                    )
                }\n`,
            ),
        ]);
        return document;
    }

    console.info("Capturing the championship index");
    const overview = await fetchDocument(CHAMPIONSHIP.sourceUrl);
    const links = parseOverview(overview.decodedHtml);
    if (links.length > MAX_RACE_LINKS)
    {
        throw new Error(`Source contains more than ${MAX_RACE_LINKS} reviewed race links`);
    }
    const races: Race[] = [];
    const issues = [];
    for (const [index, link] of links.entries())
    {
        console.info(
            `[${String(index + 1).padStart(3, "0")}/${links.length}] ${link.eventName} ${link.raceLabel}`,
        );
        const document = await fetchDocument(link.url);
        const parsed = parseRace(document.decodedHtml, link, []);
        parsed.race.sourceSnapshotId = uuidFrom(`source-snapshot:${document.sha256}`);
        races.push(parsed.race);
        issues.push(...parsed.issues);
    }
    issues.push(...validateCandidate(races, []));
    if (issues.some((issue) => issue.severity === "error"))
    {
        throw new Error(
            "The captured catalogue failed validation. The previous local catalogue remains active.",
        );
    }

    const groupedSchools = new Map<string, Map<string, number>>();
    for (const race of races)
    {
        for (const result of race.results)
        {
            const identity = schoolIdentity(result.schoolRaw);
            const names = groupedSchools.get(identity) ?? new Map<string, number>();
            names.set(result.schoolRaw, (names.get(result.schoolRaw) ?? 0) + 1);
            groupedSchools.set(identity, names);
        }
    }

    const schools: SchoolPresentation[] = [];
    const media = [];
    const schoolIds = new Map<string, string>();
    for (
        const [index, [identity, sourceNames]] of [...groupedSchools.entries()].sort((left, right) =>
            preferredSourceName(left[1]).localeCompare(preferredSourceName(right[1]))
        ).entries()
    )
    {
        const rawName = preferredSourceName(sourceNames);
        const known = knownSchool(rawName);
        const id = known?.id ?? `${slugify(rawName)}-${sha256(identity).slice(0, 6)}`;
        const palette = provisionalPalettes[index % provisionalPalettes.length] as readonly [string, string];
        const primaryColor = known?.primaryColor ?? palette[0];
        const secondaryColor = known?.secondaryColor ?? palette[1];
        const name = known?.name ?? rawName.replace(/\s*\(RSA\)\s*$/i, "").trim();
        const badge = await createPreviewBadge(id, name, primaryColor, secondaryColor);
        media.push(badge);
        schoolIds.set(identity, id);
        schools.push({
            id,
            name,
            shortName: abbreviation(name),
            description: `Championship source record using ${[...sourceNames.keys()].join(", ")}.`,
            crestAssetId: badge.id,
            primaryColor,
            secondaryColor,
            accessibleTokens: {},
            paletteSourceUrl: known?.paletteSourceUrl ?? null,
            confidence: "low",
            inferred: true,
            themeAlgorithmVersion: "derive-at-render",
        });
    }

    for (const race of races)
    {
        for (const result of race.results)
        {
            result.schoolKey = schoolIds.get(schoolIdentity(result.schoolRaw)) ?? null;
        }
    }

    const generatedAt = new Date().toISOString();
    const catalog = {
        formatVersion: 1,
        generatedAt,
        parserVersion: PARSER_VERSION,
        regatta: {
            id: CHAMPIONSHIP.slug,
            name: CHAMPIONSHIP.name,
            sourceName: CHAMPIONSHIP.sourceTitle,
            sourceUrl: CHAMPIONSHIP.sourceUrl,
            startsOn: CHAMPIONSHIP.startsOn,
            endsOn: CHAMPIONSHIP.endsOn,
            venue: CHAMPIONSHIP.venue,
            activeVersionId: uuidFrom(`local-catalog:${generatedAt}`),
            updatedAt: generatedAt,
        },
        version: {
            id: uuidFrom(`local-catalog:${generatedAt}`),
            importRunId: uuidFrom(`local-import:${generatedAt}`),
            regattaKey: CHAMPIONSHIP.slug,
            manifestHash: sha256(races.map((race) => race.sourceKey).sort().join("\n")),
            createdAt: generatedAt,
        },
        latestRefresh: {
            status: "validated",
            startedAt: generatedAt,
            finishedAt: generatedAt,
        },
        races,
        schools,
        summary: {
            events: new Set(races.map((race) => race.sourceEventId)).size,
            races: races.length,
            results: races.reduce((sum, race) => sum + race.results.length, 0),
            appearances: races.reduce(
                (sum, race) =>
                    sum + race.results.reduce((entrySum, result) => entrySum + result.appearances.length, 0),
                0,
            ),
            schools: schools.length,
            warnings: issues.filter((issue) => issue.severity === "warning").length,
            capturedBytes: aggregateBytes,
        },
    };
    const temporaryCatalog = path.join(dataRoot, "local-review-catalog.json.tmp");
    const catalogPath = path.join(dataRoot, "local-review-catalog.json");
    const mediaManifestPath = path.join(dataRoot, "local-review-media.json");
    await writeFile(temporaryCatalog, `${JSON.stringify(catalog)}\n`);
    await writeFile(
        mediaManifestPath,
        `${JSON.stringify({ formatVersion: 1, generatedAt, assets: media })}\n`,
    );
    await rename(temporaryCatalog, catalogPath);
    console.info(`Published local catalogue: ${JSON.stringify(catalog.summary)}`);
}

await main();
