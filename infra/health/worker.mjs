import { stat } from "node:fs/promises";

try
{
    const heartbeat = await stat("/tmp/catch-worker-heartbeat");
    process.exit(Date.now() - heartbeat.mtimeMs < 120_000 ? 0 : 1);
}
catch
{
    process.exit(1);
}
