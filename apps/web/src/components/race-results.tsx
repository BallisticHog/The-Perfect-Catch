import { finishGap, formatFinish, gapLabel, schoolAbbreviation } from "@/lib/presentation";
import { appearanceRowerHref } from "@/lib/rower-records";
import type { SchoolPresentation } from "@the-perfect-catch/db";
import type { Race, Result } from "@the-perfect-catch/domain";
import { resolveSchoolTheme } from "@the-perfect-catch/ui";
import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { FinishGap } from "./finish-gap";
import { SchoolIdentityMark } from "./school-identity-mark";

function School(
    { result, presentation, link = true }: {
        result: Result;
        presentation: SchoolPresentation | undefined;
        link?: boolean;
    },
)
{
    return (
        <span className="school-cell">
            <SchoolIdentityMark
                name={result.schoolRaw}
                abbreviation={schoolAbbreviation(result.schoolRaw)}
                crestAssetId={presentation?.crestAssetId}
                theme={presentation
                    ? resolveSchoolTheme({
                        primaryColor: presentation.primaryColor,
                        secondaryColor: presentation.secondaryColor,
                        accessibleTokens: presentation.accessibleTokens ?? {},
                        themeAlgorithmVersion: presentation.themeAlgorithmVersion ?? "",
                    })
                    : undefined}
            />
            {result.schoolKey && link
                ? <Link href={`/schools/${encodeURIComponent(result.schoolKey)}`}>{result.schoolRaw}</Link>
                : <span>{result.schoolRaw}</span>}
        </span>
    );
}

function Crew({ result, regattaId }: { result: Result; regattaId: string; })
{
    return (
        <>
            {result.appearances.length
                ? result.appearances.map((person, index) => (
                    <Link
                        className="crew-person"
                        href={appearanceRowerHref(
                            regattaId,
                            person.displayName,
                            result.schoolKey,
                            result.schoolRaw,
                        )}
                        key={`${person.rawName}-${index}`}
                    >
                        {person.displayName}
                        {person.isCox ? " (cox)" : person.seat ? ` (seat ${person.seat})` : ""}
                    </Link>
                ))
                : result.athletesRaw || "Not recorded"}
        </>
    );
}

function Status({ result, official }: { result: Result; official: boolean; })
{
    if (result.status === "finished")
    {
        return <>{official ? "Official" : "Unconfirmed"}</>;
    }
    if (result.status === "unknown")
    {
        return <>{result.statusRaw || "Not recorded"}</>;
    }
    return <>{result.status.toUpperCase()}</>;
}

export function RaceResults(
    { race, regattaId, schoolPresentations }: {
        race: Race;
        regattaId: string;
        schoolPresentations: Record<string, SchoolPresentation>;
    },
)
{
    const gaps = race.results.map((result) => finishGap(result, race.results)).filter((gap): gap is number =>
        gap !== null
    );
    const maximum = Math.max(5, Math.ceil(Math.max(0, ...gaps) / 5) * 5);
    return (
        <section aria-label="Race results">
            <p className="gap-explanation">
                Finish gap in seconds relative to the fastest recorded finish. Positions are a time
                comparison, not a location on the course.
            </p>
            <div className="desktop-results">
                <table className="results-table">
                    <caption className="sr-only">
                        {race.eventName}, race{" "}
                        {race.raceNumber}, results. Finish gaps are seconds, not on-course positions.
                    </caption>
                    <thead>
                        <tr>
                            <th scope="col">Lane</th>
                            <th scope="col">Place</th>
                            <th scope="col">School</th>
                            <th scope="col">Crew</th>
                            <th scope="col" className="visual-column">
                                <span className="sr-only">Finish gap visual</span>
                                <FinishGap gap={null} maximum={maximum} labels />
                            </th>
                            <th scope="col">Time</th>
                            <th scope="col">Gap (s)</th>
                            <th scope="col">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {race.results.map((result) => (
                            <tr key={result.sourceKey}>
                                <td className="lane-cell">
                                    <span>{result.lane ?? (result.laneRaw || "?")}</span>
                                </td>
                                <td className="place-cell">{result.place ?? (result.placeRaw || "?")}</td>
                                <td>
                                    <School
                                        result={result}
                                        presentation={result.schoolKey
                                            ? schoolPresentations[result.schoolKey]
                                            : undefined}
                                    />
                                </td>
                                <td className="crew-cell">
                                    <Crew result={result} regattaId={regattaId} />
                                </td>
                                <td className="visual-column">
                                    <FinishGap gap={finishGap(result, race.results)} maximum={maximum} />
                                </td>
                                <td className="finish-time">
                                    {formatFinish(result.finishMs, result.finishRaw)}
                                </td>
                                <td className="gap-number">{gapLabel(finishGap(result, race.results))}</td>
                                <td>
                                    <Status result={result} official={race.official} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="mobile-results">
                <div className="mobile-result-heading" aria-hidden="true">
                    <span>Place</span>
                    <span>Lane</span>
                    <span>School</span>
                    <span>Time</span>
                    <span>Gap (s)</span>
                </div>
                {race.results.map((result, index) => (
                    <details className="mobile-result" key={result.sourceKey} open={index === 0}>
                        <summary>
                            <span className="mobile-result-main">
                                <span className="mobile-place">
                                    {result.place ?? (result.placeRaw || "?")}
                                </span>
                                <span className="mobile-lane">{result.lane ?? (result.laneRaw || "?")}</span>
                                <School
                                    result={result}
                                    presentation={result.schoolKey
                                        ? schoolPresentations[result.schoolKey]
                                        : undefined}
                                    link={false}
                                />
                                <span className="finish-time">
                                    {formatFinish(result.finishMs, result.finishRaw)}
                                </span>
                                <span className="gap-number">
                                    {gapLabel(finishGap(result, race.results))}
                                </span>
                                <ChevronDown className="result-disclosure" aria-hidden="true" />
                            </span>
                            <span className="mobile-result-gap">
                                <FinishGap
                                    gap={finishGap(result, race.results)}
                                    maximum={maximum}
                                    labels
                                />
                            </span>
                            <span className="sr-only">Expand crew and result status</span>
                        </summary>
                        <div className="mobile-result-detail">
                            <dl>
                                <div>
                                    <dt>School</dt>
                                    <dd>
                                        <School
                                            result={result}
                                            presentation={result.schoolKey
                                                ? schoolPresentations[result.schoolKey]
                                                : undefined}
                                        />
                                    </dd>
                                </div>
                                <div>
                                    <dt>Crew</dt>
                                    <dd>
                                        <Crew result={result} regattaId={regattaId} />
                                    </dd>
                                </div>
                                <div>
                                    <dt>Status</dt>
                                    <dd>
                                        <Status result={result} official={race.official} />
                                    </dd>
                                </div>
                            </dl>
                        </div>
                    </details>
                ))}
            </div>
        </section>
    );
}
