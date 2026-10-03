import type { StoredDocument } from "@the-perfect-catch/db";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface SnapshotArchiveContext
{
    fetchedAt: Date;
    responseHeaders: Record<string, string>;
}

export interface SnapshotArchive
{
    archive(document: StoredDocument, context: SnapshotArchiveContext): Promise<void>;
}

async function writeBytesOnce(filePath: string, content: Buffer): Promise<void>
{
    try
    {
        await writeFile(filePath, content, { flag: "wx", mode: 0o600 });
    }
    catch (error)
    {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST")
        {
            throw error;
        }
        const existing = await readFile(filePath);
        if (!existing.equals(content))
        {
            throw new Error("Content-addressed source object does not match its existing bytes");
        }
    }
}

export class FileSnapshotArchive implements SnapshotArchive
{
    private readonly root: string;

    constructor(root: string)
    {
        if (!root.trim())
        {
            throw new Error("SNAPSHOT_ROOT is required for the private source archive");
        }
        this.root = path.resolve(root);
    }

    async archive(document: StoredDocument, context: SnapshotArchiveContext): Promise<void>
    {
        if (!/^[0-9a-f]{64}$/.test(document.sourceKey) || !/^[0-9a-f]{64}$/.test(document.sha256))
        {
            throw new Error("Source archive keys must be lowercase SHA-256 values");
        }
        const objectDirectory = path.join(this.root, "objects", document.sha256.slice(0, 2));
        const recordDirectory = path.join(this.root, "records", document.sourceKey);
        await Promise.all([
            mkdir(objectDirectory, { recursive: true, mode: 0o700 }),
            mkdir(recordDirectory, { recursive: true, mode: 0o700 }),
        ]);
        await writeBytesOnce(path.join(objectDirectory, `${document.sha256}.bin`), document.rawBytes);

        const recordPath = path.join(recordDirectory, `${document.sha256}.json`);
        const record = {
            sourceKey: document.sourceKey,
            canonicalUrl: document.url,
            sha256: document.sha256,
            encoding: document.encoding,
            firstObservedAt: context.fetchedAt.toISOString(),
            responseHeaders: Object.fromEntries(
                Object.entries(context.responseHeaders).sort(([left], [right]) => left.localeCompare(right)),
            ),
        };
        try
        {
            await writeFile(recordPath, `${JSON.stringify(record, null, 2)}\n`, { flag: "wx", mode: 0o600 });
        }
        catch (error)
        {
            if ((error as NodeJS.ErrnoException).code !== "EEXIST")
            {
                throw error;
            }
            const existing = JSON.parse(await readFile(recordPath, "utf8")) as Partial<typeof record>;
            if (
                existing.sourceKey !== document.sourceKey || existing.sha256 !== document.sha256
                || existing.canonicalUrl !== document.url
            )
            {
                throw new Error("Source archive record does not match its content address");
            }
        }
    }
}
