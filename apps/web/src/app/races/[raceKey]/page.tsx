import { RaceScreen } from "@/components/race-screen";
import { loadCatalog } from "@/lib/catalog";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Race results" };

export default async function RacePage({ params }: { params: Promise<{ raceKey: string; }>; })
{
    const { raceKey } = await params;
    const { access, catalog, schoolPresentations } = await loadCatalog(
        `/races/${encodeURIComponent(raceKey)}`,
        true,
    );
    const race = catalog?.races.find((item) => item.sourceKey === raceKey);
    if (!catalog || !race)
    {
        notFound();
    }
    return (
        <RaceScreen
            name={access.name}
            regattaId={catalog.regatta.id}
            race={race}
            races={catalog.races}
            schoolPresentations={schoolPresentations}
            capturedAt={catalog.version?.createdAt ?? null}
            latestRefresh={catalog.latestRefresh}
        />
    );
}
