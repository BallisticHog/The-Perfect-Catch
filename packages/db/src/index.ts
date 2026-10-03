import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export { schema };
export * from "./repository";
export * from "./schema";

export function createDatabase(databaseUrl: string)
{
    const pool = new Pool(
        {
            connectionString: databaseUrl,
            max: 10,
            idleTimeoutMillis: 30_000,
            connectionTimeoutMillis: 10_000,
            statement_timeout: 30_000,
            application_name: "the-perfect-catch",
        },
    );
    return { db: drizzle(pool, { schema }), pool };
}

export type Database = ReturnType<typeof createDatabase>["db"];
