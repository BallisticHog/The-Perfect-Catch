import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const common = fileURLToPath(new URL("./common.sh", import.meta.url));

test("writer discovery filters application services and fails when Compose cannot inspect them", () =>
{
    const success = spawnSync("bash", [
        "-c",
        "source \"$1\"; compose() { printf 'postgres\\nweb\\ncaddy\\nworker\\nlive\\n'; }; running_application_services",
        "test",
        common,
    ]);
    assert.equal(success.status, 0);
    assert.equal(success.stdout.toString(), "web\nworker\nlive\n");
    const failure = spawnSync("bash", [
        "-c",
        "source \"$1\"; compose() { return 1; }; running_application_services",
        "test",
        common,
    ]);
    assert.notEqual(failure.status, 0);
    assert.match(failure.stderr.toString(), /Cannot determine running writers/);
});

test("current release selection accepts the saved full SHA and rejects malformed records", async () =>
{
    const directory = await mkdtemp(join(tmpdir(), "catch-release-contract-"));
    const record = join(directory, "current-sha");
    try
    {
        for (
            const [value, accepted] of [["a".repeat(40), true], ["latest", false], [
                "a".repeat(40) + "\nother",
                false,
            ]]
        )
        {
            await writeFile(record, `${value}\n`);
            const result = spawnSync("bash", [
                "-c",
                "source \"$1\"; read_release_sha \"$2\"",
                "test",
                common,
                record,
            ]);
            assert.equal(result.status === 0, accepted, value);
            if (accepted)
            {
                assert.equal(result.stdout.toString().trim(), value);
            }
        }
    }
    finally
    {
        await rm(directory, { recursive: true });
    }
});

test("checksum manifests require every backup payload exactly once", async () =>
{
    const directory = await mkdtemp(join(tmpdir(), "catch-checksum-contract-"));
    const manifest = join(directory, "SHA256SUMS");
    const line = (name) => `${"a".repeat(64)}  ${name}\n`;
    const valid = ["database.dump", "storage.tar.gz", "metadata.txt"].map(line).join("");
    try
    {
        for (
            const [content, accepted] of [
                [valid, true],
                [line("database.dump").repeat(3), false],
                [valid + `${"a".repeat(64)}  /etc/passwd`, false],
                [line("database.dump") + line("storage.tar.gz") + line("../metadata.txt"), false],
            ]
        )
        {
            await writeFile(manifest, content);
            const result = spawnSync("bash", [
                "-c",
                "source \"$1\"; validate_checksum_manifest \"$2\"",
                "test",
                common,
                manifest,
            ]);
            assert.equal(result.status === 0, accepted, content);
        }
    }
    finally
    {
        await rm(directory, { recursive: true });
    }
});

test("release SHA validation accepts only full lowercase commit identifiers", () =>
{
    for (
        const [value, accepted] of [["a".repeat(40), true], ["latest", false], ["../other", false], [
            "A".repeat(40),
            false,
        ], ["a".repeat(39), false]]
    )
    {
        const result = spawnSync("bash", ["-c", "source \"$1\"; validate_sha \"$2\"", "test", common, value]);
        assert.equal(result.status === 0, accepted, value);
    }
});

test("backup target validation rejects broad or escaping paths before reading data", () =>
{
    for (
        const value of [
            "/",
            "/var/backups",
            "/var/backups/the-perfect-catch",
            "/tmp/backup",
            "/var/backups/the-perfect-catch/daily/../monthly",
        ]
    )
    {
        const result = spawnSync("bash", [
            "-c",
            "source \"$1\"; validate_backup \"$2\"",
            "test",
            common,
            value,
        ]);
        assert.notEqual(result.status, 0, value);
        assert.match(result.stderr.toString(), /Backup path must identify/);
    }
});

test("deployment stops writers and backs up before running migrations", async () =>
{
    const script = await readFile(new URL("./deploy.sh", import.meta.url), "utf8");
    const stop = script.indexOf("compose stop --timeout 90 web worker live");
    const backup = script.indexOf("bash \"$CHECKOUT/scripts/operations/backup.sh\" release");
    const migrate = script.indexOf("compose --profile operations run --rm --no-deps migrate");
    const start = script.indexOf(
        "compose up -d --force-recreate --wait --wait-timeout 180 web worker live caddy",
    );
    assert.ok(stop >= 0 && stop < backup && backup < migrate && migrate < start);
});

test("deployment and rollback recreate Caddy so checked-out proxy policy is loaded", async () =>
{
    const deploy = await readFile(new URL("./deploy.sh", import.meta.url), "utf8");
    const rollback = await readFile(new URL("./rollback.sh", import.meta.url), "utf8");
    assert.match(deploy, /compose up -d --force-recreate --wait .* web worker live caddy/);
    assert.match(rollback, /compose up -d --pull never --force-recreate --wait .* web worker live caddy/);
});

test("container build contexts exclude production environment files", async () =>
{
    for (const name of ["web", "worker"])
    {
        const ignore = await readFile(
            new URL(`../../infra/${name}.Dockerfile.dockerignore`, import.meta.url),
            "utf8",
        );
        assert.match(ignore, /^\*\*\/\*\.env$/m);
    }
});

test("media is attached only to explicit backup and restore operations", async () =>
{
    const common = await readFile(new URL("./common.sh", import.meta.url), "utf8");
    const backup = await readFile(new URL("./backup.sh", import.meta.url), "utf8");
    const restore = await readFile(new URL("./restore.sh", import.meta.url), "utf8");
    assert.match(common, /readonly MEDIA_VOLUME=catch-production-media/);
    assert.match(common, /readonly LIVE_VOLUME=catch-production-live/);
    assert.match(backup, /--volume "\$MEDIA_VOLUME:\/var\/lib\/catch\/media:ro"/);
    assert.match(backup, /--volume "\$LIVE_VOLUME:\/var\/lib\/catch\/live:ro"/);
    assert.equal(restore.match(/--volume "\$MEDIA_VOLUME:\/var\/lib\/catch\/media"/g)?.length, 2);
});
