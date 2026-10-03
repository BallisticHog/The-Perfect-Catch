import { AlertTriangle, RefreshCw } from "lucide-react";

export interface SourceRefreshState
{
    status: "running" | "validated" | "published" | "unchanged" | "failed";
    startedAt: Date;
    finishedAt: Date | null;
}

export function sourceRefreshMessage(
    refresh: SourceRefreshState | null,
    publishedAt: Date | string | null | undefined,
): string | null
{
    if (!refresh)
    {
        return null;
    }
    if (refresh.status === "running")
    {
        return "A source refresh is in progress. The last reviewed results remain available.";
    }
    if (
        refresh.status === "failed"
        && publishedAt
        && refresh.startedAt.getTime() > new Date(publishedAt).getTime()
    )
    {
        return "The latest source refresh failed. These are the last reviewed results, which remain unchanged.";
    }
    return null;
}

export function SourceRefreshNotice(
    { refresh, publishedAt }: {
        refresh: SourceRefreshState | null;
        publishedAt: Date | string | null | undefined;
    },
)
{
    const message = sourceRefreshMessage(refresh, publishedAt);
    if (!message)
    {
        return null;
    }
    return (
        <aside className="source-refresh-notice" role="status">
            {refresh?.status === "running"
                ? <RefreshCw aria-hidden="true" />
                : <AlertTriangle aria-hidden="true" />}
            <span>{message}</span>
        </aside>
    );
}
