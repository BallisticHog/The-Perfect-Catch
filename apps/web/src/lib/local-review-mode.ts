import { timingSafeEqual } from "node:crypto";
import type { CatalogAccess } from "./authorization";

export const LOCAL_REVIEW_USER_ID = "local-playwright-review";
const localReviewHeader = "x-the-catch-local-review";
const localReviewStateHeader = "x-the-catch-local-review-state";

function equalSecrets(candidate: string, expected: string): boolean
{
    const candidateBuffer = Buffer.from(candidate);
    const expectedBuffer = Buffer.from(expected);
    return candidateBuffer.byteLength === expectedBuffer.byteLength
        && timingSafeEqual(candidateBuffer, expectedBuffer);
}

export function localReviewAccess(requestHeaders: Headers): CatalogAccess | null
{
    const expected = process.env.LOCAL_REVIEW_SECRET;
    if (
        process.env.NODE_ENV !== "development"
        || process.env.LOCAL_REVIEW_MODE !== "true"
        || !expected
        || expected.length < 32
        || !equalSecrets(requestHeaders.get(localReviewHeader) ?? "", expected)
    )
    {
        return null;
    }
    const requestedState = requestHeaders.get(localReviewStateHeader);
    const localReviewState = requestedState === "stale" || requestedState === "empty"
        ? requestedState
        : "ready";
    return { userId: LOCAL_REVIEW_USER_ID, name: "Local reviewer", role: "admin", localReviewState };
}

export function isLocalReviewAccess(access: CatalogAccess): boolean
{
    return access.userId === LOCAL_REVIEW_USER_ID;
}
