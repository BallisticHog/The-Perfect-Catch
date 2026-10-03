import { CalendarRange, ChartNoAxesCombined, ChevronRight, RadioTower, Trophy } from "lucide-react";
import Link from "next/link";

const workspaces = [
    {
        href: "/regattas",
        title: "Results",
        description:
            "Open the championship archive, follow event progressions, and move between races, schools, and published rower records.",
        action: "Browse results",
        icon: Trophy,
        access: "Catalogue",
    },
    {
        href: "/my-rowing",
        title: "My Rowing",
        description:
            "Bring verified race evidence, assigned sessions, water pieces, erg tests, and personal progress into one private record.",
        action: "Open My Rowing",
        icon: ChartNoAxesCombined,
        access: "Signed in",
    },
    {
        href: "/programme",
        title: "School Programme",
        description:
            "Plan groups, crews, training sessions, trials, attendance, and regattas from one coach-owned calendar.",
        action: "Open programme",
        icon: CalendarRange,
        access: "Signed in",
    },
] as const;

export function WorkspaceHome()
{
    return (
        <>
            <section className="home-introduction" aria-labelledby="home-title">
                <div>
                    <h1 id="home-title">One rowing record, from programme to finish line.</h1>
                    <p>
                        The Catch connects published regatta evidence with the private work that prepares St
                        Dunstan&apos;s rowers to race.
                    </p>
                </div>
                <Link className="course-watch-callout" href="/course-watch">
                    <RadioTower aria-hidden="true" />
                    <span>
                        <small>Venue intelligence</small>
                        Course Watch
                    </span>
                    <ChevronRight aria-hidden="true" />
                </Link>
            </section>
            <section className="workspace-grid" aria-label="The Catch workspaces">
                {workspaces.map((workspace, index) =>
                {
                    const Icon = workspace.icon;
                    return (
                        <Link className="workspace-card" href={workspace.href} key={workspace.href}>
                            <span className="workspace-number">0{index + 1}</span>
                            <Icon aria-hidden="true" />
                            <small>{workspace.access}</small>
                            <h2>{workspace.title}</h2>
                            <p>{workspace.description}</p>
                            <strong>
                                {workspace.action}
                                <ChevronRight aria-hidden="true" />
                            </strong>
                        </Link>
                    );
                })}
            </section>
            <section className="home-live-context" aria-labelledby="current-regatta-heading">
                <div>
                    <small>Current archive</small>
                    <h2 id="current-regatta-heading">2026 SA Schools Championships</h2>
                    <p>
                        Roodeplaat Dam, Pretoria. Events, rounds, schools, and source rower records are
                        linked.
                    </p>
                </div>
                <div className="home-context-actions">
                    <Link className="button button-primary" href="/live">Follow St Mary&apos;s live</Link>
                    <Link className="button button-primary" href="/regattas/2026-sa-schools-championships">
                        Open championship
                    </Link>
                    <Link className="button button-outline" href="/course-watch?venue=roodeplaat">
                        View course model
                    </Link>
                </div>
            </section>
        </>
    );
}
