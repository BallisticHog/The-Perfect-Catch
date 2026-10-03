import { AppShell } from "@/components/app-shell";
import { SourceRefreshNotice } from "@/components/source-refresh-notice";
import { loadCatalog } from "@/lib/catalog";
import { captureLabel } from "@/lib/presentation";
import { CHAMPIONSHIP } from "@the-perfect-catch/domain";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Data sources" };

export default async function DataSourcesPage()
{
    const { access, catalog } = await loadCatalog("/data-sources");
    return (
        <AppShell name={access.name} active="data-sources">
            <main className="catalog-page prose-page" id="main-content">
                <div className="page-heading">
                    <h1>Data sources</h1>
                    <p>The archive keeps a clear link back to the original result.</p>
                </div>
                {catalog
                    ? (
                        <SourceRefreshNotice
                            refresh={catalog.latestRefresh}
                            publishedAt={catalog.version.createdAt}
                        />
                    )
                    : null}
                <section>
                    <h2>2026 SA Schools Championships</h2>
                    <p>Published by Regatta Results. Roodeplaat, 6-8 March 2026.</p>
                    <a href={CHAMPIONSHIP.sourceUrl} target="_blank" rel="noreferrer">
                        View the original results index
                    </a>
                    <p>
                        {catalog
                            ? `Last published capture: ${
                                captureLabel(catalog.version?.createdAt)
                            }. ${catalog.races.length} races in the archive.`
                            : "No validated capture has been published yet."}
                    </p>
                </section>
                <section>
                    <h2>How to read the archive</h2>
                    <p>
                        Official describes the sporting result as labelled by its publisher. It does not mean
                        The Catch has received permission to redistribute that result publicly.
                    </p>
                    <p>
                        Each race links to its precise original result page. Missing or unclear source values
                        remain marked as not recorded. Crew names, seats, and cox designations stay within
                        their race result.
                    </p>
                    <p>
                        This is an archive, not live timing. A finish-gap visual compares recorded durations
                        in seconds and does not track boats on the course.
                    </p>
                </section>
                <section>
                    <h2>Private beta use</h2>
                    <p>
                        These source results are available to invited beta accounts. Public reuse approval has
                        not been established. Raw source captures and operational records are not part of
                        viewer access.
                    </p>
                    <Link href="/corrections-and-removals">Corrections and removal</Link>
                </section>
            </main>
        </AppShell>
    );
}
