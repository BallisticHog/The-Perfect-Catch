import { AppShell } from "@/components/app-shell";
import { SchoolIdentityMark } from "@/components/school-identity-mark";
import { loadSchools } from "@/lib/catalog";
import { schoolAbbreviation } from "@/lib/presentation";
import { Empty, resolveSchoolTheme } from "@the-perfect-catch/ui";
import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Schools" };

export default async function SchoolsPage()
{
    const { access, schools } = await loadSchools();
    return (
        <AppShell name={access.name} active="schools">
            <main className="catalog-page" id="main-content">
                <div className="page-heading">
                    <h1>Schools</h1>
                    <p>Explore school results in the published archive.</p>
                </div>
                {schools.length
                    ? (
                        <ul className="school-list">
                            {schools.map((school) => (
                                <li key={school.id}>
                                    <Link href={`/schools/${encodeURIComponent(school.id)}`}>
                                        <SchoolIdentityMark
                                            name={school.name}
                                            abbreviation={schoolAbbreviation(school.name)}
                                            crestAssetId={school.crestAssetId}
                                            theme={resolveSchoolTheme({
                                                primaryColor: school.primaryColor,
                                                secondaryColor: school.secondaryColor,
                                                accessibleTokens: school.accessibleTokens ?? {},
                                                themeAlgorithmVersion: school.themeAlgorithmVersion ?? "",
                                            })}
                                        />
                                        <span>{school.name}</span>
                                        <ArrowUpRight aria-hidden="true" />
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )
                    : (
                        <Empty title="No schools have been linked yet">
                            <p>
                                School names appear as recorded in each race until an exact school match is
                                approved.
                            </p>
                            <Link href="/regattas">Browse regattas</Link>
                        </Empty>
                    )}
            </main>
        </AppShell>
    );
}
