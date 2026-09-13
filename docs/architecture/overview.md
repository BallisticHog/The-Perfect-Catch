# Architecture and domain boundaries

The Catch begins as a private archived-regatta beta. The first supported event is the 2026 SA Schools Championships at Roodeplaat, 6 to 8 March 2026. It is not a live timing service.

## Runtime responsibilities

| Component              | Responsibility                                                                                                                                |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Web application        | Google sign-in, current-grant authorization, archive browsing, protected media access, administrator import control                           |
| PostgreSQL             | Auth records, access grants, normalized archive, provenance metadata, security events, release state, and durable job state where implemented |
| Worker                 | Execute `catalog.importRegatta`, fetch conservatively, preserve snapshots, parse and validate, publish transactionally                        |
| Snapshot/media storage | Exact fetched documents and rights-controlled identity assets; no direct public directory listing                                             |
| Caddy                  | HTTPS termination and reverse proxy to the web service                                                                                        |

Keep authorization decisions on the server. Worker source credentials and import controls do not belong in client bundles. Runtime code, migrations, and tests remain the evidence of implementation; this document defines the required boundary.

## Domain model

Represent regattas, events, races, results, schools, source documents, import runs, and exact school aliases. Preserve source identifiers and source URLs alongside internal identifiers. The source URL is the strongest available identity key for imported source records. Do not merge records by a similar label alone.

Keep a source document's raw content and parsed raw fields separately from normalized values. Preserve race category, round, progression, status, original timing text, and organization label where present. Normalize timings to a consistent duration representation without replacing unknown or absent values with zero. Keep source order and placing separate when they are not the same.

Schools can have exact aliases with explicit provenance. Unknown school text stays unresolved or requires an explicit alias; fuzzy matching cannot silently assign a result. Race-local athlete appearances are required: retain each source crew member's raw name, display name, seat, cox status, and raw annotation within that result. No canonical athlete table exists. An appearance belongs to its race result and does not become a global identity, profile, search field, or cross-race link.

## Detailed contracts

- [Authentication and authorization](authentication.md)
- [Import contract](import-contract.md)
- [Data governance](../data-sources/governance.md)
- [Home VM topology](../operations/home-vm.md)
- [Release gates and roadmap](../operations/release.md)
