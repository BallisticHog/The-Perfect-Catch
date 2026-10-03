import type { RowingVenueProfile } from "@the-perfect-catch/domain";
import { Cloud, CloudRain, RadioTower, Wind, ZapOff } from "lucide-react";

function CourseBoard({ venue }: { venue: RowingVenueProfile; })
{
    const laneCount = venue.observedLaneCount ?? 0;
    const lanes = Array.from({ length: laneCount }, (_, index) => index + 1);
    return (
        <svg
            className="course-board"
            viewBox="0 0 920 520"
            role="img"
            aria-labelledby="course-board-title course-board-description"
        >
            <title id="course-board-title">{venue.name} course model preview</title>
            <desc id="course-board-description">
                A schematic rowing course showing observed lane numbers. It is not surveyed shoreline geometry
                and contains no live weather observations.
            </desc>
            <path
                className="course-lake-shape"
                d="M34 100C132 34 269 44 351 79C457 124 548 54 684 70C779 81 868 152 886 246C905 345 850 443 737 463C613 484 532 424 424 449C305 477 165 461 85 383C10 310-33 174 34 100Z"
            />
            {venue.geometryStatus === "schematic"
                ? (
                    <g>
                        <rect className="course-water" x="154" y="92" width="610" height="334" rx="10" />
                        <line className="course-boundary" x1="190" y1="116" x2="190" y2="402" />
                        <line className="course-finish" x1="724" y1="116" x2="724" y2="402" />
                        {lanes.map((lane, index) =>
                        {
                            const y = 132 + index * (254 / Math.max(laneCount - 1, 1));
                            return (
                                <g key={lane}>
                                    <line className="course-lane" x1="190" y1={y} x2="724" y2={y} />
                                    <text className="course-lane-label" x="173" y={y + 5}>{lane}</text>
                                </g>
                            );
                        })}
                        <text className="course-end-label" x="190" y="97">START</text>
                        <text className="course-end-label" x="724" y="97" textAnchor="end">FINISH</text>
                        <g className="course-wind-placeholder">
                            <line x1="548" y1="55" x2="642" y2="55" />
                            <path d="m642 55-17-10v20Z" />
                            <text x="546" y="42">WIND LAYER</text>
                        </g>
                    </g>
                )
                : (
                    <g className="course-survey-pending">
                        <text x="460" y="242" textAnchor="middle">COURSE SURVEY PENDING</text>
                        <text x="460" y="273" textAnchor="middle">No lane geometry has been approved</text>
                    </g>
                )}
        </svg>
    );
}

export function CourseWatchPreview({ venue }: { venue: RowingVenueProfile; })
{
    const layers = [
        { icon: Wind, name: "Course-relative wind", state: "Awaiting source" },
        { icon: Cloud, name: "Cloud coverage", state: "Awaiting source" },
        { icon: CloudRain, name: "Rain and radar", state: "Awaiting source" },
        { icon: ZapOff, name: "Lightning observations", state: "Not connected" },
        { icon: RadioTower, name: "Local tower", state: "Not connected" },
    ];
    return (
        <div className="course-watch-layout">
            <section className="course-watch-map" aria-labelledby="course-map-heading">
                <header>
                    <div>
                        <small>Course model preview</small>
                        <h2 id="course-map-heading">{venue.shortName}</h2>
                    </div>
                    <span className="course-data-state">Not live</span>
                </header>
                <CourseBoard venue={venue} />
                <p className="course-map-caption">
                    {venue.evidenceNote}{" "}
                    The shoreline and course are schematic until reviewed geometry and bearing are recorded.
                </p>
            </section>
            <aside className="course-watch-instrument" aria-label="Weather layer status">
                <div className="safety-unknown">
                    <strong>Safety status unavailable</strong>
                    <span>
                        No trusted live observation is connected. A coach must use the approved safety
                        process.
                    </span>
                </div>
                <dl>
                    <div>
                        <dt>Venue</dt>
                        <dd>{venue.name}</dd>
                    </div>
                    <div>
                        <dt>Locality</dt>
                        <dd>{venue.locality}</dd>
                    </div>
                    <div>
                        <dt>Course</dt>
                        <dd>{venue.courseDistanceMetres ? `${venue.courseDistanceMetres} m` : "Pending"}</dd>
                    </div>
                    <div>
                        <dt>Observed lanes</dt>
                        <dd>{venue.observedLaneCount ?? "Pending"}</dd>
                    </div>
                </dl>
                <div className="weather-layer-list">
                    {layers.map((layer) =>
                    {
                        const Icon = layer.icon;
                        return (
                            <div key={layer.name}>
                                <Icon aria-hidden="true" />
                                <span>
                                    <strong>{layer.name}</strong>
                                    <small>{layer.state}</small>
                                </span>
                            </div>
                        );
                    })}
                </div>
            </aside>
        </div>
    );
}
