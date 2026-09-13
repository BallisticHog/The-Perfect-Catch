# The Catch UX contract

## Access and scope

The beta serves invited viewers and administrators through Google sign-in. It initially covers the archived 2026 SA Schools Championships. It provides regatta, event, race, result, and school context. It does not offer athlete profiles, athlete search, identity resolution, individual performance histories, or a canonical athlete directory.

The unauthenticated experience explains that access is private and presents Google sign-in. A denied sign-in gives a useful, generic access message without exposing whether another email has a grant. A revoked viewer loses access on the next protected request, even when a session cookie remains. The interface cannot grant access by hiding controls or trusting a browser role.

## Browsing behavior

| Surface          | Required behavior                                                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regatta overview | Identify the championship, venue, 6 to 8 March 2026 dates, archived status, and source                                                                               |
| Events and races | Use the publisher's event and race structure, retaining raw category and round labels                                                                                |
| Results          | Show school, lane, placing, recorded time, margin, and result status when supplied; missing values stay missing                                                      |
| School context   | Filter or group existing regatta results without creating athlete history; school accents remain scoped                                                              |
| Source detail    | Link to the precise official result page and distinguish source status from Catch import status                                                                      |
| Admin import     | Report queued/running/succeeded/failed or the implementation's equivalent, with counts and actionable errors; never show a failed import as a new successful archive |

Search and filters, if present, operate only on allowed regatta, event, race, or school fields. Race-local crew appearances may show the source-derived name, seat, and cox designation as part of a result. Crew text is not indexed into a person search. An appearance does not authorize creating a canonical person record or a cross-race person link. Minimize personal content beyond this result context in rendered responses and exports.

## Status and recovery

Loading feedback names the content being loaded. An empty archive differs from an empty filter result. Give a filter reset for the latter. An error preserves the viewer's useful context and offers an appropriate retry. A failed refresh continues to serve the last published valid import and indicates its freshness. If no valid import exists, show an honest unavailable state.

Result statuses such as DNS, DNF, DSQ, or an unknown source label must not silently become a normal finish. Do not use zero as a missing result time. Keep scheduled times separate from finish durations. Display local event dates and times explicitly; keep server timestamps unambiguous.

## Accessibility and privacy

Use semantic landmarks, a logical heading order, labelled form controls, table headers, visible keyboard focus, and status text that does not rely on colour. Preserve readable content at narrow widths and zoom. Keep sticky areas from obscuring focused controls. Announce meaningful async results without repeatedly interrupting a screen reader.

Authentication tokens, raw source snapshots, audit events, private media, and import internals are not public browsing surfaces. Protect direct data and media requests as well as pages. Keep protected responses out of shared caches. Configure private-beta search indexing restrictions, while treating authentication as the real access control.

## Release acceptance

Before exposing the beta, demonstrate an accepted invited Google account, a rejected uninvited account, rejection after revocation, server-side administrator enforcement, a valid published import, and a failed import preserving its predecessor. Check the results view with keyboard input and at mobile and desktop widths.

Public deployment is a separate future action. It requires the privacy approval, crest-rights approval, content-level `public_approved` states, and separate deployment flag described in [release operations](docs/operations/release.md). A completed UI or a working home server does not satisfy those gates.
