# Design decisions

## Regatta Instrument

The approved direction is a white, navy, and cyan rowing results instrument with condensed sporting headings and monospaced timings. The exact palette and font roles live in [DESIGN.md](../../DESIGN.md). Reuse those tokens instead of introducing near-duplicate local values.

## Stable shell and school identity

Catch identity stays stable as a viewer changes schools. A school accent may mark a school heading, a small identity panel, or a selected school indicator. It must not replace shared status semantics or global navigation. Identity assets carry provenance and rights state just like result sources.

St Dunstan's provisional navy `#253573` and bronze `#996A28` are inferred from the school's visual identity. [St Dunstan's vision page](https://stdunstans.co.za/vision) is the official source link, not evidence that these sampled colour values are official or that crest reuse is licensed. Keep text-first identity usable when a crest cannot be served.

## Content discipline

Show the source's event classification and race progression without inventing domain assumptions. Do not fabricate athlete records, school rankings, or cross-event comparisons. A preview dataset must be clearly identified as synthetic or a fixture; never call it a successful official import.

## Review record

For material interface changes, record the affected surface, reason, viewport evidence, interaction verification, and any outstanding limitation in the delivery notes. Do not treat this document as proof that the interface has passed review.
