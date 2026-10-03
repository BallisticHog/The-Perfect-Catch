import { normalizeGrantedEmail } from "@the-perfect-catch/domain";
import { createHash, timingSafeEqual } from "node:crypto";

export interface GrantRecord
{
    id: string;
    emailNormalized: string;
    role: "viewer" | "admin";
    status: "active" | "revoked";
    userId: string | null;
    googleSubject: string | null;
}

export interface GrantTransaction
{
    findByEmail(email: string): Promise<GrantRecord | null>;
    findActiveAdmin(userId: string): Promise<GrantRecord | null>;
    hasAdmin(): Promise<boolean>;
    save(
        input: {
            emailNormalized: string;
            role: "viewer" | "admin";
            status: "active" | "revoked";
            actorId: string | null;
            notes: string | null;
        },
    ): Promise<GrantRecord>;
    audit(action: string, actorId: string | null, targetId: string, result: string): Promise<void>;
}

export interface GrantStore
{
    transaction<T>(work: (tx: GrantTransaction) => Promise<T>): Promise<T>;
}

export function normalizeGrantEmail(value: string): string
{
    const normalized = normalizeGrantedEmail(value);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized))
    {
        throw new Error("A valid email address is required");
    }
    return normalized;
}

export function verifyBootstrapSecret(secret: string | undefined, expectedHash: string | undefined): boolean
{
    if (
        !secret || Buffer.byteLength(secret, "utf8") < 32 || !expectedHash
        || !/^[0-9a-f]{64}$/i.test(expectedHash)
    )
    {
        return false;
    }
    const actual = createHash("sha256").update(secret, "utf8").digest();
    const expected = Buffer.from(expectedHash, "hex");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export type GrantCommand =
    | { action: "bootstrap"; email: string; }
    | { action: "grant"; email: string; role: "viewer" | "admin"; actorId: string; notes?: string; }
    | { action: "revoke"; email: string; actorId: string; notes?: string; };

export async function administerGrant(
    store: GrantStore,
    command: GrantCommand,
): Promise<{ status: "created" | "updated" | "unchanged"; grantId: string; }>
{
    const emailNormalized = normalizeGrantEmail(command.email);
    return store.transaction(async (tx) =>
    {
        const existing = await tx.findByEmail(emailNormalized);
        if (command.action === "bootstrap")
        {
            if (existing?.status === "active" && existing.role === "admin")
            {
                await tx.audit("access.bootstrap", null, existing.id, "unchanged");
                return { status: "unchanged", grantId: existing.id };
            }
            if (existing || await tx.hasAdmin())
            {
                throw new Error(
                    "Owner bootstrap is already initialized; use an audited administrator grant command",
                );
            }
            const grant = await tx.save({
                emailNormalized,
                role: "admin",
                status: "active",
                actorId: null,
                notes: "Initial owner bootstrap",
            });
            await tx.audit("access.bootstrap", null, grant.id, "created");
            return { status: "created", grantId: grant.id };
        }
        if (!await tx.findActiveAdmin(command.actorId))
        {
            throw new Error("The acting account must have a current active administrator grant");
        }
        if (command.action === "revoke" && !existing)
        {
            throw new Error("No grant exists for the supplied email");
        }
        const role = command.action === "grant" ? command.role : existing!.role;
        const status = command.action === "grant" ? "active" : "revoked";
        if (existing?.role === role && existing.status === status)
        {
            await tx.audit(`access.${command.action}`, command.actorId, existing.id, "unchanged");
            return { status: "unchanged", grantId: existing.id };
        }
        const grant = await tx.save({
            emailNormalized,
            role,
            status,
            actorId: command.actorId,
            notes: command.notes ?? null,
        });
        await tx.audit(
            `access.${command.action}`,
            command.actorId,
            grant.id,
            existing ? "updated" : "created",
        );
        return { status: existing ? "updated" : "created", grantId: grant.id };
    });
}
