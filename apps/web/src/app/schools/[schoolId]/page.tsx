import { AppShell } from "@/components/app-shell";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { RaceList } from "@/components/race-list";
import { RowerDirectory } from "@/components/rower-directory";
import { SchoolIdentityMark } from "@/components/school-identity-mark";
import { SchoolStatistics } from "@/components/school-statistics";
import { loadSchool } from "@/lib/catalog";
import { schoolAbbreviation } from "@/lib/presentation";
import { regattaRowerRecords } from "@/lib/rower-records";
import { CHAMPIONSHIP, summarizeSchoolResults } from "@the-perfect-catch/domain";
import { resolveSchoolTheme, schoolThemeProperties } from "@the-perfect-catch/ui";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";

export const metadata: Metadata = { title: "School results" };

export default async function SchoolPage({ params }: { params: Promise<{ schoolId: string; }>; })
{
    const { schoolId } = await params;
    const { access, school, races } = await loadSchool(schoolId);
    if (!school)
    {
        notFound();
    }
    const statistics = summarizeSchoolResults(races, schoolId);
    const rowerRecords = regattaRowerRecords(races).filter((record) => record.schoolKey === schoolId);
    const theme = resolveSchoolTheme({
        primaryColor: school.primaryColor,
        secondaryColor: school.secondaryColor,
        accessibleTokens: school.accessibleTokens ?? {},
        themeAlgorithmVersion: school.themeAlgorithmVersion ?? "",
    });
    return (
        <AppShell name={access.name} active="schools" theme={theme}>
            <main
                className="catalog-page school-profile"
                id="main-content"
                style={schoolThemeProperties(theme) as CSSProperties}
            >
                <Breadcrumbs items={[{ label: "Schools", href: "/schools" }, { label: school.name }]} />
                <div className="school-heading">
                    <SchoolIdentityMark
                        name={school.name}
                        abbreviation={schoolAbbreviation(school.name)}
                        crestAssetId={school.crestAssetId}
                        theme={theme}
                    />
                    <div>
                        <h1>{school.name}</h1>
                        <p>
                            {school.description || "Results in the archived 2026 SA Schools Championships."}
                        </p>
                    </div>
                </div>
                <p className="source-note">
                    The identity mark is a private-beta visual aid and is not presented as an official school
                    crest. No affiliation or endorsement is implied.
                </p>
                {school.inferred
                    ? (
                        <p className="school-theme-note">
                            School colours are inferred from official material and are not presented as an
                            official hex-value brand guide.
                        </p>
                    )
                    : null}
                <SchoolStatistics statistics={statistics} />
                <section className="school-rowers" aria-labelledby="school-rowers-title">
                    <div className="list-toolbar school-races-heading">
                        <div>
                            <p className="section-kicker">Published names</p>
                            <h2 id="school-rowers-title">Championship rower records</h2>
                        </div>
                        <Link
                            href={`/regattas/${CHAMPIONSHIP.slug}/rowers?school=${
                                encodeURIComponent(schoolId)
                            }`}
                        >
                            View all {rowerRecords.length}
                        </Link>
                    </div>
                    <p className="school-roster-note">
                        These records describe names published at this championship. They are not a current
                        school roster and are not linked to other regattas.
                    </p>
                    <RowerDirectory
                        records={rowerRecords.slice(0, 24)}
                        regattaId={CHAMPIONSHIP.slug}
                        schoolPresentations={{ [school.id]: school }}
                    />
                </section>
                <section className="school-races" aria-labelledby="school-races-title">
                    <div className="list-toolbar school-races-heading">
                        <h2 id="school-races-title">Published races</h2>
                        <p>{races.length} race{races.length === 1 ? "" : "s"} in this archive</p>
                    </div>
                    <RaceList races={races} emptyTitle="No published races for this school" />
                </section>
            </main>
        </AppShell>
    );
}
