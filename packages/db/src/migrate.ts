import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
{
    throw new Error("DATABASE_URL is required");
}
const pool = new Pool({ connectionString: databaseUrl, max: 1 });
const client = await pool.connect();
try
{
    const migrationsUrl = new URL("../migrations/", import.meta.url);
    const migrationNames = (await readdir(migrationsUrl))
        .filter((name) => /^\d{4}_[a-z0-9_]+\.sql$/.test(name))
        .sort((left, right) => left.localeCompare(right));
    if (!migrationNames.length)
    {
        throw new Error("No database migrations were found");
    }
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext('the-perfect-catch:migrations'))");
    await client.query(
        "CREATE TABLE IF NOT EXISTS app_migrations (name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())",
    );
    for (const name of migrationNames)
    {
        const content = await readFile(new URL(name, migrationsUrl), "utf8");
        const checksum = createHash("sha256").update(content).digest("hex");
        const prior = await client.query<{ checksum: string; }>(
            "SELECT checksum FROM app_migrations WHERE name = $1",
            [name],
        );
        if (prior.rows.length && prior.rows[0]?.checksum !== checksum)
        {
            throw new Error(`Applied migration ${name} has changed; add a new migration instead`);
        }
        if (!prior.rows.length)
        {
            await client.query(content);
            await client.query("INSERT INTO app_migrations (name, checksum) VALUES ($1, $2)", [
                name,
                checksum,
            ]);
        }
    }
    await client.query("COMMIT");
}
catch (error)
{
    await client.query("ROLLBACK");
    throw error;
}
finally
{
    client.release();
    await pool.end();
}
