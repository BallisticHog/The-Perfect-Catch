"use client";

import {
    estimatePublicationDelay,
    LIVE_REGATTA,
    type LiveRace,
    type LiveState,
} from "@the-perfect-catch/domain";
import { useEffect, useRef, useState } from "react";

const clock = (value: string | null) =>
    value
        ? new Intl.DateTimeFormat("en-ZA", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            timeZone: "Africa/Johannesburg",
            hourCycle: "h23",
        }).format(new Date(value))
        : "Not checked";

function raceState(race: LiveRace, now: number): string
{
    if (!race.listed)
    {
        return "No longer listed";
    }
    if (race.entries.some((entry) => entry.finishMs !== null))
    {
        return race.detailStatus ?? "Results published";
    }
    if (/cancel|scratch|withdraw/i.test(race.status))
    {
        return race.status;
    }
    return now > Date.parse(race.scheduledAt) + 10 * 60_000 ? "Awaiting results" : race.status;
}

export function LiveBoard({ initialQuery, initialView }: { initialQuery: string; initialView: string; })
{
    const [data, setData] = useState<LiveState | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [query, setQuery] = useState(initialQuery);
    const [view, setView] = useState(initialView);
    const [limit, setLimit] = useState(30);
    const [now, setNow] = useState(0);
    const [dismissedDelay, setDismissedDelay] = useState("");
    const search = useRef<HTMLInputElement>(null);

    useEffect(() =>
    {
        let disposed = false;
        let timer: ReturnType<typeof setTimeout>;
        const controller = new AbortController();
        async function refresh()
        {
            try
            {
                const response = await fetch("/api/live", {
                    cache: "no-store",
                    signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]),
                });
                if (response.status === 401 || response.status === 403)
                {
                    setData(null);
                    setError("Your access has expired. Sign in again to continue.");
                    return;
                }
                if (!response.ok)
                {
                    throw new Error("Updates are unavailable. Your last received results remain below.");
                }
                const latest = await response.json() as LiveState | null;
                if (!disposed)
                {
                    setData(latest);
                    setError("");
                }
            }
            catch (failure)
            {
                if (!disposed)
                {
                    setError(
                        failure instanceof Error ? failure.message : "Connection interrupted; retrying.",
                    );
                }
            }
            finally
            {
                if (!disposed)
                {
                    setLoading(false);
                    setNow(Date.now());
                    timer = setTimeout(refresh, document.hidden ? 15_000 : 5000);
                }
            }
        }
        void refresh();
        return () =>
        {
            disposed = true;
            controller.abort();
            clearTimeout(timer);
        };
    }, []);

    const fresh = Boolean(data && now - Date.parse(data.heartbeatAt) < 90_000);
    const complete = data?.monitorStatus === "complete";
    const delay =
        data && fresh && !data.indexError && data.indexValidAt && now - Date.parse(data.indexValidAt) < 90_000
            ? estimatePublicationDelay(data.races, now)
            : null;
    const delayKey = delay ? `${delay.lowerMinutes}-${delay.upperMinutes}` : "";
    const normalizedQuery = query.trim().toLowerCase();
    const races = (data?.races ?? []).filter((race) =>
    {
        const hasResults = race.entries.some((entry) => entry.finishMs !== null);
        const matchesView = view === "results" ? hasResults : view === "pending" ? !hasResults : true;
        return matchesView
            && (!normalizedQuery
                || [
                    race.eventName,
                    race.eventId,
                    race.raceLabel,
                    ...race.entries.map((entry) => `${entry.school} ${entry.athletes} ${entry.boat}`),
                ].some((value) => value.toLowerCase().includes(normalizedQuery)));
    }).sort((a, b) =>
        a.scheduledAt.localeCompare(b.scheduledAt)
        || a.raceLabel.localeCompare(b.raceLabel, undefined, { numeric: true })
    );
    let monitorLabel = "Connecting";
    if (data)
    {
        if (complete)
        {
            monitorLabel = "Capture complete";
        }
        else if (fresh)
        {
            monitorLabel = "Following the publisher";
        }
        else
        {
            monitorLabel = "Updates paused";
        }
    }
    let resultSummary = `${races.length} matching races. Open a race for its lanes and crews.`;
    if (loading)
    {
        resultSummary = "Loading the regatta...";
    }
    else if (!data)
    {
        resultSummary = "No live capture yet. Start the live monitor on the host PC.";
    }

    function filters(nextQuery: string, nextView: string)
    {
        setQuery(nextQuery);
        setView(nextView);
        setLimit(30);
        const url = new URL(window.location.href);
        if (nextQuery)
        {
            url.searchParams.set("q", nextQuery);
        }
        else
        {
            url.searchParams.delete("q");
        }
        if (nextView !== "all")
        {
            url.searchParams.set("view", nextView);
        }
        else
        {
            url.searchParams.delete("view");
        }
        window.history.replaceState(null, "", url);
    }

    return (
        <>
            <div className="page-heading">
                <p className="eyebrow">RACE DAY · 3 OCTOBER 2026 · ROODEPLAAT</p>
                <h1>{LIVE_REGATTA.name}</h1>
                <p>Lane draws, programme changes and results as the publisher releases them.</p>
            </div>
            <section className="live-summary" aria-label="Live source status">
                <div>
                    <strong>{monitorLabel}</strong>
                    <span>Programme checked {clock(data?.indexValidAt ?? null)} SAST</span>
                </div>
                <div>
                    <strong>{data?.races.filter((race) => race.listed).length ?? 0} races</strong>
                    <span>
                        {data?.races.filter((race) => race.entries.some((entry) => entry.finishMs !== null))
                            .length ?? 0} with times published
                    </span>
                </div>
                <a href={LIVE_REGATTA.sourceUrl} target="_blank" rel="noreferrer">Open publisher ↗</a>
            </section>
            {(error || data?.indexError || (data && !fresh && !complete)) && (
                <p className="live-warning" role="status">
                    {error || data?.indexError
                        || "The monitor has stopped or lost connection. These are the last captured results."}
                </p>
            )}
            <section className="live-delay" aria-label="Programme delay estimate">
                <h2>
                    {delay
                        ? `Results arriving ${delay.lowerMinutes}-${delay.upperMinutes} minutes behind schedule`
                        : "Watching the programme"}
                </h2>
                <p>
                    {delay
                        ? `Low confidence, based on ${delay.sampleCount} recent race publications. This includes upload delay and does not confirm actual start times.`
                        : "An estimate appears after three separately observed junior race results. Previously published results and batch uploads do not establish a trend."}
                </p>
                <small>
                    Keep the published start time as your arrival target. Allow for results taking time to
                    appear.
                </small>
            </section>
            {delay && delay.lowerMinutes >= 10 && dismissedDelay !== delayKey && (
                <aside className="live-delay-notice" role="status">
                    <strong>
                        Possible programme delay: {delay.lowerMinutes}-{delay.upperMinutes} minutes.
                    </strong>
                    <span>Results publication can contribute to this estimate.</span>
                    <button
                        className="button button-outline"
                        onClick={() =>
                            setDismissedDelay(delayKey)}
                    >
                        Dismiss notice
                    </button>
                </aside>
            )}
            <form
                className="catalog-filters live-filters"
                noValidate
                onSubmit={(event) => event.preventDefault()}
            >
                <div className="filter-field search-field">
                    <label htmlFor="live-search">Find a school, rower, event or boat class</label>
                    <div className="search-control">
                        <input
                            id="live-search"
                            ref={search}
                            value={query}
                            onChange={(event) => filters(event.target.value, view)}
                            placeholder="St Dunstans, 1x, event name..."
                        />
                        {query && (
                            <button
                                type="button"
                                aria-label="Clear search"
                                onClick={() =>
                                {
                                    filters("", view);
                                    search.current?.focus();
                                }}
                            >
                                ×
                            </button>
                        )}
                    </div>
                </div>
                <div className="filter-field">
                    <label htmlFor="live-view">Show</label>
                    <select
                        id="live-view"
                        value={view}
                        onChange={(event) => filters(query, event.target.value)}
                    >
                        <option value="all">All races</option>
                        <option value="pending">Awaiting results</option>
                        <option value="results">Results published</option>
                    </select>
                </div>
            </form>
            <p className="muted" role="status">{resultSummary}</p>
            {!loading && data && !races.length && (
                <p>No races match these filters. Clear the search or show all races.</p>
            )}
            <div className="live-races">
                {races.slice(0, limit).map((race) => (
                    <details key={race.key} className="live-race" id={`race-${race.key}`}>
                        <summary>
                            <time dateTime={race.scheduledAt}>{clock(race.scheduledAt).slice(0, 5)}</time>
                            <span>
                                <strong>{race.eventName}</strong>
                                <small>Event {race.eventId} · Race {race.raceLabel}</small>
                            </span>
                            <span className="live-race-status">
                                {raceState(race, now)}
                                <small>
                                    {race.error ? "Source page retrying" : `${race.entries.length} crews`}
                                </small>
                            </span>
                        </summary>
                        <div className="live-race-body">
                            <p>{race.progression}</p>
                            {race.error && (
                                <p className="live-warning">
                                    {race.error}. Retrying automatically; any previous data stays visible.
                                </p>
                            )}
                            {race.detailScheduledAt && race.detailScheduledAt !== race.scheduledAt && (
                                <p className="live-warning">
                                    The programme and race page show different starts. Programme:{" "}
                                    {clock(race.scheduledAt)}; race page: {clock(race.detailScheduledAt)}.
                                </p>
                            )}
                            <p className="muted">
                                Draw/results last read {clock(race.validAt)} SAST · Revision {race.revision}
                            </p>
                            {race.entries.length
                                ? (
                                    <div
                                        className="live-table-scroll"
                                        tabIndex={0}
                                        role="region"
                                        aria-label={`Lanes and results for race ${race.raceLabel}`}
                                    >
                                        <table className="live-table">
                                            <caption className="sr-only">
                                                {race.eventName}, race {race.raceLabel}
                                            </caption>
                                            <thead>
                                                <tr>
                                                    <th scope="col">Lane</th>
                                                    <th scope="col">School / club and crew</th>
                                                    <th scope="col">Place</th>
                                                    <th scope="col">Time</th>
                                                    <th scope="col">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {race.entries.map((entry, index) => (
                                                    <tr key={`${race.key}-${index}`}>
                                                        <td>{entry.lane || "Pending"}</td>
                                                        <td>
                                                            <strong>{entry.school}</strong>
                                                            <span>{entry.athletes}</span>
                                                            <small>{entry.boat}</small>
                                                        </td>
                                                        <td>{entry.place || ""}</td>
                                                        <td>{entry.time || "Pending"}</td>
                                                        <td>{entry.status}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                                : (
                                    <p>
                                        Waiting for the publisher&apos;s lane draw. This page will update
                                        automatically.
                                    </p>
                                )}
                            <a href={race.url} target="_blank" rel="noreferrer">
                                View this race at the publisher ↗
                            </a>
                        </div>
                    </details>
                ))}
            </div>
            {races.length > limit && (
                <button
                    className="button button-outline"
                    onClick={() => setLimit((value) => value + 30)}
                >
                    Show 30 more races
                </button>
            )}
        </>
    );
}
