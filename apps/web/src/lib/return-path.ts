export function safeReturnPath(value: unknown): string
{
    if (
        typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")
        || /[\\\u0000-\u001f]/.test(value)
    )
    {
        return "/regattas";
    }
    const path = value.split("?")[0] ?? "";
    if (!/^\/(?:regattas|races|schools|data-sources|corrections-and-removals)(?:\/|$)/.test(path))
    {
        return "/regattas";
    }
    return value;
}
