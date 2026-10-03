import "server-only";
import { schema } from "@the-perfect-catch/db";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { acceptsIdentity, normalizeEmail } from "./access-policy";
import { getAuth } from "./auth";
import { getDatabase } from "./database";
import { localReviewAccess } from "./local-review-mode";
import { safeReturnPath } from "./return-path";

export type CatalogAccess = {
    userId: string;
    name: string;
    role: "admin" | "viewer";
    localReviewState?: "ready" | "stale" | "empty";
};
export type AccessResult = { state: "unauthenticated"; } | { state: "denied"; } | {
    state: "allowed";
    access: CatalogAccess;
};

export async function checkCatalogAccess(requestHeaders: Headers): Promise<AccessResult>
{
    const reviewAccess = localReviewAccess(requestHeaders);
    if (reviewAccess)
    {
        return { state: "allowed", access: reviewAccess };
    }
    if (
        !process.env.DATABASE_URL || !process.env.BETTER_AUTH_SECRET || !process.env.GOOGLE_CLIENT_ID
        || !process.env.GOOGLE_CLIENT_SECRET
    )
    {
        return { state: "unauthenticated" };
    }
    const session = await getAuth().api.getSession({
        headers: requestHeaders,
        query: { disableCookieCache: true },
    });
    if (!session || new Date(session.session.expiresAt).getTime() <= Date.now())
    {
        return { state: "unauthenticated" };
    }
    const db = getDatabase();
    const [account] = await db.select({ googleSubject: schema.account.accountId }).from(schema.account).where(
        and(eq(schema.account.userId, session.user.id), eq(schema.account.providerId, "google")),
    ).limit(1);
    const [grant] = await db.select().from(schema.accessGrants).where(
        eq(schema.accessGrants.emailNormalized, normalizeEmail(session.user.email)),
    ).limit(1);
    if (
        !account || !grant
        || !acceptsIdentity({
            userId: session.user.id,
            email: session.user.email,
            emailVerified: session.user.emailVerified,
            googleSubject: account.googleSubject,
        }, grant)
    )
    {
        await db.insert(schema.securityEvents).values({
            actorId: session.user.id,
            action: "access.request_denied",
            outcome: "denied",
            targetId: grant?.id,
            metadata: { reason: "current_identity_or_grant_mismatch" },
        });
        return { state: "denied" };
    }
    return {
        state: "allowed",
        access: { userId: session.user.id, name: session.user.name, role: grant.role },
    };
}

export async function requireCatalogAccess(returnTo = "/regattas"): Promise<CatalogAccess>
{
    const result = await checkCatalogAccess(await headers());
    if (result.state === "unauthenticated")
    {
        redirect(`/sign-in?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`);
    }
    if (result.state === "denied")
    {
        forbidden();
    }
    return result.access;
}

export async function requireAdministrator(): Promise<CatalogAccess>
{
    const access = await requireCatalogAccess();
    if (access.role !== "admin")
    {
        await getDatabase().insert(schema.securityEvents).values({
            actorId: access.userId,
            action: "access.administrator_denied",
            outcome: "denied",
            metadata: { reason: "insufficient_role" },
        });
        forbidden();
    }
    return access;
}

export function privateHeaders(): Record<string, string>
{
    return {
        "Cache-Control": "private, no-store, max-age=0",
        "X-Robots-Tag": "noindex, nofollow, noarchive, nosnippet",
        "X-Content-Type-Options": "nosniff",
    };
}
