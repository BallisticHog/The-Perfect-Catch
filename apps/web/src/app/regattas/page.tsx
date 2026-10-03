import { AppShell } from "@/components/app-shell";
import { SourceRefreshNotice } from "@/components/source-refresh-notice";
import { loadCatalog } from "@/lib/catalog";
import { captureLabel } from "@/lib/presentation";
import { Empty } from "@the-perfect-catch/ui";
import { ArrowUpRight, CalendarDays, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Regattas" };

export default async function RegattasPage()
{
    const { access, catalog } = await loadCatalog();
    return (
        <AppShell name={access.name} active="regattas">
            <main className="catalog-page" id="main-content">
                <div className="page-heading">
                    <h1>Regattas</h1>
                    <p>South African school rowing. Results worth keeping.</p>
                </div>
                <Link className="regatta-listing" href="/live">
                    <div>
                        <span className="archive-year">RACE DAY</span>
                        <h2>St Mary&apos;s U16, U19 and Masters</h2>
                        <p>3 October 2026 · Roodeplaat · Lane draws and live result updates</p>
                    </div>
                    <ArrowUpRight aria-hidden="true" />
                </Link>
                {catalog
                    ? (
                        <>
                            <SourceRefreshNotice
                                refresh={catalog.latestRefresh}
                                publishedAt={catalog.version.createdAt}
                            />
                            <Link className="regatta-listing" href={`/regattas/${catalog.regatta.id}`}>
                                <div>
                                    <span className="archive-year">2026</span>
                                    <h2>{catalog.regatta.name}</h2>
                                    <div className="archive-metadata">
                                        <span>
                                            <MapPin aria-hidden="true" />
                                            {catalog.regatta.venue}
                                        </span>
                                        <span>
                                            <CalendarDays aria-hidden="true" />6-8 March 2026
                                        </span>
                                        <span>Archived</span>
                                    </div>
                                    <p className="muted">
                                        {catalog.races.length} published races · Captured{" "}
                                        {captureLabel(catalog.version?.createdAt)}
                                    </p>
                                </div>
                                <ArrowUpRight aria-hidden="true" />
                            </Link>
                        </>
                    )
                    : (
                        <Empty title="The archive is being prepared">
                            <p>
                                No results have been published yet. Please return once the first import has
                                been reviewed.
                            </p>
                        </Empty>
                    )}
            </main>
        </AppShell>
    );
}
