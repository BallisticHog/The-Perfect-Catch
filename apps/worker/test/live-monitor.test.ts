import {
    estimatePublicationDelay,
    LIVE_REGATTA,
    type LiveRace,
    newLiveState,
} from "@the-perfect-catch/domain";
import { liveSourceUrl, parseLiveOverview, parseLiveRace } from "@the-perfect-catch/ingestion";
import { describe, expect, it } from "vitest";
import { applyLiveDetail, applyLiveOverview, nextLiveRace } from "../src/live-monitor";

const wrap = (body: string) =>
    `<html><head><title>${LIVE_REGATTA.sourceTitle}</title></head><body>${body}</body></html>`;
const overview = (status = "Scheduled", time = "08:00:00") =>
    wrap(
        `<table id="table1"><tr><td>Event ID</td><td>Event Name</td><td>Race</td><td>Date</td><td>Time</td><td>Event Status</td><td>Details</td></tr><tr><td>1</td><td>J M 19 A 1x-</td><td>1 - Final</td><td>Saturday, 03 October 2026</td><td>${time}</td><td>${status}</td><td><a href="1_Final.htm">${
            status === "Scheduled" ? "Lane Draw" : "Results"
        }</a></td></tr></table>`,
    );
const detail = (finished = false, lane = "4", status = "Finished") =>
    wrap(
        `<p>Event 1 - J M 19 A 1x-</p><p>Race: 1 - Final</p><p>Date: Saturday, 03 October 2026</p><p>Time: 08:00:00</p><p>Status: ${
            finished ? "Official" : "Scheduled"
        }</p><table id="table1"><tr><td>Lane</td><td>Boat</td><td>Org. Name</td><td>Athlete</td>${
            finished ? "<td>Place</td><td>Finish Time</td><td>Status</td>" : ""
        }</tr><tr><td>${lane}</td><td>1 - Example</td><td>Example School</td><td>Example, Sam</td>${
            finished ? `<td>1</td><td>07:30.00</td><td>${status}</td>` : ""
        }</tr></table>`,
    );
const time = Date.parse("2026-10-03T06:00:00Z");

function setup()
{
    const state = newLiveState(new Date(time).toISOString());
    applyLiveOverview(state, overview(), time);
    return state;
}

describe("live regatta recovery and publication", () =>
{
    it("accepts actual lane-draw columns without inventing a placing or time", () =>
    {
        const race = setup().races[0]!;
        applyLiveDetail(race, detail(), time);
        expect(race.entries[0]).toMatchObject({
            lane: "4",
            place: "",
            time: "",
            finishMs: null,
            status: "Lane draw",
        });
    });
    it("retains valid entries on a malformed page, then accepts a repaired page and lane change", () =>
    {
        const race = setup().races[0]!;
        applyLiveDetail(race, detail(), time);
        const before = structuredClone(race);
        expect(() => applyLiveDetail(race, wrap("Officials are working to bring you the page"), time + 5000))
            .toThrow();
        expect(race).toEqual(before);
        applyLiveDetail(race, detail(false, "2"), time + 10_000);
        expect(race.entries[0]?.lane).toBe("2");
        expect(race.revision).toBe(2);
        applyLiveDetail(race, detail(false, "2"), time + 15_000);
        expect(race.revision).toBe(2);
    });
    it("preserves scratches and never removes completed results on a temporary draw reversion", () =>
    {
        const race = setup().races[0]!;
        applyLiveDetail(race, detail(true, "4", "SCRATCH"), time + 600_000);
        expect(race.entries[0]?.status).toBe("SCRATCH");
        const before = structuredClone(race);
        expect(() => applyLiveDetail(race, detail(), time + 605_000)).toThrow(/reverted/);
        expect(race).toEqual(before);
    });
    it("retries other races while a broken race is backing off", () =>
    {
        const state = setup();
        state.races[0]!.nextCheckAt = time + 60_000;
        state.races.push({ ...state.races[0]!, key: "other", nextCheckAt: time });
        expect(nextLiveRace(state, time)?.key).toBe("other");
    });
    it("observes result arrival only across a continuous window and invalidates rescheduled samples", () =>
    {
        const state = setup();
        applyLiveOverview(state, overview("Official"), time + 5000);
        expect(state.races[0]?.timingEligible).toBe(true);
        applyLiveOverview(state, overview("Official", "08:20:00"), time + 10_000);
        expect(state.races[0]?.timingEligible).toBe(false);
        const resumed = setup();
        applyLiveOverview(resumed, overview("Official"), time + 600_000);
        expect(resumed.races[0]?.timingEligible).toBe(false);
    });
    it("rejects empty and wrong-event pages without mutating the programme", () =>
    {
        const state = setup();
        const before = structuredClone(state);
        expect(() => applyLiveOverview(state, wrap("<table id='table1'></table>"), time)).toThrow();
        expect(state).toEqual(before);
        expect(() => parseLiveRace(detail().replace("Event 1 -", "Event 2 -"), state.races[0]!)).toThrow();
    });
    it("limits discovery and redirects to the exact registered source directory", () =>
    {
        expect(liveSourceUrl("1_Final.htm")).toContain("2026-Oct-Mary1619M/1_Final.htm");
        for (
            const url of [
                "http://127.0.0.1/",
                "https://evil.example/a.htm",
                "../private.htm",
                "1.htm?secret=x",
                "https://www.regattaresults.co.za/Results/Results2026/2026-Oct-Mary1619M/../../x.htm",
            ]
        )
        {
            expect(() => liveSourceUrl(url)).toThrow();
        }
        expect(parseLiveOverview(overview()).races).toHaveLength(1);
    });
});

describe("publication timing evidence", () =>
{
    function samples(): LiveRace[]
    {
        const race = setup().races[0]!;
        applyLiveDetail(race, detail(true), time + 1_500_000);
        return [0, 1, 2].map((index) => ({
            ...race,
            key: String(index),
            timingEligible: true,
            scheduledAt: new Date(time + index * 300_000).toISOString(),
            detailScheduledAt: new Date(time + index * 300_000).toISOString(),
            firstResultAt: new Date(time + index * 300_000 + 1_500_000).toISOString(),
        }));
    }
    it("estimates a range from observed finish durations, never from assumed race lengths", () =>
    {
        expect(estimatePublicationDelay(samples(), time + 2_100_000)).toMatchObject({
            lowerMinutes: 15,
            upperMinutes: 20,
            sampleCount: 3,
        });
    });
    it("suppresses sparse, old, batch, resumed and masters-only evidence", () =>
    {
        expect(estimatePublicationDelay(samples().slice(0, 2), time + 2_100_000)).toBeNull();
        expect(estimatePublicationDelay(samples(), time + 9_000_000)).toBeNull();
        expect(
            estimatePublicationDelay(
                samples().map((race) => ({
                    ...race,
                    firstResultAt: new Date(time + 2_000_000).toISOString(),
                })),
                time + 2_100_000,
            ),
        ).toBeNull();
        expect(
            estimatePublicationDelay(
                samples().map((race) => ({ ...race, timingEligible: false })),
                time + 2_100_000,
            ),
        ).toBeNull();
        expect(
            estimatePublicationDelay(
                samples().map((race) => ({ ...race, eventName: "Mast M 1x-" })),
                time + 2_100_000,
            ),
        ).toBeNull();
    });
});
