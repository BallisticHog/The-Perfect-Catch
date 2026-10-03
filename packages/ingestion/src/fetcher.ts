import type { StoredDocument } from "@the-perfect-catch/db";
import { createHash } from "node:crypto";
import { canonicalSourceUrl, decodeHtml } from "./parser";

export interface FetchObservation
{
    url: string;
    statusCode: number | null;
    headers: Record<string, string>;
    fetchedAt: Date;
    document: StoredDocument | null;
    error: string | null;
}

export interface FetchResult
{
    statusCode: number;
    headers: Record<string, string>;
    document: StoredDocument | null;
    observations: FetchObservation[];
}

export class SourceFetchError extends Error
{
    constructor(message: string, readonly observations: FetchObservation[])
    {
        super(message);
        this.name = "SourceFetchError";
    }
}

interface FetcherOptions
{
    approveUrl?: (value: string, base?: string) => string;
    fetchImpl?: typeof fetch;
    minimumIntervalMs?: number;
    timeoutMs?: number;
    maxBytes?: number;
    userAgent?: string;
    sleep?: (ms: number) => Promise<void>;
    now?: () => number;
}

export class SourceFetcher
{
    private queue: Promise<void> = Promise.resolve();
    private nextRequestAt = 0;

    constructor(private readonly options: FetcherOptions = {})
    {
    }

    async fetch(
        url: string,
        previous?: { responseHeaders: Record<string, string>; } | null,
    ): Promise<FetchResult>
    {
        const approvedUrl = (this.options.approveUrl ?? canonicalSourceUrl)(url);
        const operation = this.queue.then(() => this.fetchSerially(approvedUrl, previous));
        this.queue = operation.then(() => undefined, () => undefined);
        return operation;
    }

    private async fetchSerially(
        approvedUrl: string,
        previous?: { responseHeaders: Record<string, string>; } | null,
    ): Promise<FetchResult>
    {
        const now = this.options.now ?? Date.now;
        const sleep = this.options.sleep
            ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
        const userAgent = this.options.userAgent ?? process.env.REGATTA_RESULTS_USER_AGENT;
        const observations: FetchObservation[] = [];
        if (!userAgent || !/(?:mailto:|https?:\/\/|@)/i.test(userAgent) || /[\r\n]/.test(userAgent))
        {
            throw new SourceFetchError(
                "REGATTA_RESULTS_USER_AGENT must identify the importer and include a contact URL or email",
                observations,
            );
        }
        const headers: Record<string, string> = { Accept: "text/html", "User-Agent": userAgent };
        if (previous?.responseHeaders.etag)
        {
            headers["If-None-Match"] = previous.responseHeaders.etag;
        }
        if (previous?.responseHeaders["last-modified"])
        {
            headers["If-Modified-Since"] = previous.responseHeaders["last-modified"];
        }
        let requestUrl = approvedUrl;
        let redirects = 0;
        let retries = 0;
        while (true)
        {
            const wait = this.nextRequestAt - now();
            if (wait > 0)
            {
                await sleep(wait);
            }
            this.nextRequestAt = now() + Math.max(this.options.minimumIntervalMs ?? 1500, 1000);
            const fetchedAt = new Date(now());
            let response: Response;
            try
            {
                response = await (this.options.fetchImpl ?? fetch)(requestUrl, {
                    headers,
                    redirect: "manual",
                    signal: AbortSignal.timeout(this.options.timeoutMs ?? 20_000),
                });
            }
            catch (error)
            {
                const message = error instanceof Error ? error.message : "Source request failed";
                observations.push({
                    url: requestUrl,
                    statusCode: null,
                    headers: {},
                    fetchedAt,
                    document: null,
                    error: message,
                });
                if (++retries > 2)
                {
                    throw new SourceFetchError(message, observations);
                }
                this.nextRequestAt = Math.max(this.nextRequestAt, now() + 2000 * retries);
                continue;
            }
            const responseHeaders = Object.fromEntries(response.headers.entries());
            let document: StoredDocument | null = null;
            try
            {
                if (response.ok && response.status !== 304)
                {
                    const rawBytes = await this.readBody(response);
                    if (!rawBytes.length)
                    {
                        throw new Error("Source returned an empty body");
                    }
                    const decoded = decodeHtml(rawBytes, response.headers.get("content-type") ?? "");
                    document = {
                        sourceKey: createHash("sha256").update(approvedUrl).digest("hex"),
                        url: approvedUrl,
                        rawBytes,
                        decodedHtml: decoded.html,
                        encoding: decoded.encoding,
                        sha256: createHash("sha256").update(rawBytes).digest("hex"),
                        responseHeaders,
                    };
                }
                else if (response.status !== 304)
                {
                    await response.body?.cancel();
                }
            }
            catch (error)
            {
                const message = error instanceof Error ? error.message : "Source body could not be archived";
                observations.push({
                    url: requestUrl,
                    statusCode: response.status,
                    headers: responseHeaders,
                    fetchedAt,
                    document: null,
                    error: message,
                });
                throw new SourceFetchError(message, observations);
            }
            observations.push({
                url: requestUrl,
                statusCode: response.status,
                headers: responseHeaders,
                fetchedAt,
                document,
                error: response.ok || response.status === 304 ? null : `Source HTTP ${response.status}`,
            });
            if ([301, 302, 303, 307, 308].includes(response.status))
            {
                try
                {
                    if (++redirects > 3 || !response.headers.get("location"))
                    {
                        throw new Error("Source redirect limit exceeded or missing Location");
                    }
                    requestUrl = (this.options.approveUrl ?? canonicalSourceUrl)(
                        response.headers.get("location")!,
                        requestUrl,
                    );
                }
                catch (error)
                {
                    throw new SourceFetchError(
                        error instanceof Error ? error.message : "Invalid source redirect",
                        observations,
                    );
                }
                continue;
            }
            if ([429, 502, 503, 504].includes(response.status) && retries < 2)
            {
                retries++;
                const retry = response.headers.get("retry-after");
                let delay = 2000 * retries;
                if (retry && /^\d+$/.test(retry))
                {
                    delay = Number(retry) * 1000;
                }
                else if (retry)
                {
                    delay = Date.parse(retry) - now();
                }
                const safeDelay = Math.max(Number.isFinite(delay) ? delay : 2000, 1000);
                if (safeDelay > 300_000)
                {
                    throw new SourceFetchError(
                        "Source requested a long Retry-After; retry the import later",
                        observations,
                    );
                }
                this.nextRequestAt = Math.max(this.nextRequestAt, now() + safeDelay);
                continue;
            }
            return { statusCode: response.status, headers: responseHeaders, document, observations };
        }
    }

    private async readBody(response: Response): Promise<Buffer>
    {
        const limit = this.options.maxBytes ?? 2_000_000;
        if (Number(response.headers.get("content-length")) > limit)
        {
            await response.body?.cancel();
            throw new Error("Source response exceeds size limit");
        }
        const reader = response.body?.getReader();
        if (!reader)
        {
            return Buffer.alloc(0);
        }
        const chunks: Uint8Array[] = [];
        let length = 0;
        while (true)
        {
            const chunk = await reader.read();
            if (chunk.done)
            {
                break;
            }
            length += chunk.value.byteLength;
            if (length > limit)
            {
                await reader.cancel();
                throw new Error("Source response exceeds size limit");
            }
            chunks.push(chunk.value);
        }
        return Buffer.concat(chunks);
    }
}
