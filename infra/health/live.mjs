import { readFile } from "node:fs/promises";
import path from "node:path";

try
{
    const root = process.env.CATCH_LIVE_ROOT ?? "/var/lib/catch/live";
    const state = JSON.parse(await readFile(path.join(root, "state.json"), "utf8"));
    process.exit(Date.now() - Date.parse(state.heartbeatAt) < 120_000 ? 0 : 1);
}
catch
{
    process.exit(1);
}
