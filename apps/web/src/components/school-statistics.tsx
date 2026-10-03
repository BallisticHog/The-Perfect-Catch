import type { SchoolResultStatistics } from "@the-perfect-catch/domain";

export function SchoolStatistics({ statistics }: { statistics: SchoolResultStatistics; })
{
    const boatClasses = statistics.boatClasses.length
        ? statistics.boatClasses.join(", ")
        : "Not recorded";

    return (
        <section className="school-statistics" aria-labelledby="school-statistics-title">
            <div className="list-toolbar school-statistics-header">
                <div>
                    <h2 id="school-statistics-title">2026 championship summary</h2>
                    <p>Counts derived from the published archive.</p>
                </div>
            </div>
            <dl className="school-statistics-grid">
                <div className="school-statistic">
                    <dt>Published crew entries</dt>
                    <dd>{statistics.publishedCrewEntries}</dd>
                </div>
                <div className="school-statistic">
                    <dt>Evidenced crew starts</dt>
                    <dd>{statistics.evidencedCrewStarts}</dd>
                </div>
                <div className="school-statistic">
                    <dt>Races contested</dt>
                    <dd>{statistics.racesContested}</dd>
                </div>
                <div className="school-statistic">
                    <dt>Race wins</dt>
                    <dd>{statistics.raceWins}</dd>
                </div>
                <div className="school-statistic">
                    <dt>Published final crew entries</dt>
                    <dd>{statistics.finalCrewEntries}</dd>
                </div>
                <div className="school-statistic">
                    <dt>Final A podium results</dt>
                    <dd>{statistics.finalAPodiums}</dd>
                </div>
                <div className="school-statistic">
                    <dt>Published seat appearances</dt>
                    <dd>{statistics.publishedSeatAppearances}</dd>
                </div>
                <div className="school-statistic school-statistics-boats">
                    <dt>Recorded boat classes</dt>
                    <dd>{boatClasses}</dd>
                </div>
            </dl>
            <div className="school-statistics-note muted small">
                <p>
                    Published entries include crews listed as DNS or scratched. Evidenced starts count
                    finished and DNF results only.
                </p>
                <p>
                    Source-derived seat appearances and results are not current roster size or a unique
                    athlete count. The same source-recorded person can appear in more than one race, and cox
                    appearances are included.
                </p>
            </div>
        </section>
    );
}
