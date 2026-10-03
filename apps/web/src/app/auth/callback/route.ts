import { checkCatalogAccess, privateHeaders } from "@/lib/authorization";
import { safeReturnPath } from "@/lib/return-path";

export async function GET(request: Request): Promise<Response>
{
    const access = await checkCatalogAccess(request.headers);
    const returnTo = safeReturnPath(new URL(request.url).searchParams.get("returnTo"));
    if (access.state !== "allowed")
    {
        return new Response(null, {
            status: 303,
            headers: { ...privateHeaders(), Location: "/sign-in?error=access" },
        });
    }
    return new Response(null, { status: 303, headers: { ...privateHeaders(), Location: returnTo } });
}
