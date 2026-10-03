import { checkCatalogAccess, privateHeaders } from "@/lib/authorization";
import { getDatabase } from "@/lib/database";
import { readLocalReviewAsset } from "@/lib/local-review-assets";
import { isLocalReviewAccess } from "@/lib/local-review-mode";
import { canServeMedia } from "@/lib/media-policy";
import { schema } from "@the-perfect-catch/db";
import { eq } from "drizzle-orm";
import { createHash } from "node:crypto";
import { readFile, realpath } from "node:fs/promises";
import path from "node:path";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ assetId: string; }>; },
): Promise<Response>
{
    const access = await checkCatalogAccess(request.headers);
    if (access.state !== "allowed")
    {
        return new Response(null, {
            status: access.state === "unauthenticated" ? 401 : 403,
            headers: privateHeaders(),
        });
    }
    const { assetId } = await params;
    if (!/^[a-f0-9-]{36}$/i.test(assetId))
    {
        return new Response(null, { status: 404, headers: privateHeaders() });
    }
    if (isLocalReviewAccess(access.access))
    {
        try
        {
            const asset = await readLocalReviewAsset(assetId);
            return asset
                ? new Response(asset.content, {
                    headers: {
                        ...privateHeaders(),
                        "Content-Type": asset.mimeType,
                        "Content-Length": String(asset.content.byteLength),
                        "Content-Security-Policy": "default-src 'none'; sandbox",
                        "Cross-Origin-Resource-Policy": "same-origin",
                    },
                })
                : new Response(null, { status: 404, headers: privateHeaders() });
        }
        catch
        {
            return new Response(null, { status: 404, headers: privateHeaders() });
        }
    }
    const db = getDatabase();
    const [[asset], [release]] = await Promise.all([
        db.select().from(schema.mediaAssets).where(eq(schema.mediaAssets.id, assetId)).limit(1),
        db.select().from(schema.siteReleaseState).where(eq(schema.siteReleaseState.id, "global")).limit(1),
    ]);
    if (
        !asset || !canServeMedia(asset, release ?? null, process.env.SITE_PUBLIC_RELEASE_ENABLED === "true")
        || !process.env.MEDIA_ROOT || !/^(image\/(png|jpeg|webp))$/.test(asset.mimeType)
        || path.parse(asset.storageKey).name.toLowerCase() !== asset.sha256.toLowerCase()
    )
    {
        return new Response(null, { status: 404, headers: privateHeaders() });
    }
    try
    {
        const root = await realpath(process.env.MEDIA_ROOT);
        const candidate = await realpath(path.resolve(root, asset.storageKey));
        const relative = path.relative(root, candidate);
        if (!relative || relative.startsWith("..") || path.isAbsolute(relative))
        {
            return new Response(null, { status: 404, headers: privateHeaders() });
        }
        const content = await readFile(candidate);
        if (
            content.byteLength !== asset.byteSize
            || createHash("sha256").update(content).digest("hex") !== asset.sha256.toLowerCase()
        )
        {
            return new Response(null, { status: 404, headers: privateHeaders() });
        }
        return new Response(content, {
            headers: {
                ...privateHeaders(),
                "Content-Type": asset.mimeType,
                "Content-Length": String(content.byteLength),
                "Content-Security-Policy": "default-src 'none'; sandbox",
                "Cross-Origin-Resource-Policy": "same-origin",
            },
        });
    }
    catch
    {
        return new Response(null, { status: 404, headers: privateHeaders() });
    }
}
