import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    requireAccess: vi.fn(),
    checkAccess: vi.fn(),
    repository: vi.fn(),
    database: vi.fn(),
    readFile: vi.fn(),
    realpath: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock(
    "@/lib/authorization",
    () => ({
        requireCatalogAccess: mocks.requireAccess,
        checkCatalogAccess: mocks.checkAccess,
        privateHeaders: () => ({ "Cache-Control": "private, no-store", "X-Robots-Tag": "noindex, nofollow" }),
    }),
);
vi.mock("@/lib/database", () => ({ getDatabase: mocks.database }));
vi.mock(
    "@the-perfect-catch/db",
    async (original) => ({ ...await original<object>(), CatalogRepository: mocks.repository }),
);
vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile, realpath: mocks.realpath }));

beforeEach(() =>
{
    mocks.requireAccess.mockRejectedValue(new Error("ACCESS_REQUIRED"));
    mocks.checkAccess.mockResolvedValue({ state: "unauthenticated" });
    delete process.env.MEDIA_ROOT;
    delete process.env.SITE_PUBLIC_RELEASE_ENABLED;
});

function mediaDatabase(asset: Record<string, unknown>, release: Record<string, unknown>)
{
    const rows = [[asset], [release]];
    return {
        select: vi.fn(() => ({
            from: vi.fn(() => ({
                where: vi.fn(() => ({ limit: vi.fn(async () => rows.shift() ?? []) })),
            })),
        })),
    };
}

describe("protected page loaders", () =>
{
    const params = Promise.resolve({
        regattaId: "archive",
        eventId: "event-1",
        raceId: "race-1",
        raceKey: "race-1",
        schoolId: "school-1",
    });
    const searchParams = Promise.resolve({});
    it.each([
        () => import("../src/app/page"),
        () => import("../src/app/live/page"),
        () => import("../src/app/course-watch/page"),
        () => import("../src/app/my-rowing/page"),
        () => import("../src/app/programme/page"),
        () => import("../src/app/regattas/page"),
        () => import("../src/app/regattas/[regattaId]/page"),
        () => import("../src/app/regattas/[regattaId]/events/[eventId]/page"),
        () => import("../src/app/races/[raceKey]/page"),
        () => import("../src/app/schools/page"),
        () => import("../src/app/schools/[schoolId]/page"),
        () => import("../src/app/data-sources/page"),
        () => import("../src/app/corrections-and-removals/page"),
    ])("requires access before constructing a repository or rendering catalog content", async (load) =>
    {
        const page = await load();
        await expect(page.default({ params, searchParams })).rejects.toThrow("ACCESS_REQUIRED");
        expect(mocks.requireAccess).toHaveBeenCalled();
        expect(mocks.repository).not.toHaveBeenCalled();
        expect(mocks.database).not.toHaveBeenCalled();
    });
});

describe("direct media and callback requests", () =>
{
    it("denies the live feed before reading its private state", async () =>
    {
        mocks.readFile.mockClear();
        const { GET } = await import("../src/app/api/live/route");
        const response = await GET(new Request("http://localhost/api/live"));
        expect(response.status).toBe(401);
        expect(mocks.readFile).not.toHaveBeenCalled();
        mocks.checkAccess.mockResolvedValueOnce({ state: "denied" });
        expect((await GET(new Request("http://localhost/api/live"))).status).toBe(403);
    });
    it("denies media without opening the database or filesystem", async () =>
    {
        const { GET } = await import("../src/app/protected-media/[assetId]/route");
        const response = await GET(new Request("http://localhost/protected-media/asset"), {
            params: Promise.resolve({ assetId: "asset" }),
        });
        expect(response.status).toBe(401);
        expect(await response.text()).toBe("");
        expect(response.headers.get("Cache-Control")).toContain("no-store");
        expect(mocks.database).not.toHaveBeenCalled();
        mocks.checkAccess.mockResolvedValueOnce({ state: "denied" });
        expect(
            (await GET(new Request("http://localhost/protected-media/asset"), {
                params: Promise.resolve({ assetId: "asset" }),
            })).status,
        ).toBe(403);
    });
    it("serves only the authenticated content-addressed crest with matching bytes", async () =>
    {
        const content = Buffer.from("review crest bytes");
        const sha256 = createHash("sha256").update(content).digest("hex");
        const assetId = "00000000-0000-4000-8000-000000000009";
        const asset = {
            id: assetId,
            visibility: "private_beta",
            rightsStatus: "official_source_unlicensed",
            removedAt: null,
            mimeType: "image/png",
            storageKey: `school-crests/${sha256}.png`,
            sha256,
            byteSize: content.byteLength,
        };
        const release = {
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
        process.env.MEDIA_ROOT = "C:\\private-media";
        mocks.checkAccess.mockResolvedValue({
            state: "allowed",
            access: { userId: "user-1", name: "Viewer", role: "viewer" },
        });
        mocks.database.mockReturnValue(mediaDatabase(asset, release));
        mocks.realpath.mockImplementation(async (value: string) => value);
        mocks.readFile.mockResolvedValue(content);

        const { GET } = await import("../src/app/protected-media/[assetId]/route");
        const response = await GET(
            new Request(`http://localhost/protected-media/${assetId}`),
            { params: Promise.resolve({ assetId }) },
        );
        expect(response.status).toBe(200);
        expect(Buffer.from(await response.arrayBuffer())).toEqual(content);
        expect(response.headers.get("Content-Type")).toBe("image/png");
        expect(response.headers.get("Content-Security-Policy")).toContain("sandbox");
        expect(response.headers.get("Cross-Origin-Resource-Policy")).toBe("same-origin");

        mocks.database.mockReturnValue(mediaDatabase(asset, release));
        mocks.readFile.mockResolvedValue(Buffer.from("corrupt crest bytes"));
        const corrupt = await GET(
            new Request(`http://localhost/protected-media/${assetId}`),
            { params: Promise.resolve({ assetId }) },
        );
        expect(corrupt.status).toBe(404);
        expect(await corrupt.text()).toBe("");
    });
    it("redirects a denied callback to a generic sign-in failure", async () =>
    {
        const { GET } = await import("../src/app/auth/callback/route");
        const response = await GET(new Request("http://localhost/auth/callback?returnTo=//outside.example"));
        expect(response.status).toBe(303);
        expect(response.headers.get("Location")).toBe("/sign-in?error=access");
        expect(await response.text()).toBe("");
    });
    it("returns an accepted callback only to a supported same-origin path", async () =>
    {
        const { GET } = await import("../src/app/auth/callback/route");
        mocks.checkAccess.mockResolvedValue({
            state: "allowed",
            access: { userId: "user-1", name: "Viewer", role: "viewer" },
        });
        const response = await GET(new Request("http://localhost/auth/callback?returnTo=%2Fraces%2Frace-1"));
        expect(response.headers.get("Location")).toBe("/races/race-1");
        const unsafe = await GET(new Request("http://localhost/auth/callback?returnTo=//outside.example"));
        expect(unsafe.headers.get("Location")).toBe("/regattas");
    });
});
