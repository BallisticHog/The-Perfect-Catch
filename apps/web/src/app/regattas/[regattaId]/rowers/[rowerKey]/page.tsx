import { AppShell } from "@/components/app-shell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ChampionshipNavigation } from "@/components/championship-navigation";
import { SchoolIdentityMark } from "@/components/school-identity-mark";
import { loadCatalog } from "@/lib/catalog";
import { eventHref, formatFinish, raceHref, roundLabel, schoolAbbreviation } from "@/lib/presentation";
import { findRegattaRowerRecord, regattaRowerRecords, rowerHref, rowerRouteKey } from "@/lib/rower-records";
import { appearanceRoleLabel } from "@the-perfect-catch/domain";
import { resolveSchoolTheme, schoolThemeProperties } from "@the-perfect-catch/ui";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

export const metadata: Metadata = { title: "Championship rower record" };

export default async function RowerRecordPage(
    { params }: { params: Promise<{ regattaId: string; rowerKey: string; }>; },
)
{
    const { regattaId, rowerKey } = await params;
    const { access, catalog, schoolPresentations } = await loadCatalog(
        `/regattas/${encodeURIComponent(regattaId)}/rowers/${encodeURIComponent(rowerKey)}`,
        true,
    );
    const record = catalog ? findRegattaRowerRecord(catalog.races, rowerKey) : null;
    if (!catalog || catalog.regatta.id !== regattaId || !record)
    {
        notFound();
    }
    const school = record.schoolKey ? schoolPresentations[record.schoolKey] : undefined;
    const theme = school
        ? resolveSchoolTheme({
            primaryColor: school.primaryColor,
            secondaryColor: school.secondaryColor,
            accessibleTokens: school.accessibleTokens ?? {},
            themeAlgorithmVersion: school.themeAlgorithmVersion ?? "",
        })
        : undefined;
    const groupedEvents = new Map<string, typeof record.appearances>();
    for (const appearance of record.appearances)
    {
        const group = groupedEvents.get(appearance.race.sourceEventId) ?? [];
        group.push(appearance);
        groupedEvents.set(appearance.race.sourceEventId, group);
    }
    const records = regattaRowerRecords(catalog.races);
    const recordIndex = records.findIndex((candidate) => rowerRouteKey(candidate.identityKey) === rowerKey);
    const previous = recordIndex > 0 ? records[recordIndex - 1] : null;
    const next = recordIndex >= 0 && recordIndex < records.length - 1 ? records[recordIndex + 1] : null;
    const finished = record.appearances.filter((item) => item.result.status === "finished");
    return (
        <AppShell name={access.name} active="regattas" theme={theme}>
            <main
                className="catalog-page rower-record-page school-profile"
                id="main-content"
                style={theme ? schoolThemeProperties(theme) as CSSProperties : undefined}
            >
                <Breadcrumbs
                    items={[{ label: "Regattas", href: "/regattas" }, {
                        label: catalog.regatta.name,
                        href: `/regattas/${encodeURIComponent(regattaId)}`,
                    }, {
                        label: "Rower records",
                        href: `/regattas/${encodeURIComponent(regattaId)}/rowers`,
                    }, { label: record.displayName }]}
                />
                <ChampionshipNavigation regattaId={regattaId} active="rowers" />
                <header className="rower-record-heading">
                    <SchoolIdentityMark
                        name={school?.name ?? record.schoolName}
                        abbreviation={schoolAbbreviation(school?.name ?? record.schoolName)}
                        crestAssetId={school?.crestAssetId}
                        theme={theme}
                    />
                    <div>
                        <p className="section-kicker">Championship rower record</p>
                        <h1>{record.displayName}</h1>
                        {record.schoolKey
                            ? (
                                <Link href={`/schools/${encodeURIComponent(record.schoolKey)}`}>
                                    {school?.name ?? record.schoolName}
                                </Link>
                            )
                            : <span>{record.schoolName}</span>}
                    </div>
                </header>
                <aside className="identity-scope-note" role="note">
                    This page joins only exact published name and school appearances inside the 2026 SA
                    Schools Championships. It does not prove a permanent identity or link this rower to other
                    regattas.
                </aside>
                <dl className="rower-record-statistics">
                    <div>
                        <dt>Events</dt>
                        <dd>{groupedEvents.size}</dd>
                    </div>
                    <div>
                        <dt>Race appearances</dt>
                        <dd>{record.raceCount}</dd>
                    </div>
                    <div>
                        <dt>Finished results</dt>
                        <dd>{finished.length}</dd>
                    </div>
                    <div>
                        <dt>Boat classes</dt>
                        <dd>{record.boatClasses.join(", ") || "Not recorded"}</dd>
                    </div>
                </dl>
                <section className="rower-event-history" aria-labelledby="rower-history-title">
                    <div className="list-toolbar">
                        <div>
                            <p className="section-kicker">Source history</p>
                            <h2 id="rower-history-title">Events and race appearances</h2>
                        </div>
                    </div>
                    {[...groupedEvents.entries()].map(([eventId, appearances]) =>
                    {
                        const first = appearances[0];
                        if (!first)
                        {
                            return null;
                        }
                        return (
                            <article className="rower-event-record" key={eventId}>
                                <header>
                                    <div>
                                        <span>Event {eventId}</span>
                                        <h3>{first.race.eventName}</h3>
                                    </div>
                                    <Link href={eventHref(first.race, regattaId)}>Open complete event</Link>
                                </header>
                                <div className="rower-race-list">
                                    {appearances.map(({ race, result, appearance }) => (
                                        <Link
                                            className="rower-race-row"
                                            href={raceHref(race)}
                                            key={result.sourceKey}
                                        >
                                            <span className="rower-race-number">
                                                Race {race.raceNumber ?? "?"}
                                            </span>
                                            <strong>{roundLabel(race.round)}</strong>
                                            <span>{appearanceRoleLabel(appearance)}</span>
                                            <span>Lane {result.lane ?? (result.laneRaw || "?")}</span>
                                            <span>Place {result.place ?? (result.placeRaw || "?")}</span>
                                            <span className="finish-time">
                                                {formatFinish(result.finishMs, result.finishRaw)}
                                            </span>
                                            <ArrowRight aria-hidden="true" />
                                        </Link>
                                    ))}
                                </div>
                            </article>
                        );
                    })}
                </section>
                <nav className="record-sequence-navigation" aria-label="Adjacent rower records">
                    {previous
                        ? (
                            <Link href={rowerHref(regattaId, previous)}>
                                <ArrowLeft aria-hidden="true" />
                                <span>
                                    <small>Previous rower</small>
                                    {previous.displayName}
                                </span>
                            </Link>
                        )
                        : <span />}
                    {next
                        ? (
                            <Link href={rowerHref(regattaId, next)}>
                                <span>
                                    <small>Next rower</small>
                                    {next.displayName}
                                </span>
                                <ArrowRight aria-hidden="true" />
                            </Link>
                        )
                        : <span />}
                </nav>
            </main>
        </AppShell>
    );
}
