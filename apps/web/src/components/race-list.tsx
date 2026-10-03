import { raceHref, roundLabel } from "@/lib/presentation";
import type { Race } from "@the-perfect-catch/domain";
import { Empty } from "@the-perfect-catch/ui";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

export function RaceList(
    { races, emptyTitle = "No races match these filters" }: { races: Race[]; emptyTitle?: string; },
)
{
    if (!races.length)
    {
        return (
            <Empty title={emptyTitle}>
                <p>Choose another filter or return to all races.</p>
            </Empty>
        );
    }
    return (
        <div className="race-list">
            {races.map((race) => (
                <Link className="race-list-row" href={raceHref(race)} key={race.sourceKey}>
                    <span className="race-list-number">{race.raceNumber ?? "?"}</span>
                    <span>
                        <strong>{race.eventName}</strong>
                        <span className="race-list-description">
                            {race.roundRaw || roundLabel(race.round)} · {race.dateRaw || "Date not recorded"}
                        </span>
                    </span>
                    <span className="race-list-status">
                        {race.official ? "Official" : race.statusRaw || "Status not recorded"}
                    </span>
                    <ArrowUpRight aria-hidden="true" />
                </Link>
            ))}
        </div>
    );
}
