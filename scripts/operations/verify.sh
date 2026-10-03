#!/usr/bin/env bash
# Usage: sudo bash /opt/the-perfect-catch/scripts/operations/verify.sh
# Read-only verification. No catalog content or secrets are printed.
set -Eeuo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/common.sh"
require_host
compose config --quiet
for service in postgres web worker live caddy
do
    container=$(compose ps --quiet "$service")
    [[ -n $container ]] || fail "Missing service: $service"
    [[ $(docker inspect --format '{{.State.Health.Status}}' "$container") == healthy ]] \
        || fail "Unhealthy service: $service"
    if [[ $service != caddy ]]
    then
        [[ -z $(docker port "$container") ]] || fail "Unexpected published port on $service"
    fi
done
domain=$(compose exec -T caddy printenv CATCH_DOMAIN)
[[ $domain =~ ^[a-zA-Z0-9.-]+$ && $domain == *.* ]] || fail 'Invalid public hostname.'
headers=$(curl --fail --silent --show-error --max-time 20 --dump-header - --output /dev/null "https://$domain/health")
for expected in 'cache-control:.*private.*no-store' 'x-robots-tag:.*noindex' 'x-content-type-options:.*nosniff' 'strict-transport-security:'
do
    printf '%s\n' "$headers" | grep -Eiq "$expected" || fail "Missing response protection: $expected"
done
printf 'Healthy services, private response headers, valid HTTPS, and internal application ports verified.\n'
