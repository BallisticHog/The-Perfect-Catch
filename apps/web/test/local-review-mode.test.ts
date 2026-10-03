import { afterEach, describe, expect, it, vi } from "vitest";
import { localReviewAccess } from "../src/lib/local-review-mode";

const secret = "local-review-mode-test-secret-at-least-32-characters";

function headers(value = secret): Headers
{
    return new Headers({ "x-the-catch-local-review": value });
}

afterEach(() =>
{
    vi.unstubAllEnvs();
});

describe("local browser review mode", () =>
{
    it("accepts the exact secret only in an explicitly enabled development process", () =>
    {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("LOCAL_REVIEW_MODE", "true");
        vi.stubEnv("LOCAL_REVIEW_SECRET", secret);
        expect(localReviewAccess(headers())).toEqual({
            userId: "local-playwright-review",
            name: "Local reviewer",
            role: "admin",
            localReviewState: "ready",
        });
        expect(localReviewAccess(headers(`${secret}-wrong`))).toBeNull();
    });

    it("is unavailable in production even when configured", () =>
    {
        vi.stubEnv("NODE_ENV", "production");
        vi.stubEnv("LOCAL_REVIEW_MODE", "true");
        vi.stubEnv("LOCAL_REVIEW_SECRET", secret);
        expect(localReviewAccess(headers())).toBeNull();
    });

    it("rejects missing and short secrets", () =>
    {
        vi.stubEnv("NODE_ENV", "development");
        vi.stubEnv("LOCAL_REVIEW_MODE", "true");
        expect(localReviewAccess(headers())).toBeNull();
        vi.stubEnv("LOCAL_REVIEW_SECRET", "short");
        expect(localReviewAccess(headers("short"))).toBeNull();
    });
});
