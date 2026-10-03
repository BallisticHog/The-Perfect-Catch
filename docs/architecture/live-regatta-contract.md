# Live regatta contract

## Registered source

The first live monitor follows the St Mary's U16, U19 and Masters regatta at Roodeplaat on
3 October 2026. Its exact publisher index is:

`https://www.regattaresults.co.za/Results/Results2026/2026-Oct-Mary1619M/results.htm`

The adapter accepts only HTTPS pages inside this exact regatta directory. It discovers actual
detail links from the index and does not construct race filenames.

## Polling and recovery

During the active programme window, the monitor checks the index every five seconds. It uses
the index as the quick signal for schedule, lane draw, scratch and result changes. Detail pages
are checked through one host-wide queue with at least one second between requests. Races near
their scheduled start receive priority. Each viewer reads the one captured state and never
polls the publisher directly.

Every valid response is archived before parsing. An empty, truncated, mismatched, placeholder
or malformed page fails that observation and leaves the last readable schedule, draw or result
active. Network and page failures use bounded exponential backoff while other races continue.
A shorter index cannot silently remove the existing programme.

The interface states when the monitor or source is stale. It shows the last valid observation
time and links to the publisher. Lane changes, scratches, source status and results produce
append-only revision records. Raw source captures remain outside the web container.

## Publication delay estimate

The delay indicator estimates when results are arriving relative to the published programme.
For each newly observed junior result:

`observed publication time - scheduled start - fastest published finish duration`

This combines any real programme delay with finish processing and publisher upload delay. It
does not claim to know an actual start time. The interface therefore labels the range as low
confidence and describes it as results arriving behind schedule.

An estimate needs at least three results observed in separate minute windows during a continuous
monitoring run. It excludes results already present when monitoring resumes, batches observed
at the same time, changed start times, Masters races, invalid finish durations and observations
older than thirty minutes. The displayed range is rounded to five minutes and keeps the
published start as the arrival target.

## Access and operation

The live page and JSON feed use the same current-session and active-grant checks as the archive.
The local review shortcut remains development-only and must never be exposed through router
forwarding. Production publishes only Caddy ports 80 and 443. The live state has a read-only
mount in the web service; raw source captures are available only to the live monitor.

On Windows development, `live.bat` starts the private preview, opens the live page and keeps the
monitor attached to its own terminal. On the home production host, the `live` Compose service
starts with the other application services and retains its state in a named volume.
