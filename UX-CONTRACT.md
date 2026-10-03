# The Catch UX contract

## Access and scope

The current development beta serves invited viewers and administrators through Google sign-in. It initially covers the archived 2026 SA Schools Championships. The intended product separates a future public Results catalogue from private My Rowing and School Programme workspaces. Unauthenticated Results access is not enabled until the release gates are satisfied. The current catalogue provides regatta, event, race, result, school, and championship-scoped source-name context. Verified member profiles and private training records are introduced only through coach-reviewed identity links and their own authorization contract.

The unauthenticated experience explains that access is private and presents Google sign-in. A denied sign-in gives a useful, generic access message without exposing whether another email has a grant. A revoked viewer loses access on the next protected request, even when a session cookie remains. The interface cannot grant access by hiding controls or trusting a browser role.

## Browsing behavior

| Surface          | Required behavior                                                                                                                                                    |
| ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Regatta overview | Identify the championship, venue, 6 to 8 March 2026 dates, archived status, and source                                                                               |
| Events and races | List each publisher event number once, then group its heats, repechages, semifinals, and finals into one progression view while retaining raw labels                 |
| Results          | Show school, lane, placing, recorded time, margin, and result status when supplied; missing values stay missing                                                      |
| School context   | Summarize published crew entries and evidenced results without claiming a current roster or unique athlete count; school accents remain scoped                       |
| Rower records    | Group exact published name plus exact school only inside one regatta; link every appearance back to its event and race; state the identity limitation clearly        |
| Source detail    | Link to the precise official result page and distinguish source status from Catch import status                                                                      |
| Admin import     | Report queued/running/succeeded/failed or the implementation's equivalent, with counts and actionable errors; never show a failed import as a new successful archive |

## Canonical UI Map

| Capability     | Canonical owner                                  | Source of truth                     | Allowed variants                         | Verification                                |
| -------------- | ------------------------------------------------ | ----------------------------------- | ---------------------------------------- | ------------------------------------------- |
| Select/Listbox | Native HTML select in `CatalogFilters`           | This contract and `premium-ui.json` | Native platform popup                    | Browser keyboard and narrow viewport checks |
| Form           | `CatalogFilters` and server-owned URL parameters | This contract                       | Catalog filtering only                   | Unit and browser interaction tests          |
| Scrollbar      | Global rules in `packages/ui/src/tokens.css`     | `DESIGN.md` tokens                  | Stable gutter on bounded race navigation | Static audit and browser inspection         |

Catalog filters intentionally use native selects. The operating-system popup geometry is accepted because these
controls select short, single values and native keyboard and touch behavior is preferable to an authored popup.
Committed filter values, including the selected racing day, remain in the URL.

Event search and filters operate only on allowed regatta, event, race, or school fields. Event search does not match crew names. A separate championship rower directory may search exact source-name projections within that regatta. Each projection groups only exact normalized published name plus exact school and links back to source races. It must not imply a verified, unique, current, or lifelong person. Minimize personal content beyond this result context in rendered responses and exports.

The regatta directory groups races by the publisher's exact event identifier. A round or day filter includes an event when at least one contained race matches, and opening the event still shows its complete published progression. Event search may match the exact event number, event label, or a school named in one of its result rows. It must not match athlete or crew names.

School statistics are projections from the published result rows. Published crew entries include listed DNS and scratch records. Evidenced starts include only finished and DNF results. Races contested and wins count distinct source races. Final appearances include published A, B, and C final entries. Final A podiums require a finished result with an explicit place from first through third. Published seat appearances include repeated source names and coxes, so they are neither a unique-person count nor a current school roster.

Navigation must preserve context. A regatta exposes event and rower-record tabs. An event exposes its complete progression and adjacent events. A race links to its event, adjacent races, every resolved school, and every published crew source record. A school links to its championship source-name records, and those records link back to their school, events, and races.

The primary home exposes Results, My Rowing, and School Programme as three distinct destinations. Results opens the existing regatta catalogue. My Rowing and School Programme remain authenticated even after Results is approved for public access. The account menu provides direct access to the two private workspaces.

Course Watch is reachable from the stable shell and from venue-aware regatta or programme context. A venue selector preserves the selected venue in the URL. The first venue set is Roodeplaat Dam and Germiston Lake at Victoria Lake Club. The screen must distinguish schematic course geometry from reviewed geometry and distinguish preview, current, stale, unavailable, and not-connected observations. Missing weather data produces an unavailable safety status, never a safe status.

Published source-name records and private St Dunstan's member records remain separate. A coach-reviewed link may connect them without changing the source evidence. A rower sees their own private record. An authorized coach sees the same underlying member record through a coach view. Public or catalogue views never expose training logs, attendance, coach notes, programme membership, or private forecasts.

## Status and recovery

Loading feedback names the content being loaded. An empty archive differs from an empty filter result. Give a filter reset for the latter. An error preserves the viewer's useful context and offers an appropriate retry. A failed refresh continues to serve the last published valid import and indicates its freshness. If no valid import exists, show an honest unavailable state.

Result statuses such as DNS, DNF, DSQ, or an unknown source label must not silently become a normal finish. Do not use zero as a missing result time. Keep scheduled times separate from finish durations. Display local event dates and times explicitly; keep server timestamps unambiguous.

## Accessibility and privacy

Use semantic landmarks, a logical heading order, labelled form controls, table headers, visible keyboard focus, and status text that does not rely on colour. Preserve readable content at narrow widths and zoom. Keep sticky areas from obscuring focused controls. Announce meaningful async results without repeatedly interrupting a screen reader.

Authentication tokens, raw source snapshots, audit events, private media, and import internals are not public browsing surfaces. Protect direct data and media requests as well as pages. Keep protected responses out of shared caches. Configure private-beta search indexing restrictions, while treating authentication as the real access control.

## Release acceptance

Before exposing the beta, demonstrate an accepted invited Google account, a rejected uninvited account, rejection after revocation, server-side administrator enforcement, a valid published import, and a failed import preserving its predecessor. Check the results view with keyboard input and at mobile and desktop widths.

Public deployment is a separate future action. It requires the privacy approval, crest-rights approval, content-level `public_approved` states, and separate deployment flag described in [release operations](docs/operations/release.md). A completed UI or a working home server does not satisfy those gates.
