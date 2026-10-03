import { createDatabase } from "@the-perfect-catch/db";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createCrestStore } from "../src/crest-store";
import type { CrestRegistration } from "../src/crests";

const databaseUrl = process.env.TEST_DATABASE_URL;
const databaseSuite = databaseUrl ? describe : describe.skip;

databaseSuite("crest database authorization and takedown", () =>
{
    let database: ReturnType<typeof createDatabase>;
    const actorId = `crest-test-${randomUUID()}`;
    const email = `${actorId}@example.test`;
    const schoolId = actorId;
    const token = randomUUID();
    const sha256 = randomUUID().replaceAll("-", "").repeat(2);
    let assetId: string;

    beforeAll(async () =>
    {
        database = createDatabase(databaseUrl!);
        const identity = await database.pool.query<{ name: string; }>("SELECT current_database() AS name");
        if (!identity.rows[0]?.name.toLowerCase().includes("test"))
        {
            await database.pool.end();
            throw new Error("Crest integration tests require a dedicated test database");
        }
        await database.pool.query(
            "INSERT INTO \"user\" (id, name, email, email_verified) VALUES ($1, $1, $2, true)",
            [actorId, email],
        );
        await database.pool.query(
            "INSERT INTO account (id, account_id, provider_id, user_id) VALUES ($1, $1, 'google', $1)",
            [actorId],
        );
        await database.pool.query(
            "INSERT INTO session (id, token, expires_at, user_id) VALUES ($1, $2, now() + interval '1 hour', $1)",
            [actorId, token],
        );
        await database.pool.query(
            "INSERT INTO access_grants (email_normalized, user_id, google_subject, role) VALUES ($1, $2, $2, 'admin')",
            [email, actorId],
        );
        await database.pool.query("INSERT INTO schools (id, name) VALUES ($1, 'Crest integration fixture')", [
            schoolId,
        ]);
    });

    afterAll(async () =>
    {
        if (!database || database.pool.ended)
        {
            return;
        }
        try
        {
            await database.pool.query("DELETE FROM school_brand_profiles WHERE school_id = $1", [schoolId]);
            await database.pool.query("DELETE FROM media_assets WHERE school_id = $1", [schoolId]);
            await database.pool.query("DELETE FROM schools WHERE id = $1", [schoolId]);
            await database.pool.query("DELETE FROM security_events WHERE actor_id = $1", [actorId]);
            await database.pool.query("DELETE FROM access_grants WHERE user_id = $1", [actorId]);
            await database.pool.query("DELETE FROM \"user\" WHERE id = $1", [actorId]);
        }
        finally
        {
            await database.pool.end();
        }
    });

    it("checks the real current session, role, expiry, Google binding, and email verification", async () =>
    {
        const store = createCrestStore(database);
        const authorize = (sessionToken: string = token) =>
            store.transaction((tx) => tx.requireAdmin(sessionToken));
        expect(await authorize()).toBe(actorId);
        await expect(authorize("missing")).rejects.toThrow("administrator");
        await database.pool.query("UPDATE access_grants SET role = 'viewer' WHERE user_id = $1", [actorId]);
        await expect(authorize()).rejects.toThrow("administrator");
        await database.pool.query(
            "UPDATE access_grants SET role = 'admin', status = 'revoked', revoked_at = now() WHERE user_id = $1",
            [actorId],
        );
        await expect(authorize()).rejects.toThrow("administrator");
        await database.pool.query(
            "UPDATE access_grants SET status = 'active', revoked_at = NULL WHERE user_id = $1",
            [actorId],
        );
        await database.pool.query(
            "UPDATE session SET expires_at = now() - interval '1 second' WHERE user_id = $1",
            [actorId],
        );
        await expect(authorize()).rejects.toThrow("administrator");
        await database.pool.query(
            "UPDATE session SET expires_at = now() + interval '1 hour' WHERE user_id = $1",
            [actorId],
        );
        await database.pool.query("UPDATE account SET account_id = 'mismatch' WHERE user_id = $1", [actorId]);
        await expect(authorize()).rejects.toThrow("administrator");
        await database.pool.query("UPDATE account SET account_id = $1 WHERE user_id = $1", [actorId]);
        await database.pool.query("UPDATE \"user\" SET email_verified = false WHERE id = $1", [actorId]);
        await expect(authorize()).rejects.toThrow("administrator");
        await database.pool.query("UPDATE \"user\" SET email_verified = true WHERE id = $1", [actorId]);
    });

    it("registers only provisional private assets, preserves palettes, records takedown, and refuses resurrection", async () =>
    {
        const store = createCrestStore(database);
        const input: CrestRegistration = {
            schoolId,
            inputFile: "unused-by-store",
            mediaRoot: "unused-by-store",
            reviewed: true,
            officialSourceUrl: "https://stdunstans.co.za/vision",
            acquiredAt: "2026-03-10T12:00:00Z",
            rightsNotes: "Fixture private review; no permission",
            attribution: "Fixture source",
            altText: "Fixture crest",
        };
        const crest = {
            bytes: Buffer.from("fixture"),
            sha256,
            width: 4,
            height: 4,
            mimeType: "image/png",
            extension: "png",
        };
        await database.pool.query(
            "INSERT INTO school_brand_profiles (school_id, primary_color) VALUES ($1, '#253573')",
            [schoolId],
        );
        const register = () =>
            store.transaction(async (tx) =>
            {
                const actor = await tx.requireAdmin(token);
                await tx.requireSchool(schoolId);
                return tx.register(input, crest, `crests/${sha256}.png`, actor);
            });
        assetId = await register();
        expect(await register()).toBe(assetId);
        const asset = await database.pool.query(
            "SELECT visibility, rights_status, official_source_url, uploaded_by FROM media_assets WHERE id = $1",
            [assetId],
        );
        expect(asset.rows[0]).toEqual({
            visibility: "private_beta",
            rights_status: "official_source_unlicensed",
            official_source_url: input.officialSourceUrl,
            uploaded_by: actorId,
        });
        await store.transaction(async (tx) =>
            tx.remove(assetId, "Rights review request", await tx.requireAdmin(token))
        );
        const removed = await database.pool.query(
            "SELECT visibility, rights_status, removed_at, takedown_history FROM media_assets WHERE id = $1",
            [assetId],
        );
        expect(removed.rows[0]).toMatchObject({
            visibility: "removed",
            rights_status: "removed",
            takedown_history: [{ reason: "Rights review request", actorId }],
        });
        expect(removed.rows[0].removed_at).toBeInstanceOf(Date);
        const brand = await database.pool.query(
            "SELECT crest_asset_id, primary_color FROM school_brand_profiles WHERE school_id = $1",
            [schoolId],
        );
        expect(brand.rows[0]).toEqual({ crest_asset_id: null, primary_color: "#253573" });
        await expect(register()).rejects.toThrow("cannot be reassigned or restored");
        const events = await database.pool.query(
            "SELECT action FROM security_events WHERE actor_id = $1 ORDER BY created_at",
            [actorId],
        );
        expect(events.rows.map((event) => event.action)).toEqual([
            "school.crest.register",
            "school.crest.register",
            "school.crest.remove",
        ]);
    });
});
