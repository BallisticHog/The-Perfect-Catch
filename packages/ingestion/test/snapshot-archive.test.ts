import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FileSnapshotArchive } from "../src/snapshot-archive";

const temporaryRoots: string[] = [];

afterEach(async () =>
{
    await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("private content-addressed source archive", () =>
{
    it("stores exact bytes and immutable provenance without duplicating a repeated snapshot", async () =>
    {
        const root = await mkdtemp(path.join(tmpdir(), "catch-snapshots-"));
        temporaryRoots.push(root);
        const rawBytes = Buffer.from([0x41, 0x92, 0x42]);
        const sha256 = createHash("sha256").update(rawBytes).digest("hex");
        const sourceKey = createHash("sha256").update("source-url").digest("hex");
        const document = {
            sourceKey,
            url: "https://www.regattaresults.co.za/Results/Results2026/2026-Feb-SASChamps/1_SF%201.htm",
            sha256,
            rawBytes,
            decodedHtml: "A\u2019B",
            encoding: "windows-1252",
            responseHeaders: { etag: "race-A" },
        };
        const archive = new FileSnapshotArchive(root);
        await archive.archive(document, {
            fetchedAt: new Date("2026-03-08T14:53:54Z"),
            responseHeaders: document.responseHeaders,
        });
        await archive.archive(document, {
            fetchedAt: new Date("2026-03-09T00:00:00Z"),
            responseHeaders: { etag: "race-A", date: "later" },
        });
        expect(await readFile(path.join(root, "objects", sha256.slice(0, 2), `${sha256}.bin`))).toEqual(
            rawBytes,
        );
        const record = JSON.parse(
            await readFile(path.join(root, "records", sourceKey, `${sha256}.json`), "utf8"),
        );
        expect(record).toMatchObject({
            sourceKey,
            sha256,
            encoding: "windows-1252",
            firstObservedAt: "2026-03-08T14:53:54.000Z",
        });
    });

    it("fails closed when an existing content address contains different bytes", async () =>
    {
        const root = await mkdtemp(path.join(tmpdir(), "catch-snapshots-"));
        temporaryRoots.push(root);
        const rawBytes = Buffer.from("expected");
        const sha256 = createHash("sha256").update(rawBytes).digest("hex");
        const sourceKey = createHash("sha256").update("source-url").digest("hex");
        const objectDirectory = path.join(root, "objects", sha256.slice(0, 2));
        const archive = new FileSnapshotArchive(root);
        await archive.archive({
            sourceKey,
            url: "https://www.regattaresults.co.za/Results/Results2026/2026-Feb-SASChamps/results.htm",
            sha256,
            rawBytes,
            decodedHtml: "expected",
            encoding: "windows-1252",
            responseHeaders: {},
        }, { fetchedAt: new Date(), responseHeaders: {} });
        await writeFile(path.join(objectDirectory, `${sha256}.bin`), "tampered");
        await expect(
            archive.archive({
                sourceKey,
                url: "https://www.regattaresults.co.za/Results/Results2026/2026-Feb-SASChamps/results.htm",
                sha256,
                rawBytes,
                decodedHtml: "expected",
                encoding: "windows-1252",
                responseHeaders: {},
            }, { fetchedAt: new Date(), responseHeaders: {} }),
        ).rejects.toThrow("does not match");
    });
});
