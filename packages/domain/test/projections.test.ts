import { describe, expect, it } from "vitest";
import {
    groupRacesByEvent,
    groupRowerAppearances,
    sortEventRaces,
    sourceRowerIdentityKey,
    summarizeSchoolResults,
} from "../src/index";
import type { Race, Result } from "../src/index";

function result(overrides: Partial<Result> = {}): Result
{
    return {
        sourceKey: "crew-1",
        rowIndex: 0,
        schoolRaw: "Source School",
        schoolKey: "school-1",
        boatRaw: "A",
        laneRaw: "1",
        lane: 1,
        placeRaw: "1",
        place: 1,
        finishRaw: "4:30.00",
        finishMs: 270000,
        splitRaw: "",
        deltaRaw: "",
        statusRaw: "Finished",
        status: "finished",
        athletesRaw: "Smith, Alex",
        appearances: [{
            rawName: "Smith, Alex",
            displayName: "Alex Smith",
            seat: 1,
            isCox: false,
            rawAnnotation: null,
        }],
        rawCells: [],
        ...overrides,
    };
}

function race(number: number, overrides: Partial<Race> = {}): Race
{
    return {
        sourceKey: `race-${number}`,
        sourceUrl: `https://www.regattaresults.co.za/results/race-${number}.htm`,
        sourceEventId: "1",
        eventNameRaw: "JW/GU14 1x",
        eventName: "JW/GU14 1x",
        gender: "girls",
        ageGroup: "U14",
        boatClass: "1x",
        raceNumber: number,
        roundRaw: "Heat",
        round: "heat",
        dateRaw: "Friday, 06 March 2026",
        timeRaw: "12:00:00",
        scheduledAt: "2026-03-06T10:00:00.000Z",
        statusRaw: "Official",
        official: true,
        progressionRaw: "",
        results: [result()],
        ...overrides,
    };
}

describe("event directory projection", () =>
{
    it("groups repeated event numbers across rounds and preserves first source event order and raw labels", () =>
    {
        const input = [
            race(80, { sourceEventId: "18", round: "final-a" }),
            race(1),
            race(50, { round: "semifinal", eventNameRaw: "Later spelling" }),
            race(70, { round: "final-a" }),
            race(3, { sourceEventId: "18" }),
        ];
        const events = groupRacesByEvent(input);
        expect(events.map((event) => event.sourceEventId)).toEqual(["18", "1"]);
        expect(events[1]?.races.map((row) => row.raceNumber)).toEqual([1, 50, 70]);
        expect(events[1]?.rounds.map((round) => round.round)).toEqual(["heat", "semifinal", "final-a"]);
        expect(events[1]?.eventNameRaw).toBe("JW/GU14 1x");
        expect(events[1]?.races[1]?.eventNameRaw).toBe("Later spelling");
        expect(events[1]?.publishedCrewEntries).toBe(3);
        expect(input.map((row) => row.raceNumber)).toEqual([80, 1, 50, 70, 3]);
    });

    it("orders progression stages while preserving input order within each round", () =>
    {
        const input = [
            race(100, { round: "unknown" }),
            race(80, { round: "final-b" }),
            race(8),
            race(2),
            race(60, { round: "semifinal" }),
            race(90, { round: "final-c" }),
            race(40, { round: "repechage" }),
            race(70, { round: "final-a" }),
        ];
        expect(sortEventRaces(input).map((row) => row.raceNumber)).toEqual([8, 2, 40, 60, 70, 80, 90, 100]);
    });

    it("keeps similarly named events separate and counts only explicitly mapped schools", () =>
    {
        const events = groupRacesByEvent([
            race(1, {
                results: [result(), result({ schoolKey: null }), result({ schoolKey: "school-2" }), result()],
            }),
            race(2, { sourceEventId: "01" }),
        ]);
        expect(events).toHaveLength(2);
        expect(events[0]?.schoolKeys).toEqual(["school-1", "school-2"]);
        expect(events[0]?.publishedCrewEntries).toBe(4);
        expect(groupRacesByEvent([])).toEqual([]);
    });
});

