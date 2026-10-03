import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dataDirectory = path.join(root, ".data");
const processFile = path.join(dataDirectory, "local-review-processes.json");
const catalogFile = path.join(dataDirectory, "local-review-catalog.json");
const url = "http://127.0.0.1:4318/";
const reviewSecret = "the-catch-private-local-review-2026-only";

function readProcesses()
{
    if (!existsSync(processFile))
    {
        return null;
    }
    try
    {
        return JSON.parse(readFileSync(processFile, "utf8"));
    }
    catch
    {
        return null;
    }
}

function processIsRunning(pid)
{
    if (!Number.isSafeInteger(pid) || pid <= 0)
    {
        return false;
    }
    try
    {
        process.kill(pid, 0);
        return true;
    }
    catch
    {
        return false;
    }
}

function processCommandLine(pid)
{
    if (!processIsRunning(pid))
    {
        return "";
    }
    const query = spawnSync(
        "powershell.exe",
        [
            "-NoProfile",
            "-Command",
            `$item = Get-CimInstance Win32_Process -Filter \"ProcessId = ${pid}\"; if ($item) { $item.CommandLine }`,
        ],
        { encoding: "utf8", windowsHide: true },
    );
    return query.status === 0 ? query.stdout.trim().toLocaleLowerCase("en-US") : "";
}

function processIsOwned(pid, requiredText)
{
    const commandLine = processCommandLine(pid);
    return commandLine !== "" && requiredText.every((value) => commandLine.includes(value));
}

function stopProcess(pid, requiredText)
{
    if (!processIsOwned(pid, requiredText))
    {
        return;
    }
    spawnSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
        windowsHide: true,
        stdio: "ignore",
    });
}

function stop(announce = true)
{
    const running = readProcesses();
    if (running)
    {
        stopProcess(running.proxyPid, ["local-review-proxy.mjs"]);
        stopProcess(running.webPid, ["next", "--port 4317"]);
    }
    rmSync(processFile, { force: true });
    if (announce)
    {
        console.info("The Catch local preview is stopped.");
    }
}

function openBrowser()
{
    const browser = spawn("cmd.exe", ["/d", "/c", "start", "", url], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
    });
    browser.unref();
}

async function waitUntilReady()
{
    const deadline = Date.now() + 90_000;
    while (Date.now() < deadline)
    {
        try
        {
            const response = await fetch(url, { redirect: "manual" });
            if (response.status >= 200 && response.status < 400)
            {
                return true;
            }
        }
        catch
        {
            // The web process is still starting.
        }
        await new Promise((resolve) => setTimeout(resolve, 750));
    }
    return false;
}

async function start()
{
    mkdirSync(dataDirectory, { recursive: true });
    if (!existsSync(catalogFile))
    {
        throw new Error("The full local catalogue is missing. Run refresh-data.bat first.");
    }

    const running = readProcesses();
    if (
        running
        && processIsOwned(running.webPid, ["next", "--port 4317"])
        && processIsOwned(running.proxyPid, ["local-review-proxy.mjs"])
    )
    {
        console.info(`The Catch is already running at ${url}`);
        if (!process.argv.includes("--no-browser"))
        {
            openBrowser();
        }
        return;
    }
    stop(false);

    const environment = {
        ...process.env,
        LOCAL_REVIEW_MODE: "true",
        LOCAL_REVIEW_SECRET: reviewSecret,
        CATCH_USE_FULL_LOCAL_CATALOG: "true",
        CATCH_LOCAL_CATALOG_PATH: catalogFile,
        CATCH_WEB_PORT: "4317",
        CATCH_PREVIEW_PORT: "4318",
    };
    const webLog = openSync(path.join(dataDirectory, "local-web.log"), "a");
    const proxyLog = openSync(path.join(dataDirectory, "local-proxy.log"), "a");
    const web = spawn(
        process.execPath,
        [
            path.join(root, "node_modules", "next", "dist", "bin", "next"),
            "dev",
            "--hostname",
            "127.0.0.1",
            "--port",
            "4317",
        ],
        {
            cwd: path.join(root, "apps", "web"),
            detached: true,
            env: environment,
            stdio: ["ignore", webLog, webLog],
            windowsHide: true,
        },
    );
    const proxy = spawn(process.execPath, [path.join(root, "scripts", "local-review-proxy.mjs")], {
        cwd: root,
        detached: true,
        env: environment,
        stdio: ["ignore", proxyLog, proxyLog],
        windowsHide: true,
    });
    web.unref();
    proxy.unref();
    closeSync(webLog);
    closeSync(proxyLog);
    writeFileSync(processFile, `${JSON.stringify({ webPid: web.pid, proxyPid: proxy.pid }, null, 4)}\n`);

    console.info("Starting The Catch with the complete 2026 SA Schools Championships catalogue...");
    const ready = await waitUntilReady();
    if (!ready)
    {
        throw new Error(
            `The preview did not become ready. Check ${path.join(dataDirectory, "local-web.log")}.`,
        );
    }
    console.info(`The Catch is ready at ${url}`);
    if (!process.argv.includes("--no-browser"))
    {
        openBrowser();
    }
}

const command = process.argv[2] ?? "start";
if (command === "stop")
{
    stop();
}
else if (command === "start")
{
    await start();
}
else
{
    throw new Error(`Unknown local preview command: ${command}`);
}
