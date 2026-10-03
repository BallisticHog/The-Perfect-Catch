import "server-only";
import { createDatabase } from "@the-perfect-catch/db";

let database: ReturnType<typeof createDatabase> | undefined;

export function getDatabase()
{
    if (!database)
    {
        const url = process.env.DATABASE_URL;
        if (!url)
        {
            throw new Error("Database is not configured");
        }
        database = createDatabase(url);
    }
    return database.db;
}
