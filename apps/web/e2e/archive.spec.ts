import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const selectedRace = "/races/review-race-137";
const reviewSecret = "local-review-browser-secret-32-characters-minimum";

test.skip(process.env.CATCH_E2E_FULL === "true", "Fixture checks run separately from the full catalogue.");

test("an unauthenticated browser cannot enter local review mode", async ({ browser }) =>
{
    const context = await browser.newContext({
        extraHTTPHeaders: { "x-the-catch-local-review": "deliberately-invalid-review-secret" },
    });
    const page = await context.newPage();
    await page.goto(selectedRace);
    await expect(page).toHaveURL(/\/sign-in\?returnTo=/);
    await expect(page.getByRole("heading", { name: "Sign in to the private beta" })).toBeVisible();
    await context.close();
});

test(
    "the archived race flow renders and responds without accessibility violations",
    async ({ page, isMobile }, testInfo) =>
    {
        const browserIssues: string[] = [];
        page.on("console", (message) =>
        {
            if (message.type() === "error" || message.type() === "warning")
            {
                browserIssues.push(`${message.type()}: ${message.text()}`);
            }
        });
        page.on("pageerror", (error) => browserIssues.push(`pageerror: ${error.message}`));
        const response = await page.goto(selectedRace);
        expect(response?.status()).toBe(200);
        await expect(page).toHaveTitle("Race results | The Catch");
        await expect(page.getByRole("heading", { name: /JM19 2-/ })).toBeVisible();
        await expect(page.getByText("Finish gap in seconds relative to the fastest recorded finish."))
            .toBeVisible();
        await expect(page.getByText(/Application error|Unhandled Runtime Error/)).toHaveCount(0);
        const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"])
            .analyze();
        expect(accessibility.violations).toEqual([]);
        await page.screenshot({
            path: testInfo.outputPath(isMobile ? "mobile-race.png" : "desktop-race.png"),
            fullPage: true,
        });

        if (isMobile)
        {
            await expect(page.locator(".mobile-results")).toBeVisible();
            await expect(page.locator(".desktop-results")).toBeHidden();
            const secondResult = page.locator(".mobile-result").nth(1);
            await secondResult.locator("summary").click();
            await expect(secondResult).toHaveAttribute("open", "");
            await expect(secondResult.locator("dt", { hasText: "Crew" })).toBeVisible();
            await expect(secondResult.getByText("Official")).toBeVisible();

            await page.getByLabel("Open navigation").click();
            await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible();
        }
        else
        {
            await expect(page.locator(".desktop-results")).toBeVisible();
            await expect(page.locator(".mobile-results")).toBeHidden();
            await expect(page.getByRole("table")).toContainText("St Dunstan's College");
            await page.getByRole("link", { name: "Fri 6" }).click();
            await expect(page).toHaveURL(/day=2026-03-06/);
            await expect(page.getByRole("status")).toContainText("1 event with racing on 2026-03-06");
        }

        expect(browserIssues).toEqual([]);
    },
);

test("keyboard focus begins with the skip link", async ({ page }) =>
{
    await page.goto(selectedRace);
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
});

test("home workspaces and Course Watch form one navigable product", async ({ page }) =>
{
    await page.goto("/");
    await expect(page).toHaveTitle("Home | The Catch");
    await expect(page.getByRole("heading", { name: "One rowing record, from programme to finish line." }))
        .toBeVisible();
    await expect(page.getByRole("link", { name: /Browse results/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Open My Rowing/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Open programme/ })).toBeVisible();

    await page.getByRole("link", { name: /Course Watch/ }).first().click();
    await expect(page).toHaveURL(/\/course-watch$/);
    await expect(page.getByRole("heading", { name: "Course Watch" })).toBeVisible();
    await expect(page.getByText("Safety status unavailable")).toBeVisible();
    await expect(page.getByText("Not connected")).toHaveCount(2);
    await expect(page.getByRole("img", { name: /Roodeplaat Dam course model preview/ })).toBeVisible();

    await page.getByRole("link", { name: "Germiston" }).click();
    await expect(page).toHaveURL(/venue=germiston/);
    await expect(page.getByRole("img", { name: /Germiston Lake.*course model preview/ })).toBeVisible();
    await expect(
        page.getByText(
            "Course distance, lane count, bearing, and shoreline geometry await reviewed venue evidence.",
        ),
    )
        .toBeVisible();

    const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"])
        .analyze();
    expect(accessibility.violations).toEqual([]);
});

test("a failed refresh leaves the last reviewed catalog visible", async ({ page }) =>
{
    await page.context().setExtraHTTPHeaders({
        "x-the-catch-local-review": reviewSecret,
        "x-the-catch-local-review-state": "stale",
    });
    await page.goto("/regattas/2026-sa-schools-championships");
    await expect(page.locator(".source-refresh-notice")).toContainText("latest source refresh failed");
    await expect(page.getByRole("link", { name: /Event 24: JM19 2-/ })).toBeVisible();
});

