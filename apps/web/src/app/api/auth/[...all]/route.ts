import { getAuth } from "@/lib/auth";
import { privateHeaders } from "@/lib/authorization";
import { toNextJsHandler } from "better-auth/next-js";

async function handler(request: Request): Promise<Response>
{
    let handlers: ReturnType<typeof toNextJsHandler>;
    try
    {
        handlers = toNextJsHandler(getAuth());
    }
    catch
    {
        return Response.json({ error: "Authentication is temporarily unavailable." }, {
            status: 503,
            headers: privateHeaders(),
        });
    }
    const response = await handlers[request.method === "GET" ? "GET" : "POST"](request);
    for (const [key, value] of Object.entries(privateHeaders()))
    {
        response.headers.set(key, value);
    }
    return response;
}

export { handler as GET, handler as POST };
