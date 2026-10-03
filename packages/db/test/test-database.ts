import { createDatabase } from "../src/index";

export async function openTestDatabase(url: string): Promise<ReturnType<typeof createDatabase>>
{
    const candidate = createDatabase(url);
    try
    {
        const identity = await candidate.pool.query<{ name: string; }>("SELECT current_database() AS name");
        if (!identity.rows[0]?.name.toLowerCase().includes("test"))
        {
            throw new Error("Database integration tests require a dedicated test database");
        }
        return candidate;
    }
    catch (error)
    {
        await candidate.pool.end();
        throw error;
    }
}
