import { createDatabase } from "@the-perfect-catch/db";
import { createGrantStore } from "./grant-store";
import { administerGrant, type GrantCommand, verifyBootstrapSecret } from "./grants";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
{
    throw new Error("DATABASE_URL is required");
}
const action = process.argv[2];
let command: GrantCommand;
if (action === "bootstrap")
{
    if (!verifyBootstrapSecret(process.env.BOOTSTRAP_SECRET, process.env.BOOTSTRAP_SECRET_SHA256))
    {
        throw new Error("The temporary owner bootstrap secret is invalid");
    }
    command = { action, email: process.env.BOOTSTRAP_GOOGLE_EMAIL ?? "" };
}
else if (action === "grant" || action === "revoke")
{
    const actorId = process.env.ADMIN_USER_ID;
    if (!actorId)
    {
        throw new Error("ADMIN_USER_ID must identify the acting administrator");
    }
    const email = process.env.GRANT_EMAIL ?? "";
    if (action === "revoke")
    {
        command = { action, email, actorId, notes: process.env.GRANT_NOTES };
    }
    else
    {
        const role = process.argv[3];
        if (role !== "viewer" && role !== "admin")
        {
            throw new Error("Grant role must be viewer or admin");
        }
        command = { action, email, actorId, role, notes: process.env.GRANT_NOTES };
    }
}
else
{
    throw new Error("Expected bootstrap, grant viewer, grant admin, or revoke");
}
const database = createDatabase(databaseUrl);
try
{
    const result = await administerGrant(createGrantStore(database), command);
    console.info(`Access grant ${result.status}; audit target ${result.grantId}`);
}
finally
{
    await database.pool.end();
}
