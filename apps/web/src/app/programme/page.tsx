import { AppShell } from "@/components/app-shell";
import { requireCatalogAccess } from "@/lib/authorization";
import { Empty } from "@the-perfect-catch/ui";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "School Programme" };

export default async function ProgrammePage()
{
    const access = await requireCatalogAccess("/programme");
    return (
        <AppShell name={access.name} active="programme">
            <main className="catalog-page private-workspace" id="main-content">
                <div className="page-heading">
                    <h1>School Programme</h1>
                    <p>Groups, crews, calendar assignments, and completed training will live here.</p>
                </div>
                <Empty title="Programme setup has not started">
                    <p>
                        The next slice adds age groups, custom squads, calendar sessions, and rower
                        assignments. No training record has been invented for this preview.
                    </p>
                    <Link href="/course-watch">Review the Course Watch foundation</Link>
                </Empty>
                <section className="programme-model" aria-labelledby="programme-model-heading">
                    <h2 id="programme-model-heading">Planned programme structure</h2>
                    <div>
                        <span>Age group</span>
                        <span>Squad</span>
                        <span>Crew</span>
                        <span>Individual</span>
                    </div>
                    <p>
                        A session may target any combination without duplicating the underlying calendar item.
                    </p>
                </section>
            </main>
        </AppShell>
    );
}
