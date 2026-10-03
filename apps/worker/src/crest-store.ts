import type { createDatabase } from "@the-perfect-catch/db";
import { normalizeGrantedEmail } from "@the-perfect-catch/domain";
import type { CrestStore } from "./crests";

export function createCrestStore(database: ReturnType<typeof createDatabase>): CrestStore
{
    return {
        async transaction(work)
        {
            const client = await database.pool.connect();
            try
            {
                await client.query("BEGIN");
                await client.query(
                    "SELECT pg_advisory_xact_lock(hashtext('the-perfect-catch:school-crests'))",
                );
                const result = await work(
                    {
                        async requireAdmin(sessionToken)
                        {
                            const found = await client.query<
                                { id: string; email: string; emailNormalized: string; }
                            >(
                                `
                            SELECT u.id, u.email, g.email_normalized AS "emailNormalized"
                            FROM session s
                            JOIN "user" u ON u.id = s.user_id
                            JOIN access_grants g ON g.user_id = u.id
                            JOIN account a ON a.user_id = u.id AND a.provider_id = 'google' AND a.account_id = g.google_subject
                            WHERE s.token = $1 AND s.expires_at > clock_timestamp() AND u.email_verified
                                AND g.status = 'active' AND g.role = 'admin'
                            FOR UPDATE OF s, u, g, a`,
                                [sessionToken],
                            );
                            const actor = found.rows[0];
                            if (!actor || normalizeGrantedEmail(actor.email) !== actor.emailNormalized)
                            {
                                throw new Error(
                                    "A current verified administrator session and active grant are required",
                                );
                            }
                            return actor.id;
                        },
                        async requireSchool(schoolId)
                        {
                            const found = await client.query(
                                "SELECT id FROM schools WHERE id = $1 FOR UPDATE",
                                [schoolId],
                            );
                            if (!found.rows.length)
                            {
                                throw new Error("The exact school ID does not exist");
                            }
                        },
                        async register(input, crest, storageKey, actorId)
                        {
                            const existing = await client.query<
                                { id: string; school_id: string; visibility: string; rights_status: string; }
                            >(
                                "SELECT id, school_id, visibility, rights_status FROM media_assets WHERE storage_key = $1 FOR UPDATE",
                                [storageKey],
                            );
                            const asset = existing.rows[0];
                            if (
                                asset
                                && (asset.school_id !== input.schoolId || asset.visibility !== "private_beta"
                                    || asset.rights_status !== "official_source_unlicensed")
                            )
                            {
                                throw new Error(
                                    "This content already belongs to another school or a reviewed/removed asset; it cannot be reassigned or restored here",
                                );
                            }
                            const previous = await client.query<{ crest_asset_id: string | null; }>(
                                "SELECT crest_asset_id FROM school_brand_profiles WHERE school_id = $1 FOR UPDATE",
                                [input.schoolId],
                            );
                            const inserted = asset ? null : await client.query<{ id: string; }>(
                                `
                            INSERT INTO media_assets (school_id, storage_key, mime_type, sha256, byte_size, width, height,
                                alt_text, attribution, visibility, rights_status, rights_notes, official_source_url, acquired_at, uploaded_by)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'private_beta', 'official_source_unlicensed', $10, $11, $12, $13)
                            RETURNING id`,
                                [
                                    input.schoolId,
                                    storageKey,
                                    crest.mimeType,
                                    crest.sha256,
                                    crest.bytes.length,
                                    crest.width,
                                    crest.height,
                                    input.altText,
                                    input.attribution,
                                    input.rightsNotes,
                                    input.officialSourceUrl,
                                    input.acquiredAt,
                                    actorId,
                                ],
                            );
                            const assetId = asset?.id ?? inserted!.rows[0].id;
                            await client.query(
                                `
                            INSERT INTO school_brand_profiles (school_id, crest_asset_id, updated_by)
                            VALUES ($1, $2, $3)
                            ON CONFLICT (school_id) DO UPDATE SET crest_asset_id = $2, updated_by = $3, updated_at = now()`,
                                [input.schoolId, assetId, actorId],
                            );
                            await client.query(
                                `
                            INSERT INTO security_events (actor_id, action, outcome, target_id, metadata)
                            VALUES ($1, 'school.crest.register', 'success', $2, $3::jsonb)`,
                                [
                                    actorId,
                                    assetId,
                                    JSON.stringify({
                                        interface: "server-cli",
                                        schoolId: input.schoolId,
                                        previousAssetId: previous.rows[0]?.crest_asset_id ?? null,
                                        sha256: crest.sha256,
                                        sourceUrl: input.officialSourceUrl,
                                        acquiredAt: input.acquiredAt,
                                        rightsNotes: input.rightsNotes,
                                        reviewed: true,
                                        result: asset ? "associated-existing" : "created",
                                    }),
                                ],
                            );
                            return assetId;
                        },
                        async remove(assetId, reason, actorId)
                        {
                            const found = await client.query<{ school_id: string; visibility: string; }>(
                                "SELECT school_id, visibility FROM media_assets WHERE id = $1 FOR UPDATE",
                                [assetId],
                            );
                            if (!found.rows.length)
                            {
                                throw new Error("The crest asset does not exist");
                            }
                            await client.query(
                                `
                            UPDATE media_assets SET visibility = 'removed', rights_status = 'removed',
                                removed_at = COALESCE(removed_at, now()),
                                takedown_history = takedown_history || jsonb_build_array(jsonb_build_object('at', now(), 'reason', $2::text, 'actorId', $3::text))
                            WHERE id = $1`,
                                [assetId, reason, actorId],
                            );
                            await client.query(
                                `
                            UPDATE school_brand_profiles SET crest_asset_id = NULL, updated_by = $2, updated_at = now()
                            WHERE crest_asset_id = $1`,
                                [assetId, actorId],
                            );
                            await client.query(
                                `
                            INSERT INTO security_events (actor_id, action, outcome, target_id, metadata)
                            VALUES ($1, 'school.crest.remove', 'success', $2, $3::jsonb)`,
                                [
                                    actorId,
                                    assetId,
                                    JSON.stringify({
                                        interface: "server-cli",
                                        schoolId: found.rows[0].school_id,
                                        reason,
                                    }),
                                ],
                            );
                        },
                    },
                );
                await client.query("COMMIT");
                return result;
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
        },
    };
}
