# Source fixture

`2026-event-1-semifinal-1.html` is a byte-locked parser fixture derived from the structure of the existing
read-only reference fixture. Athlete and boat names are deliberately replaced with obvious fixture values
because the source repository is public. It represents the approved championship title, event 1, race 69,
semifinal 1. Its structural source URL is
`https://www.regattaresults.co.za/Results/Results2026/2026-Feb-SASChamps/1_SF%201.htm`.

The fixture is not a live capture and does not prove current source contents. Tests also construct
specific Windows-1252 byte sequences explicitly, because the representative source fixture happens to use
ASCII characters despite declaring Windows-1252. Production imports retain each raw response body, SHA-256,
response headers, encoding, URL, and fetch attempt in PostgreSQL.

## Live structural golden manifest

`2026-live-structure.json` records a live private dry parse on 14 September 2026. The registered index and
all 203 discovered detail pages returned HTTP 200: 204 requests, 42 events, 203 official races, 1,465 result
rows, and 4,045 race-local appearances. These are live aggregate counts, separate from the sanitized
fixture's one race, eight result rows, and eight appearances.

The verification used `importRegatta` with `dryRun: true`, an in-memory repository, and the production
`SourceFetcher`. The exact response bytes, headers, URLs, and hashes were retained in process memory
before parsing, then released when the process exited. No database was used, no publication was attempted,
and no source bodies, athlete names, boat names, school labels, or raw diagnostics were written to disk.
The manifest contains only structural evidence and verification metadata. It is not a source archive or
evidence of publication or reuse rights.

Requests used the manifest's identifiable project User-Agent and Windows-1252 decoding. Serial fetching
used a configured and observed minimum interval of 1,500 ms. There were no redirects or retries. No cached
bodies were available, so this run did not exercise live conditional reuse; fixture tests cover that path.
The dry run used zero school aliases: all 1,465 `unmapped-school` warnings are consequently expected.
Four unsupported source result statuses remain `unknown` for review. No validation errors occurred.

Digest construction uses SHA-256 of UTF-8 text. Except for `overviewSha256`, which hashes the exact index
bytes, lists are lexically sorted and joined with a single LF and no trailing LF. `sourceKeysSha256`
hashes all 204 canonical URL keys. `sourceBodiesSha256` hashes all `sourceKey:bodySha256` pairs.
`raceStructureSha256` hashes each `raceSourceKey:eventId:resultCount:appearanceCount` tuple.
`importManifestSha256` is the importer result, including its parser version and empty alias configuration.
No digest is derived from an individual name.

Offline tests enforce the manifest's field allowlist, numeric counts, hash shapes, complete coverage, and
count reconciliation. They do not refetch the publisher or establish that the live source remains unchanged.