test("events stay grouped and filters operate on the complete event", async ({ page }) =>
{
    await page.goto("/regattas/2026-sa-schools-championships");
    await expect(page.getByRole("status")).toContainText("3 events");
    await expect(page.locator(".event-directory-row")).toHaveCount(3);

    await page.getByLabel("Boat").selectOption("1x");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page.getByRole("status")).toContainText("2 events");
    await expect(page.getByRole("link", { name: /Event 24:/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Event 31: JW19 1x/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Event 35: JM19 1x/ })).toBeVisible();

    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/regattas\/2026-sa-schools-championships$/);
    await expect(page.getByLabel("Boat")).toHaveValue("");
    await expect(page.getByRole("status")).toContainText("3 events");

    await page.getByLabel("Find an event or school").fill("24");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page).toHaveURL(/q=24/);
    await expect(page.getByRole("status")).toContainText("1 event");
    await expect(page.getByRole("link", { name: /Event 24: JM19 2-/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Event 31:/ })).toHaveCount(0);

    await page.getByRole("link", { name: /Event 24: JM19 2-/ }).click();
    await expect(page).toHaveURL(/\/events\/24$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Heat" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Semi final" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Final A" })).toBeVisible();
    await expect(page.getByRole("link", { name: /101 JM19 2-/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /118 JM19 2-/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /137 JM19 2-/ })).toBeVisible();
    const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"])
        .analyze();
    expect(accessibility.violations).toEqual([]);
});

test("empty archives and empty filters remain distinct", async ({ page }) =>
{
    await page.goto("/regattas/2026-sa-schools-championships?q=no-such-school-or-event");
    await expect(page.getByRole("heading", { name: "No events match these filters" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Clear filters" })).toBeVisible();

    await page.context().setExtraHTTPHeaders({
        "x-the-catch-local-review": reviewSecret,
        "x-the-catch-local-review-state": "empty",
    });
    await page.goto("/regattas");
    await expect(page.getByRole("heading", { name: "The archive is being prepared" })).toBeVisible();
});

test("missing crests use a readable school monogram", async ({ page }) =>
{
    await page.goto("/schools/jeppe-high-school-for-boys");
    await expect(page.getByRole("heading", { name: "Jeppe High School for Boys" })).toBeVisible();
    await expect(page.getByLabel("Jeppe High School for Boys monogram").first()).toBeVisible();
    await expect(page.getByText(/private-beta visual aid/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "2026 championship summary" })).toBeVisible();
    await expect(page.locator(".school-statistic").filter({ hasText: "Races contested" }).locator("dd"))
        .toHaveText("5");
    await expect(
        page.locator(".school-statistic").filter({ hasText: "Final A podium results" }).locator("dd"),
    )
        .toHaveText("3");
    await expect(page.getByText(/not current roster size or a unique athlete count/)).toBeVisible();
    const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"])
        .analyze();
    expect(accessibility.violations).toEqual([]);
});

test("race, rower, school, and event navigation preserves context", async ({ page, isMobile }) =>
{
    await page.goto(selectedRace);
    if (isMobile)
    {
        const result = page.locator(".mobile-result").filter({ hasText: "St Dunstan's College" }).first();
        if (!(await result.evaluate((element) => element.hasAttribute("open"))))
        {
            await result.locator("summary").click();
        }
        await result.getByRole("link", { name: /Review Rower 1/ }).click();
    }
    else
    {
        await page.locator(".desktop-results").getByRole("link", { name: /Review Rower 1/ }).first().click();
    }
    await expect(page).toHaveURL(/\/rowers\/iFNYIVTGEKqxkKvOkB$/);
    await expect(page.getByRole("heading", { name: "Review Rower 1" })).toBeVisible();
    await expect(page.getByText(/exact published name and school appearances/)).toBeVisible();
    await page.getByRole("link", { name: "St Dunstan's College" }).first().click();
    await expect(page.getByRole("heading", { name: "St Dunstan's College" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Review Rower 1" }).first()).toBeVisible();

    await page.goto("/regattas/2026-sa-schools-championships/events/24");
    await page.getByRole("link", { name: /Next event Event 31/ }).click();
    await expect(page).toHaveURL(/\/events\/31$/);
    await expect(page.getByRole("heading", { name: /Event 31/ })).toBeVisible();

    await page.goto(selectedRace);
    await page.getByRole("link", { name: /Next race Race 141/ }).click();
    await expect(page).toHaveURL(/\/races\/review-race-141$/);
});

test("reduced motion keeps the archive operable", async ({ page, isMobile }) =>
{
    test.skip(Boolean(isMobile), "One representative Chromium viewport covers the motion preference.");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(selectedRace);
    await expect(page.getByRole("heading", { name: /JM19 2-/ })).toBeVisible();
    const transition = await page.getByRole("link", { name: "Fri 6" }).evaluate((element) =>
        getComputedStyle(element).transitionDuration
    );
    expect(transition).toBe("0s");
});
