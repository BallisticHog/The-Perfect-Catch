---
name: the-catch-ingestion
description: Build, change, or diagnose The Catch archived regatta importer, source snapshots, normalization, exact school aliases, and publication workflow. Use when working on catalog.importRegatta or its parsers and tests; not for general web fetching.
---

# The Catch ingestion

Read `docs/architecture/import-contract.md` and `docs/data-sources/source-register.md` before changing an import. Read `docs/data-sources/governance.md` when altering retained fields, source storage, or visibility. Paths are relative to the repository root.

Keep the job name `catalog.importRegatta`. The first adapter discovers race detail pages from the registered 2026 championship index. Retain the exact source path even though it contains Feb and the event took place in March.

Archive exact response bytes and headers before parsing. Decode this source as Windows-1252. Keep checksums, source URLs, fetch metadata, raw values, and normalized values connected. Use source URL as the strongest identity key. For 304 responses, reference the stored body instead of parsing an empty body.

Limit each source host to concurrency 1 and at least one second spacing. Use conditional headers where possible. Bound retries and validate redirects/discovered links against the configured source scope. A source failure must end with useful diagnostics rather than a partial publication.

Map schools through exact approved aliases only. Parse crew strings into required race-local appearances with raw/display names, seats, cox status, and raw annotations. Preserve the full raw crew string. Do not infer canonical person identities or cross-race links from appearances. Preserve unsupported raw labels and missing values for review.

Validate detail coverage, record counts, source keys, and relationships before a transactional publication. A failed refresh leaves the last good archive active. Unchanged imports do not create duplicate domain records. Prevent overlapping runs from publishing conflicting versions.

Verify the change with representative source-shaped fixtures and failure behavior. Distinguish fixture success from a real live import. Preserve first-party four-space indentation, Allman braces, and `//` comments where supported; do not add em dash characters. A request to diagnose alone does not authorize a live import or data mutation.
