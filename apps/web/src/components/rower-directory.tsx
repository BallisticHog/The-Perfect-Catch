import { schoolAbbreviation } from "@/lib/presentation";
import { rowerHref } from "@/lib/rower-records";
import type { SchoolPresentation } from "@the-perfect-catch/db";
import type { RegattaRowerRecord } from "@the-perfect-catch/domain";
import { Empty, resolveSchoolTheme } from "@the-perfect-catch/ui";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { SchoolIdentityMark } from "./school-identity-mark";

export function RowerDirectory(
    { records, regattaId, schoolPresentations }: {
        records: RegattaRowerRecord[];
        regattaId: string;
        schoolPresentations: Record<string, SchoolPresentation>;
    },
)
{
    if (!records.length)
    {
        return (
            <Empty title="No rower records match these filters">
                <p>Choose another name, school, or boat class.</p>
            </Empty>
        );
    }
    return (
        <div className="rower-directory">
            {records.map((record) =>
            {
                const school = record.schoolKey ? schoolPresentations[record.schoolKey] : undefined;
                const theme = school
                    ? resolveSchoolTheme({
                        primaryColor: school.primaryColor,
                        secondaryColor: school.secondaryColor,
                        accessibleTokens: school.accessibleTokens ?? {},
                        themeAlgorithmVersion: school.themeAlgorithmVersion ?? "",
                    })
                    : undefined;
                return (
                    <article className="rower-directory-row" key={record.identityKey}>
                        <SchoolIdentityMark
                            name={school?.name ?? record.schoolName}
                            abbreviation={schoolAbbreviation(school?.name ?? record.schoolName)}
                            crestAssetId={school?.crestAssetId}
                            theme={theme}
                        />
                        <div className="rower-directory-main">
                            <Link className="rower-name-link" href={rowerHref(regattaId, record)}>
                                {record.displayName}
                            </Link>
                            {record.schoolKey
                                ? (
                                    <Link
                                        className="rower-school-link"
                                        href={`/schools/${encodeURIComponent(record.schoolKey)}`}
                                    >
                                        {school?.name ?? record.schoolName}
                                    </Link>
                                )
                                : <span>{record.schoolName}</span>}
                        </div>
                        <div className="rower-directory-summary">
                            <span>
                                {record.eventIds.length} event{record.eventIds.length === 1 ? "" : "s"}
                            </span>
                            <span>{record.raceCount} race{record.raceCount === 1 ? "" : "s"}</span>
                            <span>{record.boatClasses.join(", ") || "Boat not recorded"}</span>
                        </div>
                        <Link
                            className="rower-open-link"
                            href={rowerHref(regattaId, record)}
                            aria-label={`Open ${record.displayName} championship record`}
                        >
                            <ArrowRight aria-hidden="true" />
                        </Link>
                    </article>
                );
            })}
        </div>
    );
}
