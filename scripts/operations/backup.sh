#!/usr/bin/env bash
# Usage: sudo bash /opt/the-perfect-catch/scripts/operations/backup.sh daily|weekly|monthly|release
# Policy: keep 7 daily, 4 weekly, 12 monthly successful full backups. Release backups
# are retained until an operator explicitly retires the associated rollback release.
# Run prune-backups.sh separately after confirming an encrypted off-host copy.
# This briefly stops writers for a consistent database/media/snapshot recovery point.
set -Eeuo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
require_host
operation_lock
tier=${1:-}
[[ $tier =~ ^(daily|weekly|monthly|release)$ ]] || fail 'Specify daily, weekly, monthly, or release.'
compose config --quiet
stamp=$(date -u +%Y%m%dT%H%M%SZ)
destination="$BACKUP_ROOT/$tier/$stamp"
[[ $(realpath -m -- "$destination") == "$destination" ]] || fail 'Linked backup destination refused.'
[[ ! -e $destination ]] || fail 'Backup timestamp already exists.'
install -d -m 700 -- "$destination"
running=()
running_services=$(running_application_services) || exit 1
while IFS= read -r service
do
    if [[ $service == web || $service == worker || $service == live ]]
    then
        running+=("$service")
    fi
done <<< "$running_services"

finish()
{
    local result=$?
    trap - EXIT
    if [[ ${#running[@]} -gt 0 ]]
    then
        if ! compose start "${running[@]}"
        then
            result=1
        fi
    fi
    audit "backup tier=$tier path=$destination exit=$result"
    exit "$result"
}
trap finish EXIT
compose stop --timeout 90 web worker live
compose exec -T postgres pg_dump -U catch -d catch --format=custom > "$destination/database.dump"
compose exec -T postgres pg_restore --list < "$destination/database.dump" > /dev/null
compose run --rm --no-deps -T --volume "$MEDIA_VOLUME:/var/lib/catch/media:ro" \
    --volume "$LIVE_VOLUME:/var/lib/catch/live:ro" --entrypoint tar worker \
    -czf - -C /var/lib/catch media snapshots live > "$destination/storage.tar.gz"
tar -tzf "$destination/storage.tar.gz" > /dev/null
printf 'created_utc=%s\ncommit=%s\npolicy=7_daily_4_weekly_12_monthly\n' \
    "$stamp" "$(git -C "$CHECKOUT" rev-parse HEAD)" > "$destination/metadata.txt"
(cd "$destination" && sha256sum database.dump storage.tar.gz metadata.txt > SHA256SUMS)
printf '%s\n' "$stamp" > "$destination/COMPLETE"
validate_backup "$destination"
printf 'Verified backup: %s\n' "$destination"
