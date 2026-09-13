# Source register

## Initial regatta

| Field                            | Value                                                                                                                                        |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Regatta                          | 2026 SA Schools Championships                                                                                                                |
| Venue                            | Roodeplaat                                                                                                                                   |
| Dates                            | 6 to 8 March 2026                                                                                                                            |
| Results index                    | https://www.regattaresults.co.za/Results/Results2026/2026-Feb-SASChamps/results.htm                                                          |
| Publisher context                | https://rowsa.co.za/sasru/schools-championships/                                                                                             |
| Official regatta entries context | https://rowsa.co.za/sasru/regatta-entries/                                                                                                   |
| Regatta notice                   | https://regatta.co.za/gui/frmViewFile.aspx?attribute_id=2&description=SA+Schools+Champs+6+7+8+March+2026+-+Notice&instanceProperty_id=110116 |
| Initial usage status             | `official_source_unlicensed`, eligible for the private beta only                                                                             |

The results path contains `2026-Feb-SASChamps`; keep the exact source path even though the championship dates are in March. Do not rewrite URLs based on a guessed month. The index is a discovery page. Import race detail links and attribute each result to its detail source URL.

The publisher's pages identify individual result status, such as Official. That status describes the sporting result. It is separate from permission to reuse the content, Catch's ingestion state, and deployment approval.

## School identity

| Field                       | Value                           |
| --------------------------- | ------------------------------- |
| School                      | St Dunstan's                    |
| Official identity reference | https://stdunstans.co.za/vision |
| Provisional navy            | `#253573`, inferred             |
| Provisional bronze          | `#996A28`, inferred             |

Retain a source link, observation date, and reviewer notes when collecting an identity asset. Mark inferred colours explicitly. A reachable official crest does not establish reuse rights.

## Adding a source

Record the exact origin URL, regatta coverage, format/encoding, retrieval strategy, observed structure, rights state, and evidence for any reuse approval. A new source needs an explicit adapter or demonstrated compatibility. Never silently apply this regatta's HTML assumptions to another publisher.
