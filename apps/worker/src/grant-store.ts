import type { createDatabase } from "@the-perfect-catch/db";
import type { GrantRecord, GrantStore } from "./grants";

export function createGrantStore(database: ReturnType<typeof createDatabase>): GrantStore
{
    return {
        async transaction(work)
        {
            const client = await database.pool.connect();
            try
            {
                await client.query("BEGIN");
                await client.query(
                    "SELECT pg_advisory_xact_lock(hashtext('the-perfect-catch:access-grants'))",
                );
                const fields =
                    "id, email_normalized AS \"emailNormalized\", role, status, user_id AS \"userId\", google_subject AS \"googleSubject\"";
                const result = await work(
                    {
                        async findByEmail(email)
                        {
                            const found = await client.query<GrantRecord>(
                                `SELECT ${fields} FROM access_grants WHERE email_normalized = $1 FOR UPDATE`,
                                [email],
                            );
                            return found.rows[0] ?? null;
                        },
                        async findActiveAdmin(userId)
                        {
                            const found = await client.query<GrantRecord>(
                                `SELECT ${fields} FROM access_grants WHERE user_id = $1 AND status = 'active' AND role = 'admin' FOR UPDATE`,
                                [userId],
                            );
                            return found.rows[0] ?? null;
                        },
                        async hasAdmin()
                        {
                            const found = await client.query(
                                "SELECT 1 FROM access_grants WHERE role = 'admin' LIMIT 1",
                            );
                            return found.rows.length > 0;
                        },
                        async save(input)
                        {
                            const found = await client.query<GrantRecord>(
                                `
                            INSERT INTO access_grants (email_normalized, role, status, granted_by_user_id, revoked_at, revoked_by_user_id, notes)
                            VALUES ($1, $2, $3, $4, CASE WHEN $3 = 'revoked' THEN now() END, CASE WHEN $3 = 'revoked' THEN $4 END, $5)
                            ON CONFLICT (email_normalized) DO UPDATE SET
                                role = EXCLUDED.role, status = EXCLUDED.status,
                                granted_at = CASE WHEN EXCLUDED.status = 'active' THEN now() ELSE access_grants.granted_at END,
                                granted_by_user_id = CASE WHEN EXCLUDED.status = 'active' THEN $4 ELSE access_grants.granted_by_user_id END,
                                revoked_at = CASE WHEN EXCLUDED.status = 'revoked' THEN now() END,
                                revoked_by_user_id = CASE WHEN EXCLUDED.status = 'revoked' THEN $4 END,
                                notes = COALESCE($5, access_grants.notes)
                            RETURNING ${fields}`,
                                [input.emailNormalized, input.role, input.status, input.actorId, input.notes],
                            );
                            return found.rows[0];
                        },
                        async audit(action, actorId, targetId, result)
                        {
                            await client.query(
                                "INSERT INTO security_events (actor_id, action, outcome, target_id, metadata) VALUES ($1, $2, 'success', $3, $4::jsonb)",
                                [
                                    actorId,
                                    action,
                                    targetId,
                                    JSON.stringify({ result, interface: "server-cli" }),
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
