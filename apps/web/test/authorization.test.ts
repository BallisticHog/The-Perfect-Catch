import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() =>
{
    return {
        getSession: vi.fn(),
        select: vi.fn(),
        insert: vi.fn(),
        values: vi.fn(),
        headers: vi.fn(),
        forbidden: vi.fn(),
        redirect: vi.fn(),
    };
});

vi.mock("server-only", () => ({}));
vi.mock("../src/lib/auth", () => ({ getAuth: () => ({ api: { getSession: mocks.getSession } }) }));
vi.mock(
    "../src/lib/database",
    () => ({ getDatabase: () => ({ select: mocks.select, insert: mocks.insert }) }),
);
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ forbidden: mocks.forbidden, redirect: mocks.redirect }));

import { checkCatalogAccess, requireAdministrator, requireCatalogAccess } from "../src/lib/authorization";

const activeGrant = {
    emailNormalized: "invited@example.test",
    googleSubject: "subject-1",
    userId: "user-1",
    status: "active",
    role: "viewer",
};

function databaseRows(rows: unknown[][])
{
    mocks.select.mockImplementation(() => ({
        from: () => ({ where: () => ({ limit: async () => rows.shift() ?? [] }) }),
    }));
}

beforeEach(() =>
{
    vi.stubEnv("DATABASE_URL", "postgres://test.invalid/catch");
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-only-not-used-in-real-auth");
    vi.stubEnv("GOOGLE_CLIENT_ID", "test-client");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-secret");
    mocks.headers.mockResolvedValue(new Headers());
    mocks.insert.mockReturnValue({ values: mocks.values });
    mocks.values.mockResolvedValue(undefined);
    mocks.forbidden.mockImplementation(() =>
    {
        throw new Error("forbidden");
    });
    mocks.redirect.mockImplementation((path: string) =>
    {
        throw new Error(`redirect:${path}`);
    });
    mocks.getSession.mockResolvedValue({
        user: { id: "user-1", name: "Invited viewer", email: "invited@example.test", emailVerified: true },
        session: { expiresAt: new Date(Date.now() + 60_000) },
    });
    databaseRows([[{ googleSubject: "subject-1" }], [activeGrant]]);
});

describe("server authorization", () =>
{
    it("checks the database-backed session with cookie caching disabled", async () =>
    {
        const headers = new Headers({ cookie: "opaque-session" });
        const result = await checkCatalogAccess(headers);
        expect(result).toEqual({
            state: "allowed",
            access: { userId: "user-1", name: "Invited viewer", role: "viewer" },
        });
        expect(mocks.getSession).toHaveBeenCalledWith({ headers, query: { disableCookieCache: true } });
    });
    it("rejects absent and expired sessions before reading protected account data", async () =>
    {
        mocks.getSession.mockResolvedValueOnce(null);
        expect(await checkCatalogAccess(new Headers())).toEqual({ state: "unauthenticated" });
        expect(mocks.select).not.toHaveBeenCalled();
        mocks.getSession.mockResolvedValueOnce({ session: { expiresAt: new Date(Date.now() - 1) } });
        expect(await checkCatalogAccess(new Headers())).toEqual({ state: "unauthenticated" });
        expect(mocks.select).not.toHaveBeenCalled();
    });
    it("rejects grant revocation on the very next request", async () =>
    {
        expect((await checkCatalogAccess(new Headers())).state).toBe("allowed");
        databaseRows([[{ googleSubject: "subject-1" }], [{ ...activeGrant, status: "revoked" }]]);
        expect(await checkCatalogAccess(new Headers())).toEqual({ state: "denied" });
        expect(mocks.values).toHaveBeenCalledWith(
            expect.objectContaining({ action: "access.request_denied", outcome: "denied" }),
        );
    });
    it.each([{ grants: [] }, { grants: [{ ...activeGrant, googleSubject: "other-subject" }] }])(
        "rejects unavailable or mismatched grants",
        async ({ grants }) =>
        {
            databaseRows([[{ googleSubject: "subject-1" }], grants]);
            expect(await checkCatalogAccess(new Headers())).toEqual({ state: "denied" });
        },
    );
    it("rejects an unverified email", async () =>
    {
        mocks.getSession.mockResolvedValueOnce({
            user: { id: "user-1", email: "invited@example.test", emailVerified: false },
            session: { expiresAt: new Date(Date.now() + 60_000) },
        });
        expect(await checkCatalogAccess(new Headers())).toEqual({ state: "denied" });
    });
    it("redirects unsigned viewers while giving signed-in denied viewers a forbidden boundary", async () =>
    {
        mocks.getSession.mockResolvedValueOnce(null);
        await expect(requireCatalogAccess("/races/race-1")).rejects.toThrow(
            "redirect:/sign-in?returnTo=%2Fraces%2Frace-1",
        );
        databaseRows([[{ googleSubject: "subject-1" }], [{ ...activeGrant, status: "revoked" }]]);
        await expect(requireCatalogAccess()).rejects.toThrow("forbidden");
    });
    it("uses the current database role for administrator authorization", async () =>
    {
        await expect(requireAdministrator()).rejects.toThrow("forbidden");
        databaseRows([[{ googleSubject: "subject-1" }], [{ ...activeGrant, role: "admin" }]]);
        expect((await requireAdministrator()).role).toBe("admin");
    });
});
