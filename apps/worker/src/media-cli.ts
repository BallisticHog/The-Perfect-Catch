import { createDatabase } from "@the-perfect-catch/db";
import { createCrestStore } from "./crest-store";
import { registerCrest, removeCrest } from "./crests";

const databaseUrl = process.env.DATABASE_URL;
const sessionToken = process.env.ADMIN_SESSION_TOKEN;
if (!databaseUrl || !sessionToken)
{
    throw new Error("DATABASE_URL and ADMIN_SESSION_TOKEN are required in the trusted server environment");
}
const database = createDatabase(databaseUrl);
try
{
    const store = createCrestStore(database);
    if (process.argv[2] === "register")
    {
        const assetId = await registerCrest(store, sessionToken, {
            schoolId: process.env.CREST_SCHOOL_ID ?? "",
            inputFile: process.env.CREST_INPUT_FILE ?? "",
            mediaRoot: process.env.MEDIA_ROOT ?? "",
            officialSourceUrl: process.env.CREST_OFFICIAL_SOURCE_URL ?? "",
            acquiredAt: process.env.CREST_ACQUIRED_AT ?? "",
            rightsNotes: process.env.CREST_RIGHTS_NOTES ?? "",
            attribution: process.env.CREST_ATTRIBUTION ?? "",
            altText: process.env.CREST_ALT_TEXT ?? "",
            reviewed: process.env.CREST_REVIEWED === "true",
        });
        console.info(`Private-beta crest registered: ${assetId}`);
    }
    else if (process.argv[2] === "remove")
    {
        await removeCrest(
            store,
            sessionToken,
            process.env.CREST_ASSET_ID ?? "",
            process.env.CREST_TAKEDOWN_REASON ?? "",
        );
        console.info("Crest removed from delivery; takedown recorded and school fallback restored");
    }
    else
    {
        throw new Error("Expected register or remove");
    }
}
finally
{
    await database.pool.end();
}
