import {
    CHAMPIONSHIP,
    exactAliasKey,
    type ImportIssue,
    type Race,
    type SchoolAlias,
} from "@the-perfect-catch/domain";
import { and, desc, eq, ne, sql } from "drizzle-orm";
import { createHash } from "node:crypto";
import type { Database } from "./index";
import * as tables from "./schema";

function requireRow<T>(value: T | undefined, context: string): T
{
    if (!value)
    {
        throw new Error(`Database operation returned no row: ${context}`);
    }
    return value;
}

export interface StoredDocument
{
    sourceKey: string;
    url: string;
    sha256: string;
    rawBytes: Buffer;
    decodedHtml: string;
    encoding: string;
    responseHeaders: Record<string, string>;
}

export interface SchoolPresentation
{
    id: string;
    name: string;
    shortName: string | null;
    description: string | null;
    crestAssetId: string | null;
    primaryColor: string | null;
    secondaryColor: string | null;
    accessibleTokens: Record<string, string> | null;
    paletteSourceUrl: string | null;
    confidence: "low" | "medium" | "high" | null;
    inferred: boolean | null;
    themeAlgorithmVersion: string | null;
}

export class CatalogRepository
{
    constructor(private readonly db: Database)
    {
    }

    async startImport(parserVersion: string, requestedBy?: string)
    {
        const [run] = await this.db.insert(tables.importRuns).values({
            regattaKey: CHAMPIONSHIP.slug,
            parserVersion,
            requestedBy,
        }).returning();
        return requireRow(run, "start import");
    }

    async finishImport(
        id: string,
        status: "failed" | "validated" | "unchanged",
        issues: ImportIssue[],
        expectedRaces: number,
        parsedRaces: number,
    )
    {
        await this.db.update(tables.importRuns).set({
            status,
            issues,
            expectedRaces,
            parsedRaces,
            finishedAt: new Date(),
        }).where(eq(tables.importRuns.id, id));
    }

    async latestDocument(sourceKey: string)
    {
        const [observation] = await this.db.select({ snapshot: tables.sourceSnapshots })
            .from(tables.sourceFetches)
            .innerJoin(tables.sourceSnapshots, eq(tables.sourceFetches.documentId, tables.sourceSnapshots.id))
            .where(eq(tables.sourceSnapshots.sourceKey, sourceKey))
            .orderBy(desc(tables.sourceFetches.fetchedAt), desc(tables.sourceFetches.id))
            .limit(1);
        if (observation)
        {
            return observation.snapshot;
        }
        const [snapshot] = await this.db.select().from(tables.sourceSnapshots)
            .where(eq(tables.sourceSnapshots.sourceKey, sourceKey))
            .orderBy(desc(tables.sourceSnapshots.fetchedAt), desc(tables.sourceSnapshots.id))
            .limit(1);
        return snapshot ?? null;
    }

    async storeDocument(document: StoredDocument)
    {
        return this.db.transaction(async (tx) =>
        {
            await tx.insert(tables.sourceDocuments).values({
                sourceKey: document.sourceKey,
                url: document.url,
            }).onConflictDoNothing();
            const [source] = await tx.select().from(tables.sourceDocuments).where(
                eq(tables.sourceDocuments.sourceKey, document.sourceKey),
            );
            await tx.insert(tables.sourceSnapshots).values({
                ...document,
                sourceDocumentId: requireRow(source, "source document").id,
            }).onConflictDoNothing();
            const [stored] = await tx.select().from(tables.sourceSnapshots).where(
                and(
                    eq(tables.sourceSnapshots.sourceKey, document.sourceKey),
                    eq(tables.sourceSnapshots.sha256, document.sha256),
                ),
            );
            return requireRow(stored, "source snapshot");
        });
    }

    async recordFetch(input: typeof tables.sourceFetches.$inferInsert)
    {
        await this.db.insert(tables.sourceFetches).values(input);
    }

    async listAliases(): Promise<SchoolAlias[]>
    {
        return this.db.select({
            alias: tables.schoolAliases.alias,
            schoolKey: tables.schools.id,
            displayName: tables.schools.name,
        }).from(tables.schoolAliases).innerJoin(
            tables.schools,
            eq(tables.schoolAliases.schoolId, tables.schools.id),
        );
    }

    async isActiveAdministrator(userId: string): Promise<boolean>
    {
        const [grant] = await this.db.select({ id: tables.accessGrants.id }).from(tables.accessGrants).where(
            and(
                eq(tables.accessGrants.userId, userId),
                eq(tables.accessGrants.role, "admin"),
                eq(tables.accessGrants.status, "active"),
            ),
        ).limit(1);
        return Boolean(grant);
    }

