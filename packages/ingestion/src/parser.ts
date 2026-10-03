import {
    CHAMPIONSHIP,
    classifyEvent,
    type ImportIssue,
    matchSchool,
    normalizeResultStatus,
    normalizeRound,
    normalizeWhitespace,
    parseAppearances,
    parseFinishTime,
    parseSouthAfricanDate,
    type Race,
    raceSchema,
    type SchoolAlias,
} from "@the-perfect-catch/domain";
import { load } from "cheerio";
import iconv from "iconv-lite";
import { createHash } from "node:crypto";

export const PARSER_VERSION = "sa-schools-2026.v1";
export const SOURCE_DIRECTORY = new URL(".", CHAMPIONSHIP.sourceUrl).href;
export const MAX_RACE_LINKS = 300;

export function canonicalSourceUrl(value: string, base: string = CHAMPIONSHIP.sourceUrl): string
{
    const url = new URL(value, base);
    if (
        url.protocol !== "https:" || url.hostname !== "www.regattaresults.co.za" || url.port || url.username
        || url.password || !url.href.startsWith(SOURCE_DIRECTORY)
    )
    {
        throw new Error("Source URL is outside the approved championship directory");
    }
    url.hash = "";
    if (url.search)
    {
        throw new Error("Unexpected source query parameters");
    }
    return url.href;
}

export function sourceUrlKey(value: string): string
{
    return createHash("sha256").update(canonicalSourceUrl(value)).digest("hex");
}

export function decodeHtml(bytes: Uint8Array, contentType = ""): { html: string; encoding: string; }
{
    void contentType;
    // The registered championship adapter overrides the server's incorrect UTF-8 declaration.
    return { html: iconv.decode(Buffer.from(bytes), "windows-1252"), encoding: "windows-1252" };
}

export interface RaceLink
{
    url: string;
    eventId: string;
    eventName: string;
    raceLabel: string;
}

export function parseOverview(html: string): RaceLink[]
{
    const $ = load(html);
    if (normalizeWhitespace($("title").text()) !== CHAMPIONSHIP.sourceTitle)
    {
        throw new Error("Source page is not the approved 2026 championship");
    }
    const rows = $("#table1 tr").toArray();
    const headers = $(rows[0]).find("td,th").map((_, cell) =>
        normalizeWhitespace($(cell).text()).toLowerCase()
    ).get();
    for (const column of ["event id", "event name", "race", "details"])
    {
        if (!headers.includes(column))
        {
            throw new Error(`Overview missing ${column} column`);
        }
    }
    const links: RaceLink[] = [];
    for (const row of rows.slice(1))
    {
        const cells = $(row).find("td");
        const text = (header: string) => normalizeWhitespace(cells.eq(headers.indexOf(header)).text());
        const anchor = cells.eq(headers.indexOf("details")).find("a[href]").first();
        if (!anchor.length)
        {
            // The source contains scheduled umpire breaks with no race details.
            if (/break|lunch|prize|ceremony/i.test(text("event name")))
            {
                continue;
            }
            throw new Error(`Race has no source details link: ${text("event name")} ${text("race")}`);
        }
        const url = canonicalSourceUrl(anchor.attr("href")!);
        if (url === CHAMPIONSHIP.sourceUrl || !/\.htm$/i.test(new URL(url).pathname))
        {
            throw new Error("Unexpected race details link");
        }
        if (links.some((link) => link.url === url))
        {
            throw new Error(`Duplicate source race URL: ${url}`);
        }
        if (links.length >= MAX_RACE_LINKS)
        {
            throw new Error(`Overview exceeds the reviewed ${MAX_RACE_LINKS} race link limit`);
        }
        links.push({
            url,
            eventId: text("event id"),
            eventName: text("event name"),
            raceLabel: text("race"),
        });
    }
    if (!links.length)
    {
        throw new Error("Overview contains no race links");
    }
    return links;
}

