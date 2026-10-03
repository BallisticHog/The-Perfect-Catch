"use client";

import { SchoolMonogram, schoolThemeProperties, type SchoolThemeTokens } from "@the-perfect-catch/ui";
import type { CSSProperties } from "react";
import { useState } from "react";

export function SchoolIdentityMark(
    { name, abbreviation, crestAssetId, theme }: {
        name: string;
        abbreviation: string;
        crestAssetId?: string | null | undefined;
        theme?: SchoolThemeTokens | undefined;
    },
)
{
    const [failed, setFailed] = useState(false);
    const style = theme ? schoolThemeProperties(theme) as CSSProperties : undefined;
    if (!crestAssetId || failed)
    {
        return (
            <span className="school-identity-mark school-themed-marker" style={style}>
                <SchoolMonogram name={name} abbreviation={abbreviation} />
            </span>
        );
    }
    return (
        <span className="school-identity-mark school-themed-marker" style={style}>
            {/* Authenticated raster media must be fetched by the signed-in browser, not the image optimizer. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={`/protected-media/${encodeURIComponent(crestAssetId)}`}
                alt={`${name} crest`}
                width="48"
                height="48"
                onError={() => setFailed(true)}
            />
        </span>
    );
}
