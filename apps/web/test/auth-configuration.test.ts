import type { BetterAuthOptions } from "better-auth";
import { beforeAll, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ betterAuth: vi.fn(), adapter: vi.fn(), database: {} }));
vi.mock("server-only", () => ({}));
vi.mock("better-auth", () => ({ betterAuth: mocks.betterAuth }));
vi.mock("@better-auth/drizzle-adapter", () => ({ drizzleAdapter: mocks.adapter }));
vi.mock("../src/lib/database", () => ({ getDatabase: () => mocks.database }));

import { getAuth } from "../src/lib/auth";

let options: BetterAuthOptions;

beforeAll(() =>
{
    vi.stubEnv("APP_BASE_URL", "http://localhost:3000");
    vi.stubEnv("BETTER_AUTH_URL", "");
    vi.stubEnv("BETTER_AUTH_SECRET", "test-only-long-configuration-secret");
    vi.stubEnv("GOOGLE_CLIENT_ID", "test-client");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-secret");
    mocks.betterAuth.mockImplementation((config: BetterAuthOptions) =>
    {
        options = config;
        return { options: config };
    });
    getAuth();
});

describe("Google-only private authentication configuration", () =>
{
    it("uses only identity scopes, online access, 24-hour database sessions and an exact trusted origin", () =>
    {
        expect(options.socialProviders).toMatchObject({
            google: {
                scope: ["openid", "email", "profile"],
                accessType: "online",
                includeGrantedScopes: false,
                requireEmailVerification: true,
            },
        });
        expect(Object.keys(options.socialProviders ?? {})).toEqual(["google"]);
        expect(options.session).toMatchObject({ expiresIn: 86_400, cookieCache: { enabled: false } });
        expect(options.emailAndPassword).toMatchObject({ enabled: false });
        expect(options.account).toMatchObject({
            accountLinking: { enabled: false },
            storeAccountCookie: false,
        });
        expect(options.trustedOrigins).toEqual(["http://localhost:3000"]);
    });
    it("removes OAuth tokens and token expiry values from account creation and updates", async () =>
    {
        const incoming = {
            id: "account-1",
            userId: "user-1",
            providerId: "google",
            accountId: "stable-subject",
            createdAt: new Date(),
            updatedAt: new Date(),
            accessToken: "access-secret",
            refreshToken: "refresh-secret",
            idToken: "identity-secret",
            accessTokenExpiresAt: new Date(),
            refreshTokenExpiresAt: new Date(),
        };
        const created = await options.databaseHooks?.account?.create?.before?.(incoming, null);
        const updated = await options.databaseHooks?.account?.update?.before?.(incoming, null);
        for (const output of [created, updated])
        {
            expect(output).toMatchObject({
                data: {
                    providerId: "google",
                    accountId: "stable-subject",
                    accessToken: null,
                    refreshToken: null,
                    idToken: null,
                    accessTokenExpiresAt: null,
                    refreshTokenExpiresAt: null,
                },
            });
            expect(JSON.stringify(output)).not.toContain("secret");
        }
    });
});
