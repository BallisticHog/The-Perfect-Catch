import "server-only";
import {
    groupRowerAppearances,
    type Race,
    type RegattaRowerRecord,
    sourceRowerIdentityKey,
} from "@the-perfect-catch/domain";
import { createHash } from "node:crypto";

export function rowerRouteKey(identityKey: string): string
{
    return createHash("sha256").update(identityKey).digest("base64url").slice(0, 18);
}

export function rowerHref(regattaId: string, record: RegattaRowerRecord): string
{
    return `/regattas/${encodeURIComponent(regattaId)}/rowers/${rowerRouteKey(record.identityKey)}`;
}

export function appearanceRowerHref(
    regattaId: string,
    displayName: string,
    schoolKey: string | null,
    schoolRaw: string,
): string
{
    return `/regattas/${encodeURIComponent(regattaId)}/rowers/${
        rowerRouteKey(sourceRowerIdentityKey(displayName, schoolKey, schoolRaw))
    }`;
}

export function regattaRowerRecords(races: readonly Race[]): RegattaRowerRecord[]
{
    return groupRowerAppearances(races);
}

export function findRegattaRowerRecord(
    races: readonly Race[],
    routeKey: string,
): RegattaRowerRecord | null
{
    return regattaRowerRecords(races).find((record) => rowerRouteKey(record.identityKey) === routeKey)
        ?? null;
}
