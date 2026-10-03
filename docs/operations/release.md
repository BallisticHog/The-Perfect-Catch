# Release gates and roadmap

## Private beta acceptance

The initial release is a private Google allowlist beta for the archived 2026 SA Schools Championships and explicitly registered live regattas. Default `site_release_state` to `private_beta`. Official-source content marked `official_source_unlicensed` may be shown within this approved private scope. Source snapshots and operational records remain separately protected.

Before declaring the beta operational, provide evidence for real Google sign-in and denial, revocation on the next protected request, administrator-only actions, a valid official import, idempotent rerun, failed refresh retaining the last good data, private media protection, mobile/desktop usability, and a successful backup restore. If a live credential, hosting prerequisite, or source fetch is unavailable, name it as outstanding instead of calling the deployment complete.

## Public release gate

Public exposure requires all of the following together:

- Recorded privacy approval for the intended public fields and surfaces.
- Recorded crest-rights approval for every crest being exposed.
- `public_approved` rights state for each exposed source-content or identity asset.
- A separate affirmative deployment flag and explicit public release decision.

Keep approval scope, reviewer, evidence, and time. Do not make sign-in removal a side effect of a migration, environment default, successful import, or rights-status update. Do not infer public release authority from private-beta approval.

## Roadmap

| Stage            | Scope                                                                                                              | Exit evidence                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Foundation       | Contracts, workspace conventions, database/auth model, Regatta Instrument tokens, protected shell                  | Build and checks pass; contracts agree with implementation                              |
| Results beta     | One championship archive, registered live adapter, exact snapshots, normalized results, provenance, invited access | Complete archive and live-state validation, idempotency, rollback and real access tests |
| Home operation   | Ubuntu VM, Caddy HTTPS, Tailscale administration, protected volumes, local and encrypted offsite backups           | Reachability and restore demonstrated; monitoring configured                            |
| Beta refinement  | School aliases, scoped identity, source corrections, usability and reliability improvements                        | Feedback addressed without expanding personal data scope                                |
| Public readiness | Privacy and rights evidence, reviewed public data scope, deployment decision                                       | Every public release gate satisfied                                                     |
| Broader archive  | Additional authorized regattas and source adapters                                                                 | Per-source compatibility, provenance, rights, and complete-import validation            |

The beta may display publisher result updates and a cautious publication-delay estimate. It does not claim official race timing or boat tracking. Cross-regatta athlete identity, public athlete search, individual notifications, and broad historical aggregation require their own product and data review.
