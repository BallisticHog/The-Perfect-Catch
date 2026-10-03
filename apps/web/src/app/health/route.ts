export function GET(): Response
{
    return Response.json({ status: "ok" }, {
        headers: { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" },
    });
}
