# The Catch design contract

The Catch is a private, Google allowlist beta for browsing archived school rowing results. Its first regatta is the 2026 SA Schools Championships at Roodeplaat, held 6 to 8 March 2026. The visual direction is Regatta Instrument: clear sporting typography, precise result alignment, and restrained colour on a white surface.

## Regatta Instrument tokens

| Role         | Value     | Use                                                         |
| ------------ | --------- | ----------------------------------------------------------- |
| Canvas       | `#FFFFFF` | Main page and reading surfaces                              |
| Catch navy   | `#062B5B` | App identity, navigation, principal text                    |
| Catch cyan   | `#009DBA` | Selected controls, active indicators, controlled highlights |
| Catch red    | `#EF3340` | Errors and attention with text labels                       |
| Catch yellow | `#FFD100` | Caution and pending states with dark text                   |
| Boundary     | `#D7E1E8` | Separators, table rules, neutral outlines                   |

Use Saira Condensed for headings and race identifiers, Source Sans 3 for interface and reading text, and IBM Plex Mono for times, lane numbers, numeric alignment, and source identifiers. Bundle fonts or use reliable fallbacks so a font request cannot block reading. Measure text contrast in its actual foreground/background pairing; brand colours are not a blanket contrast approval. Cyan, red, yellow, and boundary grey must not become untested small-text colours on white.

The stable Catch shell owns navigation, authentication, focus states, status treatment, spacing, typography, and page structure. School identity belongs inside a scoped school context. It must not recolour global navigation, auth screens, alerts, or unrelated schools. Avoid a full-screen school-colour wash.

The provisional St Dunstan's palette is navy `#253573` and bronze `#996A28`. These values are inferred, not official brand specifications. The [school's identity page](https://stdunstans.co.za/vision) is the retained official source. Store the evidence, rights status, and provisional label with the identity record. Do not claim official affiliation or approval.

School crests and official source content use the rights gates in [data governance](docs/data-sources/governance.md). Private visibility does not establish public reuse rights. A crest without public approval must not ship in a public release.

## Layout and interaction

Use a readable maximum width, crisp rules, modest corner radii, and ample separation between navigation and dense results. Hierarchy comes from typography and alignment. Keep rank, lane, school, time, margin, and result status easy to compare. Preserve source order where the source defines it. Use tabular numerals for results. Never make colour the only status signal.

On small screens, keep event identification and selected filters visible. Let the results region scroll horizontally when necessary, with a visible affordance and accessible label; do not squeeze names and times into illegibility. Do not make the entire page scroll sideways. Interactive targets, keyboard navigation, visible focus, and text labels remain usable without hover.

Every data view distinguishes archived results from live timing. Show regatta dates, source attribution, import freshness, and any uncertainty in plain language. Use realistic empty, loading, stale, denied, and error states. Do not invent wins, school totals, or athlete information to fill a layout.

## Review basis

Review changes against [UX-CONTRACT.md](UX-CONTRACT.md), [design decisions](docs/design/decisions.md), and the page's real loading and failure states. These documents specify intended behavior; screenshots, successful builds, and implemented controls provide separate evidence that the contract is met.
