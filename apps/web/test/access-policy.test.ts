import { describe, expect, it } from "vitest";
import { acceptsIdentity, type AccessGrant, normalizeEmail } from "../src/lib/access-policy";
import { canServeMedia, type MediaPolicyRelease } from "../src/lib/media-policy";
import { safeReturnPath } from "../src/lib/return-path";

const identity = {
    userId: "user-1",
    email: "Row.er+beta@gmail.com",
    emailVerified: true,
    googleSubject: "google-1",
};
const grant: AccessGrant = {
    userId: "user-1",
    emailNormalized: "row.er+beta@gmail.com",
    googleSubject: "google-1",
    status: "active",
    role: "viewer",
};

describe("exact account policy", () =>
{
    it("accepts a verified matching identity and current active grant", () =>
    {
        expect(acceptsIdentity(identity, grant)).toBe(true);
    });
    it("rejects uninvited, unverified, revoked and subject-mismatched identities", () =>
    {
        expect(acceptsIdentity(identity, null)).toBe(false);
        expect(acceptsIdentity({ ...identity, emailVerified: false }, grant)).toBe(false);
        expect(acceptsIdentity(identity, { ...grant, status: "revoked" })).toBe(false);
        expect(acceptsIdentity({ ...identity, googleSubject: "another-subject" }, grant)).toBe(false);
        expect(acceptsIdentity({ ...identity, userId: "another-user" }, grant)).toBe(false);
    });
    it("allows binding only in the explicitly requested first-sign-in operation", () =>
    {
        const unbound = { ...grant, googleSubject: null, userId: null };
        expect(acceptsIdentity(identity, unbound)).toBe(false);
        expect(acceptsIdentity(identity, unbound, true)).toBe(true);
        expect(acceptsIdentity(identity, { ...unbound, googleSubject: "another" }, true)).toBe(false);
    });
    it("normalizes case, NFC, and surrounding space without Gmail mailbox equivalence", () =>
    {
        expect(normalizeEmail("  Row.er+Beta@GMAIL.com  ")).toBe("row.er+beta@gmail.com");
        expect(normalizeEmail("e\u0301@example.com")).toBe("é@example.com");
        expect(acceptsIdentity({ ...identity, email: "rower+beta@gmail.com" }, grant)).toBe(false);
        expect(acceptsIdentity({ ...identity, email: "row.er@gmail.com" }, grant)).toBe(false);
    });
});

describe("return destinations", () =>
{
    it.each([
        "https://outside.example",
        "//outside.example",
        "/\\outside.example",
        "/api/auth/sign-out",
        "/corrections",
        "/races\n/1",
    ])("rejects unsafe or unsupported return path %s", (path) =>
    {
        expect(safeReturnPath(path)).toBe("/regattas");
    });
    it.each([
        "/races/race-1",
        "/regattas/archive?round=heat",
        "/corrections-and-removals",
        "/schools/school-1",
    ])("preserves the intended protected route %s", (path) =>
    {
        expect(safeReturnPath(path)).toBe(path);
    });
});

describe("media release policy", () =>
{
    const release: MediaPolicyRelease = {
        mode: "private_beta",
        privacyApprovedAt: null,
        privacyApprovedByUserId: null,
        privacyApprovalScope: null,
        privacyApprovalEvidence: null,
        crestRightsApprovedAt: null,
        crestRightsApprovedByUserId: null,
        crestRightsApprovalScope: null,
        crestRightsApprovalEvidence: null,
        publicReleasedAt: null,
        publicReleasedByUserId: null,
    };
    const asset = {
        visibility: "private_beta" as const,
        rightsStatus: "official_source_unlicensed",
        removedAt: null,
    };
    it("keeps private beta content inside a known private release", () =>
    {
        expect(canServeMedia(asset, release, false)).toBe(true);
        expect(canServeMedia(asset, null, false)).toBe(false);
        expect(canServeMedia(asset, { ...release, mode: "public" }, true)).toBe(false);
    });
    it("never serves removed media", () =>
    {
        expect(canServeMedia({ ...asset, removedAt: new Date() }, release, false)).toBe(false);
        expect(canServeMedia({ ...asset, visibility: "removed" }, release, false)).toBe(false);
        expect(canServeMedia({ ...asset, rightsStatus: "removed" }, release, false)).toBe(false);
    });
    it("requires per-asset approval, global recorded approvals and the separate public flag", () =>
    {
        const approved = { ...asset, visibility: "public_approved" as const, rightsStatus: "licensed" };
        const publicRelease = {
            ...release,
            mode: "public" as const,
            privacyApprovedAt: new Date(),
            privacyApprovedByUserId: "reviewer",
            privacyApprovalScope: "approved public catalog fields",
            privacyApprovalEvidence: { record: "privacy-review" },
            crestRightsApprovedAt: new Date(),
            crestRightsApprovedByUserId: "reviewer",
            crestRightsApprovalScope: "approved crest inventory",
            crestRightsApprovalEvidence: { record: "rights-review" },
            publicReleasedAt: new Date(),
            publicReleasedByUserId: "reviewer",
        };
        expect(canServeMedia(approved, publicRelease, true)).toBe(true);
        expect(canServeMedia(approved, publicRelease, false)).toBe(false);
        expect(canServeMedia(approved, { ...publicRelease, privacyApprovedAt: null }, true)).toBe(false);
        expect(canServeMedia({ ...approved, rightsStatus: "permission_pending" }, publicRelease, true)).toBe(
            false,
        );
    });
});
