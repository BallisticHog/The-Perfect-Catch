import { CHAMPIONSHIP, type Race } from "@the-perfect-catch/domain";
import { createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CatalogRepository, createDatabase } from "../src/index";
import { openTestDatabase } from "./test-database";

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
const databaseSuite = testDatabaseUrl ? describe : describe.skip;
let database: ReturnType<typeof createDatabase>;

function hash(value: string | Buffer): string
{
    return createHash("sha256").update(value).digest("hex");
}

async function clearCatalog(): Promise<void>
{
    const client = await database.pool.connect();
    try
    {
        await client.query("BEGIN");
        await client.query("DELETE FROM athlete_appearances");
        await client.query("DELETE FROM results");
        await client.query("DELETE FROM crew_entries");
        await client.query("DELETE FROM races");
        await client.query("DELETE FROM entity_revisions");
        await client.query("DELETE FROM events");
        await client.query("DELETE FROM regattas");
        await client.query("DELETE FROM catalog_versions");
        await client.query("DELETE FROM school_source_mentions");
        await client.query("DELETE FROM source_fetches");
        await client.query("DELETE FROM source_snapshots");
        await client.query("DELETE FROM source_documents");
        await client.query("DELETE FROM import_runs");
        await client.query("COMMIT");
    }
    catch (error)
    {
        await client.query("ROLLBACK");
        throw error;
    }
    finally
    {
        client.release();
    }
}

