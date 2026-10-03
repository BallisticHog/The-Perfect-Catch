import { CHAMPIONSHIP } from "@the-perfect-catch/domain";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { canonicalSourceUrl, decodeHtml, parseOverview, parseRace, sourceUrlKey } from "../src/parser";

const bytes = readFileSync(new URL("./fixtures/2026-event-1-semifinal-1.html", import.meta.url));
const html = decodeHtml(bytes).html;
const link = {
    url: new URL("1_SF%201.htm", CHAMPIONSHIP.sourceUrl).href,
    eventId: "1",
    eventName: "JM/BU14 1x",
    raceLabel: "69 - SF 1",
};

describe("the exact 2026 championship source", () =>
{
    it("reads the reference fixture without replacing its original bytes", () =>
    {
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(
            "54e63eba23bd43a0fd472bef63cd2d80bf77419063c6298fcb01f7ac872908a7",
        );
        const result = parseRace(html, link, [{
            alias: "St Dunstans College (RSA)",
            schoolKey: "st-dunstans-college",
            displayName: "St Dunstan's College",
        }]);
        expect(result.race.results).toHaveLength(8);
        expect(result.race.results[0].finishMs).toBe(277480);
        expect(result.race.results[0].schoolRaw).toBe("St Dunstans College (RSA)");
        expect(result.race.results[0].schoolKey).toBe("st-dunstans-college");
        expect(result.race.results[0].appearances[0].displayName).toBe("Alpha Fixture");
        expect(result.race.round).toBe("semifinal");
        expect(result.race.official).toBe(true);
    });
    it("decodes Windows-1252 punctuation from exact byte values", () =>
    {
        const cp1252 = Buffer.from([0x53, 0x74, 0x20, 0x41, 0x6c, 0x62, 0x61, 0x6e, 0x92, 0x73]);
        expect(decodeHtml(cp1252).html).toBe("St Alban\u2019s");
        expect(decodeHtml(cp1252).encoding).toBe("windows-1252");
        expect(decodeHtml(cp1252, "text/html; charset=utf-8").html).toBe("St Alban\u2019s");
    });
    it("rejects directory escapes and URL drift", () =>
    {
        expect(() => canonicalSourceUrl("../other/results.htm")).toThrow();
        expect(() => canonicalSourceUrl("https://evil.example/results.htm")).toThrow();
        expect(() =>
            canonicalSourceUrl(
                "https://www.regattaresults.co.za/Results/Results2026/2026-mar-SAChamps/results.htm",
            )
        ).toThrow();
        expect(sourceUrlKey(link.url)).toBe(sourceUrlKey(link.url.replace("%20", " ")));
        expect(sourceUrlKey(link.url)).not.toBe(sourceUrlKey(link.url.replace("SF%201", "SF%202")));
    });
    it("discovers only actual details links and rejects broken race links", () =>
    {
        const overview =
            `<html><title>${CHAMPIONSHIP.sourceTitle}</title><table id="table1"><tr><td>Event ID</td><td>Event Name</td><td>Race</td><td>Details</td></tr><tr><td>1</td><td>JM/BU14 1x</td><td>69 - SF 1</td><td><a href="1_SF 1.htm">Results</a></td></tr><tr><td>100</td><td>Umpire Break</td><td>Final</td><td>TBA</td></tr></table></html>`;
        expect(parseOverview(overview)).toEqual([link]);
        expect(() => parseOverview(overview.replace("Umpire Break", "JM/BU14 1x"))).toThrow(
            "no source details link",
        );
    });
    it("rejects placeholders, missing tables, mismatched event IDs, and changed dates", () =>
    {
        expect(() => parseRace("<html>Officials are working to bring you the page</html>", link)).toThrow();
        expect(() => parseRace(html.replace("id='table1'", "id='missing'"), link)).toThrow();
        expect(() => parseRace(html, { ...link, eventId: "999" })).toThrow();
        expect(() => parseRace(html.replace("Friday, 06 March 2026", "Friday, 06 March 2025"), link))
            .toThrow();
    });
    it("rejects unsupported crew headers while accepting both registered athlete labels", () =>
    {
        expect(() => parseRace(html.replace(">Athlete<", ">Crew<"), link)).toThrow("missing athlete column");
        const plural = parseRace(html.replace(">Athlete<", ">Athletes<"), link);
        expect(plural.race.results[0].appearances[0].displayName).toBe("Alpha Fixture");
        expect(plural.race.results[0].athletesRaw).toBe(parseRace(html, link).race.results[0].athletesRaw);
    });
});
