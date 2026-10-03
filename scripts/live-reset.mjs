import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const file = path.join(root, ".data", "live", "worker.lock");
try
{
    const pid = Number(await readFile(file, "utf8"));
    if (!Number.isSafeInteger(pid) || pid <= 0)
    {
        throw new Error("Invalid lock. Inspect it manually before removal.");
    }
    let running = true;
    try
    {
        process.kill(pid, 0);
    }
    catch (error)
    {
        if (error.code !== "ESRCH")
        {
            throw error;
        }
        running = false;
    }
    if (running)
    {
        console.info("The recorded process still exists. Close the live window before resetting.");
        process.exitCode = 1;
    }
    else
    {
        await unlink(file);
        console.info("Removed the stale worker lock. Captured results are unchanged. Run live.bat.");
    }
}
catch (error)
{
    if (error.code === "ENOENT")
    {
        console.info("No worker lock exists. Run live.bat.");
    }
    else
    {
        throw error;
    }
}
