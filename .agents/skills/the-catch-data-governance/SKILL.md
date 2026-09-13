---
name: the-catch-data-governance
description: Review or implement The Catch provenance, content rights, school identity permissions, private access, and public-release gates. Use when changing exposed fields, source or media visibility, access grants, or release controls; not as a general legal audit.
---

# The Catch data governance

Read `docs/data-sources/governance.md` and the relevant source entry in `docs/data-sources/source-register.md`. For access changes read `docs/architecture/authentication.md`; for release changes read `docs/operations/release.md`. Paths are relative to the repository root.

Keep the beta private by default. `official_source_unlicensed` records may be used only within the approved private beta. Public data and assets require their own `public_approved` state plus recorded privacy approval, recorded crest-rights approval, and the separate deployment flag. A publisher's Official result label establishes neither reuse permission nor a release approval.

Retain evidence, reviewer, scope, and timestamp for approvals. Do not invent permission from source availability or attribution. Mark St Dunstan's palette as inferred and retain its official identity source. Protect crests, raw snapshots, and operational metadata according to their rights and access scope.

Allow the required race-local crew appearances as part of their result context. Do not add athlete profiles, athlete search, a canonical athlete table, or cross-race person links. Minimize personal data beyond this result context in rendered responses, indexes, logs, and exports. Keep provenance without promoting appearances into an identity product.

Require a verified Google email, trim plus Unicode NFC plus lowercase email normalization, stable subject binding, and a current active grant on every protected request. Never strip email dots or plus suffixes. Enforce the current administrator role on the server. A 24-hour database session does not delay revocation. Apply access checks to direct data and media paths as well as visible pages.

For a requested change, identify the actual affected records and surfaces, implement only the authorized scope, and verify positive and negative access or release cases. A review alone does not authorize modifying grants, approvals, data, or deployments. Report missing approval evidence factually without asserting a legal conclusion.

Use four-space indentation, Allman braces, and `//` comments in supported first-party code examples. Do not introduce em dash characters into first-party files.
