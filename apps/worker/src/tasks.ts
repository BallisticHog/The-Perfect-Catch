import { CatalogRepository, createDatabase } from "@the-perfect-catch/db";
import { CHAMPIONSHIP } from "@the-perfect-catch/domain";
import { FileSnapshotArchive, importRegatta, SourceFetcher } from "@the-perfect-catch/ingestion";
import type { TaskList } from "graphile-worker";
import { z } from "zod";

const payloadSchema = z.object({
    regattaKey: z.literal(CHAMPIONSHIP.slug),
    requestedBy: z.string().min(1),
    dryRun: z.boolean().optional(),
}).strict();

type ImportAuthorizationRepository = Pick<CatalogRepository, "isActiveAdministrator" | "recordSecurityEvent">;
type WorkerDatabase = ReturnType<typeof createDatabase>;

export async function requireImportAdministrator(
    repository: ImportAuthorizationRepository,
    userId: string,
): Promise<void>
{
    if (!await repository.isActiveAdministrator(userId))
    {
        await repository.recordSecurityEvent({
            action: "catalog.import_denied",
            outcome: "denied",
            targetId: userId,
            metadata: { reason: "current_administrator_grant_required" },
        });
        throw new Error("A current administrator grant is required to import results");
    }
}

export async function runWithImportLock(database: WorkerDatabase, work: () => Promise<void>): Promise<void>
{
    const lockClient = await database.pool.connect();
    let acquired = false;
    try
    {
        const lock = await lockClient.query<{ acquired: boolean; }>(
            "select pg_try_advisory_lock(hashtext($1)) as acquired",
            ["the-perfect-catch:source-import"],
        );
        acquired = lock.rows[0]?.acquired === true;
        if (!acquired)
        {
            throw new Error("Another championship import is active");
        }
        await work();
    }
    finally
    {
        let cleanupError: Error | undefined;
        try
        {
            if (acquired)
            {
                await lockClient.query("select pg_advisory_unlock(hashtext($1))", [
                    "the-perfect-catch:source-import",
                ]);
            }
        }
        catch (error)
        {
            // Discard the connection because its session may still own the advisory lock.
            cleanupError = error instanceof Error ? error : new Error("Import lock cleanup failed");
            throw error;
        }
        finally
        {
            lockClient.release(cleanupError);
        }
    }
}

export function createTasks(database: ReturnType<typeof createDatabase>): TaskList
{
    const snapshotRoot = process.env.SNAPSHOT_ROOT;
    if (!snapshotRoot)
    {
        throw new Error("SNAPSHOT_ROOT is required");
    }
    const repository = new CatalogRepository(database.db);
    const fetcher = new SourceFetcher();
    const snapshotArchive = new FileSnapshotArchive(snapshotRoot);
    return {
        "catalog.importRegatta": async (payload, helpers) =>
        {
            const parsed = payloadSchema.parse(payload);
            await requireImportAdministrator(repository, parsed.requestedBy);
            try
            {
                // This session-level lock coordinates manual and queued imports across worker processes.
                await runWithImportLock(database, async () =>
                {
                    const report = await importRegatta(repository, {
                        fetcher,
                        requestedBy: parsed.requestedBy,
                        dryRun: parsed.dryRun,
                        snapshotArchive,
                    });
                    await repository.recordSecurityEvent({
                        actorId: parsed.requestedBy,
                        action: "catalog.import_completed",
                        outcome: "success",
                        targetId: report.runId,
                        metadata: {
                            status: report.status,
                            expectedRaces: report.expectedRaces,
                            parsedRaces: report.parsedRaces,
                        },
                    });
                    helpers.logger.info(
                        `Championship import ${report.status}: ${report.parsedRaces}/${report.expectedRaces} races`,
                        { runId: report.runId },
                    );
                });
            }
            catch (error)
            {
                await repository.recordSecurityEvent({
                    actorId: parsed.requestedBy,
                    action: "catalog.import_failed",
                    outcome: "failure",
                    metadata: { reason: "worker_task_failed" },
                });
                throw error;
            }
        },
    };
}
