# Data governance and rights gates

These are project release rules, not a determination that the project has received legal permission. Public availability, attribution, private access, and permission to redistribute are different facts.

## Minimum data and provenance

The initial product is an archive of regatta results with school context. Race-local athlete appearances are part of a faithful result: retain crew names, seats, cox status, and source annotations within the particular result. There is no canonical athlete table, athlete profile, athlete search, or cross-race person matching. Preserve source-derived raw values only where needed for faithful import, review, or provenance. Do not promote those appearances into a separate personal data product.

Each fetch preserves the exact response bytes and headers before parsing, source URL, fetch timestamp, content checksum, and import relationship. Each normalized record remains traceable to its source document and raw values. Keep snapshots access controlled and separate from ordinary viewer responses. Avoid logging raw crew lists or authentication credentials.

Source corrections create a traceable new version. An unchanged source must not create duplicate published records. Keep the previous valid publication available when a refresh fails. Corrections, removals, and access revocations should leave a limited audit trail without unnecessarily retaining the removed personal content in public views.

## Rights and release model

| State or gate                | Meaning                                                                                                                                |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `official_source_unlicensed` | Official source provenance is recorded; reuse permission is not established. Private-beta use only under this project's approved scope |
| `public_approved`            | The particular source content or identity asset has documented approval for public use                                                 |
| Privacy approval             | A recorded review approves the intended public fields, surfaces, and handling of school-rower information                              |
| Crest-rights approval        | A recorded review confirms allowed public use of each crest actually exposed                                                           |
| Deployment flag              | A separate operational control authorizes public exposure after the other gates are satisfied                                          |

Default `site_release_state` to `private_beta`. Require both recorded privacy and crest-rights approvals plus a separate deployment flag before public exposure. A global approval must not bypass a record's content-level rights state: only `public_approved` content may be public. Where approval is absent, keep the release private or omit the affected asset as supported by the approved release scope.

Store approval evidence, reviewer, timestamp, and scope. Do not fill approval fields with a build timestamp or treat a source's Official result label as licensing evidence. Public release requires an explicit decision separate from importing data.

## Operational handling

Restrict source snapshots, private media, audit events, and import diagnostics to appropriate roles. Serve protected media through an authenticated boundary or equivalent access-checked delivery. Do not expose a backup or snapshot directory through the reverse proxy. A signed-in viewer is not an administrator.

Maintain a way to review source corrections and requests concerning displayed content. Before a public release, document the responsible contact, retention periods, deletion handling, backup expiry, and the evidence supporting the approved public scope. These remain operational decisions until actually recorded; do not claim they are complete.
