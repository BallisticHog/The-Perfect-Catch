import { describe, expect, it, vi } from "vitest";
import { requireImportAdministrator, runWithImportLock } from "../src/tasks";

describe("catalog import authorization", () =>
{
    it("allows a current administrator without writing a denial", async () =>
    {
        const repository = {
            isActiveAdministrator: vi.fn().mockResolvedValue(true),
            recordSecurityEvent: vi.fn(),
        };
        await expect(requireImportAdministrator(repository as never, "admin-user")).resolves.toBeUndefined();
        expect(repository.recordSecurityEvent).not.toHaveBeenCalled();
    });

    it("denies a stale or viewer grant and records the attempt", async () =>
    {
        const repository = {
            isActiveAdministrator: vi.fn().mockResolvedValue(false),
            recordSecurityEvent: vi.fn().mockResolvedValue(undefined),
        };
        await expect(requireImportAdministrator(repository as never, "viewer-user")).rejects.toThrow(
            "administrator",
        );
        expect(repository.recordSecurityEvent).toHaveBeenCalledWith(
            expect.objectContaining({ action: "catalog.import_denied", outcome: "denied" }),
        );
    });
});

describe("catalog import lock", () =>
{
    it("runs authorized work and releases the advisory lock and client", async () =>
    {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [{ acquired: true }] })
            .mockResolvedValueOnce({ rows: [{ pg_advisory_unlock: true }] });
        const release = vi.fn();
        const work = vi.fn().mockResolvedValue(undefined);
        const database = { pool: { connect: vi.fn().mockResolvedValue({ query, release }) } };

        await expect(runWithImportLock(database as never, work)).resolves.toBeUndefined();

        expect(work).toHaveBeenCalledOnce();
        expect(query).toHaveBeenCalledTimes(2);
        expect(release).toHaveBeenCalledOnce();
    });

    it("does not run work or unlock when another import owns the lock", async () =>
    {
        const query = vi.fn().mockResolvedValueOnce({ rows: [{ acquired: false }] });
        const release = vi.fn();
        const work = vi.fn();
        const database = { pool: { connect: vi.fn().mockResolvedValue({ query, release }) } };

        await expect(runWithImportLock(database as never, work)).rejects.toThrow(
            "Another championship import is active",
        );

        expect(work).not.toHaveBeenCalled();
        expect(query).toHaveBeenCalledOnce();
        expect(release).toHaveBeenCalledOnce();
    });

    it("discards the client when advisory lock cleanup fails", async () =>
    {
        const query = vi.fn()
            .mockResolvedValueOnce({ rows: [{ acquired: true }] })
            .mockRejectedValueOnce(new Error("Lock cleanup failed"));
        const release = vi.fn();
        const database = { pool: { connect: vi.fn().mockResolvedValue({ query, release }) } };

        await expect(runWithImportLock(database as never, async () => undefined)).rejects.toThrow(
            "Lock cleanup failed",
        );

        expect(release).toHaveBeenCalledOnce();
        expect(release).toHaveBeenCalledWith(expect.objectContaining({ message: "Lock cleanup failed" }));
    });
});
