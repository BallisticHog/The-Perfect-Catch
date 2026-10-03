import { AppShell } from "@/components/app-shell";
import { CourseWatchPreview } from "@/components/course-watch-preview";
import { requireCatalogAccess } from "@/lib/authorization";
import { ROWING_VENUES, type RowingVenueKey } from "@the-perfect-catch/domain";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Course Watch" };

export default async function CourseWatchPage(
    { searchParams }: { searchParams: Promise<{ venue?: string; }>; },
)
{
    const [access, parameters] = await Promise.all([requireCatalogAccess("/course-watch"), searchParams]);
    const venueKey: RowingVenueKey = parameters.venue === "germiston" ? "germiston" : "roodeplaat";
    const venue = ROWING_VENUES[venueKey];
    return (
        <AppShell name={access.name} active="course-watch">
            <main className="course-watch-page" id="main-content">
                <div className="page-heading course-watch-heading">
                    <h1>Course Watch</h1>
                    <p>Venue, course, and weather evidence in one rowing instrument.</p>
                </div>
                <nav className="venue-selector" aria-label="Rowing venue">
                    {Object.values(ROWING_VENUES).map((item) => (
                        <Link
                            href={`/course-watch?venue=${item.key}`}
                            aria-current={item.key === venueKey ? "page" : undefined}
                            key={item.key}
                        >
                            {item.shortName}
                        </Link>
                    ))}
                </nav>
                <CourseWatchPreview venue={venue} />
                <section className="course-watch-principles" aria-labelledby="weather-boundary-heading">
                    <h2 id="weather-boundary-heading">Evidence before prediction</h2>
                    <p>
                        Course Watch will preserve each tower, forecast, radar, lightning, and coach
                        observation separately. Performance estimates may explain likely time effects, but
                        they cannot approve water safety.
                    </p>
                </section>
            </main>
        </AppShell>
    );
}
