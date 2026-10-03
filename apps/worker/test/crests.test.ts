import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterEach, describe, expect, it, vi } from "vitest";
import { inspectCrestFile, maximumCrestBytes, storeCrestFile } from "../src/crest-file";
import {
    type CrestRegistration,
    type CrestStore,
    type CrestTransaction,
    registerCrest,
    removeCrest,
} from "../src/crests";

const directories: string[] = [];
async function temporaryDirectory(): Promise<string>
{
    const directory = await mkdtemp(path.join(tmpdir(), "catch-crest-test-"));
    directories.push(directory);
    return directory;
}

afterEach(async () =>
{
    await Promise.all(
        directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
    );
});

function storeFixture()
{
    const tx: CrestTransaction = {
        requireAdmin: vi.fn(async () => "admin-user"),
        requireSchool: vi.fn(async () => undefined),
        register: vi.fn(async () => "asset-id"),
        remove: vi.fn(async () => undefined),
    };
    const store: CrestStore = { transaction: async (work) => work(tx) };
    return { tx, store };
}

describe("reviewed server crest files", () =>
{
    it.each(["png", "jpeg", "webp"] as const)(
        "decodes %s bytes independent of the supplied extension and preserves them",
        async (format) =>
        {
            const directory = await temporaryDirectory();
            const file = path.join(directory, "misleading.svg");
            const bytes = await sharp({ create: { width: 20, height: 30, channels: 3, background: "navy" } })
                .toFormat(format).toBuffer();
            await writeFile(file, bytes);
            const crest = await inspectCrestFile(file);
            expect(crest).toMatchObject({ mimeType: `image/${format}`, width: 20, height: 30 });
            expect(crest.bytes.equals(bytes)).toBe(true);
            const key = await storeCrestFile(directory, crest);
            expect(key).toBe(`crests/${crest.sha256}.${format === "jpeg" ? "jpg" : format}`);
            expect((await readFile(path.join(directory, key))).equals(bytes)).toBe(true);
            expect(await storeCrestFile(directory, crest)).toBe(key);
            expect(await readdir(path.join(directory, "crests"))).toEqual([path.basename(key)]);
        },
    );

    it("rejects non-images, SVG, relative paths, oversized files, and corrupt image data", async () =>
    {
        const directory = await temporaryDirectory();
        const file = path.join(directory, "crest.png");
        await expect(inspectCrestFile("../crest.png")).rejects.toThrow("absolute");
        await writeFile(file, "not an image");
        await expect(inspectCrestFile(file)).rejects.toThrow();
        await writeFile(
            file,
            "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"10\" height=\"10\"><rect width=\"10\" height=\"10\"/></svg>",
        );
        await expect(inspectCrestFile(file)).rejects.toThrow("PNG, JPEG, or WebP");
        await writeFile(file, Buffer.alloc(maximumCrestBytes + 1));
        await expect(inspectCrestFile(file)).rejects.toThrow("5 MiB");
        const png = await sharp({ create: { width: 20, height: 20, channels: 3, background: "navy" } }).png()
            .toBuffer();
        await writeFile(file, png.subarray(0, png.length - 24));
        await expect(inspectCrestFile(file)).rejects.toThrow();
    });

    it("does not overwrite a conflicting content-addressed file", async () =>
    {
        const directory = await temporaryDirectory();
        const file = path.join(directory, "source.png");
        await writeFile(
            file,
            await sharp({ create: { width: 4, height: 4, channels: 3, background: "navy" } }).png()
                .toBuffer(),
        );
        const crest = await inspectCrestFile(file);
        const key = await storeCrestFile(directory, crest);
        await writeFile(path.join(directory, key), "conflict");
        await expect(storeCrestFile(directory, crest)).rejects.toThrow("does not match");
        expect(await readFile(path.join(directory, key), "utf8")).toBe("conflict");
        expect(await readdir(path.join(directory, "crests"))).toEqual([path.basename(key)]);
    });
});

describe("crest administration", () =>
{
    const input: CrestRegistration = {
        schoolId: "st-dunstans-college",
        inputFile: "",
        mediaRoot: "",
        officialSourceUrl: "https://stdunstans.co.za/vision",
        acquiredAt: "2026-03-10T12:00:00Z",
        rightsNotes:
            "Official source reviewed for provisional private beta only; no reuse permission established",
        attribution: "St Dunstan's College",
        altText: "St Dunstan's College crest",
        reviewed: true,
    };

    it("checks current admin before reading files or modifying associations and again before registration", async () =>
    {
        const { store, tx } = storeFixture();
        vi.mocked(tx.requireAdmin).mockRejectedValueOnce(new Error("administrator required"));
        await expect(registerCrest(store, "revoked-session", input)).rejects.toThrow("administrator");
        expect(tx.requireSchool).not.toHaveBeenCalled();
        expect(tx.register).not.toHaveBeenCalled();
        const directory = await temporaryDirectory();
        const file = path.join(directory, "source.png");
        await writeFile(
            file,
            await sharp({ create: { width: 4, height: 4, channels: 3, background: "navy" } }).png()
                .toBuffer(),
        );
        expect(
            await registerCrest(store, "admin-session", { ...input, inputFile: file, mediaRoot: directory }),
        ).toBe("asset-id");
        expect(tx.requireAdmin).toHaveBeenCalledTimes(3);
        expect(tx.register).toHaveBeenCalledWith(
            expect.objectContaining({ schoolId: input.schoolId }),
            expect.objectContaining({ mimeType: "image/png", width: 4 }),
            expect.stringMatching(/^crests\/[0-9a-f]{64}\.png$/),
            "admin-user",
        );
    });

    it("requires human review, official source provenance, and acquisition/rights metadata", async () =>
    {
        for (
            const invalid of [
                { reviewed: false },
                { rightsNotes: "" },
                { officialSourceUrl: "http://example.com/crest" },
                { officialSourceUrl: "https://user:pass@example.com/crest" },
                { acquiredAt: "not-a-date" },
            ]
        )
        {
            const { store, tx } = storeFixture();
            await expect(registerCrest(store, "admin-session", { ...input, ...invalid })).rejects.toThrow();
            expect(tx.register).not.toHaveBeenCalled();
        }
    });

    it("denies takedown to a revoked admin and records an authorized reason", async () =>
    {
        const { store, tx } = storeFixture();
        const assetId = "00000000-0000-4000-8000-000000000001";
        vi.mocked(tx.requireAdmin).mockRejectedValueOnce(new Error("administrator required"));
        await expect(removeCrest(store, "revoked-session", assetId, "Rights review")).rejects.toThrow(
            "administrator",
        );
        expect(tx.remove).not.toHaveBeenCalled();
        await expect(removeCrest(store, "admin-session", assetId, " ")).rejects.toThrow("reason");
        await removeCrest(store, "admin-session", assetId, " Rights review ");
        expect(tx.remove).toHaveBeenCalledWith(assetId, "Rights review", "admin-user");
    });
});
