import "server-only";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { schema } from "@the-perfect-catch/db";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { and, eq } from "drizzle-orm";
import { acceptsIdentity, normalizeEmail } from "./access-policy";
import { getDatabase } from "./database";

function requiredEnvironment(name: string): string
{
    const value = process.env[name];
    if (!value)
    {
        throw new Error(`Missing authentication configuration: ${name}`);
    }
    return value;
}

function createAuth()
{
    const db = getDatabase();
    const baseURL = process.env.BETTER_AUTH_URL || requiredEnvironment("APP_BASE_URL");
    const origin = new URL(baseURL).origin;
    if (process.env.NODE_ENV === "production" && !origin.startsWith("https://"))
    {
        throw new Error("Production authentication requires HTTPS");
    }
    return betterAuth(
        {
            appName: "The Catch",
            baseURL,
            secret: requiredEnvironment("BETTER_AUTH_SECRET"),
            trustedOrigins: [origin],
            database: drizzleAdapter(db, { provider: "pg", schema }),
            emailAndPassword: { enabled: false },
            socialProviders: {
                google: {
                    clientId: requiredEnvironment("GOOGLE_CLIENT_ID"),
                    clientSecret: requiredEnvironment("GOOGLE_CLIENT_SECRET"),
                    scope: ["openid", "email", "profile"],
                    accessType: "online",
                    includeGrantedScopes: false,
                    requireEmailVerification: true,
                    async mapProfileToUser(profile)
                    {
                        const email = normalizeEmail(profile.email);
                        const [grant] = await db.select().from(schema.accessGrants).where(
                            eq(schema.accessGrants.emailNormalized, email),
                        ).limit(1);
                        if (
                            !profile.email_verified || !grant || grant.status !== "active"
                            || (grant.googleSubject !== null && grant.googleSubject !== profile.sub)
                        )
                        {
                            await db.insert(schema.securityEvents).values({
                                action: "auth.sign_in_denied",
                                outcome: "denied",
                                metadata: { reason: "provider_identity_or_grant_mismatch" },
                            });
                            throw new APIError("FORBIDDEN", {
                                message: "This account cannot access the private beta.",
                            });
                        }
                        return { email, emailVerified: true };
                    },
                },
            },
            account: { accountLinking: { enabled: false }, storeAccountCookie: false },
            session: { expiresIn: 86_400, updateAge: 86_400, cookieCache: { enabled: false } },
            advanced: {
                useSecureCookies: process.env.NODE_ENV === "production",
                defaultCookieAttributes: { httpOnly: true, sameSite: "lax" },
            },
            databaseHooks: {
                account: {
                    create: {
                        async before(data)
                        {
                            return {
                                data: {
                                    ...data,
                                    accessToken: null,
                                    refreshToken: null,
                                    idToken: null,
                                    accessTokenExpiresAt: null,
                                    refreshTokenExpiresAt: null,
                                },
                            };
                        },
                    },
                    update: {
                        async before(data)
                        {
                            return {
                                data: {
                                    ...data,
                                    accessToken: null,
                                    refreshToken: null,
                                    idToken: null,
                                    accessTokenExpiresAt: null,
                                    refreshTokenExpiresAt: null,
                                },
                            };
                        },
                    },
                },
                user: {
                    create: {
                        async before(data)
                        {
                            const email = normalizeEmail(data.email);
                            const [grant] = await db.select().from(schema.accessGrants).where(
                                and(
                                    eq(schema.accessGrants.emailNormalized, email),
                                    eq(schema.accessGrants.status, "active"),
                                ),
                            ).limit(1);
                            if (!grant || !data.emailVerified)
                            {
                                await db.insert(schema.securityEvents).values({
                                    action: "auth.sign_in_denied",
                                    outcome: "denied",
                                    metadata: {
                                        reason: data.emailVerified
                                            ? "grant_unavailable"
                                            : "unverified_identity",
                                    },
                                });
                                throw new APIError("FORBIDDEN", {
                                    message: "This account cannot access the private beta.",
                                });
                            }
                            return { data: { ...data, email } };
                        },
                    },
                },
                session: {
                    create: {
                        async before(data)
                        {
                            try
                            {
                                await db.transaction(async (tx) =>
                                {
                                    const [identity] = await tx.select({
                                        userId: schema.user.id,
                                        email: schema.user.email,
                                        emailVerified: schema.user.emailVerified,
                                        googleSubject: schema.account.accountId,
                                    }).from(schema.user).innerJoin(
                                        schema.account,
                                        and(
                                            eq(schema.account.userId, schema.user.id),
                                            eq(schema.account.providerId, "google"),
                                        ),
                                    ).where(eq(schema.user.id, data.userId)).limit(1);
                                    const [grant] = identity
                                        ? await tx.select().from(schema.accessGrants).where(
                                            eq(
                                                schema.accessGrants.emailNormalized,
                                                normalizeEmail(identity.email),
                                            ),
                                        ).for("update").limit(1)
                                        : [];
                                    if (!identity || !grant || !acceptsIdentity(identity, grant, true))
                                    {
                                        throw new APIError("FORBIDDEN", {
                                            message: "This account cannot access the private beta.",
                                        });
                                    }
                                    if (grant.googleSubject === null || grant.userId === null)
                                    {
                                        await tx.update(schema.accessGrants).set({
                                            googleSubject: identity.googleSubject,
                                            userId: identity.userId,
                                        }).where(eq(schema.accessGrants.id, grant.id));
                                        await tx.insert(schema.securityEvents).values({
                                            actorId: identity.userId,
                                            action: "access.subject_bound",
                                            targetId: grant.id,
                                            outcome: "success",
                                            metadata: { binding: "google_subject_and_user" },
                                        });
                                    }
                                });
                            }
                            catch (error)
                            {
                                if (error instanceof APIError)
                                {
                                    await db.insert(schema.securityEvents).values({
                                        actorId: data.userId,
                                        action: "auth.sign_in_denied",
                                        outcome: "denied",
                                        metadata: { reason: "identity_or_grant_mismatch" },
                                    });
                                }
                                throw error;
                            }
                            return { data };
                        },
                        async after(data)
                        {
                            await db.insert(schema.securityEvents).values({
                                actorId: data.userId,
                                action: "auth.sign_in",
                                outcome: "success",
                                metadata: { provider: "google" },
                            });
                        },
                    },
                    delete: {
                        async after(data)
                        {
                            await db.insert(schema.securityEvents).values({
                                actorId: data.userId,
                                action: "auth.session_ended",
                                outcome: "success",
                            });
                        },
                    },
                },
            },
        },
    );
}

let auth: ReturnType<typeof createAuth> | undefined;

export function getAuth()
{
    auth ??= createAuth();
    return auth;
}
