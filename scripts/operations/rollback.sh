#!/usr/bin/env bash
# Usage: sudo --preserve-env=SSH_CONNECTION bash scripts/operations/rollback.sh <retained-sha> --schema-compatible
# Review additive migrations before asserting compatibility. Otherwise restore a matching backup.
# Check out the retained release first. Does not run migrations or remove images, data or backups.
set -Eeuo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
require_host
operation_lock
validate_sha "${1:-}"
[[ ${2:-} == --schema-compatible ]] || fail 'Review the database schema and explicitly supply --schema-compatible.'
export IMAGE_TAG=$1
connection=${SSH_CONNECTION:-}
peer=${connection%% *}
[[ $peer =~ ^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.[0-9]{1,3}\.[0-9]{1,3}$ ]] \
    || fail 'Rollback requires a Tailscale IPv4 SSH session.'
[[ $(git -C "$CHECKOUT" rev-parse HEAD) == "$IMAGE_TAG" ]] || fail 'Checkout must match the rollback release.'
[[ -z $(git -C "$CHECKOUT" status --porcelain) ]] || fail 'Rollback requires a clean checkout.'
record=$(find "$RELEASE_ROOT" -mindepth 2 -maxdepth 2 -path "*-$IMAGE_TAG/COMPLETE" -type f -print -quit)
[[ -n $record && $(<"$record") == "$IMAGE_TAG" ]] || fail 'No retained successful release matches this SHA.'
compose config --quiet
while IFS= read -r image
do
    docker image inspect "$image" > /dev/null || fail "Retained image missing: $image"
done < <(compose config --images)
audit "rollback-start sha=$IMAGE_TAG schema-compatibility=operator-reviewed"
trap 'audit "rollback-ended sha=$IMAGE_TAG exit=$?"' EXIT
compose stop --timeout 90 web worker live
bash "$CHECKOUT/scripts/operations/backup.sh" release
compose up -d --pull never --force-recreate --wait --wait-timeout 180 web worker live caddy
bash "$CHECKOUT/scripts/operations/verify.sh"
printf '%s\n' "$IMAGE_TAG" > "$RELEASE_ROOT/current-sha"
audit "rollback-completed sha=$IMAGE_TAG"
