#!/usr/bin/env bash
# Usage: sudo bash scripts/operations/prune-backups.sh daily|weekly|monthly [--apply]
# Dry run is the default. Apply only after encrypted off-host replication is verified.
# Retention: 7 daily, 4 weekly, 12 monthly. Never removes release backups or failed sets.
# Each deletion is limited to five known files in a validated completed backup directory.
set -Eeuo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
require_host
operation_lock
tier=${1:-}
case "$tier" in
    daily) keep=7 ;;
    weekly) keep=4 ;;
    monthly) keep=12 ;;
    *) fail 'Specify daily, weekly, or monthly.' ;;
esac
[[ ${2:-} == '' || ${2:-} == --apply ]] || fail 'Only --apply is accepted.'
directory="$BACKUP_ROOT/$tier"
[[ -d $directory && $(realpath -e -- "$directory") == "$directory" ]] || fail 'Missing or linked tier directory.'
mapfile -t candidates < <(find "$directory" -mindepth 1 -maxdepth 1 -type d -printf '%p\n' | sort -r)
completed=0
for target in "${candidates[@]}"
do
    [[ -f $target/COMPLETE ]] || continue
    validate_backup "$target"
    completed=$((completed + 1))
    [[ $completed -gt $keep ]] || continue
    [[ $(find "$target" -mindepth 1 -maxdepth 1 | wc -l) -eq 5 ]] || fail 'Unexpected files in backup; refusing deletion.'
    printf 'Expired backup: %s\n' "$target"
    if [[ ${2:-} == --apply ]]
    then
        rm -- "$target/database.dump" "$target/storage.tar.gz" "$target/metadata.txt" "$target/SHA256SUMS" "$target/COMPLETE"
        rmdir -- "$target"
        audit "backup-pruned path=$target"
    fi
done
