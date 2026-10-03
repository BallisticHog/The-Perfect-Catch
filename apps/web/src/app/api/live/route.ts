import { checkCatalogAccess, privateHeaders } from "@/lib/authorization";
import { readLiveState } from "@/lib/live";

export const dynamic = "force-dynamic";

export async function GET(request: Request)
{
    const access = await checkCatalogAccess(request.headers);
    if (access.state !== "allowed")
    {
        return new Response(null, {
            status: access.state === "denied" ? 403 : 401,
            headers: privateHeaders(),
        });
    }
    try
    {
        return Response.json(await readLiveState(), { headers: privateHeaders() });
    }
    catch
    {
        return Response.json({ error: "Live updates are temporarily unavailable" }, {
            status: 503,
            headers: privateHeaders(),
        });
    }
}
