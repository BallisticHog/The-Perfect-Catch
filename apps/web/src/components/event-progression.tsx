import { roundLabel } from "@/lib/presentation";
import { type EventRound } from "@the-perfect-catch/domain";
import { RaceList } from "./race-list";

function groupHeading(group: EventRound): string
{
    const label = roundLabel(group.round);
    if (group.races.length === 1)
    {
        return label;
    }
    if (group.round === "heat")
    {
        return "Heats";
    }
    if (group.round === "semifinal")
    {
        return "Semi finals";
    }
    return `${label} races`;
}

export function EventProgression({ rounds }: { rounds: EventRound[]; })
{
    return (
        <div className="event-progression">
            <ol className="round-navigation event-progression-rail" aria-label="Event progression">
                {rounds.map((group) => (
                    <li key={group.round}>
                        <span>{groupHeading(group)}</span>
                        <i aria-hidden="true" />
                        <small>{group.races.length} race{group.races.length === 1 ? "" : "s"}</small>
                    </li>
                ))}
            </ol>
            {rounds.map((group) =>
            {
                const headingId = `event-stage-${group.round}`;
                return (
                    <section className="event-stage" key={group.round} aria-labelledby={headingId}>
                        <div className="list-toolbar event-stage-heading">
                            <h3 id={headingId}>{groupHeading(group)}</h3>
                            <p>{group.races.length} published race{group.races.length === 1 ? "" : "s"}</p>
                        </div>
                        <RaceList races={group.races} />
                    </section>
                );
            })}
        </div>
    );
}
