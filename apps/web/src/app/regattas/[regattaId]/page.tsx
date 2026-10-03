import { AppShell } from "@/components/app-shell";
import { ArchiveHeading } from "@/components/archive-heading";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { CatalogFilters } from "@/components/catalog-filters";
import { ChampionshipNavigation } from "@/components/championship-navigation";
import { EventDirectory } from "@/components/event-directory";
import { SourceRefreshNotice } from "@/components/source-refresh-notice";
import { loadCatalog } from "@/lib/catalog";
import { captureLabel, raceDay } from "@/lib/presentation";
import { groupRacesByEvent } from "@the-perfect-catch/domain";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Regatta archive" };

export default async function RegattaPage(
    { params, searchParams }: {
        params: Promise<{ regattaId: string; }>;
        searchParams: Promise<Record<string, string | string[] | undefined>>;
    },
)
{
    const { regattaId } = await params;
    const { access, catalog } = await loadCatalog(`/regattas/${encodeURIComponent(regattaId)}`);
    if (!catalog || catalog.regatta.id !== regattaId)
    {
        notFound();
    }
    const search = await searchParams;
    const text = (key: string) => typeof search[key] === "string" ? search[key] as string : "";
    const values = {
        q: text("q"),
        gender: text("gender"),
        ageGroup: text("ageGroup"),
        boatClass: text("boatClass"),
        round: text("round"),
        day: text("day"),
    };
    const query = values.q.trim().toLocaleLowerCase("en-ZA");
    const eventNumberQuery = /^(?:event\s*)?(\d+)$/u.exec(query)?.[1];
    const filtered = groupRacesByEvent(catalog.races).filter((event) =>
    {
        const matchesFilters = event.races.some((race) =>
            (!values.gender || race.gender === values.gender)
            && (!values.ageGroup || race.ageGroup === values.ageGroup)
            && (!values.boatClass || race.boatClass === values.boatClass)
            && (!values.round || race.round === values.round)
            && (!values.day || raceDay(race.scheduledAt) === values.day)
        );
        const searchable = `event ${event.sourceEventId} ${event.eventName} ${event.eventNameRaw} ${
            event.races.flatMap((race) => race.results.map((result) => result.schoolRaw)).join(" ")
        }`.toLocaleLowerCase("en-ZA");
        const matchesQuery = !query || (eventNumberQuery
            ? event.sourceEventId.toLocaleLowerCase("en-ZA") === eventNumberQuery
            : searchable.includes(query));
        return matchesFilters && matchesQuery;
    });
    const pageCount = Math.max(1, Math.ceil(filtered.length / 30));
    const page = Math.min(pageCount, Math.max(1, Math.floor(Number(text("page")) || 1)));
    const pageHref = (nextPage: number) =>
    {
        const next = new URLSearchParams(Object.entries(values).filter(([, value]) => value));
        next.set("page", String(nextPage));
        return `?${next.toString()}`;
    };
    return (
        <AppShell name={access.name} active="regattas">
            <main className="catalog-page" id="main-content">
                <Breadcrumbs
                    items={[{ label: "Regattas", href: "/regattas" }, { label: catalog.regatta.name }]}
                />
                <ArchiveHeading />
                <ChampionshipNavigation regattaId={regattaId} active="events" />
                <SourceRefreshNotice
                    refresh={catalog.latestRefresh}
                    publishedAt={catalog.version.createdAt}
                />
                <CatalogFilters
                    key={JSON.stringify(values)}
                    values={values}
                    options={{
                        ageGroups: [
                            ...new Set(
                                catalog.races.map((race) => race.ageGroup).filter((value): value is string =>
                                    Boolean(value)
                                ),
                            ),
                        ].sort(),
                        boatClasses: [
                            ...new Set(
                                catalog.races.map((race) => race.boatClass).filter((value): value is string =>
                                    Boolean(value)
                                ),
                            ),
                        ].sort(),
                        days: [
                            ...new Set(
                                catalog.races.map((race) => raceDay(race.scheduledAt)).filter(
                                    (value): value is string => Boolean(value),
                                ),
                            ),
                        ].sort(),
                    }}
                />
                <div className="list-toolbar">
                    <p role="status">
                        {filtered.length} event{filtered.length === 1 ? "" : "s"}
                        {values.day ? ` with racing on ${values.day}` : ""}
                        {filtered.length
                            ? ` · Showing ${(page - 1) * 30 + 1}-${Math.min(page * 30, filtered.length)}`
                            : ""}
                    </p>
                    <Link href={`/regattas/${regattaId}`}>Clear filters</Link>
                </div>
                <EventDirectory
                    events={filtered.slice((page - 1) * 30, page * 30)}
                    regattaId={regattaId}
                />
                <nav className="pagination" aria-label="Event pages">
                    {page > 1
                        ? <Link className="button button-outline" href={pageHref(page - 1)}>Previous</Link>
                        : <span />}
                    <span>Page {page} of {pageCount}</span>
                    {page < pageCount
                        ? <Link className="button button-outline" href={pageHref(page + 1)}>Next</Link>
                        : <span />}
                </nav>
                <p className="source-note">
                    Source captured {captureLabel(catalog.version?.createdAt)} ·{" "}
                    <a href={catalog.regatta.sourceUrl} target="_blank" rel="noreferrer">
                        View original results
                    </a>
                </p>
            </main>
        </AppShell>
    );
}
