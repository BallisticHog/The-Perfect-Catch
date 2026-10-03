import { captureLabel, eventHref, raceHref, roundLabel } from "@/lib/presentation";
import type { SchoolPresentation } from "@the-perfect-catch/db";
import type { Race } from "@the-perfect-catch/domain";
import { BoatMark } from "@the-perfect-catch/ui";
import { ArrowLeft, ChevronRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { AppShell } from "./app-shell";
import { ArchiveHeading } from "./archive-heading";
import { Breadcrumbs } from "./breadcrumbs";
import { ChampionshipNavigation } from "./championship-navigation";
import { RaceResults } from "./race-results";
import { SourceRefreshNotice, type SourceRefreshState } from "./source-refresh-notice";

export function RaceScreen(
    { name, regattaId, race, races, capturedAt, schoolPresentations, latestRefresh }: {
        name: string;
        regattaId: string;
        race: Race;
        races: Race[];
        capturedAt: Date | null | undefined;
        schoolPresentations: Record<string, SchoolPresentation>;
        latestRefresh: SourceRefreshState | null;
    },
)
{
    const eventRaces = races.filter((item) => item.sourceEventId === race.sourceEventId);
    const rounds = [...new Set(eventRaces.map((item) => item.round))];
    const selectedIndex = Math.max(0, races.findIndex((item) => item.sourceKey === race.sourceKey));
    const previousRace = selectedIndex > 0 ? races[selectedIndex - 1] : null;
    const nextRace = selectedIndex < races.length - 1 ? races[selectedIndex + 1] : null;
    const sidebarStart = Math.max(0, Math.min(selectedIndex - 5, Math.max(0, races.length - 15)));
    const nearbyRaces = races.slice(sidebarStart, sidebarStart + 15);
    const days = ["2026-03-06", "2026-03-07", "2026-03-08"];
    const raceDay = race.scheduledAt
        ? new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Johannesburg" }).format(
            new Date(race.scheduledAt),
        )
        : null;
    return (
        <AppShell name={name} active="regattas">
            <div className="race-workspace">
                <aside className="race-sidebar" aria-label="Championship races">
                    <Link className="back-link" href={`/regattas/${encodeURIComponent(regattaId)}`}>
                        <ArrowLeft aria-hidden="true" />Championship events
                    </Link>
                    <h2>2026 SA Schools Championships</h2>
                    <p>Roodeplaat · 6-8 March 2026</p>
                    <nav aria-label="Choose a race">
                        {nearbyRaces.map((item) => (
                            <Link
                                key={item.sourceKey}
                                href={raceHref(item)}
                                className="sidebar-race"
                                aria-current={item.sourceKey === race.sourceKey ? "page" : undefined}
                            >
                                <span>{item.raceNumber ?? "?"}</span>
                                <strong>{item.eventName}</strong>
                                {item.sourceKey === race.sourceKey ? <BoatMark /> : null}
                                <ChevronRight aria-hidden="true" />
                            </Link>
                        ))}
                    </nav>
                    <Link className="sidebar-all-races" href={`/regattas/${encodeURIComponent(regattaId)}`}>
                        Browse all {races.length} races
                    </Link>
                </aside>
                <main className="race-main" id="main-content">
                    <div className="mobile-back">
                        <Link className="back-link" href={eventHref(race, regattaId)}>
                            <ArrowLeft aria-hidden="true" />Event {race.sourceEventId}
                        </Link>
                    </div>
                    <Breadcrumbs
                        items={[{ label: "Regattas", href: "/regattas" }, {
                            label: "2026 SA Schools Championships",
                            href: `/regattas/${encodeURIComponent(regattaId)}`,
                        }, { label: `Race ${race.raceNumber ?? ""}` }]}
                    />
                    <ArchiveHeading />
                    <ChampionshipNavigation regattaId={regattaId} active="events" />
                    <SourceRefreshNotice refresh={latestRefresh} publishedAt={capturedAt} />
                    <nav className="day-navigation" aria-label="Racing day">
                        {days.map((day, index) => (
                            <Link
                                key={day}
                                href={`/regattas/2026-sa-schools-championships?day=${day}`}
                                aria-current={raceDay === day ? "date" : undefined}
                            >
                                {["Fri 6", "Sat 7", "Sun 8"][index]}
                            </Link>
                        ))}
                    </nav>
                    <section className="race-heading">
                        <div>
                            <Link className="event-title" href={eventHref(race, regattaId)}>
                                <h2>
                                    <span className="event-number-label">Event {race.sourceEventId} ·</span>
                                    {race.eventName}
                                </h2>
                                <BoatMark />
                                <ChevronRight className="mobile-event-chevron" aria-hidden="true" />
                            </Link>
                            <p className="race-ribbon">
                                RACE {race.raceNumber ?? "?"} · {race.roundRaw || roundLabel(race.round)}
                            </p>
                            <p>{race.progressionRaw || "Progression not recorded"}</p>
                        </div>
                        <ol className="round-navigation" aria-label="Event progression">
                            {rounds.map((round) =>
                            {
                                const stageRaces = eventRaces.filter((item) => item.round === round);
                                return (
                                    <li key={round} aria-current={race.round === round ? "step" : undefined}>
                                        <Link href={raceHref(stageRaces[0] ?? race)}>
                                            <span>{roundLabel(round)}</span>
                                        </Link>
                                        <i aria-hidden="true" />
                                        <small>
                                            {race.round === round
                                                ? `Race ${race.raceNumber ?? "?"}`
                                                : `${stageRaces.length} race${
                                                    stageRaces.length === 1 ? "" : "s"
                                                }`}
                                        </small>
                                    </li>
                                );
                            })}
                        </ol>
                    </section>
                    <RaceResults
                        race={race}
                        regattaId={regattaId}
                        schoolPresentations={schoolPresentations}
                    />
                    <p className="source-note">
                        Source captured {captureLabel(capturedAt)} ·{" "}
                        <a href={race.sourceUrl} target="_blank" rel="noreferrer">
                            View original result <ExternalLink aria-hidden="true" />
                        </a>
                    </p>
                    <section className="progression-note">
                        <h3>RACE PROGRESSION</h3>
                        <p>
                            {race.progressionRaw || "The source does not record progression for this race."}
                        </p>
                        <Link href={eventHref(race, regattaId)}>View all races in this event</Link>
                    </section>
                    <nav
                        className="record-sequence-navigation race-sequence-navigation"
                        aria-label="Adjacent races"
                    >
                        {previousRace
                            ? (
                                <Link href={raceHref(previousRace)}>
                                    <ArrowLeft aria-hidden="true" />
                                    <span>
                                        <small>Previous race</small>
                                        Race {previousRace.raceNumber ?? "?"}
                                    </span>
                                </Link>
                            )
                            : <span />}
                        {nextRace
                            ? (
                                <Link href={raceHref(nextRace)}>
                                    <span>
                                        <small>Next race</small>
                                        Race {nextRace.raceNumber ?? "?"}
                                    </span>
                                    <ChevronRight aria-hidden="true" />
                                </Link>
                            )
                            : <span />}
                    </nav>
                </main>
            </div>
        </AppShell>
    );
}
