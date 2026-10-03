import { AppShell } from "@/components/app-shell";
import { WorkspaceHome } from "@/components/workspace-home";
import { requireCatalogAccess } from "@/lib/authorization";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Home | The Catch" };

export default async function Home()
{
    const access = await requireCatalogAccess("/");
    return (
        <AppShell name={access.name} active="home">
            <main className="home-page" id="main-content">
                <WorkspaceHome />
            </main>
        </AppShell>
    );
}
