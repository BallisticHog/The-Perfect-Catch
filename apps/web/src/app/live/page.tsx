import { AppShell } from "@/components/app-shell";
import { LiveBoard } from "@/components/live-board";
import { requireCatalogAccess } from "@/lib/authorization";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Live regatta" };

export default async function LivePage(
    { searchParams }: { searchParams: Promise<{ q?: string; view?: string; }>; },
)
{
    const access = await requireCatalogAccess("/live");
    const params = await searchParams;
    return (
        <AppShell name={access.name} active="live">
            <main className="catalog-page live-page" id="main-content">
                <LiveBoard initialQuery={params.q ?? ""} initialView={params.view ?? "all"} />
            </main>
        </AppShell>
    );
}
