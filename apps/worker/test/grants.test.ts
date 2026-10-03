import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
    administerGrant,
    type GrantRecord,
    type GrantStore,
    type GrantTransaction,
    normalizeGrantEmail,
    verifyBootstrapSecret,
} from "../src/grants";

function fixtureStore()
{
    const grants = new Map<string, GrantRecord>();
    const audits: string[] = [];
    const tx: GrantTransaction = {
        findByEmail: async (email) => grants.get(email) ?? null,
        findActiveAdmin: async (userId) =>
            [...grants.values()].find((grant) =>
                grant.userId === userId && grant.role === "admin" && grant.status === "active"
            ) ?? null,
        hasAdmin: async () => [...grants.values()].some((grant) => grant.role === "admin"),
        save: async (input) =>
        {
            const existing = grants.get(input.emailNormalized);
            const grant: GrantRecord = {
                id: existing?.id ?? `grant-${grants.size}`,
                emailNormalized: input.emailNormalized,
                role: input.role,
                status: input.status,
                googleSubject: existing?.googleSubject ?? null,
                userId: existing?.userId ?? null,
            };
            grants.set(input.emailNormalized, grant);
            return grant;
        },
        audit: async (action) =>
        {
            audits.push(action);
        },
    };
    const store: GrantStore = { transaction: async (work) => work(tx) };
    return { store, grants, audits };
}

describe("server-only grant administration", () =>
{
    it("uses NFC and lowercasing without removing dots or plus suffixes", () =>
    {
        expect(normalizeGrantEmail("  A.B+Rowing@Example.COM  ")).toBe("a.b+rowing@example.com");
        expect(normalizeGrantEmail("A\u0301@example.com")).toBe("\u00e1@example.com");
        expect(() => normalizeGrantEmail("not an email")).toThrow();
    });
    it("bootstraps exactly one owner and is idempotent", async () =>
    {
        const fixture = fixtureStore();
        expect(
            (await administerGrant(fixture.store, { action: "bootstrap", email: "Owner@Example.com" }))
                .status,
        ).toBe("created");
        expect(
            (await administerGrant(fixture.store, { action: "bootstrap", email: "owner@example.com" }))
                .status,
        ).toBe("unchanged");
        expect(fixture.grants.size).toBe(1);
        expect(fixture.audits).toEqual(["access.bootstrap", "access.bootstrap"]);
        await expect(administerGrant(fixture.store, { action: "bootstrap", email: "other@example.com" }))
            .rejects.toThrow("already initialized");
    });
    it("checks the current admin, preserves subject binding, and records revocation", async () =>
    {
        const fixture = fixtureStore();
        fixture.grants.set("owner@example.com", {
            id: "owner-grant",
            emailNormalized: "owner@example.com",
            role: "admin",
            status: "active",
            userId: "owner-user",
            googleSubject: "subject-owner",
        });
        fixture.grants.set("viewer@example.com", {
            id: "viewer-grant",
            emailNormalized: "viewer@example.com",
            role: "viewer",
            status: "active",
            userId: "viewer-user",
            googleSubject: "subject-viewer",
        });
        await expect(
            administerGrant(fixture.store, {
                action: "revoke",
                actorId: "viewer-user",
                email: "owner@example.com",
            }),
        ).rejects.toThrow("administrator");
        await administerGrant(fixture.store, {
            action: "revoke",
            actorId: "owner-user",
            email: "viewer@example.com",
        });
        expect(fixture.grants.get("viewer@example.com")).toMatchObject({
            status: "revoked",
            googleSubject: "subject-viewer",
            userId: "viewer-user",
        });
        expect(fixture.audits).toEqual(["access.revoke"]);
        await administerGrant(fixture.store, {
            action: "grant",
            actorId: "owner-user",
            email: "viewer@example.com",
            role: "viewer",
        });
        expect(fixture.grants.get("viewer@example.com")).toMatchObject({
            status: "active",
            googleSubject: "subject-viewer",
        });
    });
    it("bootstrap cannot silently reactivate a revoked owner", async () =>
    {
        const fixture = fixtureStore();
        fixture.grants.set("owner@example.com", {
            id: "owner-grant",
            emailNormalized: "owner@example.com",
            role: "admin",
            status: "revoked",
            userId: "owner-user",
            googleSubject: "subject-owner",
        });
        await expect(administerGrant(fixture.store, { action: "bootstrap", email: "owner@example.com" }))
            .rejects.toThrow("already initialized");
    });
    it("requires a matching temporary bootstrap secret without logging it", () =>
    {
        const secret = "a-unique-bootstrap-secret-with-32-bytes";
        const expectedHash = createHash("sha256").update(secret).digest("hex");
        expect(verifyBootstrapSecret(secret, expectedHash)).toBe(true);
        expect(verifyBootstrapSecret("wrong-secret-with-at-least-32-characters", expectedHash)).toBe(false);
        expect(verifyBootstrapSecret(secret, undefined)).toBe(false);
    });
});
