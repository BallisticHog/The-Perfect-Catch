# The Catch design contract

The Catch is being developed as a public rowing-results catalogue connected to private My Rowing and School Programme workspaces. Until the public release gates are approved, every implemented surface remains inside the Google allowlist beta. Its first regatta is the 2026 SA Schools Championships at Roodeplaat, held 6 to 8 March 2026. The visual direction is Regatta Instrument: clear sporting typography, precise result alignment, and restrained colour on a blue-grey canvas.

## Regatta Instrument tokens

| Role         | Value     | Use                                                         |
| ------------ | --------- | ----------------------------------------------------------- |
| Canvas       | `#EDF3F7` | App background and neutral surrounding space                |
| Surface      | `#FFFFFF` | Dense reading, table, and control surfaces                  |
| Catch navy   | `#062B5B` | App identity, navigation, principal text                    |
| Catch cyan   | `#009DBA` | Selected controls, active indicators, controlled highlights |
| Catch red    | `#EF3340` | Errors and attention with text labels                       |
| Catch yellow | `#FFD100` | Caution and pending states with dark text                   |
| Boundary     | `#D7E1E8` | Separators, table rules, neutral outlines                   |

Use Saira Condensed for headings and race identifiers, Source Sans 3 for interface and reading text, and IBM Plex Mono for times, lane numbers, numeric alignment, and source identifiers. Bundle fonts or use reliable fallbacks so a font request cannot block reading. Measure text contrast in its actual foreground/background pairing; brand colours are not a blanket contrast approval. Cyan, red, yellow, and boundary grey must not become untested small-text colours on white.

The stable Catch shell owns navigation, authentication, focus states, status treatment, spacing, typography, and page structure. School identity belongs inside a scoped school context. A school page and its championship rower records may tint the surrounding canvas, header surface, selected state, markers, and local rules with accessible derived school colours. Navigation text, focus, warning, success, error, and unrelated-school colours remain stable. Keep dense reading surfaces light and avoid saturating the entire screen.

The provisional St Dunstan's palette is navy `#253573` and bronze `#996A28`. These values are inferred, not official brand specifications. The [school's identity page](https://stdunstans.co.za/vision) is the retained official source. Store the evidence, rights status, and provisional label with the identity record. Do not claim official affiliation or approval.

School crests and official source content use the rights gates in [data governance](docs/data-sources/governance.md). Private visibility does not establish public reuse rights. A crest without public approval must not ship in a public release.

## Layout and interaction

Use a readable maximum width, crisp rules, modest corner radii, and ample separation between navigation and dense results. Hierarchy comes from typography and alignment. Keep rank, lane, school, time, margin, and result status easy to compare. Preserve source order where the source defines it. Use tabular numerals for results. Never make colour the only status signal.

The regatta directory uses publisher event numbers as prominent wayfinding marks. Its event rows summarize the contained race progression without flattening heats, semifinals, and finals into unrelated listings. The event detail keeps that progression visible as a compact course-like sequence above clearly separated round sections.

School statistics use the same ruled, results-ledger vocabulary. Labels must state what the source proves, such as crew entries, evidenced starts, and published seat appearances. Do not style an inferred appearance total as a team roster or a unique athlete count.

On small screens, keep event identification and selected filters visible. Transform race results into a vertical
ledger that keeps place, lane, school, time, and gap visible. Keep the honest finish-gap track visible for every
result, while crew and status use native expandable details. Do not make the page scroll sideways or squeeze names
and times into illegibility. Interactive targets, keyboard navigation, visible focus, and text labels remain usable
without hover.

Every data view distinguishes archived results from live timing. Show regatta dates, source attribution, import freshness, and any uncertainty in plain language. Use realistic empty, loading, stale, denied, and error states. Do not invent wins, school totals, or athlete information to fill a layout.

## Workspace and Course Watch language

The home presents three related workspaces: Results, My Rowing, and School Programme. Results uses cyan as its active instrument accent. My Rowing may use lane yellow for personal progress and targets. School Programme may use buoy red for schedule attention and coach-owned decisions. These accents do not replace semantic warning, error, or safety colours.

Course Watch is a shared venue instrument, not a fourth product. It uses the light Regatta Instrument shell, a water-blue course canvas, lane-board geometry, fixed start and finish rules, and compact weather-source status. A course diagram must state whether it is schematic, surveyed, or source-derived. Weather, radar, tower, cloud, rain, and lightning marks must state whether they are live, stale, unavailable, or preview data. Never make a generated or missing observation look live.

The map and performance surfaces use the same evidence-first language. Raw observations remain distinct from interpretations. A safety state is visually and textually separate from a predicted performance effect. School theme colours may identify a selected crew or school on the course, but they cannot replace fixed safety semantics.

## Review basis

Review changes against [UX-CONTRACT.md](UX-CONTRACT.md), [design decisions](docs/design/decisions.md), and the page's real loading and failure states. These documents specify intended behavior; screenshots, successful builds, and implemented controls provide separate evidence that the contract is met.
