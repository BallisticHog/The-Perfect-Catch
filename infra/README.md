# Private beta production host

Run one dedicated Ubuntu Server 24.04 LTS VM on the home server, with a reserved LAN address,
Docker Engine, Docker Compose 2.33.1 or newer, Git, curl, and Tailscale. The deployment target is
`linux/amd64`. Give the VM sufficient memory for Postgres and the application; builds run in
GitHub Actions, not on the home server. Keep Ubuntu and Docker patched through a separate
maintenance procedure with backups.

Only forward TCP 80 and 443 from the router to this VM, including any IPv6 firewall rules.
Allow SSH only on the Tailscale interface and restrict tailnet SSH access to the operator.
Do not publish port 22, 3000, 5432, or Caddy's local admin port. Docker port publishing can
bypass ordinary UFW rules, so review both router and host rules. No database service port is
published by this Compose file. Caddy manages HTTPS certificates automatically; DNS must
point to the home's reachable public address and inbound 80/443 must work. Resolve CGNAT
or blocked inbound ports with the ISP before launch.

## Host preparation

1. Place a clean checkout at `/opt/the-perfect-catch`. All deployment scripts require this
   exact resolved path and the selected full commit SHA. Operational scripts run with sudo;
   the operator account and checkout must be trusted because Docker access grants host control.
2. Create `/etc/the-perfect-catch/server-id` containing only `catch-production`. This marker
   prevents an accidental operation on another host.
3. Copy `infra/production.env.example` to `/etc/the-perfect-catch/production.env`, owned by
   root with mode `600`. Replace every placeholder. Use a URL-safe random database password
   in `POSTGRES_PASSWORD`; Compose derives the fixed internal database URL from it. Configure
   Google OAuth for the HTTPS hostname and the application's Google callback route. Keep all
   production secrets outside the checkout, images, command arguments and workflow variables.
4. Authenticate the VM to the private GHCR packages with a read-only package credential.
   Keep registry credentials on the VM, protected by root permissions. Verify the SSH host key
   through the VM console before connecting from Windows. Use a root-owned checkout or add
   only this exact trusted checkout to Git's safe-directory configuration when sudo requires it.
5. Configure GitHub's `production-images` environment with required reviewers and allowed
   release branches. Restrict package visibility to private. The workflow never connects to
   the VM and does not store Tailscale or production credentials.

The six persistent named volumes hold Postgres data, original media, source snapshots, live state,
Caddy certificates and Caddy configuration. Web mounts reviewed media and live state read-only.
Raw source snapshots are not mounted into web, and neither worker can alter curated media.
The archive worker owns general snapshot writes. The live monitor owns its live state and source
captures. Backup and restore commands mount media and live state into one-shot containers.
Images initialize archive directories as UID/GID 1000.
Web and both workers explicitly use their public network as the default gateway, while Postgres
and migrations remain on the internal database network. Runtime secrets are limited to the
services that consume them. Caddy runs with a read-only root filesystem and only the capability
needed to bind HTTPS ports.
Do not use `docker compose down --volumes` or global Docker pruning on this host.

## Publish and deploy

After CI succeeds for the exact commit, manually dispatch **Publish production images** for
that commit's branch or tag. The workflow checks the successful CI result, repeats quality
checks and the build, validates operational contracts, then publishes:

```text
ghcr.io/<lowercase-owner>/<lowercase-repository>-web:<full-commit-sha>
ghcr.io/<lowercase-owner>/<lowercase-repository>-worker:<full-commit-sha>
```

Set `GHCR_NAMESPACE` to `<lowercase-owner>/<lowercase-repository>`. Record the published
digests from the workflow summary. Keep SHA tags for every retained release; never delete
or repoint a retained tag. Checkout the approved commit on the VM before deploying. From a
Tailscale IPv4 SSH session run:

```bash
sudo --preserve-env=SSH_CONNECTION bash /opt/the-perfect-catch/scripts/operations/deploy.sh <full-commit-sha>
```

Windows operators can run `scripts/operations/Invoke-ProductionDeploy.ps1` with the VM's
Tailscale IPv4 address, their SSH username, and the SHA. The wrapper requires a trusted SSH
host key and verifies Tailscale reachability.

