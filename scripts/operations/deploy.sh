#!/usr/bin/env bash
# Usage, from a Tailscale SSH session:
# sudo --preserve-env=SSH_CONNECTION bash scripts/operations/deploy.sh <full-commit-sha>
# The approved commit must already be checked out at /opt/the-perfect-catch.
# Retains all release image digests, audit entries and pre-migration recovery points.
# Backups use the 7 daily / 4 weekly / 12 monthly policy; release sets are not pruned.
set -Eeuo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
require_host
operation_lock
validate_sha "${1:-}"
export IMAGE_TAG=$1
connection=${SSH_CONNECTION:-}
peer=${connection%% *}
[[ $peer =~ ^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.[0-9]{1,3}\.[0-9]{1,3}$ ]] \
    || fail 'Deployment requires a Tailscale IPv4 SSH session.'
[[ $(git -C "$CHECKOUT" rev-parse HEAD) == "$IMAGE_TAG" ]] || fail 'Checkout does not match the requested image SHA.'
[[ -z $(git -C "$CHECKOUT" status --porcelain) ]] || fail 'Deployment requires a clean checkout.'
compose config --quiet
release="$RELEASE_ROOT/$(date -u +%Y%m%dT%H%M%SZ)-$IMAGE_TAG"
[[ ! -e $release ]] || fail 'Release record already exists.'
install -d -m 700 -- "$release"
audit "deploy-start sha=$IMAGE_TAG"

finish()
{
    local result=$?
    if [[ $result -ne 0 ]]
    then
        audit "deploy-failed sha=$IMAGE_TAG exit=$result"
        printf 'Deployment failed. Inspect service state and retained backup before manual rollback.\n' >&2
    fi
}
trap finish EXIT
compose pull web worker live
docker image inspect postgres:17-alpine > /dev/null 2>&1 || docker pull postgres:17-alpine
docker image inspect caddy:2-alpine > /dev/null 2>&1 || docker pull caddy:2-alpine
compose config --images > "$release/images.txt"
while IFS= read -r image
do
    docker image inspect --format '{{json .RepoDigests}}' "$image" >> "$release/digests.jsonl"
done < "$release/images.txt"
compose up -d --wait --wait-timeout 120 postgres
# Quiesce every application writer before the backup and keep them stopped if migration fails.
compose stop --timeout 90 web worker live
bash "$CHECKOUT/scripts/operations/backup.sh" release
compose --profile operations run --rm --no-deps migrate
printf '%s\n' "$IMAGE_TAG" > "$release/migration-completed"
compose up -d --force-recreate --wait --wait-timeout 180 web worker live caddy
bash "$CHECKOUT/scripts/operations/verify.sh"
printf '%s\n' "$IMAGE_TAG" > "$RELEASE_ROOT/current-sha"
printf '%s\n' "$IMAGE_TAG" > "$release/COMPLETE"
audit "deploy-completed sha=$IMAGE_TAG"
printf 'Deployment verified: %s\n' "$IMAGE_TAG"
