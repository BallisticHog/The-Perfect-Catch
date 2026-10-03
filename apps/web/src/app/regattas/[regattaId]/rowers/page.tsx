import { AppShell } from "@/components/app-shell";
import { ArchiveHeading } from "@/components/archive-heading";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ChampionshipNavigation } from "@/components/championship-navigation";
import { RowerDirectory } from "@/components/rower-directory";
import { RowerDirectoryFilters } from "@/components/rower-directory-filters";
import { loadCatalog } from "@/lib/catalog";
import { regattaRowerRecords } from "@/lib/rower-records";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Championship rower records" };

export default async function RowerDirectoryPage(
    { params, searchParams }: {
        params: Promise<{ regattaId: string; }>;
        searchParams: Promise<Record<string, string | string[] | undefined>>;
    },
)
{
    const { regattaId } = await params;
    const { access, catalog, schoolPresentations } = await loadCatalog(
        `/regattas/${encodeURIComponent(regattaId)}/rowers`,
        true,
    );
    if (!catalog || catalog.regatta.id !== regattaId)
    {
        notFound();
    }
    const search = await searchParams;
    const text = (key: string) => typeof search[key] === "string" ? search[key] as string : "";
    const values = { q: text("q"), school: text("school"), boatClass: text("boatClass") };
    const query = values.q.trim().toLocaleLowerCase("en-ZA");
    const allRecords = regattaRowerRecords(catalog.races);
    const filtered = allRecords.filter((record) =>
        (!query || `${record.displayName} ${record.schoolName}`.toLocaleLowerCase("en-ZA").includes(query))
        && (!values.school || record.schoolKey === values.school)
        && (!values.boatClass || record.boatClasses.includes(values.boatClass))
    );
    const pageCount = Math.max(1, Math.ceil(filtered.length / 50));
    const page = Math.min(pageCount, Math.max(1, Math.floor(Number(text("page")) || 1)));
    const pageHref = (nextPage: number) =>
    {
        const next = new URLSearchParams(Object.entries(values).filter(([, value]) => value));
        next.set("page", String(nextPage));
        return `?${next.toString()}`;
    };
    const schools = [...new Map(
        allRecords.filter((record) => record.schoolKey).map((record) => [
            record.schoolKey as string,
            {
                id: record.schoolKey as string,
                name: schoolPresentations[record.schoolKey as string]?.name ?? record.schoolName,
            },
        ]),
    ).values()].sort((left, right) => left.name.localeCompare(right.name, "en-ZA"));
    const boatClasses = [...new Set(allRecords.flatMap((record) => record.boatClasses))].sort();
    return (
        <AppShell name={access.name} active="regattas">
            <main className="catalog-page" id="main-content">
                <Breadcrumbs
                    items={[{ label: "Regattas", href: "/regattas" }, {
                        label: catalog.regatta.name,
                        href: `/regattas/${encodeURIComponent(regattaId)}`,
                    }, { label: "Rower records" }]}
                />
                <ArchiveHeading />
                <ChampionshipNavigation regattaId={regattaId} active="rowers" />
                <div className="page-heading compact-page-heading">
                    <h2>Championship rower records</h2>
                    <p>
                        Search exact names published in this championship and follow each appearance back to
                        its event and race.
                    </p>
                </div>
                <aside className="identity-scope-note" role="note">
                    These are regatta-scoped source records grouped by the same published name and school.
                    They are not verified lifetime identities, and two people with the same name at one school
                    may still share one record.
                </aside>
                <RowerDirectoryFilters
                    key={JSON.stringify(values)}
                    values={values}
                    schools={schools}
                    boatClasses={boatClasses}
                />
                <div className="list-toolbar">
                    <p role="status">
                        {filtered.length} rower record{filtered.length === 1 ? "" : "s"}
                        {filtered.length
                            ? ` · Showing ${(page - 1) * 50 + 1}-${Math.min(page * 50, filtered.length)}`
                            : ""}
                    </p>
                    <Link href={`/regattas/${encodeURIComponent(regattaId)}/rowers`}>Clear filters</Link>
                </div>
                <RowerDirectory
                    records={filtered.slice((page - 1) * 50, page * 50)}
                    regattaId={regattaId}
                    schoolPresentations={schoolPresentations}
                />
                <nav className="pagination" aria-label="Rower record pages">
                    {page > 1
                        ? <Link className="button button-outline" href={pageHref(page - 1)}>Previous</Link>
                        : <span />}
                    <span>Page {page} of {pageCount}</span>
                    {page < pageCount
                        ? <Link className="button button-outline" href={pageHref(page + 1)}>Next</Link>
                        : <span />}
                </nav>
            </main>
        </AppShell>
    );
}
