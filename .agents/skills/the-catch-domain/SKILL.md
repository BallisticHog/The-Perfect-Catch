---
name: the-catch-domain
description: Implement or review The Catch rowing archive domain, result browsing, school identity, and product scope using the repository contracts. Use for changes to regattas, events, races, results, schools, or archive UI; not for unrelated repository maintenance.
---

# The Catch domain

Read `docs/architecture/overview.md` for domain changes. Read `DESIGN.md` and `UX-CONTRACT.md` for interface changes, and `docs/design/decisions.md` when changing school identity. Paths are relative to the repository root.

The first release is a private Google allowlist beta for the 2026 SA Schools Championships at Roodeplaat, 6 to 8 March 2026. Preserve the publisher's event/race structure, source URL identity, raw labels, result statuses, and provenance. Do not substitute row order for placing or missing time for zero.

Use exact school aliases only. Keep ambiguous organization labels unresolved until an explicit mapping exists. Preserve required race-local athlete appearances with source names, seats, cox status, and raw annotations. Do not introduce a canonical athlete table, athlete search, athlete profiles, or cross-race person matching. A race-local appearance does not authorize a separate personal data feature.

Keep the Catch shell stable. Use the Regatta Instrument tokens and font roles from `DESIGN.md`. Limit school accents to school context. Label the St Dunstan's navy and bronze palette as inferred; retain the official source link and rights state for identity assets.

Implement loading, empty, failed, stale, and denied states that tell the truth about the archive. Validate the changed domain behavior and relevant keyboard/responsive interactions. Report fixtures and live data separately.

For first-party code and code examples, use four-space indentation, Allman braces, and `//` comments where the language supports them. Do not introduce an em dash character into first-party files. Do not expand data collection or deployment scope as a side effect of a domain change.
