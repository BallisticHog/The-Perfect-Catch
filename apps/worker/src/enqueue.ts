import { CatalogRepository, createDatabase } from "@the-perfect-catch/db";
import { CHAMPIONSHIP } from "@the-perfect-catch/domain";
import { makeWorkerUtils } from "graphile-worker";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
{
    throw new Error("DATABASE_URL is required");
}
const requestedBy = process.env.ADMIN_USER_ID;
if (!requestedBy)
{
    throw new Error("ADMIN_USER_ID must identify the acting administrator");
}
const database = createDatabase(databaseUrl);
const repository = new CatalogRepository(database.db);
let utils: Awaited<ReturnType<typeof makeWorkerUtils>> | undefined;
try
{
    if (!await repository.isActiveAdministrator(requestedBy))
    {
        await repository.recordSecurityEvent({
            action: "catalog.import_enqueue_denied",
            outcome: "denied",
            targetId: requestedBy,
            metadata: { reason: "current_administrator_grant_required" },
        });
        throw new Error("A current administrator grant is required to queue an import");
    }
    utils = await makeWorkerUtils({ connectionString: databaseUrl });
    await utils.migrate();
    const job = await utils.addJob("catalog.importRegatta", {
        regattaKey: CHAMPIONSHIP.slug,
        requestedBy,
        dryRun: process.argv.includes("--dry-run"),
    }, {
        queueName: "regattaresults-source",
        jobKey: `catalog.importRegatta:${CHAMPIONSHIP.slug}`,
        maxAttempts: 1,
    });
    await repository.recordSecurityEvent({
        actorId: requestedBy,
        action: "catalog.import_queued",
        outcome: "success",
        targetId: String(job.id),
        metadata: { dryRun: process.argv.includes("--dry-run") },
    });
    console.info(`Queued championship import ${job.id}`);
}
finally
{
    await utils?.release();
    await database.pool.end();
}
