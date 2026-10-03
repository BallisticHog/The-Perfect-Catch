# Reviewed school crests

School crests are curated independently from results ingestion and school palettes. Use these commands only from a trusted administrator shell on the server. There is no web upload or remote URL fetch. Review the locally acquired file and its official source first; a reachable official source establishes provenance, not reuse permission.

The commands require `DATABASE_URL` and `ADMIN_SESSION_TOKEN` in the process environment. The session token must identify a current database session for a verified Google account with its current active administrator grant and matching subject binding. Supply the token through the server's secret mechanism, never command arguments, shared shell history, logs, or Git. Clear the temporary environment after use. A viewer, expired session, revoked grant, or mismatched Google identity is rejected.

## Register a reviewed crest

Set these process environment values, then run `pnpm --filter @the-perfect-catch/worker crest:register`:

| Variable                    | Meaning                                                                          |
| --------------------------- | -------------------------------------------------------------------------------- |
| `CREST_SCHOOL_ID`           | Existing exact school ID; aliases and fuzzy matching are not accepted            |
| `CREST_INPUT_FILE`          | Absolute path to the reviewed file on the trusted server                         |
| `MEDIA_ROOT`                | Existing absolute private media volume shared with protected media delivery      |
| `CREST_OFFICIAL_SOURCE_URL` | Exact official HTTPS URL, without credentials or fragment                        |
| `CREST_ACQUIRED_AT`         | Actual acquisition timestamp in ISO format, such as `2026-09-14T09:00:00Z`       |
| `CREST_RIGHTS_NOTES`        | Review notes and available rights evidence; explicitly record missing permission |
| `CREST_ATTRIBUTION`         | Source attribution                                                               |
| `CREST_ALT_TEXT`            | Reviewed accessible crest description                                            |
| `CREST_REVIEWED`            | Exactly `true`, confirming human review of the file and source                   |

Only single-frame PNG, JPEG, and WebP files are accepted, with a 5 MiB file limit and 16 million pixel limit. Format and dimensions come from image decoding, not the supplied filename. The full image must decode successfully. Original bytes are preserved under `MEDIA_ROOT/crests/<sha256>.<extension>`; an operator cannot supply a storage key. Storage uses a private temporary file and an atomic same-volume hard link, never overwriting conflicting bytes. The private volume must support hard links and be writable only by trusted service administrators. The web service requires read access to the resulting files. Keep the entire volume outside web roots and Git, and back it up with the database.

Registration always records `private_beta` visibility and `official_source_unlicensed` rights. This command cannot approve public use, license a crest, alter school palettes, or restore a removed asset. It associates the asset with the exact school and records the acting administrator, previous association, checksum, source, acquisition, and review notes in the audit event. Repeating the same file for the same eligible school reuses its record; original acquisition metadata is retained, and the new review attempt is audited. Bytes already registered to another school or to a removed/publicly reviewed asset are rejected for reassignment. The same hash is not a school identity match.

## Take down a crest

Set `CREST_ASSET_ID` to the stored asset UUID and `CREST_TAKEDOWN_REASON` to the reviewed reason, then run `pnpm --filter @the-perfect-catch/worker crest:remove` with the same administrator session environment.

The transaction marks the asset removed, appends its timestamp/reason/actor to takedown history, records an audit event, and clears any current crest association. Existing protected delivery refuses removed assets on the next request. School rendering returns to its deterministic text/monogram fallback while retaining its separately curated palette. Taking down an older asset does not clear a newer crest association.

Takedown withdraws delivery and retains private bytes and provenance for review; it is not physical erasure. Removed content cannot be restored through registration. Backup expiry and any approved physical erasure remain separate operator decisions. If file storage succeeds but the database transaction fails, an unreferenced private content-addressed file may remain; it is not served without an eligible database record and may be reconciled later. No automatic deletion of an operator's source file, existing asset, or backup occurs.
