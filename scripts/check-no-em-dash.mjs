import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const prohibitedCharacter = String.fromCodePoint(0x2014);
const excludedPrefixes = [
    ".git/",
    ".next/",
    "coverage/",
    "dist/",
    "docs/design/references/",
    "node_modules/",
    "packages/ingestion/fixtures/raw/",
];
const excludedFiles = new Set(["pnpm-lock.yaml"]);

function isFirstPartyFile(filePath)
{
    const normalizedPath = filePath.replaceAll("\\", "/");

    return !excludedFiles.has(normalizedPath)
        && !excludedPrefixes.some((prefix) => normalizedPath.startsWith(prefix));
}

function getTrackedAndUntrackedFiles()
{
    const output = execFileSync(
        "git",
        ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        { encoding: "utf8" },
    );

    return output.split("\0").filter(Boolean).filter(isFirstPartyFile);
}

const violations = [];

for (const filePath of getTrackedAndUntrackedFiles())
{
    let content;

    try
    {
        content = readFileSync(filePath, "utf8");
    }
    catch
    {
        continue;
    }

    if (content.includes(prohibitedCharacter))
    {
        violations.push(filePath);
    }
}

const commitSubjects = execFileSync("git", ["log", "--format=%s%n%b"], { encoding: "utf8" });

if (commitSubjects.includes(prohibitedCharacter))
{
    violations.push("git commit history");
}

if (violations.length > 0)
{
    console.error(`U+2014 is prohibited in: ${violations.join(", ")}`);
    process.exitCode = 1;
}
else
{
    console.info("No prohibited U+2014 characters found.");
}
