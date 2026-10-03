import type { Race, Result } from "@the-perfect-catch/domain";

export function raceHref(race: Race): string
{
    return `/races/${encodeURIComponent(race.sourceKey)}`;
}

export function eventHref(race: Race, regattaId = "2026-sa-schools-championships"): string
{
    return `/regattas/${encodeURIComponent(regattaId)}/events/${encodeURIComponent(race.sourceEventId)}`;
}

export function formatFinish(milliseconds: number | null, fallback: string): string
{
    if (milliseconds === null)
    {
        return fallback || "Not recorded";
    }
    const centiseconds = Math.round(milliseconds / 10);
    const minutes = Math.floor(centiseconds / 6000);
    const seconds = Math.floor(centiseconds % 6000 / 100);
    return `${minutes}:${String(seconds).padStart(2, "0")}.${String(centiseconds % 100).padStart(2, "0")}`;
}

export function finishGap(result: Result, results: readonly Result[]): number | null
{
    const finishes = results.filter((item) => item.status === "finished" && item.finishMs !== null).map((
        item,
    ) => item.finishMs as number);
    if (result.status !== "finished" || result.finishMs === null || finishes.length === 0)
    {
        return null;
    }
    return (result.finishMs - Math.min(...finishes)) / 1000;
}

export function gapLabel(gap: number | null): string
{
    return gap === null ? "Not recorded" : gap === 0 ? "Winner" : `+${gap.toFixed(2)}`;
}

export function schoolAbbreviation(name: string): string
{
    return name.replace(/['’]/g, "").split(/\s+/).filter((part) =>
        !/^(school|college|high|for|of|the|boys|girls)$/i.test(part)
    ).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "SC";
}

export function roundLabel(round: Race["round"]): string
{
    const labels = {
        heat: "Heat",
        semifinal: "Semi final",
        repechage: "Repechage",
        "final-a": "Final A",
        "final-b": "Final B",
        "final-c": "Final C",
        unknown: "Round not recorded",
    };
    return labels[round];
}

export function captureLabel(value: string | Date | null | undefined): string
{
    if (!value)
    {
        return "Capture date not recorded";
    }
    return new Intl.DateTimeFormat("en-ZA", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Africa/Johannesburg",
    }).format(new Date(value));
}

export function raceDay(value: string | null): string | null
{
    if (!value)
    {
        return null;
    }
    return new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Africa/Johannesburg",
    }).format(new Date(value));
}