Deployment pulls the selected application images, waits for Postgres, stops application
writers, creates and checks a full backup, runs the one-shot migration service, starts
the application, then checks container health, HTTPS and privacy headers. The migration
service is an explicit operations profile; ordinary Compose startup cannot accidentally run it.
Web, archive worker, live monitor and Caddy are recreated for each deploy so the selected images and checked-out
Caddy policy are always loaded.
Every release records image digests and status in `/var/lib/the-perfect-catch/releases`, with
an append-only operational audit log. Copy the audit log off-host for tamper-resistant retention.
Scheduled backups, verification and recovery read the last successful `current-sha` record.
An explicitly exported `IMAGE_TAG` takes precedence when selecting a recovery release. The
secret-file tag is used only before the first successful deployment.
Postgres and Caddy images are reused locally; update these deliberately during maintenance.

The web health endpoint exposes only generic liveness. Archive-worker health requires its process
timer to refresh `/tmp/catch-worker-heartbeat` within 120 seconds; this does not prove database
connectivity or successful ingestion. Live-monitor health requires its stored heartbeat to remain
fresh and likewise does not prove the publisher has posted a result. Unhealthy status is observable
but does not itself cause Docker to restart a running process; restart policies handle exits.
Alert on failed container health, low disk space, failed backups, and certificate failures.

## Backups and recovery

Run `backup.sh daily`, `backup.sh weekly` and `backup.sh monthly` using root-owned systemd
timers or cron entries at separate quiet periods. Templates under `infra/systemd/` schedule
daily at 02:00 UTC, Sunday at 04:15 UTC and the first of the month at 06:30 UTC. Install them
in `/etc/systemd/system`, reload systemd, and enable the three timers only after the initial
deployment and a successful manual backup. Persistent timers catch up after downtime, so
inspect failed runs and retry any that overlapped. Do not schedule tiers simultaneously because
operations share an exclusive lock. Each set includes a custom-format Postgres dump, complete
media, source snapshot and live-state archive, metadata, checksums and a completion marker. Writers are stopped
briefly so database rows and archive files describe the same recovery point. Services that
were running before a scheduled backup are restarted even if that backup fails.

Retain **7 daily, 4 weekly and 12 monthly** successful full sets. `prune-backups.sh <tier>`
shows expired sets; add `--apply` only after verifying the encrypted off-host copy. The script
deletes only the five known files from completed, validated backup directories. Failed sets
and pre-release backups are retained for operator inspection. Nothing is automatically pruned
by deployment. Keep at least the current release and three previous successful releases,
their GHCR images, local images, matching pre-release backups and operational configuration.

Backups contain private data. Their host directories are root-only; replicate them to an
encrypted off-host destination with independent credentials, and keep the encryption recovery
key separately. A copy on the same VM or physical server is not disaster recovery. Snapshot or
back up the secret file separately to an encrypted recovery store. Caddy certificates can be
reissued from DNS and the retained configuration; their persistent volumes survive app updates.

On a separate recovery VM, provision the same exact host paths and marker, fetch the matching
retained images, start Postgres, and create an initial baseline backup. Copy one verified backup
set into the same timestamped backup hierarchy. Then rehearse the production restoration command:

```bash
sudo bash /opt/the-perfect-catch/scripts/operations/restore.sh /var/backups/the-perfect-catch/daily/20260913T010000Z --replace-production=catch-production
```

This command explicitly replaces production database, media, snapshot and live-state contents. It verifies
checksums and archive paths first, stops writers and creates another recovery point before
replacement. It leaves writers stopped so the operator can select the matching release before
startup. Review the matching schema version, start with that release's `IMAGE_TAG`, and run
`verify.sh`; also sign in with an approved account, open a known result and fetch protected media.
Record restore duration and those checks. A checksum check alone is not a tested recovery drill.

If an additive migration is compatible with a retained application version, checkout that
clean release and use `rollback.sh <sha> --schema-compatible` over Tailscale. This preserves
the database and creates a fresh backup before switching images. If compatibility is uncertain,
restore the matching backup instead. Failed deployments never perform automatic schema rollback.

## Local verification

`bash scripts/operations/test-contracts.sh` parses every operational shell script, resolves
Compose with test-only environment values and checks network, port, volume, restart, image
tag and private-release contracts. It also tests path rejection and backup-before-migration
ordering. It does not start Docker services, use production secrets or deploy anything.
CI runs these contracts on Ubuntu and separately builds both production Dockerfiles without
publishing images, so container packaging is checked before release approval.

Runtime readiness still requires a real image build, a successful migration on an isolated
database, a Tailscale deployment rehearsal, a backup restoration drill and an external HTTPS
check on the provisioned VM.