describe("regatta-scoped rower records", () =>
{
    it("groups exact published names within one school and keeps schools separate", () =>
    {
        const first = race(1, {
            sourceEventId: "1",
            results: [result({
                schoolKey: "school-1",
                schoolRaw: "School One",
                appearances: [{
                    rawName: "Rower, Bob",
                    displayName: "Bob Rower",
                    seat: 1,
                    isCox: false,
                    rawAnnotation: null,
                }],
            })],
        });
        const second = race(2, {
            sourceEventId: "2",
            results: [
                result({
                    sourceKey: "entry-2",
                    schoolKey: "school-1",
                    schoolRaw: "School One",
                    appearances: [{
                        rawName: "Rower, Bob",
                        displayName: "Bob Rower",
                        seat: 2,
                        isCox: false,
                        rawAnnotation: null,
                    }],
                }),
                result({
                    sourceKey: "entry-3",
                    schoolKey: "school-2",
                    schoolRaw: "School Two",
                    appearances: [{
                        rawName: "Rower, Bob",
                        displayName: "Bob Rower",
                        seat: 1,
                        isCox: false,
                        rawAnnotation: null,
                    }],
                }),
            ],
        });

        const records = groupRowerAppearances([first, second]);

        expect(records).toHaveLength(2);
        expect(records.find((record) => record.schoolKey === "school-1")).toMatchObject({
            displayName: "Bob Rower",
            raceCount: 2,
            eventIds: ["1", "2"],
            boatClasses: ["1x"],
        });
        expect(sourceRowerIdentityKey("Bob Rower", "school-1", "ignored")).not.toBe(
            sourceRowerIdentityKey("Bob Rower", "school-2", "ignored"),
        );
    });
});

describe("school result statistics", () =>
{
    it("counts crew entries and repeated seat appearances without inferring individual identity", () =>
    {
        const races = [
            race(1, {
                results: [
                    result(),
                    result({ place: 2 }),
                    result({ schoolKey: null }),
                    result({ schoolKey: "school-2" }),
                ],
            }),
            race(40, {
                round: "semifinal",
                results: [result({ status: "dnf", place: null, finishMs: null })],
            }),
            race(70, { round: "final-a", results: [result(), result({ place: 3 })] }),
            race(80, { round: "final-b", boatClass: "2x", results: [result({ place: 2 })] }),
        ];
        expect(summarizeSchoolResults(races, "school-1")).toEqual({
            publishedCrewEntries: 6,
            evidencedCrewStarts: 6,
            racesContested: 4,
            raceWins: 2,
            finalCrewEntries: 3,
            finalAPodiums: 2,
            publishedSeatAppearances: 6,
            boatClasses: ["1x", "2x"],
        });
    });

    it("does not turn DNS, scratch, DSQ, unknown labels or row position into starts, wins or podiums", () =>
    {
        const races = [race(70, {
            round: "final-a",
            boatClass: null,
            results: [
                result({ status: "dns" }),
                result({ status: "scratch" }),
                result({ status: "dsq" }),
                result({ status: "unknown" }),
                result({ place: null }),
                result({ place: 4 }),
            ],
        })];
        expect(summarizeSchoolResults(races, "school-1")).toEqual({
            publishedCrewEntries: 6,
            evidencedCrewStarts: 2,
            racesContested: 1,
            raceWins: 0,
            finalCrewEntries: 6,
            finalAPodiums: 0,
            publishedSeatAppearances: 6,
            boatClasses: [],
        });
    });

    it("counts a dead-heat race win once, preserves cox appearances, and ignores unresolved source spelling", () =>
    {
        const cox = {
            rawName: "May, Jo (Cox)",
            displayName: "Jo May",
            seat: null,
            isCox: true,
            rawAnnotation: "Cox",
        };
        const races = [race(70, {
            round: "final-a",
            results: [
                result(),
                result({ appearances: [cox] }),
                result({ schoolKey: null, schoolRaw: "school-1" }),
            ],
        })];
        const statistics = summarizeSchoolResults(races, "school-1");
        expect(statistics.raceWins).toBe(1);
        expect(statistics.finalAPodiums).toBe(2);
        expect(statistics.publishedSeatAppearances).toBe(2);
        expect(summarizeSchoolResults(races, "missing")).toEqual(summarizeSchoolResults([], "school-1"));
    });
});
