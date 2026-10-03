# Home VM operating topology

## Deployment shape

Internet traffic reaches DNS, then the home router's forwarded ports 80 and 443, then Caddy in an Ubuntu Server LTS VM. Caddy terminates HTTPS and proxies to the web application. The web application connects to PostgreSQL, protected media storage, and a read-only live-state volume. An archive worker connects to PostgreSQL, snapshot storage, and the official results source. A separate live monitor polls only the registered live source and publishes its last-good state to that volume.

Use Tailscale for administration. Do not publish PostgreSQL, either worker, live-state storage, snapshot storage, backup storage, or administrative SSH to the internet. Only the reverse proxy requires the router's public web ports. Verify actual router reachability and any ISP carrier-grade NAT constraints before claiming the beta is reachable.

The baseline VM allocation is 8 vCPU and 16 GB RAM. Keep the application and database on SSD-backed storage, with a separate large volume for snapshots, media, and backups. Capacity depends on observed imports and retention; monitor free space and avoid allowing an import to consume the database's remaining capacity.

## Configuration and startup

Configure the canonical HTTPS origin, Google client ID and secret, authentication secret, database connection, snapshot/media paths, and the release state outside committed source. Register the exact Google callback URI required by the implemented authentication adapter. Use a maintained Ubuntu Server LTS version and pin tested runtime/container versions in deployment artifacts.

Bring up storage and PostgreSQL, run migrations, provision the intended first administrator, then start web, archive worker, and live monitor services behind Caddy. Verify service health and private authorization before considering external exposure complete. Keep the release state `private_beta` even though the sign-in page is reachable over the internet.

## Backups and recovery

Maintain separate local backups and encrypted offsite backups. Back up the database, source snapshot, live state, and media volumes, plus the deployment configuration needed for recovery. Store encryption keys separately from the backup media and document who can retrieve them. A backup file's presence is not a restore test.

Perform a restore into an isolated target, run migrations only as appropriate for the restored version, verify the archive/provenance relationship, confirm protected access and release state, and check that no restored service sends unintended jobs. Record restore date, result, and measured recovery time. Choose and document retention, recovery point, and recovery time targets before ongoing operation.

## Monitoring and incidents

Monitor service availability, database capacity, snapshot capacity, live-monitor freshness, TLS renewal, import failures, backup completion, and unexpected authorization failures. Keep logs useful without including tokens or raw personal lists. A failed import should preserve the archive; a storage or database outage requires a truthful unavailable state.

For an access incident, revoke affected grants and recheck protected requests. For a publication problem, return to the previous valid archive or stop serving the affected data under administrator control. For a secret exposure, rotate the affected secret and invalidate sessions when relevant. Record the actual event and remediation without claiming a hypothetical checklist is an implemented incident system.
