import { AppShell } from "@/components/app-shell";
import { ArchiveHeading } from "@/components/archive-heading";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ChampionshipNavigation } from "@/components/championship-navigation";
import { EventProgression } from "@/components/event-progression";
import { SourceRefreshNotice } from "@/components/source-refresh-notice";
import { loadCatalog } from "@/lib/catalog";
import { captureLabel } from "@/lib/presentation";
import { groupRacesByEvent } from "@the-perfect-catch/domain";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Event races" };

export default async function EventPage(
    { params }: { params: Promise<{ regattaId: string; eventId: string; }>; },
)
{
    const { regattaId, eventId } = await params;
    const { access, catalog } = await loadCatalog(
        `/regattas/${encodeURIComponent(regattaId)}/events/${encodeURIComponent(eventId)}`,
    );
    const events = catalog ? groupRacesByEvent(catalog.races) : [];
    const eventIndex = events.findIndex((item) => item.sourceEventId === eventId);
    const event = eventIndex >= 0 ? events[eventIndex] : null;
    if (!catalog || catalog.regatta.id !== regattaId || !event)
    {
        notFound();
    }
    const previousEvent = eventIndex > 0 ? events[eventIndex - 1] : undefined;
    const nextEvent = eventIndex < events.length - 1 ? events[eventIndex + 1] : undefined;
    return (
        <AppShell name={access.name} active="regattas">
            <main className="catalog-page" id="main-content">
                <Breadcrumbs
                    items={[{ label: "Regattas", href: "/regattas" }, {
                        label: catalog.regatta.name,
                        href: `/regattas/${regattaId}`,
                    }, { label: event.eventName }]}
                />
                <ArchiveHeading />
                <ChampionshipNavigation regattaId={regattaId} active="events" />
                <SourceRefreshNotice
                    refresh={catalog.latestRefresh}
                    publishedAt={catalog.version.createdAt}
                />
                <div className="page-heading event-heading">
                    <h2>Event {event.sourceEventId} · {event.eventName}</h2>
                    <p>
                        {event.races.length} published race{event.races.length === 1 ? "" : "s"} ·{" "}
                        {event.publishedCrewEntries}{" "}
                        published crew entr{event.publishedCrewEntries === 1 ? "y" : "ies"} ·{" "}
                        {event.eventNameRaw}
                    </p>
                </div>
                <EventProgression rounds={event.rounds} />
                <nav className="record-sequence-navigation" aria-label="Adjacent events">
                    {previousEvent
                        ? (
                            <Link
                                href={`/regattas/${encodeURIComponent(regattaId)}/events/${
                                    encodeURIComponent(previousEvent.sourceEventId)
                                }`}
                            >
                                <ArrowLeft aria-hidden="true" />
                                <span>
                                    <small>Previous event</small>
                                    Event {previousEvent.sourceEventId}
                                </span>
                            </Link>
                        )
                        : <span />}
                    {nextEvent
                        ? (
                            <Link
                                href={`/regattas/${encodeURIComponent(regattaId)}/events/${
                                    encodeURIComponent(nextEvent.sourceEventId)
                                }`}
                            >
                                <span>
                                    <small>Next event</small>
                                    Event {nextEvent.sourceEventId}
                                </span>
                                <ArrowRight aria-hidden="true" />
                            </Link>
                        )
                        : <span />}
                </nav>
                <p className="source-note">
                    Source captured {captureLabel(catalog.version.createdAt)} ·{" "}
                    <a href={catalog.regatta.sourceUrl} target="_blank" rel="noreferrer">
                        View original regatta results
                    </a>
                </p>
            </main>
        </AppShell>
    );
}
