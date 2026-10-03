#!/usr/bin/env bash
# Ubuntu Server only. Secrets are parsed by Compose, never sourced as shell code.
set -Eeuo pipefail
umask 077

readonly CHECKOUT=/opt/the-perfect-catch
readonly SECRET_FILE=/etc/the-perfect-catch/production.env
readonly BACKUP_ROOT=/var/backups/the-perfect-catch
readonly RELEASE_ROOT=/var/lib/the-perfect-catch/releases
readonly MEDIA_VOLUME=catch-production-media
readonly LIVE_VOLUME=catch-production-live

fail()
{
    printf '%s\n' "$*" >&2
    exit 1
}

require_host()
{
    [[ $EUID -eq 0 ]] || fail 'Run with sudo on the production VM.'
    [[ -f /etc/the-perfect-catch/server-id ]] || fail 'Missing production host marker.'
    [[ $(</etc/the-perfect-catch/server-id) == catch-production ]] || fail 'Wrong host marker.'
    [[ -d $CHECKOUT && $(realpath -e -- "$CHECKOUT") == "$CHECKOUT" ]] || fail 'Unexpected checkout path.'
    [[ -f $SECRET_FILE && ! -L $SECRET_FILE ]] || fail 'Missing or linked secret file.'
    [[ $(stat -c %u -- "$SECRET_FILE") == 0 ]] || fail 'Secret file must belong to root.'
    [[ $(stat -c %a -- "$SECRET_FILE") =~ ^(400|600)$ ]] || fail 'Secret file must have mode 400 or 600.'
    for location in "$BACKUP_ROOT" "$RELEASE_ROOT"
    do
        [[ $(realpath -m -- "$location") == "$location" ]] || fail 'Linked operational directory refused.'
        install -d -m 700 -- "$location"
    done
}

operation_lock()
{
    if [[ ${CATCH_OPERATION_LOCK_HELD:-0} != 1 ]]
    then
        exec 9>/run/lock/catch-production.lock
        flock -n 9 || fail 'Another production operation is running.'
        export CATCH_OPERATION_LOCK_HELD=1
    fi
}

compose()
{
    # Scheduled operations must follow the deployed release, not the bootstrap env-file tag.
    local image_tag=${IMAGE_TAG:-}
    if [[ -z $image_tag && ( -e $RELEASE_ROOT/current-sha || -L $RELEASE_ROOT/current-sha ) ]]
    then
        image_tag=$(read_release_sha "$RELEASE_ROOT/current-sha") || return 1
    fi
    if [[ -n $image_tag ]]
    then
        export IMAGE_TAG=$image_tag
    fi
    docker compose --project-name catch-production --env-file "$SECRET_FILE" \
        --file "$CHECKOUT/infra/compose.production.yml" "$@"
}

audit()
{
    printf '%s operator=%s %s\n' "$(date -u +%FT%TZ)" "${SUDO_USER:-root}" "$*" >> "$RELEASE_ROOT/audit.log"
}

validate_sha()
{
    [[ ${1:-} =~ ^[0-9a-f]{40}$ ]] || fail 'Supply a full lowercase 40-character commit SHA.'
}

read_release_sha()
{
    local record=${1:-}
    [[ -f $record && ! -L $record ]] || fail 'Missing or linked current release record.'
    local image_tag
    image_tag=$(<"$record")
    validate_sha "$image_tag"
    printf '%s\n' "$image_tag"
}

running_application_services()
{
    local services service
    services=$(compose ps --status running --services) || fail 'Cannot determine running writers; backup aborted.'
    while IFS= read -r service
    do
        if [[ $service == web || $service == worker || $service == live ]]
        then
            printf '%s\n' "$service"
        fi
    done <<< "$services"
}

validate_checksum_manifest()
{
    local manifest=$1
    local line name
    local -A seen=()
    [[ $(wc -l < "$manifest") -eq 3 ]] || fail 'Unexpected checksum manifest.'
    while IFS= read -r line || [[ -n $line ]]
    do
        [[ $line =~ ^[0-9a-f]{64}\ \ (database\.dump|storage\.tar\.gz|metadata\.txt)$ ]] \
            || fail 'Unsafe checksum manifest entry.'
        name=${BASH_REMATCH[1]}
        [[ ! -v seen[$name] ]] || fail 'Duplicate checksum manifest entry.'
        seen[$name]=1
    done < "$manifest"
}

validate_backup()
{
    local target=${1:-}
    [[ $target =~ ^/var/backups/the-perfect-catch/(daily|weekly|monthly|release)/[0-9]{8}T[0-9]{6}Z$ ]] \
        || fail 'Backup path must identify a timestamped backup beneath the fixed backup root.'
    [[ -d $target && $(realpath -e -- "$target") == "$target" ]] || fail 'Backup target missing or linked.'
    for name in database.dump storage.tar.gz metadata.txt SHA256SUMS COMPLETE
    do
        [[ -f $target/$name && ! -L $target/$name ]] || fail "Incomplete backup: $name"
    done
    # Reject a modified manifest before allowing checksum tools to read any path.
    validate_checksum_manifest "$target/SHA256SUMS"
    (cd "$target" && sha256sum --check --status SHA256SUMS) || fail 'Backup checksum verification failed.'
}
