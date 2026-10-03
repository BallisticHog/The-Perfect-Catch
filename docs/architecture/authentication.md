# Authentication and authorization contract

## Identity and sessions

Use Google OAuth with exactly the identity scopes `openid email profile`. Require a verified Google email. Normalize the email by trimming surrounding whitespace, applying Unicode NFC normalization, and lowercasing. Do not strip dots or plus suffixes. Use the same normalizer for creating and looking up grants. NFC is the non-compatibility-changing form and matches JavaScript's default normalization form; do not substitute NFKC or apply provider-specific mailbox equivalence.

On the first accepted sign-in, bind the active grant to the stable Google subject. Later sign-ins must satisfy the subject binding as well as the email and active-grant checks. Never transfer a binding automatically because an email changes. Handle an intentional account rebinding as an administrator-reviewed operation with an audit event.

Use database-backed sessions with a 24-hour lifetime. A valid session alone is insufficient: revalidate the current active grant on every protected page, API, server action, and media request. A revoked grant must stop access on the next protected request. Derive the current role from the grant rather than an enduring browser claim.

## Required persistence

The authentication store contains `user`, `account`, `session`, and `verification` tables. The access and release controls include:

| Table                | Required fields or contract                                                                                                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `access_grants`      | `email_normalized` unique; `role` in `admin`, `viewer`; `status` in `active`, `revoked`; nullable `google_subject`; `granted_at`; `granted_by_user_id`; `revoked_at`; `revoked_by_user_id`; `notes` |
| `security_events`    | Auditable security actions with timestamp, action, outcome, actor when known, and target where applicable; no secrets or full token values                                                          |
| `site_release_state` | Default `private_beta`; privacy approval; crest-rights approval; separate deployment flag                                                                                                           |

Bootstrap the first administrator through a documented administrative process. Do not make the first arbitrary Google visitor an administrator. Changing a grant, revoking access, running imports, and changing release state require current administrator authorization on the server.

## Request behavior

Reject unsigned-in requests, inactive or missing grants, unverified emails, expired sessions, and subject mismatches. Return an appropriate denied or unauthenticated response without exposing a list of invited accounts. Avoid caching protected content in shared caches. Apply the same boundary to direct result requests and media paths as to the visible page.

Validate OAuth state and use the authentication library's secure callback flow. Set production session cookies for HTTPS, HTTP-only use, and appropriate same-site handling. Keep client secret and session secret out of the repository. Restrict callback and trusted-origin configuration to the actual deployment origins.

## Acceptance evidence

Verify accepted access for an active invited account, denial for an uninvited account, denial for an unverified email, prevention of subject rebinding, next-request revocation, session expiry, and rejection of viewer attempts at administrator actions. Test direct endpoints in addition to navigation. A local development identity bypass must be explicit, fail closed in production, and must not be presented as evidence that real Google OAuth has been tested.
