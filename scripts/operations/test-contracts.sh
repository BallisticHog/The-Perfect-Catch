#!/usr/bin/env bash
# Read-only contract tests. No containers are started and no production secrets are read.
set -Eeuo pipefail
repository=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
for script in "$repository"/scripts/operations/*.sh
do
    bash -n "$script"
done
export CATCH_DOMAIN=catch.example.invalid
export ACME_EMAIL=operator@example.invalid
export BETTER_AUTH_SECRET=test-only-secret-with-at-least-32-characters
export GOOGLE_CLIENT_ID=test-only
export GOOGLE_CLIENT_SECRET=test-only
export PUBLIC_CONTACT_EMAIL=operator@example.invalid
export REGATTA_RESULTS_USER_AGENT=The-Catch-Test/0.1
export GHCR_NAMESPACE=example/the-perfect-catch
export IMAGE_TAG=0123456789012345678901234567890123456789
export POSTGRES_PASSWORD=test-only
docker compose --file "$repository/infra/compose.production.yml" --profile operations config --format json \
    | node "$repository/scripts/operations/verify-compose.mjs"
node --test "$repository/scripts/operations/contracts.test.mjs"
