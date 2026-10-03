# Product map

## Product shape

The Catch has three user-facing workspaces supported by shared evidence and intelligence.

| Workspace        | Audience                                                         | Purpose                                                                                                    |
| ---------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Results          | Future public audience, currently beta-authenticated             | Archived and live regattas, events, rounds, races, schools, and published source-name records              |
| My Rowing        | Verified St Dunstan's rower                                      | Personal calendar, assigned sessions, training logs, verified result links, progress, goals, and forecasts |
| School Programme | Authorized St Dunstan's staff and rowers with scoped read access | Groups, crews, programme calendar, assignments, attendance, trials, coach review, and safety support       |

Course Watch is a shared layer. It appears as race conditions in Results, water and performance context in My Rowing, and operational evidence in School Programme.

## Identity boundary

A source appearance is published evidence from one race. A regatta-scoped source-name record groups an exact normalized published name and exact school only inside that regatta. A verified member is a private canonical St Dunstan's person. These records remain separate until an authorized coach reviews a proposed link.

The same verified member record supports the rower's My Rowing view and the coach's athlete view. Permissions determine which fields each view exposes. Training, programme membership, attendance, coach notes, and private forecasts never flow back into a public source record.

## Programme flow

1. A coach creates age, squad, crew, or custom groups.
2. A calendar item represents a regatta, water session, erg session, gym session, test, recovery session, or briefing.
3. The coach assigns the item to groups, crews, or individuals without duplicating it.
4. Assigned rowers see the item in My Rowing.
5. A completed session records each relevant effort, repetition, recovery, stroke rate, boat or crew context, course, and observation quality.
6. The performance ledger preserves the raw record and derives a seconds-per-500-metre pace where meaningful.

## Venue and weather flow

Regatta schedules and uploaded calendars resolve a venue key. The first venue set is Roodeplaat Dam and Germiston Lake at Victoria Lake Club. Each reviewed course revision can record distance, lane geometry, course bearing, source, validity, and reviewer.

Course Watch can combine the following evidence without erasing provenance:

- Local tower or station observations
- Forecast observations
- Radar and cloud or rain coverage
- Trusted lightning observations and warnings
- Coach visual water and visibility reports
- Regatta schedule drift and actual race times

Every observation records when and where it was observed, when it was received, who or what supplied it, and whether it is current, stale, unavailable, or preview data.

Safety and performance remain separate. Safety uses approved policy and human decisions. Performance intelligence may estimate how conditions affected pace, but it cannot declare the water safe.

## Performance progression

The first performance layer standardizes comparable observations and presents them honestly. The basic pace calculation is total duration multiplied by 500 and divided by distance in metres. Repetition sessions retain every repetition rather than only an average.

Later analysis proceeds in controlled stages:

1. Like-for-like protocol comparisons
2. Personal and crew trends
3. Course-relative wind and condition adjustment
4. Race-distance projection with uncertainty
5. Comparison with published field evidence
6. Probabilistic regatta and championship forecasts

Other schools contribute only published race evidence. St Dunstan's forecasts may use authorized private training evidence. Every forecast shows its evidence window, uncertainty, and missing-data limitations.

## Delivery sequence

1. Three-workspace home and navigation
2. Venue records and Course Watch foundation
3. Verified member and reviewed source-link workflow
4. Groups and calendar
5. Water, erg, and test logging
6. Performance ledger and chart
7. Real weather-source ingestion and freshness handling
8. Approved safety policy support
9. Condition-adjusted analysis and forecasts
10. Active-regatta monitoring, follows, and notifications
