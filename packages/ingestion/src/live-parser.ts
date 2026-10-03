import {
    LIVE_REGATTA,
    type LiveEntry,
    type LiveSchedule,
    normalizeWhitespace,
    parseFinishTime,
    parseSouthAfricanDate,
} from "@the-perfect-catch/domain";
import { load } from "cheerio";
import { createHash } from "node:crypto";

export function liveSourceUrl(value: string, base = LIVE_REGATTA.sourceUrl as string): string
{
    const url = new URL(value, base);
    const directory = new URL(".", LIVE_REGATTA.sourceUrl).href;
    if (
        !url.href.startsWith(directory) || url.search || url.username || url.password
        || !/\.htm$/i.test(url.pathname)
    )
    {
        throw new Error("Live source is outside the registered regatta directory");
    }
    url.hash = "";
    return url.href;
}

function sourcePage(html: string)
{
    const $ = load(html);
    if (
        normalizeWhitespace($("title").text()) !== LIVE_REGATTA.sourceTitle
        || /Officials are working to bring you the page/i.test($("body").text())
    )
    {
        throw new Error("Publisher page is not ready or has an unexpected format");
    }
    const rows = $("#table1 tr").toArray();
    const headers = $(rows[0]).find("td,th").map((_, cell) =>
        normalizeWhitespace($(cell).text()).toLowerCase().replace(/[.:]/g, "")
    ).get();
    const values = rows.slice(1).map((row) =>
    {
        const cells = $(row).children("td");
        if (cells.length !== headers.length)
        {
            throw new Error("Publisher table contains an incomplete row");
        }
        return {
            cells,
            get: (name: string) =>
                headers.includes(name) ? normalizeWhitespace(cells.eq(headers.indexOf(name)).text()) : "",
        };
    });
    return { $, headers, values };
}

function scheduled(date: string, time: string): string
{
    const value = parseSouthAfricanDate(date, time);
    if (!value || !value.startsWith(LIVE_REGATTA.date))
    {
        throw new Error("Race schedule is outside the registered regatta day");
    }
    return value;
}

export function parseLiveOverview(html: string): { races: LiveSchedule[]; updated: string | null; }
{
    const { $, headers, values } = sourcePage(html);
    for (const name of ["event id", "event name", "race", "date", "time", "event status", "details"])
    {
        if (!headers.includes(name))
        {
            throw new Error(`Publisher schedule missing ${name}`);
        }
    }
    const races: LiveSchedule[] = [];
    for (const { cells, get } of values)
    {
        if (/break|lunch|prize|ceremony/i.test(get("event name")))
        {
            continue;
        }
        const anchor = cells.eq(headers.indexOf("details")).find("a[href]").first();
        if (!anchor.length || !/^\d+$/.test(get("event id")) || !/^\d+\s*-/.test(get("race")))
        {
            throw new Error("Publisher schedule has an incomplete race or missing link");
        }
        const url = liveSourceUrl(anchor.attr("href")!);
        races.push({
            key: createHash("sha256").update(url).digest("hex"),
            url,
            eventId: get("event id"),
            eventName: get("event name"),
            raceLabel: get("race"),
            scheduledAt: scheduled(get("date"), get("time")),
            status: get("event status"),
            progression: get("progression"),
            publishedResults: /official|provisional|result/i.test(get("event status"))
                || /result/i.test(anchor.text()),
        });
    }
    if (!races.length || races.length > 300 || new Set(races.map((race) => race.key)).size !== races.length)
    {
        throw new Error("Publisher schedule has no races, too many races, or duplicate links");
    }
    const updated =
        $("p").map((_, p) => normalizeWhitespace($(p).text())).get().find((p) =>
            p.startsWith("Results updated:")
        ) ?? null;
    return { races, updated };
}

export function parseLiveRace(
    html: string,
    link: LiveSchedule,
): { entries: LiveEntry[]; status: string; scheduledAt: string; }
{
    const { $, headers, values } = sourcePage(html);
    const paragraphs = $("p").map((_, p) => normalizeWhitespace($(p).text())).get();
    const field = (label: string) =>
        paragraphs.find((p) => p.startsWith(`${label}:`))?.slice(label.length + 1).trim() ?? "";
    if (!paragraphs.includes(`Event ${link.eventId} - ${link.eventName}`) || field("Race") !== link.raceLabel)
    {
        throw new Error("Race detail does not match the current schedule");
    }
    for (const name of ["lane", "org name"])
    {
        if (!headers.includes(name))
        {
            throw new Error(`Race detail missing ${name}`);
        }
    }
    if (!headers.includes("athlete") && !headers.includes("athletes"))
    {
        throw new Error("Race detail missing crew names");
    }
    const status = field("Status");
    if (/official|provisional/i.test(status) && !headers.includes("finish time"))
    {
        throw new Error("Results page has no timing columns");
    }
    const entries = values.map(({ get }) =>
    {
        const finishMs = get("finish time") ? parseFinishTime(get("finish time")) : null;
        if (
            !get("org name")
            || (get("finish time") && finishMs === null
                && !/^(DNS|DNF|SCR|SCRATCH|DSQ|DQ|-)$/i.test(get("finish time")))
        )
        {
            throw new Error("Race detail contains an invalid entry or finish time");
        }
        return {
            lane: get("lane"),
            boat: get("boat") || get("boat id"),
            school: get("org name"),
            athletes: get("athlete") || get("athletes"),
            place: get("place"),
            time: get("finish time"),
            finishMs,
            status: get("status") || (headers.includes("finish time") ? "Awaiting result" : "Lane draw"),
        };
    });
    if (!entries.length && !/cancel|scratch|withdraw/i.test(status))
    {
        throw new Error("Race detail is empty; retaining the previous draw or results");
    }
    return { entries, status, scheduledAt: scheduled(field("Date"), field("Time")) };
}
