import { createDatabase } from "@the-perfect-catch/db";
import { run } from "graphile-worker";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createTasks } from "./tasks";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
{
    throw new Error("DATABASE_URL is required");
}
const database = createDatabase(databaseUrl);
const runner = await run({
    connectionString: databaseUrl,
    concurrency: 1,
    noHandleSignals: false,
    pollInterval: 1000,
    taskList: createTasks(database),
});
const heartbeatPath = join(tmpdir(), "catch-worker-heartbeat");
const heartbeat = setInterval(() =>
{
    void writeFile(heartbeatPath, new Date().toISOString()).catch((error: unknown) =>
    {
        console.error("Worker heartbeat failed", error instanceof Error ? error.message : "Unknown error");
    });
}, 15_000);
await writeFile(heartbeatPath, new Date().toISOString());
try
{
    await runner.promise;
}
finally
{
    clearInterval(heartbeat);
    await database.pool.end();
}