export function parseRace(
    html: string,
    link: RaceLink,
    aliases: readonly SchoolAlias[] = [],
): { race: Race; issues: ImportIssue[]; }
{
    const $ = load(html);
    const issues: ImportIssue[] = [];
    const sourceUrl = canonicalSourceUrl(link.url);
    const sourceKey = sourceUrlKey(sourceUrl);
    if (
        normalizeWhitespace($("title").text()) !== CHAMPIONSHIP.sourceTitle
        || /Officials are working to bring you the page/.test($("body").text())
    )
    {
        throw new Error("Missing or unexpected race page");
    }
    const paragraphs = $("p").map((_, element) => normalizeWhitespace($(element).text())).get();
    const field = (label: string) =>
        paragraphs.find((value) => value.startsWith(`${label}:`))?.slice(label.length + 1).trim() ?? "";
    const eventLine = paragraphs.find((value) => /^Event\s+\d+\s*-/.test(value));
    const eventMatch = eventLine?.match(/^Event\s+(\d+)\s*-\s*(.+)$/);
    if (
        !eventMatch || eventMatch[1] !== link.eventId
        || normalizeWhitespace(eventMatch[2]) !== normalizeWhitespace(link.eventName)
    )
    {
        throw new Error("Race event does not match its overview link");
    }
    const rows = $("#table1 tr").toArray();
    const headers = $(rows[0]).find("td,th").map((_, cell) =>
        normalizeWhitespace($(cell).text()).toLowerCase().replace(/[.:]/g, "")
    ).get();
    for (const column of ["org name", "lane", "finish time", "status", "place"])
    {
        if (!headers.includes(column))
        {
            throw new Error(`Race results table missing ${column}`);
        }
    }
    if (!headers.includes("athlete") && !headers.includes("athletes"))
    {
        throw new Error("Race results table missing athlete column");
    }
    const integer = (value: string) =>
        /^\d+$/.test(normalizeWhitespace(value)) && Number(value) > 0 ? Number(value) : null;
    const results = rows.slice(1).map((row, rowIndex) =>
    {
        const cells = $(row).find("td");
        if (cells.length !== headers.length)
        {
            throw new Error(`Malformed result row ${rowIndex + 1}`);
        }
        const rawCells = cells.map((_, cell) => $(cell).text()).get();
        const cell = (name: string) => rawCells[headers.indexOf(name)] ?? "";
        const schoolRaw = cell("org name");
        if (!normalizeWhitespace(schoolRaw))
        {
            throw new Error(`Empty school on result row ${rowIndex + 1}`);
        }
        const alias = matchSchool(schoolRaw, aliases);
        if (!alias)
        {
            issues.push({
                severity: "warning",
                code: "unmapped-school",
                sourceUrl,
                message: `No explicit alias for ${normalizeWhitespace(schoolRaw)}`,
            });
        }
        const statusRaw = cell("status");
        const finishRaw = cell("finish time");
        const status = normalizeResultStatus(statusRaw);
        const finishMs = parseFinishTime(finishRaw);
        if (status === "finished" && finishMs === null)
        {
            issues.push({
                severity: "error",
                code: "invalid-finish-time",
                sourceUrl,
                message: `Finished row ${rowIndex + 1} has no valid finish time`,
            });
        }
        if (status === "unknown")
        {
            issues.push({
                severity: "warning",
                code: "unknown-result-status",
                sourceUrl,
                message: `Manual review required for result status on row ${rowIndex + 1}: ${statusRaw}`,
            });
        }
        const athletesRaw = cell("athlete") || cell("athletes");
        return {
            sourceKey: `${sourceKey}:row:${rowIndex}`,
            rowIndex,
            schoolRaw,
            schoolKey: alias?.schoolKey ?? null,
            boatRaw: cell("boat id") || cell("boat"),
            laneRaw: cell("lane"),
            lane: integer(cell("lane")),
            placeRaw: cell("place"),
            place: integer(cell("place")),
            finishRaw,
            finishMs,
            splitRaw: cell("split"),
            deltaRaw: cell("delta"),
            statusRaw,
            status,
            athletesRaw,
            appearances: parseAppearances(athletesRaw),
            rawCells,
        };
    });
    const raceLine = field("Race");
    if (normalizeWhitespace(raceLine) !== normalizeWhitespace(link.raceLabel))
    {
        throw new Error("Race number or round disagrees with source overview");
    }
    const raceMatch = raceLine.match(/^(\d+)\s*-\s*(.+)$/);
    const roundRaw = raceMatch?.[2] ?? raceLine;
    const scheduledAt = parseSouthAfricanDate(field("Date"), field("Time"));
    if (!scheduledAt || scheduledAt < "2026-03-05T22:00:00.000Z" || scheduledAt >= "2026-03-08T22:00:00.000Z")
    {
        throw new Error("Race date is outside the approved championship dates");
    }
    const race = raceSchema.parse(
        {
            sourceKey,
            sourceUrl,
            sourceEventId: eventMatch[1],
            eventNameRaw: eventMatch[2],
            eventName: normalizeWhitespace(eventMatch[2]),
            ...classifyEvent(eventMatch[2]),
            raceNumber: raceMatch ? Number(raceMatch[1]) : null,
            roundRaw,
            round: normalizeRound(roundRaw),
            dateRaw: field("Date"),
            timeRaw: field("Time"),
            scheduledAt,
            statusRaw: field("Status"),
            official: field("Status").toLowerCase() === "official",
            progressionRaw: field("Progression"),
            results,
        },
    );
    if (!race.official)
    {
        issues.push({
            severity: "warning",
            code: "unofficial",
            sourceUrl,
            message: "Race is not marked Official by the source",
        });
    }
    if (race.round === "unknown")
    {
        issues.push({
            severity: "warning",
            code: "unknown-round",
            sourceUrl,
            message: `Manual review required for source round: ${race.roundRaw}`,
        });
    }
    return { race, issues };
}
