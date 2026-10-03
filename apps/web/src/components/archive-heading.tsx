import { CHAMPIONSHIP } from "@the-perfect-catch/domain";
import { CalendarDays, MapPin } from "lucide-react";

export function ArchiveHeading()
{
    return (
        <div className="archive-heading">
            <h1>{CHAMPIONSHIP.name}</h1>
            <div className="archive-metadata">
                <span>
                    <MapPin aria-hidden="true" />Roodeplaat
                </span>
                <span>
                    <CalendarDays aria-hidden="true" />6-8 March 2026
                </span>
                <span>Archived results</span>
            </div>
        </div>
    );
}
