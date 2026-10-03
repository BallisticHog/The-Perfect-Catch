# The Perfect Catch project status

Last updated: 3 October 2026

## View it now

The local private preview is available at:

- Three-workspace home: `http://127.0.0.1:4318/`
- St Mary's live board: `http://127.0.0.1:4318/live`
- Regattas: `http://127.0.0.1:4318/regattas`
- Course Watch foundation: `http://127.0.0.1:4318/course-watch`
- My Rowing foundation: `http://127.0.0.1:4318/my-rowing`
- School Programme foundation: `http://127.0.0.1:4318/programme`
- 2026 championship events: `http://127.0.0.1:4318/regattas/2026-sa-schools-championships`
- Championship rower records: `http://127.0.0.1:4318/regattas/2026-sa-schools-championships/rowers`
- St Dunstan's school summary: `http://127.0.0.1:4318/schools/st-dunstans-college`
- A real St Dunstan's result: `http://127.0.0.1:4318/races/7586c251170aab4bd95dc999e22cbe85804b9a92baa79ad59dd4ddd6944aa21f`

This is a local development preview. It is not the Ubuntu home-server deployment yet.

## Starting and stopping

- Double-click `run.bat` to start the complete local preview and open it in the browser.
- Double-click `live.bat` on race day to start the preview and the registered live monitor.
- Keep the `live.bat` window open. It is the one process that polls the publisher.
- If Windows restarts and reports a stale live lock, run `live-reset.bat` once, then `live.bat`.
- Double-click `stop.bat` to stop only the local preview processes created by the launcher.
- Double-click `refresh-data.bat` to politely capture the championship again while preserving the last working copy if refresh fails.
- Double-click `install-startup.bat` if the preview should start after Windows sign-in.
- Double-click `remove-startup.bat` to remove that Windows startup shortcut.

The startup installer is optional and has not been run automatically.

## Live regatta slice

The registered St Mary's U16, U19 and Masters programme for 3 October 2026 is captured locally:

- 68 scheduled races
- All currently published lane draws and crew entries
- Search by school, athlete, event, event number or boat label
- Automatic display updates every five seconds without each browser polling the publisher
- Last-good recovery for malformed, empty and temporarily reverted pages
- Revision records for lane, status and result changes
- A low-confidence result-publication delay estimate after enough fresh evidence exists

The estimate includes publisher upload time and does not claim an official start delay. The
live board remains inside the signed-in private beta.

## Complete local dataset

The local catalogue now uses the complete captured 2026 SA Schools Championships:

- 42 publisher events
- 203 race pages
- 1,465 result rows
- 4,045 published race-local athlete appearances
- 37 source schools or organizations
- Exact source response bytes and metadata retained under the ignored local `.data` directory

The preview no longer uses the five-race demonstration fixture when launched through `run.bat`.

## Working flow

- The regatta lists each publisher event number once.
- Heats, semifinals, and finals stay grouped inside that event.
- Event search supports event number, event label, and school text.
- Filters support gender, age group, boat class, round, and racing day.
- The championship has separate Events and Rower records tabs.
- Event pages provide previous and next event navigation.
- Race pages provide previous and next race navigation.
- Published crew names open championship-scoped rower source records.
- Schools are linked from desktop and mobile race results.
- Rower records link back to their event, race, and school.
- School pages show evidence-based statistics, source-name records, and race history.
- School and rower pages use a stronger accessible school palette across the surrounding page.
- Private preview identity badges are generated locally for visual orientation. They are not claimed as official school crests.

## Identity boundary

A rower record joins only an exact normalized published name with an exact school inside this championship. It does not prove a lifelong or unique person identity. It does not merge across schools or regattas, and it does not fuzzy-match names.

The next identity milestone remains a coach-confirmed linking workflow with correction and split controls.

## Design and legacy review

The older `the-catch`, `the catch.old`, and `Rowing system` folders were inspected as read-only references. Useful operating-board, event-progression, school-history, and rower-history ideas were retained. The dark dashboard styling and unsafe automatic lifetime identity assumptions were rejected.

The detailed review is in `docs/architecture/legacy-flow-review.md`.

## Current validation

- Formatting, lint, TypeScript, and prohibited-character checks pass.
- 126 unit and integration tests pass. Four PostgreSQL-dependent tests are intentionally skipped without `TEST_DATABASE_URL`.
- 17 deterministic browser checks pass across desktop and mobile, with one duplicate reduced-motion case skipped.
- Two complete-catalogue browser journeys pass across desktop and mobile, including automated accessibility checks.
- The clean Next.js production build passes without warnings.
- All three repository Catch skills pass the skill validator.
- The local launcher has started the complete preview successfully.

## Remaining release work

The latest product direction is recorded in `docs/architecture/product-map.md` and a requested durable memory note. The home and private workspace destinations are navigable. Course Watch switches between Roodeplaat and Germiston, labels its geometry as schematic or pending, and identifies all live weather sources as unconnected. The 500-metre pace calculation has domain tests. The first registered live regatta monitor is implemented. Groups, calendar uploads, verified member links, training persistence, real weather feeds, and forecast models remain upcoming implementation slices.

The latest slice passed desktop and mobile navigation and accessibility checks, all 51 web unit tests including access denial for the live routes, formatting, the strict interface audit, the production build, the resolved Compose contract, and all nine Linux operations tests. The full repository check passed with four database-dependent tests skipped. The illustrated home concept remains a design reference; the current functional foundation uses a simpler composition and has not reached final illustration fidelity.

1. Review the complete local flow and record visual or terminology changes.
2. Review and merge the feature branch PR after its checks pass.
3. Configure the invited Google owner email and OAuth credentials.
4. Exercise PostgreSQL migration, backup, and restore against a running test database.
5. Deploy the tested images to the Ubuntu VM through Caddy.
