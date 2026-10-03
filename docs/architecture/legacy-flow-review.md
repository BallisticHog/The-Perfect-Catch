# Legacy flow review

## Material reviewed

The previous `the-catch`, `the catch.old`, and `Rowing system` folders were inspected as read-only product references. Their useful concepts were compared with the current repository contracts and the real 2026 championship source structure. No files in those folders were modified.

## Ideas retained

- A regatta should behave as an operating board, not as a collection of disconnected result pages.
- The publisher event number is the main grouping key. Heats, semifinals, and finals stay under one event.
- Search should help a coach move quickly by event number, class, school, or published rower name.
- Race results should link directly to the school and source-name records they display.
- A school view should combine evidence-based statistics, published source-name records, and its race history.
- A source-name record should list its events and race results with direct routes back to the evidence.
- Mobile race-day browsing should preserve event, place, lane, school, time, and margin before secondary detail.

## Ideas changed or rejected

- The older dark dashboard and neon treatment was not retained. The current Regatta Instrument system uses a blue-grey canvas, light ledger surfaces, and sporting typography.
- A broad athlete table inferred from similar names was not retained. The current private view groups exact normalized published name plus exact school only inside one regatta.
- A source-name record is not called a verified person identity and does not link across regattas.
- School roster counts are not inferred from historical appearances. The interface reports source-name records and published seat appearances instead.
- Dense card grids were replaced with event ledgers and linked rows where comparison speed matters.

## Implemented route flow

```text
Regattas
    -> Championship
        -> Events
            -> Event progression
                -> Race
                    -> Previous or next race
                    -> School
                    -> Championship rower record
        -> Rower records
            -> Rower source record
                -> Event
                -> Race
                -> School
Schools
    -> School summary
        -> Championship rower records
        -> Published races
```

The complete 2026 championship remains one archive. Event numbers are meaningful only inside that regatta. Route keys for rower records are opaque hashes of the scoped source identity key so names are not placed directly in URLs.

## Future flow work

The next useful additions are a latest-regatta home screen, saved in-app follows, active-regatta monitoring, and a coach-confirmed identity workflow. Cross-regatta athlete histories must wait for confirmation, correction, and record-splitting controls.
