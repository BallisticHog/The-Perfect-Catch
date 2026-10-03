import { createHash, randomUUID } from "node:crypto";
import { link, lstat, mkdir, open, readFile, realpath, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const maximumCrestBytes = 5 * 1024 * 1024;
export const maximumCrestPixels = 16_000_000;

export interface ReviewedCrest
{
    bytes: Buffer;
    sha256: string;
    mimeType: string;
    extension: string;
    width: number;
    height: number;
}

export async function inspectCrestFile(inputPath: string): Promise<ReviewedCrest>
{
    if (!path.isAbsolute(inputPath))
    {
        throw new Error("CREST_INPUT_FILE must be an absolute trusted server path");
    }
    const source = await lstat(inputPath);
    if (!source.isFile() || source.isSymbolicLink() || source.size < 1 || source.size > maximumCrestBytes)
    {
        throw new Error("Crest must be a regular file between 1 byte and 5 MiB");
    }
    const handle = await open(inputPath, "r");
    let bytes: Buffer;
    try
    {
        // Bound allocation and reads even if an operator replaces or grows the file.
        const opened = await handle.stat();
        if (!opened.isFile() || opened.dev !== source.dev || opened.ino !== source.ino)
        {
            throw new Error("Crest source changed while opening");
        }
        const buffer = Buffer.alloc(maximumCrestBytes + 1);
        let size = 0;
        while (size < buffer.length)
        {
            const result = await handle.read(buffer, size, buffer.length - size, null);
            if (result.bytesRead === 0)
            {
                break;
            }
            size += result.bytesRead;
        }
        if (size < 1 || size > maximumCrestBytes)
        {
            throw new Error("Crest must be between 1 byte and 5 MiB");
        }
        bytes = buffer.subarray(0, size);
    }
    finally
    {
        await handle.close();
    }
    const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const webp = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    if (!png && !jpeg && !webp)
    {
        throw new Error("Crest must be a PNG, JPEG, or WebP image");
    }
    const decoder = sharp(bytes, { failOn: "warning", limitInputPixels: maximumCrestPixels });
    const metadata = await decoder.metadata();
    const extension = metadata.format === "jpeg" ? "jpg" : metadata.format;
    if (
        !extension || !["png", "jpg", "webp"].includes(extension) || !metadata.width || !metadata.height
        || metadata.width * metadata.height > maximumCrestPixels || (metadata.pages ?? 1) !== 1
    )
    {
        throw new Error("Crest must be a single PNG, JPEG, or WebP image within 16 million pixels");
    }
    // Fully decode to reject truncated or corrupt pixels; preserve the original source bytes.
    await decoder.raw().toBuffer();
    return {
        bytes,
        sha256: createHash("sha256").update(bytes).digest("hex"),
        mimeType: `image/${metadata.format}`,
        extension,
        width: metadata.width,
        height: metadata.height,
    };
}

export async function storeCrestFile(mediaRoot: string, crest: ReviewedCrest): Promise<string>
{
    if (!path.isAbsolute(mediaRoot))
    {
        throw new Error("MEDIA_ROOT must be an absolute private server directory");
    }
    if (
        !/^[0-9a-f]{64}$/.test(crest.sha256) || !["png", "jpg", "webp"].includes(crest.extension)
        || createHash("sha256").update(crest.bytes).digest("hex") !== crest.sha256
    )
    {
        throw new Error("Invalid inspected crest content");
    }
    const root = await realpath(mediaRoot);
    const directory = path.join(root, "crests");
    await mkdir(directory, { recursive: true, mode: 0o700 });
    if ((await lstat(directory)).isSymbolicLink() || await realpath(directory) !== directory)
    {
        throw new Error("Crest storage directory must not redirect outside the media root");
    }
    const storageKey = `crests/${crest.sha256}.${crest.extension}`;
    const destination = path.join(root, storageKey);
    const temporary = path.join(directory, `.pending-${randomUUID()}`);
    const handle = await open(temporary, "wx", 0o600);
    try
    {
        try
        {
            await handle.writeFile(crest.bytes);
            await handle.sync();
        }
        finally
        {
            await handle.close();
        }
        try
        {
            // A same-volume hard link publishes complete bytes atomically without overwriting.
            await link(temporary, destination);
        }
        catch (error)
        {
            if ((error as NodeJS.ErrnoException).code !== "EEXIST")
            {
                throw error;
            }
            const existing = await lstat(destination);
            if (
                !existing.isFile() || existing.isSymbolicLink() || existing.size !== crest.bytes.length
                || !crest.bytes.equals(await readFile(destination))
            )
            {
                throw new Error("Existing content-addressed crest does not match reviewed bytes");
            }
        }
    }
    finally
    {
        await unlink(temporary);
    }
    return storageKey;
}
