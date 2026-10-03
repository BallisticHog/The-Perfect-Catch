import assert from "node:assert/strict";

let input = "";
for await (const chunk of process.stdin)
{
    input += chunk;
}
const config = JSON.parse(input);
assert.equal(config.name, "catch-production");
assert.equal(config.networks.database.internal, true);
assert.deepEqual(Object.keys(config.services).sort(), [
    "caddy",
    "live",
    "migrate",
    "postgres",
    "web",
    "worker",
]);
for (const [name, service] of Object.entries(config.services))
{
    if (name !== "caddy")
    {
        assert.equal(service.ports?.length ?? 0, 0, `${name} must not publish ports`);
    }
    if (name === "migrate")
    {
        assert.equal(service.restart, "no");
        assert.deepEqual(service.profiles, ["operations"]);
    }
    else
    {
        assert.equal(service.restart, "unless-stopped");
        assert.ok(service.healthcheck?.test.length);
    }
}
assert.deepEqual(config.services.caddy.ports.map(port => Number(port.published)).sort((a, b) => a - b), [
    80,
    443,
]);
assert.equal(config.services.caddy.read_only, true);
assert.deepEqual(config.services.caddy.cap_drop, ["ALL"]);
assert.deepEqual(config.services.caddy.cap_add, ["NET_BIND_SERVICE"]);
assert.deepEqual(Object.keys(config.services.postgres.networks), ["database"]);
for (const name of ["web", "worker", "live", "migrate"])
{
    assert.match(config.services[name].image, /:[0-9a-f]{40}$/);
    assert.equal(config.services[name].read_only, true);
    assert.equal(config.services[name].user, "1000:1000");
}
assert.equal(config.services.web.environment.SITE_PUBLIC_RELEASE_ENABLED, "false");
for (const name of ["web", "worker", "migrate"])
{
    assert.equal(
        config.services[name].environment.DATABASE_URL,
        "postgres://catch:test-only@postgres:5432/catch",
    );
}
assert.equal(config.services.web.networks.edge.gw_priority, 1);
assert.equal(config.services.worker.networks.outbound.gw_priority, 1);
assert.equal(config.services.live.networks.outbound.gw_priority, 1);
for (const name of ["worker", "live", "migrate"])
{
    for (const key of ["APP_BASE_URL", "BETTER_AUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"])
    {
        assert.equal(key in config.services[name].environment, false, `${name} must not receive ${key}`);
    }
}
for (
    const key of [
        "BOOTSTRAP_GOOGLE_EMAIL",
        "BOOTSTRAP_SECRET_SHA256",
        "REGATTA_RESULTS_USER_AGENT",
        "SNAPSHOT_ROOT",
    ]
)
{
    assert.equal(key in config.services.web.environment, false, `web must not receive ${key}`);
}
assert.equal("MEDIA_ROOT" in config.services.worker.environment, false);
assert.ok(config.services.web.volumes.every(volume => volume.read_only));
assert.deepEqual(config.services.web.volumes.map(volume => volume.target).sort(), [
    "/var/lib/catch/live",
    "/var/lib/catch/media",
]);
assert.deepEqual(config.services.worker.volumes.map(volume => volume.target), ["/var/lib/catch/snapshots"]);
assert.deepEqual(config.services.live.volumes.map(volume => volume.target).sort(), [
    "/var/lib/catch/live",
    "/var/lib/catch/snapshots",
]);
assert.equal(Object.keys(config.volumes).length, 6);
process.stdout.write("Production Compose contracts passed.\n");
