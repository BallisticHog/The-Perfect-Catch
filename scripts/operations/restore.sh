#!/usr/bin/env bash
# Usage: sudo bash scripts/operations/restore.sh <absolute-backup-directory> --replace-production=catch-production
# Replaces production data only after explicit target confirmation and a fresh recovery backup.
# Practice on a separate recovery VM first. Keep services stopped on any failure.
# Retention policy: 7 daily / 4 weekly / 12 monthly; release recovery backups are never auto-pruned.
set -Eeuo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
require_host
operation_lock
[[ ${2:-} == --replace-production=catch-production ]] || fail 'Explicit --replace-production=catch-production is required.'
target=${1:-}
validate_backup "$target"
compose config --quiet
compose exec -T postgres pg_restore --list < "$target/database.dump" > /dev/null
# Only plain files and directories beneath the named archive roots are accepted.
while IFS= read -r entry
do
    [[ $entry == media || $entry == media/* || $entry == snapshots || $entry == snapshots/* \
        || $entry == live || $entry == live/* ]] \
        || fail 'Unexpected storage archive root.'
    [[ /$entry/ != */../* && /$entry/ != */./* && $entry != *//* ]] || fail 'Unsafe storage archive path.'
done < <(tar -tzf "$target/storage.tar.gz")
while IFS= read -r entry
do
    [[ ${entry:0:1} == d || ${entry:0:1} == '-' ]] || fail 'Storage archive contains a link or special file.'
done < <(tar -tvzf "$target/storage.tar.gz")
tar -tzf "$target/storage.tar.gz" > /dev/null
audit "restore-start backup=$target"
trap 'audit "restore-ended backup=$target exit=$?"' EXIT
compose stop --timeout 90 web worker live
bash "$CHECKOUT/scripts/operations/backup.sh" release
compose exec -T postgres pg_restore -U catch -d catch --clean --if-exists \
    --exit-on-error --single-transaction --no-owner < "$target/database.dump"
# Fixed container roots are mounted named volumes. Refuse links before removing their contents.
compose run --rm --no-deps --volume "$MEDIA_VOLUME:/var/lib/catch/media" \
    --volume "$LIVE_VOLUME:/var/lib/catch/live" --entrypoint sh worker -ec '
    test "$(readlink -f /var/lib/catch/media)" = /var/lib/catch/media
    test "$(readlink -f /var/lib/catch/snapshots)" = /var/lib/catch/snapshots
    test "$(readlink -f /var/lib/catch/live)" = /var/lib/catch/live
    test -d /var/lib/catch/media
    test -d /var/lib/catch/snapshots
    test -d /var/lib/catch/live
    find /var/lib/catch/media /var/lib/catch/snapshots /var/lib/catch/live -mindepth 1 -delete
'
compose run --rm --no-deps -T --volume "$MEDIA_VOLUME:/var/lib/catch/media" \
    --volume "$LIVE_VOLUME:/var/lib/catch/live" --entrypoint tar worker \
    -xzf - --no-same-owner -C /var/lib/catch < "$target/storage.tar.gz"
printf 'Restored %s. Application writers remain stopped.\n' "$target"
printf 'Select the matching retained release, review migrations, then start and verify services.\n'
