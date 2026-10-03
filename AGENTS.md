# Repository working agreement

## Scope

This is the canonical The Perfect Catch rebuild. Never edit `C:\Personal\the-catch`; it is read-only reference material.

The first release is an account-only private beta. The first dataset is the 2026 SA Schools Championships at Roodeplaat. Do not add athlete search, canonical athlete identities, lifetime profiles, or cross-regatta dossiers.

## Code style

- Use strict Allman braces.
- Use four spaces, never tabs.
- Use `//` comments in TypeScript and JavaScript.
- Do not use Unicode U+2014 in first-party files, comments, commits, or pull request text.
- Prefer small modules with explicit boundaries and names from the rowing domain.
- Add tests with every behavior change.
- Keep migrations additive and reviewable.

## Data and security

- Every protected loader, action, handler, and media response must validate the current database session and active access grant.
- Never expose catalog or media data in unauthenticated HTML, metadata, errors, or React Server Component payloads.
- Preserve source bytes, headers, URLs, raw values, normalized values, and revision provenance.
- Never fuzzy-match schools or people automatically.
- Never create a canonical athlete table in the first slice.
- Treat crest records and school palette records as curated data, separate from results ingestion.
- Never hotlink protected media or accept a user-supplied filesystem path.

## Delivery

- Keep each logical commit buildable and include its tests.
- Do not force-push or merge a pull request.
- Exclude secrets, local source captures, media volumes, database volumes, and backups from Git.
