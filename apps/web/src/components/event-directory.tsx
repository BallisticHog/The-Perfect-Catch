import { raceDay, roundLabel } from "@/lib/presentation";
import { type EventSummary } from "@the-perfect-catch/domain";
import { Empty } from "@the-perfect-catch/ui";
import { ArrowRight } from "lucide-react";
import Link from "next/link";

function eventRoundLabel(event: EventSummary): string
{
    return event.rounds.map((group) => roundLabel(group.round)).join(" / ");
}

function eventDateLabel(event: EventSummary): string
{
    const days = [
        ...new Set(
            event.races.map((race) => raceDay(race.scheduledAt)).filter(
                (day): day is string => Boolean(day),
            ),
        ),
    ].sort();
    if (!days.length)
    {
        return "Date not recorded";
    }
    const format = (day: string) =>
        new Intl.DateTimeFormat("en-ZA", {
            day: "numeric",
            month: "short",
            timeZone: "Africa/Johannesburg",
        }).format(new Date(`${day}T12:00:00+02:00`));
    const firstDay = days[0] as string;
    const lastDay = days.at(-1) as string;
    return days.length === 1 ? format(firstDay) : `${format(firstDay)} to ${format(lastDay)}`;
}

export function EventDirectory(
    { events, regattaId }: { events: EventSummary[]; regattaId: string; },
)
{
    if (!events.length)
    {
        return (
            <Empty title="No events match these filters">
                <p>Choose another filter or return to all events.</p>
            </Empty>
        );
    }
    return (
        <div className="event-directory">
            {events.map((event) => (
                <Link
                    className="event-directory-row"
                    href={`/regattas/${encodeURIComponent(regattaId)}/events/${
                        encodeURIComponent(event.sourceEventId)
                    }`}
                    key={event.sourceEventId}
                >
                    <span className="event-directory-number" aria-hidden="true">
                        <small>Event</small>
                        <strong>{event.sourceEventId}</strong>
                    </span>
                    <span className="event-directory-main">
                        <strong>
                            <span className="sr-only">Event {event.sourceEventId}:</span>
                            {event.eventName}
                        </strong>
                        <span className="event-directory-description">
                            {event.races.length} race{event.races.length === 1 ? "" : "s"} ·{" "}
                            {event.publishedCrewEntries}{" "}
                            published crew entr{event.publishedCrewEntries === 1 ? "y" : "ies"} ·{" "}
                            {eventDateLabel(event)}
                        </span>
                    </span>
                    <span className="event-directory-rounds">
                        <small>Progression</small>
                        <span>{eventRoundLabel(event)}</span>
                    </span>
                    <ArrowRight aria-hidden="true" />
                </Link>
            ))}
        </div>
    );
}
