# Archived regatta import contract

## Task and source

The worker task name is exactly `catalog.importRegatta`. Its initial supported source is [the 2026 SA Schools Championships index](https://www.regattaresults.co.za/Results/Results2026/2026-Feb-SASChamps/results.htm). It discovers and follows race detail links. An index-only fetch is not a completed regatta import.

Restrict automatic fetches to the configured source host and relevant result scope. Resolve relative links against the source URL. Validate redirects and discovered URLs before fetching. Do not turn an administrator-supplied URL into unrestricted internal-network access.

## Fetch and archive

Use host concurrency 1 with at least one second between requests. Respect retry guidance, use bounded retries, and stop with an explicit failed import when the source cannot be retrieved reliably. Use conditional request headers when validators are available. Do not refetch an unchanged detail page merely to manufacture a new publication.

Before parsing, retain the exact response bytes and response headers together with the source URL, fetch timestamp, HTTP status, and checksum. For a 304 response, retain the response metadata and link to the previously stored body; do not parse the empty 304 body as a new document.

The initial adapter decodes Windows-1252. Preserve the original bytes so decoding or parsing can be corrected later. A source format change must be reported as a compatibility failure instead of silently accepting an empty or truncated archive.

## Identity and normalization

Use source URL as the strongest identity key. Keep raw and normalized values. Preserve source race and event identifiers, organization labels, round labels, raw timing strings, source statuses, and source order. Normalize school aliases by exact configured matches only. Unknown or ambiguous organizations remain unresolved and visible in import diagnostics.

Separate finish duration from scheduled time, placing from row order, and sporting status from ingestion status. Retain missing values as missing. Unsupported labels remain raw and are flagged for review instead of being guessed. Parse crew text into race-local athlete appearances with raw name, display name, seat, cox status, and raw annotation. Preserve the full raw crew string. Do not create canonical athlete records, person indexes, or cross-race links from those appearances.

## Validate and publish

Validate discovered detail counts against fetched and parsed detail counts, parsed race and result counts, required source identifiers, duplicate source keys, timing consistency, and relationship integrity. Record unresolved aliases and parser warnings. Zero or materially incomplete records from a previously populated source must fail validation unless the source change has been deliberately reviewed.

Stage the candidate import separately from the active archive. Publish the complete validated candidate in a single database transaction. Failure during fetch, parse, validation, or publication leaves the last good archive active. Mark the failed run with useful diagnostics. Do not mix a partial new import into the last published regatta.

An unchanged import is idempotent: it must not duplicate regattas, events, races, results, or source-body records. A changed import records the new provenance and transitions the published archive atomically. Serialization or equivalent locking must prevent overlapping imports from publishing conflicting versions of the same regatta.

## Acceptance evidence

Demonstrate an index with detail links, Windows-1252 text, an unchanged rerun, conditional-response reuse, a changed page, an exact alias and an unknown alias, a malformed detail page, a missing detail page, and a publication failure. The failure cases must leave the previous successful publication intact. Report actual counts and distinguish fixtures from a live source import.
