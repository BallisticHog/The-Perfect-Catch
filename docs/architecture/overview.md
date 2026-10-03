# Architecture and domain boundaries

The Catch begins as a private results beta. Its archive starts with the 2026 SA Schools Championships at Roodeplaat, 6 to 8 March 2026. Its first monitored regatta is St Mary's U16, U19 and Masters at Roodeplaat on 3 October 2026. The target product combines a future public Results catalogue with private My Rowing and School Programme workspaces. The live monitor reports publisher observations and a low-confidence publication-delay estimate; it does not provide official timing or operational weather.

## Runtime responsibilities

| Component              | Responsibility                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Web application        | Google sign-in, current-grant authorization, archive browsing, protected media access, administrator import control                           |
| PostgreSQL             | Auth records, access grants, normalized archive, provenance metadata, security events, release state, and durable job state where implemented |
| Worker                 | Execute `catalog.importRegatta`, fetch conservatively, preserve snapshots, parse and validate, publish transactionally                        |
| Live monitor           | Poll one registered active regatta, retain the last valid draw/results, record revisions, and publish private read state                      |
| Snapshot/media storage | Exact fetched documents and rights-controlled identity assets; no direct public directory listing                                             |
| Caddy                  | HTTPS termination and reverse proxy to the web service                                                                                        |

Keep authorization decisions on the server. Worker source credentials and import controls do not belong in client bundles. Runtime code, migrations, and tests remain the evidence of implementation; this document defines the required boundary.

## Domain model

Represent regattas, events, races, results, schools, source documents, import runs, and exact school aliases. Preserve source identifiers and source URLs alongside internal identifiers. The source URL is the strongest available identity key for imported source records. Do not merge records by a similar label alone.

Keep a source document's raw content and parsed raw fields separately from normalized values. Preserve race category, round, progression, status, original timing text, and organization label where present. Normalize timings to a consistent duration representation without replacing unknown or absent values with zero. Keep source order and placing separate when they are not the same.

Represent rowing venues separately from regattas so uploaded calendars and imported regatta schedules can resolve to reviewed venue and course records. Initial venue keys are Roodeplaat and Germiston. A course revision records distance, lane geometry, course bearing, shoreline or map evidence, validity dates, reviewer, and source. A schematic course is not promoted to surveyed geometry.

Weather observations preserve provider, observed time, received time, coordinates, source quality, raw values, and units. Tower, forecast, radar, lightning, and coach visual observations remain separate evidence streams. Safety decisions use explicit policy and authorized human acknowledgement. Performance models may consume weather evidence but cannot produce a safety approval.

Schools can have exact aliases with explicit provenance. Unknown school text stays unresolved or requires an explicit alias; fuzzy matching cannot silently assign a result. Race-local athlete appearances are required: retain each source crew member's raw name, display name, seat, cox status, and raw annotation within that result.

The private catalogue may derive a regatta-scoped source-name record from exact normalized published name plus exact school. It can link appearances across races in that one regatta and can be searched inside the regatta. It is not a canonical athlete, a verified person, or a link to another regatta. The interface must explain that two people with the same published name at one school can share a record. Fuzzy person matching and cross-regatta identity remain prohibited.

A future private member domain may create verified St Dunstan's people, school memberships, programme groups, session assignments, workout logs, and coach-reviewed links to source appearances. It cannot rewrite or merge source appearances. Cross-regatta member history is available only through reviewed links with correction and split workflows.

## Detailed contracts

- [Authentication and authorization](authentication.md)
- [Import contract](import-contract.md)
- [Live regatta contract](live-regatta-contract.md)
- [Data governance](../data-sources/governance.md)
- [Home VM topology](../operations/home-vm.md)
- [Release gates and roadmap](../operations/release.md)