databaseSuite("PostgreSQL migration and publication contract", () =>
{
    beforeAll(async () =>
    {
        database = await openTestDatabase(testDatabaseUrl!);
    });

    afterAll(async () =>
    {
        if (database)
        {
            await clearCatalog();
            await database.pool.end();
        }
    });

    it("migrates from zero with locked access, release, media, and identity constraints", async () =>
    {
        const migrations = await database.pool.query<{ name: string; }>(
            "SELECT name FROM app_migrations ORDER BY name",
        );
        expect(migrations.rows.map((row) => row.name)).toContain("0001_archived_regatta.sql");
        const release = await database.pool.query<{ mode: string; }>(
            "SELECT mode FROM site_release_state WHERE id = 'global'",
        );
        expect(release.rows[0]?.mode).toBe("private_beta");
        const alias = await database.pool.query<{ schoolId: string; }>(
            "SELECT school_id AS \"schoolId\" FROM school_aliases WHERE alias_key = 'st dunstans college'",
        );
        expect(alias.rows[0]?.schoolId).toBe("st-dunstans-college");

        const client = await database.pool.connect();
        try
        {
            await client.query("BEGIN");
            await client.query(
                "INSERT INTO \"user\" (id, name, email, email_verified) VALUES ('constraint-user', 'Constraint User', 'constraint@example.test', true)",
            );

            await client.query("SAVEPOINT account_probe");
            let accountError: string | undefined;
            try
            {
                await client.query(
                    "INSERT INTO account (id, account_id, provider_id, user_id, access_token) VALUES ('constraint-account', 'subject', 'google', 'constraint-user', 'must-not-persist')",
                );
            }
            catch (error)
            {
                accountError = (error as { code?: string; }).code;
            }
            await client.query("ROLLBACK TO SAVEPOINT account_probe");
            expect(accountError).toBe("23514");

            await client.query("SAVEPOINT release_probe");
            let releaseError: string | undefined;
            try
            {
                await client.query("UPDATE site_release_state SET mode = 'public' WHERE id = 'global'");
            }
            catch (error)
            {
                releaseError = (error as { code?: string; }).code;
            }
            await client.query("ROLLBACK TO SAVEPOINT release_probe");
            expect(releaseError).toBe("23514");

            await client.query(
                "INSERT INTO schools (id, name) VALUES ('constraint-school-a', 'Constraint School A'), ('constraint-school-b', 'Constraint School B')",
            );
            const asset = await client.query<{ id: string; }>(
                "INSERT INTO media_assets (school_id, storage_key, mime_type, sha256, byte_size, alt_text) VALUES ('constraint-school-a', $1, 'image/png', $2, 4, 'Fixture crest') RETURNING id",
                [`school-crests/${"a".repeat(64)}.png`, "a".repeat(64)],
            );
            await client.query("SAVEPOINT crest_probe");
            let crestError: string | undefined;
            try
            {
                await client.query(
                    "INSERT INTO school_brand_profiles (school_id, crest_asset_id) VALUES ('constraint-school-b', $1)",
                    [asset.rows[0]?.id],
                );
            }
            catch (error)
            {
                crestError = (error as { code?: string; }).code;
            }
            await client.query("ROLLBACK TO SAVEPOINT crest_probe");
            expect(crestError).toBe("23503");
            await client.query("ROLLBACK");
        }
        finally
        {
            client.release();
        }
    });

    it("reuses exact snapshots, reactivates A after A to B to A, and rolls back failed publication", async () =>
    {
        await clearCatalog();
        const repository = new CatalogRepository(database.db);
        const sourceUrl = new URL("1_SF%201.htm", CHAMPIONSHIP.sourceUrl).href;
        const makeDocument = (body: string, etag: string) =>
        {
            const rawBytes = Buffer.from(body, "utf8");
            return {
                sourceKey: hash(sourceUrl),
                url: sourceUrl,
                sha256: hash(rawBytes),
                rawBytes,
                decodedHtml: body,
                encoding: "windows-1252",
                responseHeaders: { etag },
            };
        };
        const snapshotA = await repository.storeDocument(makeDocument("<html>A</html>", "race-A"));
        const runA = await repository.startImport("integration.v1");
        await repository.recordFetch({
            importRunId: runA.id,
            documentId: snapshotA.id,
            url: sourceUrl,
            statusCode: 200,
            responseHeaders: { etag: "race-A" },
            error: null,
        });
        const snapshotB = await repository.storeDocument(makeDocument("<html>B</html>", "race-B"));
        const observationRun = await repository.startImport("integration.v1");
        await repository.recordFetch({
            importRunId: observationRun.id,
            documentId: snapshotB.id,
            url: sourceUrl,
            statusCode: 200,
            responseHeaders: { etag: "race-B" },
            error: null,
        });
        await repository.recordFetch({
            importRunId: observationRun.id,
            documentId: snapshotA.id,
            url: sourceUrl,
            statusCode: 200,
            responseHeaders: { etag: "race-A" },
            error: null,
        });
        expect((await repository.latestDocument(snapshotA.sourceKey))?.id).toBe(snapshotA.id);

        const race = (sourceSnapshotId: string, finishMs: number): Race => ({
            sourceKey: snapshotA.sourceKey,
            sourceUrl,
            sourceSnapshotId,
            sourceEventId: "1",
            eventNameRaw: "JM/BU14 1x",
            eventName: "JM/BU14 1x",
            gender: "boys",
            ageGroup: "U14",
            boatClass: "1x",
            raceNumber: 69,
            roundRaw: "SF 1",
            round: "semifinal",
            dateRaw: "Friday, 06 March 2026",
            timeRaw: "12:50:00",
            scheduledAt: "2026-03-06T10:50:00.000Z",
            statusRaw: "Official",
            official: true,
            progressionRaw: "First two to final",
            results: [{
                sourceKey: `${snapshotA.sourceKey}:row:0`,
                rowIndex: 0,
                schoolRaw: "St Dunstans College",
                schoolKey: "st-dunstans-college",
                boatRaw: "Fixture A",
                laneRaw: "1",
                lane: 1,
                placeRaw: "1",
                place: 1,
                finishRaw: "4:37.48",
                finishMs,
                splitRaw: ".00",
                deltaRaw: ".00",
                statusRaw: "Finished",
                status: "finished",
                athletesRaw: "Fixture, Alpha",
                appearances: [{
                    rawName: "Fixture, Alpha",
                    displayName: "Alpha Fixture",
                    seat: 1,
                    isCox: false,
                    rawAnnotation: null,
                }],
                rawCells: [
                    "1",
                    "1",
                    "Fixture A",
                    "St Dunstans College",
                    "4:37.48",
                    ".00",
                    ".00",
                    "Finished",
                    "Fixture, Alpha",
                ],
            }],
        });
        const manifestA = hash("manifest-A");
        const manifestB = hash("manifest-B");
        const first = await repository.publishImport(runA.id, manifestA, [race(snapshotA.id, 277_480)], []);
        expect(first.status).toBe("published");
        const runB = await repository.startImport("integration.v1");
        await repository.publishImport(runB.id, manifestB, [race(snapshotB.id, 277_490)], []);
        const runRevert = await repository.startImport("integration.v1");
        const reverted = await repository.publishImport(runRevert.id, manifestA, [
            race(snapshotA.id, 277_480),
        ], []);
        expect(reverted).toEqual({ status: "unchanged", versionId: first.versionId });
        expect((await repository.getPublishedCatalog())?.version.id).toBe(first.versionId);

        const beforeFailure = await database.pool.query<{ count: string; }>(
            "SELECT count(*) FROM catalog_versions WHERE regatta_key = $1",
            [CHAMPIONSHIP.slug],
        );
        const failedRun = await repository.startImport("integration.v1");
        await expect(
            repository.publishImport(failedRun.id, hash("manifest-failure"), [
                race("00000000-0000-0000-0000-000000000000", 277_500),
            ], []),
        ).rejects.toThrow();
        const afterFailure = await database.pool.query<{ count: string; }>(
            "SELECT count(*) FROM catalog_versions WHERE regatta_key = $1",
            [CHAMPIONSHIP.slug],
        );
        expect(afterFailure.rows[0]?.count).toBe(beforeFailure.rows[0]?.count);
        expect((await repository.getPublishedCatalog())?.version.id).toBe(first.versionId);
    });
});