    async recordSecurityEvent(input: typeof tables.securityEvents.$inferInsert): Promise<void>
    {
        await this.db.insert(tables.securityEvents).values(input);
    }

    async addExplicitAlias(alias: SchoolAlias, approvedBy?: string)
    {
        await this.db.transaction(async (tx) =>
        {
            await tx.insert(tables.schools).values({ id: alias.schoolKey, name: alias.displayName })
                .onConflictDoNothing();
            await tx.insert(tables.schoolAliases).values({
                alias: alias.alias,
                aliasKey: exactAliasKey(alias.alias),
                schoolId: alias.schoolKey,
                approvedBy,
            }).onConflictDoNothing();
            const [existing] = await tx.select().from(tables.schoolAliases).where(
                eq(tables.schoolAliases.aliasKey, exactAliasKey(alias.alias)),
            );
            if (requireRow(existing, "school alias").schoolId !== alias.schoolKey)
            {
                throw new Error("Alias already belongs to a different school");
            }
        });
    }

    async publishImport(runId: string, manifestHash: string, races: Race[], issues: ImportIssue[])
    {
        if (!races.length || issues.some((issue) => issue.severity === "error"))
        {
            throw new Error("A complete, validated catalog is required before publish");
        }
        return this.db.transaction(async (tx) =>
        {
            // Serialize publishes, keeping source network I/O outside the transaction.
            await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${CHAMPIONSHIP.slug}))`);
            const [prior] = await tx.select().from(tables.catalogVersions).where(
                and(
                    eq(tables.catalogVersions.regattaKey, CHAMPIONSHIP.slug),
                    eq(tables.catalogVersions.manifestHash, manifestHash),
                ),
            ).limit(1);
            if (prior)
            {
                await tx.insert(tables.regattas).values(
                    {
                        id: CHAMPIONSHIP.slug,
                        name: CHAMPIONSHIP.name,
                        sourceName: CHAMPIONSHIP.sourceTitle,
                        sourceUrl: CHAMPIONSHIP.sourceUrl,
                        startsOn: CHAMPIONSHIP.startsOn,
                        endsOn: CHAMPIONSHIP.endsOn,
                        venue: CHAMPIONSHIP.venue,
                        activeVersionId: prior.id,
                    },
                ).onConflictDoUpdate({
                    target: tables.regattas.id,
                    set: { activeVersionId: prior.id, updatedAt: new Date() },
                });
                await tx.update(tables.importRuns).set({
                    status: "unchanged",
                    manifestHash,
                    issues,
                    parsedRaces: races.length,
                    expectedRaces: races.length,
                    finishedAt: new Date(),
                }).where(eq(tables.importRuns.id, runId));
                return { status: "unchanged" as const, versionId: prior.id };
            }
            const [storedVersion] = await tx.insert(tables.catalogVersions).values({
                importRunId: runId,
                regattaKey: CHAMPIONSHIP.slug,
                manifestHash,
            }).returning();
            const version = requireRow(storedVersion, "catalog version");
            const [storedRun] = await tx.select({ parserVersion: tables.importRuns.parserVersion }).from(
                tables.importRuns,
            ).where(eq(tables.importRuns.id, runId));
            const parserVersion = requireRow(storedRun, "import run").parserVersion;
            const eventIds = new Map<string, string>();
            for (const race of races)
            {
                let eventId = eventIds.get(race.sourceEventId);
                if (!eventId)
                {
                    const [event] = await tx.insert(tables.events).values(
                        {
                            catalogVersionId: version.id,
                            sourceKey: `${CHAMPIONSHIP.slug}:event:${race.sourceEventId}`,
                            sourceEventId: race.sourceEventId,
                            name: race.eventName,
                            rawName: race.eventNameRaw,
                            gender: race.gender,
                            ageGroup: race.ageGroup,
                            boatClass: race.boatClass,
                        },
                    ).returning();
                    eventId = requireRow(event, "catalog event").id;
                    eventIds.set(race.sourceEventId, eventId);
                }
                if (!race.sourceSnapshotId)
                {
                    throw new Error(`Missing source document for ${race.sourceUrl}`);
                }
                const [revision] = await tx.insert(tables.entityRevisions).values(
                    {
                        entityType: "race",
                        entityKey: race.sourceKey,
                        catalogVersionId: version.id,
                        sourceSnapshotId: race.sourceSnapshotId,
                        parserVersion,
                        normalizedHash: createHash("sha256").update(JSON.stringify(race)).digest("hex"),
                        data: race,
                    },
                ).returning();
                const [storedRace] = await tx.insert(tables.races).values(
                    {
                        catalogVersionId: version.id,
                        eventId,
                        sourceKey: race.sourceKey,
                        sourceUrl: race.sourceUrl,
                        sourceSnapshotId: race.sourceSnapshotId,
                        activeRevisionId: requireRow(revision, "race revision").id,
                        raceNumber: race.raceNumber,
                        round: race.round,
                        rawRound: race.roundRaw,
                        scheduledAt: race.scheduledAt ? new Date(race.scheduledAt) : null,
                        sourceStatus: race.statusRaw,
                        official: race.official,
                        progressionRaw: race.progressionRaw,
                        data: race,
                    },
                ).returning();
                for (const entry of race.results)
                {
                    await tx.insert(tables.schoolSourceMentions).values({
                        sourceSnapshotId: race.sourceSnapshotId,
                        rawName: entry.schoolRaw,
                        normalizedAlias: exactAliasKey(entry.schoolRaw),
                        schoolId: entry.schoolKey,
                    }).onConflictDoNothing();
                    const [storedEntry] = await tx.insert(tables.crewEntries).values(
                        {
                            raceId: requireRow(storedRace, "catalog race").id,
                            sourceKey: entry.sourceKey,
                            rowIndex: entry.rowIndex,
                            schoolId: entry.schoolKey,
                            schoolRaw: entry.schoolRaw,
                            boatRaw: entry.boatRaw,
                            laneRaw: entry.laneRaw,
                            lane: entry.lane,
                        },
                    ).returning();
                    await tx.insert(tables.results).values(
                        {
                            entryId: requireRow(storedEntry, "crew entry").id,
                            place: entry.place,
                            placeRaw: entry.placeRaw,
                            finishMs: entry.finishMs,
                            finishRaw: entry.finishRaw,
                            status: entry.status,
                            statusRaw: entry.statusRaw,
                            splitRaw: entry.splitRaw,
                            deltaRaw: entry.deltaRaw,
                            rawCells: entry.rawCells,
                        },
                    );
                    if (entry.appearances.length)
                    {
                        await tx.insert(tables.athleteAppearances).values(
                            entry.appearances.map((appearance, appearanceIndex) => ({
                                ...appearance,
                                entryId: requireRow(storedEntry, "crew entry").id,
                                appearanceIndex,
                            })),
                        );
                    }
                }
            }
            await tx.insert(tables.regattas).values(
                {
                    id: CHAMPIONSHIP.slug,
                    name: CHAMPIONSHIP.name,
                    sourceName: CHAMPIONSHIP.sourceTitle,
                    sourceUrl: CHAMPIONSHIP.sourceUrl,
                    startsOn: CHAMPIONSHIP.startsOn,
                    endsOn: CHAMPIONSHIP.endsOn,
                    venue: CHAMPIONSHIP.venue,
                    activeVersionId: version.id,
                },
            ).onConflictDoUpdate({
                target: tables.regattas.id,
                set: { activeVersionId: version.id, updatedAt: new Date() },
            });
            await tx.update(tables.importRuns).set({
                status: "published",
                manifestHash,
                issues,
                expectedRaces: races.length,
                parsedRaces: races.length,
                finishedAt: new Date(),
            }).where(eq(tables.importRuns.id, runId));
            return { status: "published" as const, versionId: version.id };
        });
    }

    async getPublishedCatalog()
    {
        const [regatta] = await this.db.select().from(tables.regattas).where(
            eq(tables.regattas.id, CHAMPIONSHIP.slug),
        ).limit(1);
        if (!regatta?.activeVersionId)
        {
            return null;
        }
        const [version] = await this.db.select().from(tables.catalogVersions).where(
            eq(tables.catalogVersions.id, regatta.activeVersionId),
        );
        const [rows, refreshRows] = await Promise.all([
            this.db.select({ data: tables.races.data }).from(tables.races).where(
                eq(tables.races.catalogVersionId, regatta.activeVersionId),
            ).orderBy(tables.races.raceNumber),
            this.db.select({
                status: tables.importRuns.status,
                startedAt: tables.importRuns.startedAt,
                finishedAt: tables.importRuns.finishedAt,
            }).from(tables.importRuns).where(eq(tables.importRuns.regattaKey, regatta.id)).orderBy(
                desc(tables.importRuns.startedAt),
                desc(tables.importRuns.id),
            ).limit(1),
        ]);
        return {
            regatta,
            version: requireRow(version, "active catalog version"),
            races: rows.map((row) => row.data),
            latestRefresh: refreshRows[0] ?? null,
        };
    }

    async listRaces(
        filters: {
            schoolId?: string;
            gender?: string;
            ageGroup?: string;
            boatClass?: string;
            round?: string;
        } = {},
    )
    {
        const catalog = await this.getPublishedCatalog();
        return (catalog?.races ?? []).filter((race) =>
            (!filters.schoolId || race.results.some((entry) => entry.schoolKey === filters.schoolId))
            && (!filters.gender || race.gender === filters.gender)
            && (!filters.ageGroup || race.ageGroup === filters.ageGroup)
            && (!filters.boatClass || race.boatClass === filters.boatClass)
            && (!filters.round || race.round === filters.round)
        );
    }

    async getRace(sourceKey: string)
    {
        const catalog = await this.getPublishedCatalog();
        return catalog?.races.find((race) => race.sourceKey === sourceKey) ?? null;
    }

    async listSchools()
    {
        return this.db.select().from(tables.schools).orderBy(tables.schools.name);
    }

    async listSchoolPresentations(): Promise<SchoolPresentation[]>
    {
        return this.db.select(
            {
                id: tables.schools.id,
                name: tables.schools.name,
                shortName: tables.schools.shortName,
                description: tables.schools.description,
                crestAssetId: tables.mediaAssets.id,
                primaryColor: tables.schoolBrandProfiles.primaryColor,
                secondaryColor: tables.schoolBrandProfiles.secondaryColor,
                accessibleTokens: tables.schoolBrandProfiles.accessibleTokens,
                paletteSourceUrl: tables.schoolBrandProfiles.paletteSourceUrl,
                confidence: tables.schoolBrandProfiles.confidence,
                inferred: tables.schoolBrandProfiles.inferred,
                themeAlgorithmVersion: tables.schoolBrandProfiles.themeAlgorithmVersion,
            },
        ).from(tables.schools)
            .leftJoin(tables.schoolBrandProfiles, eq(tables.schoolBrandProfiles.schoolId, tables.schools.id))
            .leftJoin(
                tables.mediaAssets,
                and(
                    eq(tables.mediaAssets.id, tables.schoolBrandProfiles.crestAssetId),
                    ne(tables.mediaAssets.visibility, "removed"),
                    ne(tables.mediaAssets.rightsStatus, "removed"),
                ),
            )
            .orderBy(tables.schools.name);
    }

    async getSchool(id: string)
    {
        const [school] = await this.db.select().from(tables.schools).where(eq(tables.schools.id, id));
        return school ?? null;
    }

    async getSchoolPresentation(id: string): Promise<SchoolPresentation | null>
    {
        const [school] = await this.db.select(
            {
                id: tables.schools.id,
                name: tables.schools.name,
                shortName: tables.schools.shortName,
                description: tables.schools.description,
                crestAssetId: tables.mediaAssets.id,
                primaryColor: tables.schoolBrandProfiles.primaryColor,
                secondaryColor: tables.schoolBrandProfiles.secondaryColor,
                accessibleTokens: tables.schoolBrandProfiles.accessibleTokens,
                paletteSourceUrl: tables.schoolBrandProfiles.paletteSourceUrl,
                confidence: tables.schoolBrandProfiles.confidence,
                inferred: tables.schoolBrandProfiles.inferred,
                themeAlgorithmVersion: tables.schoolBrandProfiles.themeAlgorithmVersion,
            },
        ).from(tables.schools)
            .leftJoin(tables.schoolBrandProfiles, eq(tables.schoolBrandProfiles.schoolId, tables.schools.id))
            .leftJoin(
                tables.mediaAssets,
                and(
                    eq(tables.mediaAssets.id, tables.schoolBrandProfiles.crestAssetId),
                    ne(tables.mediaAssets.visibility, "removed"),
                    ne(tables.mediaAssets.rightsStatus, "removed"),
                ),
            )
            .where(eq(tables.schools.id, id))
            .limit(1);
        return school ?? null;
    }

    async listImports(limit = 20)
    {
        return this.db.select().from(tables.importRuns).orderBy(desc(tables.importRuns.startedAt)).limit(
            Math.max(1, Math.min(limit, 100)),
        );
    }
}
