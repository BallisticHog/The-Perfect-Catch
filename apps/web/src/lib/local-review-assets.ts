import "server-only";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

interface LocalReviewAsset
{
    id: string;
    storageKey: string;
    mimeType: string;
    byteSize: number;
    sha256: string;
}

interface LocalReviewMediaManifest
{
    assets: LocalReviewAsset[];
}

function dataRoot(): string | null
{
    if (process.env.CATCH_USE_FULL_LOCAL_CATALOG !== "true")
    {
        return null;
    }
    const candidates = [
        process.env.CATCH_LOCAL_DATA_ROOT,
        path.resolve(process.cwd(), ".data"),
        path.resolve(process.cwd(), "../../.data"),
    ].filter((candidate): candidate is string => Boolean(candidate));
    return candidates.find((candidate) => existsSync(path.join(candidate, "local-review-media.json")))
        ?? null;
}

export async function readLocalReviewAsset(assetId: string)
{
    const root = dataRoot();
    if (!root)
    {
        return null;
    }
    const manifest = JSON.parse(
        await readFile(path.join(root, "local-review-media.json"), "utf8"),
    ) as LocalReviewMediaManifest;
    const asset = manifest.assets.find((candidate) => candidate.id === assetId);
    if (!asset || asset.mimeType !== "image/png" || !/^[a-f0-9]{64}\.png$/i.test(asset.storageKey))
    {
        return null;
    }
    const mediaRoot = await realpath(path.join(root, "local-review-media"));
    const candidate = await realpath(path.resolve(mediaRoot, asset.storageKey));
    const relative = path.relative(mediaRoot, candidate);
    if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
    {
        return null;
    }
    const content = await readFile(candidate);
    if (
        content.byteLength !== asset.byteSize
        || createHash("sha256").update(content).digest("hex") !== asset.sha256
    )
    {
        return null;
    }
    return { content, mimeType: asset.mimeType };
}
