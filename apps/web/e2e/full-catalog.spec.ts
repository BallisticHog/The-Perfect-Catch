import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const stDunstansRace = "/races/7586c251170aab4bd95dc999e22cbe85804b9a92baa79ad59dd4ddd6944aa21f";

test.skip(process.env.CATCH_E2E_FULL !== "true", "The full local catalogue is an explicit review run.");

test(
    "the complete championship links events, rowers, races, and schools",
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

        await page.goto("/regattas/2026-sa-schools-championships");
        await expect(page.getByRole("status")).toContainText("42 events");
        await expect(page.locator(".event-directory-row")).toHaveCount(30);
        await page.getByRole("link", { name: "Rower records" }).click();
        await expect(page.getByRole("heading", { name: "Championship rower records" })).toBeVisible();

        await page.goto(stDunstansRace);
        await expect(page.getByRole("heading", { name: /JM\/BU14 1x/ })).toBeVisible();
        if (isMobile)
        {
            const result = page.locator(".mobile-result").filter({ hasText: "St Dunstans College" }).first();
            if (!(await result.evaluate((element) => element.hasAttribute("open"))))
            {
                await result.locator("summary").click();
            }
            await result.getByRole("link", { name: /Luka Meduric/ }).click();
        }
        else
        {
            await page.locator(".desktop-results").getByRole("link", { name: "Luka Meduric" }).click();
        }

        await expect(page).toHaveURL(/\/rowers\/V4TvNeNcYEK-n8Y-q5$/);
        await expect(page.getByRole("heading", { name: "Luka Meduric" })).toBeVisible();
        await expect(page.getByText(/does not prove a permanent identity/)).toBeVisible();
        await page.getByRole("link", { name: "St Dunstan's College" }).first().click();
        await expect(page.getByRole("heading", { name: "St Dunstan's College" })).toBeVisible();
        await expect(page.getByRole("link", { name: "Luka Meduric" }).first()).toBeVisible();
        await expect(page.locator(".school-app-frame")).toBeVisible();
        const background = await page.locator(".school-app-frame").evaluate((element) =>
            getComputedStyle(element).backgroundImage
        );
        expect(background).toContain("linear-gradient");

        const accessibility = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag22aa"])
            .analyze();
        expect(accessibility.violations).toEqual([]);
        await page.screenshot({
            path: testInfo.outputPath(isMobile ? "full-school-mobile.png" : "full-school-desktop.png"),
            fullPage: true,
        });
        expect(browserIssues).toEqual([]);
    },
);
