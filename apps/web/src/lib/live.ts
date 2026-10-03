import "server-only";
import type { LiveState } from "@the-perfect-catch/domain";
import { readFile } from "node:fs/promises";
import path from "node:path";

export async function readLiveState(): Promise<LiveState | null>
{
    const directory = process.env.CATCH_LIVE_ROOT ?? path.resolve(process.cwd(), "../../.data/live");
    try
    {
        return JSON.parse(await readFile(path.join(directory, "state.json"), "utf8")) as LiveState;
    }
    catch (error)
    {
        if ((error as NodeJS.ErrnoException).code === "ENOENT")
        {
            return null;
        }
        throw error;
    }
}
