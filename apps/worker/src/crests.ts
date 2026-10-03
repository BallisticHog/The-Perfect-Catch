import { inspectCrestFile, type ReviewedCrest, storeCrestFile } from "./crest-file";

export interface CrestRegistration
{
    schoolId: string;
    inputFile: string;
    mediaRoot: string;
    officialSourceUrl: string;
    acquiredAt: string;
    rightsNotes: string;
    attribution: string;
    altText: string;
    reviewed: boolean;
}

export interface CrestTransaction
{
    requireAdmin(sessionToken: string): Promise<string>;
    requireSchool(schoolId: string): Promise<void>;
    register(
        input: CrestRegistration,
        crest: ReviewedCrest,
        storageKey: string,
        actorId: string,
    ): Promise<string>;
    remove(assetId: string, reason: string, actorId: string): Promise<void>;
}

export interface CrestStore
{
    transaction<T>(work: (tx: CrestTransaction) => Promise<T>): Promise<T>;
}

export async function registerCrest(
    store: CrestStore,
    sessionToken: string,
    input: CrestRegistration,
): Promise<string>
{
    return store.transaction(async (tx) =>
    {
        const actorId = await tx.requireAdmin(sessionToken);
        if (
            !input.reviewed || !input.schoolId.trim() || !input.rightsNotes.trim()
            || !input.attribution.trim() || !input.altText.trim()
        )
        {
            throw new Error(
                "A reviewed crest, exact school, attribution, alt text, and rights notes are required",
            );
        }
        const source = new URL(input.officialSourceUrl);
        if (source.protocol !== "https:" || source.username || source.password || source.hash)
        {
            throw new Error("An official HTTPS source URL without credentials or fragment is required");
        }
        const acquired = new Date(input.acquiredAt);
        if (
            !/^\d{4}-\d{2}-\d{2}T/.test(input.acquiredAt) || !Number.isFinite(acquired.getTime())
            || acquired.getTime() > Date.now()
        )
        {
            throw new Error("A valid past acquisition timestamp is required");
        }
        await tx.requireSchool(input.schoolId);
        const crest = await inspectCrestFile(input.inputFile);
        const storageKey = await storeCrestFile(input.mediaRoot, crest);
        await tx.requireAdmin(sessionToken);
        return tx.register(input, crest, storageKey, actorId);
    });
}

export async function removeCrest(
    store: CrestStore,
    sessionToken: string,
    assetId: string,
    reason: string,
): Promise<void>
{
    await store.transaction(async (tx) =>
    {
        const actorId = await tx.requireAdmin(sessionToken);
        if (
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assetId) || !reason.trim()
        )
        {
            throw new Error("An asset ID and takedown reason are required");
        }
        await tx.remove(assetId, reason.trim(), actorId);
    });
}
