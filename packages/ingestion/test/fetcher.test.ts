import { CHAMPIONSHIP } from "@the-perfect-catch/domain";
import { describe, expect, it, vi } from "vitest";
import { SourceFetcher, SourceFetchError } from "../src/fetcher";

describe("polite conditional source fetching", () =>
{
    it("retains response bytes and validators and accepts 304 without decoding an empty body", async () =>
    {
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(
            new Response(Buffer.from([0x41, 0x92, 0x42]), {
                headers: { "content-type": "text/html; charset=windows-1252", etag: "source-v1" },
            }),
        ).mockResolvedValueOnce(new Response(null, { status: 304, headers: { etag: "source-v1" } }));
        const sleep = vi.fn(async () => undefined);
        const fetcher = new SourceFetcher({
            fetchImpl,
            sleep,
            now: () => 0,
            userAgent: "ArchiveTest/1 (mailto:test@example.test)",
        });
        const first = await fetcher.fetch(CHAMPIONSHIP.sourceUrl);
        expect(first.document?.rawBytes).toEqual(Buffer.from([0x41, 0x92, 0x42]));
        expect(first.document?.decodedHtml).toBe("A\u2019B");
        const second = await fetcher.fetch(CHAMPIONSHIP.sourceUrl, first.document);
        expect(second.statusCode).toBe(304);
        expect(second.document).toBeNull();
        expect(fetchImpl.mock.calls[1][1]?.headers).toMatchObject({ "If-None-Match": "source-v1" });
        expect(sleep).toHaveBeenCalledWith(1500);
    });
    it("never follows redirects and enforces response size", async () =>
    {
        const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(
            new Response(null, { status: 302, headers: { location: "https://elsewhere.example" } }),
        ).mockResolvedValueOnce(new Response("too large", { headers: { "content-length": "9000" } }));
        const fetcher = new SourceFetcher({
            fetchImpl,
            sleep: async () => undefined,
            maxBytes: 4,
            userAgent: "ArchiveTest/1 (mailto:test@example.test)",
        });
        await expect(fetcher.fetch(CHAMPIONSHIP.sourceUrl)).rejects.toThrow("outside the approved");
        expect(fetchImpl.mock.calls[0][1]?.redirect).toBe("manual");
        await expect(fetcher.fetch(CHAMPIONSHIP.sourceUrl)).rejects.toThrow("size limit");
    });
    it("records safe redirects and transient retries without versioning their bodies", async () =>
    {
        const redirected = new URL("redirected.htm", CHAMPIONSHIP.sourceUrl).href;
        const fetchImpl = vi.fn<typeof fetch>()
            .mockResolvedValueOnce(
                new Response("redirect body", { status: 302, headers: { location: redirected } }),
            )
            .mockResolvedValueOnce(new Response("busy", { status: 503, headers: { "retry-after": "1" } }))
            .mockResolvedValueOnce(new Response("<html>approved page</html>"));
        let clock = 0;
        const fetcher = new SourceFetcher({
            fetchImpl,
            sleep: async (ms) =>
            {
                clock += ms;
            },
            now: () => clock,
            userAgent: "ArchiveTest/1 (mailto:test@example.test)",
        });
        const result = await fetcher.fetch(CHAMPIONSHIP.sourceUrl);
        expect(result.observations.map((item) => item.statusCode)).toEqual([302, 503, 200]);
        expect(result.observations.slice(0, 2).every((item) => item.document === null)).toBe(true);
        expect(result.document?.url).toBe(CHAMPIONSHIP.sourceUrl);
        expect(fetchImpl.mock.calls[1]?.[0]).toBe(redirected);
    });
    it("does not turn error or empty responses into catalog snapshots", async () =>
    {
        const errorFetcher = new SourceFetcher({
            fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response("not found", { status: 404 })),
            sleep: async () => undefined,
            userAgent: "ArchiveTest/1 (mailto:test@example.test)",
        });
        const result = await errorFetcher.fetch(CHAMPIONSHIP.sourceUrl);
        expect(result.document).toBeNull();
        expect(result.observations[0]?.error).toBe("Source HTTP 404");

        const emptyFetcher = new SourceFetcher({
            fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status: 200 })),
            sleep: async () => undefined,
            userAgent: "ArchiveTest/1 (mailto:test@example.test)",
        });
        await expect(emptyFetcher.fetch(CHAMPIONSHIP.sourceUrl)).rejects.toBeInstanceOf(SourceFetchError);
    });
    it("bounds network retries and retains each failed observation", async () =>
    {
        const fetcher = new SourceFetcher({
            fetchImpl: vi.fn<typeof fetch>().mockRejectedValue(new Error("offline")),
            sleep: async () => undefined,
            now: () => 0,
            userAgent: "ArchiveTest/1 (mailto:test@example.test)",
        });
        try
        {
            await fetcher.fetch(CHAMPIONSHIP.sourceUrl);
            throw new Error("Expected the source request to fail");
        }
        catch (error)
        {
            expect(error).toBeInstanceOf(SourceFetchError);
            expect((error as SourceFetchError).observations).toHaveLength(3);
        }
    });
});
