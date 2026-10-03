import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ query: vi.fn(), end: vi.fn() }));
vi.mock("../src/index", () => ({ createDatabase: () => ({ pool: mocks }) }));

import { openTestDatabase } from "./test-database";

describe("integration database safety", () =>
{
    beforeEach(() =>
    {
        vi.clearAllMocks();
    });

    it("closes and rejects a non-test database without exposing it to destructive teardown", async () =>
    {
        mocks.query.mockResolvedValue({ rows: [{ name: "catch_production" }] });
        let cleanupDatabase: Awaited<ReturnType<typeof openTestDatabase>> | undefined;
        await expect((async () =>
        {
            cleanupDatabase = await openTestDatabase("fixture-url");
        })()).rejects.toThrow("dedicated test database");
        expect(cleanupDatabase).toBeUndefined();
        expect(mocks.end).toHaveBeenCalledOnce();
        expect(mocks.query).toHaveBeenCalledExactlyOnceWith("SELECT current_database() AS name");
    });

    it("closes a connection when identity verification fails", async () =>
    {
        mocks.query.mockRejectedValue(new Error("identity lookup failed"));
        await expect(openTestDatabase("fixture-url")).rejects.toThrow("identity lookup failed");
        expect(mocks.end).toHaveBeenCalledOnce();
    });

    it("returns a verified test database for the integration suite", async () =>
    {
        mocks.query.mockResolvedValue({ rows: [{ name: "catch_test" }] });
        expect((await openTestDatabase("fixture-url")).pool).toBe(mocks);
        expect(mocks.end).not.toHaveBeenCalled();
    });
});
