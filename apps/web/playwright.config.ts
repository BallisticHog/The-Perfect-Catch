import { defineConfig, devices } from "@playwright/test";

const reviewSecret = "local-review-browser-secret-32-characters-minimum";
const useExternalServer = process.env.CATCH_E2E_EXTERNAL === "true";

export default defineConfig({
    testDir: "./e2e",
    outputDir: "../../test-results/web",
    preserveOutput: "always",
    fullyParallel: false,
    forbidOnly: Boolean(process.env.CI),
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
    use: {
        baseURL: useExternalServer ? "http://127.0.0.1:4318" : "http://127.0.0.1:4317",
        extraHTTPHeaders: { "x-the-catch-local-review": reviewSecret },
        screenshot: "only-on-failure",
        trace: "retain-on-failure",
    },
    webServer: useExternalServer ? undefined : {
        command: "pnpm exec next dev --hostname 127.0.0.1 --port 4317",
        url: "http://127.0.0.1:4317/sign-in",
        reuseExistingServer: false,
        timeout: 120_000,
        env: {
            LOCAL_REVIEW_MODE: "true",
            LOCAL_REVIEW_SECRET: reviewSecret,
        },
    },
    projects: [
        {
            name: "desktop-chromium",
            use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
        },
        {
            name: "mobile-chromium",
            use: { ...devices["Pixel 5"] },
        },
    ],
});
