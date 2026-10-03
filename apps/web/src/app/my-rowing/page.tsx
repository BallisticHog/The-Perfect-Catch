import { AppShell } from "@/components/app-shell";
import { requireCatalogAccess } from "@/lib/authorization";
import { Empty } from "@the-perfect-catch/ui";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "My Rowing" };

export default async function MyRowingPage()
{
    const access = await requireCatalogAccess("/my-rowing");
    return (
        <AppShell name={access.name} active="my-rowing">
            <main className="catalog-page private-workspace" id="main-content">
                <div className="page-heading">
                    <h1>My Rowing</h1>
                    <p>Your verified results, assigned training, and progress will meet here.</p>
                </div>
                <Empty title="No verified member record is linked yet">
                    <p>
                        A coach must confirm which published race appearances belong to this account before
                        private training and public evidence can share one record.
                    </p>
                    <Link href="/regattas/2026-sa-schools-championships/rowers">
                        Browse championship source records
                    </Link>
                </Empty>
                <ol className="identity-flow" aria-label="Verified member linking flow">
                    <li>
                        <strong>Published evidence</strong>
                        <span>Race-local source names remain unchanged.</span>
                    </li>
                    <li>
                        <strong>Coach review</strong>
                        <span>A coach confirms or rejects each proposed link.</span>
                    </li>
                    <li>
                        <strong>Private record</strong>
                        <span>Training and forecasts remain visible only to authorised people.</span>
                    </li>
                </ol>
            </main>
        </AppShell>
    );
}
