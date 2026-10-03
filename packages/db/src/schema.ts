import type { ImportIssue, Race } from "@the-perfect-catch/domain";
import { sql } from "drizzle-orm";
import {
    boolean,
    check,
    customType,
    date,
    foreignKey,
    index,
    integer,
    jsonb,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";

const instant = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const bytes = customType<{ data: Buffer; driverData: Buffer; }>(
    {
        dataType()
        {
            return "bytea";
        },
    },
);

export const user = pgTable("user", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
});
export const session = pgTable("session", {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    expiresAt: instant("expires_at").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (table) => [index("session_user_idx").on(table.userId), index("session_expiry_idx").on(table.expiresAt)]);
export const account = pgTable("account", {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: instant("access_token_expires_at"),
    refreshTokenExpiresAt: instant("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
}, (table) => [
    index("account_user_idx").on(table.userId),
    uniqueIndex("account_provider_account_idx").on(table.providerId, table.accountId),
    check(
        "google_identity_only_check",
        sql`${table.providerId} <> 'google' or (${table.accessToken} is null and ${table.refreshToken} is null and ${table.idToken} is null and ${table.accessTokenExpiresAt} is null and ${table.refreshTokenExpiresAt} is null)`,
    ),
]);
export const verification = pgTable("verification", {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: instant("expires_at").notNull(),
    createdAt: instant("created_at").notNull().defaultNow(),
    updatedAt: instant("updated_at").notNull().defaultNow(),
}, (table) => [index("verification_identifier_idx").on(table.identifier)]);
export const accessGrants = pgTable("access_grants", {
    id: uuid("id").defaultRandom().primaryKey(),
    emailNormalized: text("email_normalized").notNull().unique(),
    userId: text("user_id").unique().references(() => user.id, { onDelete: "set null" }),
    googleSubject: text("google_subject").unique(),
    role: text("role", { enum: ["viewer", "admin"] }).notNull().default("viewer"),
    status: text("status", { enum: ["active", "revoked"] }).notNull().default("active"),
    grantedByUserId: text("granted_by_user_id").references(() => user.id, { onDelete: "set null" }),
    grantedAt: instant("granted_at").notNull().defaultNow(),
    revokedAt: instant("revoked_at"),
    revokedByUserId: text("revoked_by_user_id").references(() => user.id, { onDelete: "set null" }),
    notes: text("notes"),
}, (table) => [
    check("access_grants_role_check", sql`${table.role} in ('viewer', 'admin')`),
    check("access_grants_status_check", sql`${table.status} in ('active', 'revoked')`),
    check(
        "access_grants_email_check",
        sql`${table.emailNormalized} = lower(btrim(${table.emailNormalized})) and ${table.emailNormalized} !~ '[[:space:]]'`,
    ),
    check(
        "access_grants_revocation_check",
        sql`(${table.status} = 'active' and ${table.revokedAt} is null and ${table.revokedByUserId} is null) or (${table.status} = 'revoked' and ${table.revokedAt} is not null)`,
    ),
]);
export const securityEvents = pgTable(
    "security_events",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        actorId: text("actor_id").references(() => user.id, { onDelete: "set null" }),
        action: text("action").notNull(),
        outcome: text("outcome", { enum: ["success", "denied", "failure"] }).notNull().default("success"),
        targetId: text("target_id"),
        metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
        createdAt: instant("created_at").notNull().defaultNow(),
    },
    (
        table,
    ) => [
        index("security_events_created_idx").on(table.createdAt),
        index("security_events_actor_idx").on(table.actorId),
        check("security_events_outcome_check", sql`${table.outcome} in ('success', 'denied', 'failure')`),
    ],
);
export const siteReleaseState = pgTable("site_release_state", {
    id: text("id").primaryKey().default("global"),
    mode: text("mode", { enum: ["private_beta", "public"] }).notNull().default("private_beta"),
    privacyApprovedAt: instant("privacy_approved_at"),
    privacyApprovedByUserId: text("privacy_approved_by_user_id").references(() => user.id, {
        onDelete: "set null",
    }),
    privacyApprovalScope: text("privacy_approval_scope"),
    privacyApprovalEvidence: jsonb("privacy_approval_evidence").$type<Record<string, unknown>>(),
    crestRightsApprovedAt: instant("crest_rights_approved_at"),
    crestRightsApprovedByUserId: text("crest_rights_approved_by_user_id").references(() => user.id, {
        onDelete: "set null",
    }),
    crestRightsApprovalScope: text("crest_rights_approval_scope"),
    crestRightsApprovalEvidence: jsonb("crest_rights_approval_evidence").$type<Record<string, unknown>>(),
    publicReleasedAt: instant("public_released_at"),
    publicReleasedByUserId: text("public_released_by_user_id").references(() => user.id, {
        onDelete: "set null",
    }),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    updatedAt: instant("updated_at").notNull().defaultNow(),
}, (table) => [
    check("release_singleton_check", sql`${table.id} = 'global'`),
    check("release_mode_check", sql`${table.mode} in ('private_beta', 'public')`),
    check(
        "release_approval_check",
        sql`${table.mode} = 'private_beta' or (${table.privacyApprovedAt} is not null and ${table.privacyApprovedByUserId} is not null and ${table.privacyApprovalScope} is not null and ${table.privacyApprovalEvidence} is not null and ${table.crestRightsApprovedAt} is not null and ${table.crestRightsApprovedByUserId} is not null and ${table.crestRightsApprovalScope} is not null and ${table.crestRightsApprovalEvidence} is not null and ${table.publicReleasedAt} is not null and ${table.publicReleasedByUserId} is not null)`,
    ),
]);
export const importRuns = pgTable("import_runs", {
    id: uuid("id").defaultRandom().primaryKey(),
    regattaKey: text("regatta_key").notNull(),
    status: text("status", { enum: ["running", "validated", "published", "unchanged", "failed"] }).notNull()
        .default("running"),
    parserVersion: text("parser_version").notNull(),
    startedAt: instant("started_at").notNull().defaultNow(),
    finishedAt: instant("finished_at"),
    issues: jsonb("issues").$type<ImportIssue[]>().notNull().default([]),
    expectedRaces: integer("expected_races"),
    parsedRaces: integer("parsed_races").notNull().default(0),
    manifestHash: text("manifest_hash"),
    requestedBy: text("requested_by").references(() => user.id, { onDelete: "set null" }),
}, (table) => [
    index("import_runs_regatta_started_idx").on(table.regattaKey, table.startedAt),
    check(
        "import_runs_status_check",
        sql`${table.status} in ('running', 'validated', 'published', 'unchanged', 'failed')`,
    ),
    check(
        "import_runs_counts_check",
        sql`${table.parsedRaces} >= 0 and (${table.expectedRaces} is null or ${table.expectedRaces} >= 0)`,
    ),
]);
export const sourceDocuments = pgTable("source_documents", {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceKey: text("source_key").notNull().unique(),
    url: text("url").notNull().unique(),
    createdAt: instant("created_at").notNull().defaultNow(),
});
export const sourceSnapshots = pgTable("source_snapshots", {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceDocumentId: uuid("source_document_id").notNull().references(() => sourceDocuments.id),
    sourceKey: text("source_key").notNull(),
    url: text("url").notNull(),
    sha256: text("sha256").notNull(),
    rawBytes: bytes("raw_bytes").notNull(),
    decodedHtml: text("decoded_html").notNull(),
    encoding: text("encoding").notNull(),
    responseHeaders: jsonb("response_headers").$type<Record<string, string>>().notNull(),
    fetchedAt: instant("fetched_at").notNull().defaultNow(),
}, (table) => [
    uniqueIndex("source_snapshots_revision_idx").on(table.sourceKey, table.sha256),
    index("source_snapshots_latest_idx").on(table.sourceKey, table.fetchedAt),
    index("source_snapshots_document_idx").on(table.sourceDocumentId),
    check("source_snapshots_hash_check", sql`${table.sha256} ~ '^[0-9a-f]{64}$'`),
    check("source_snapshots_encoding_check", sql`${table.encoding} = 'windows-1252'`),
    check("source_snapshots_bytes_check", sql`octet_length(${table.rawBytes}) > 0`),
]);
export const sourceFetches = pgTable(
    "source_fetches",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        importRunId: uuid("import_run_id").notNull().references(() => importRuns.id),
        documentId: uuid("document_id").references(() => sourceSnapshots.id),
        url: text("url").notNull(),
        statusCode: integer("status_code"),
        responseHeaders: jsonb("response_headers").$type<Record<string, string>>().notNull().default({}),
        error: text("error"),
        fetchedAt: instant("fetched_at").notNull().defaultNow(),
    },
    (
        table,
    ) => [
        index("source_fetches_run_idx").on(table.importRunId),
        index("source_fetches_document_idx").on(table.documentId),
    ],
);
export const catalogVersions = pgTable(
    "catalog_versions",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        importRunId: uuid("import_run_id").notNull().references(() => importRuns.id),
        regattaKey: text("regatta_key").notNull(),
        manifestHash: text("manifest_hash").notNull(),
        createdAt: instant("created_at").notNull().defaultNow(),
    },
    (
        table,
    ) => [
        uniqueIndex("catalog_versions_manifest_idx").on(table.regattaKey, table.manifestHash),
        index("catalog_versions_run_idx").on(table.importRunId),
    ],
);
export const entityRevisions = pgTable(
    "entity_revisions",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        entityType: text("entity_type").notNull(),
        entityKey: text("entity_key").notNull(),
        catalogVersionId: uuid("catalog_version_id").notNull().references(() => catalogVersions.id),
        sourceSnapshotId: uuid("source_snapshot_id").notNull().references(() => sourceSnapshots.id),
        parserVersion: text("parser_version").notNull(),
        normalizedHash: text("normalized_hash").notNull(),
        data: jsonb("data").$type<Record<string, unknown>>().notNull(),
        createdAt: instant("created_at").notNull().defaultNow(),
    },
    (
        table,
    ) => [
        uniqueIndex("entity_revisions_version_key_idx").on(
            table.catalogVersionId,
            table.entityType,
            table.entityKey,
        ),
        index("entity_revisions_snapshot_idx").on(table.sourceSnapshotId),
    ],
);
export const regattas = pgTable("regattas", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url").notNull(),
    startsOn: date("starts_on").notNull(),
    endsOn: date("ends_on").notNull(),
    venue: text("venue").notNull(),
    activeVersionId: uuid("active_version_id").references(() => catalogVersions.id),
    updatedAt: instant("updated_at").notNull().defaultNow(),
});
export const schools = pgTable("schools", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    shortName: text("short_name"),
    description: text("description"),
    createdAt: instant("created_at").notNull().defaultNow(),
});
export const schoolAliases = pgTable("school_aliases", {
    id: uuid("id").defaultRandom().primaryKey(),
    alias: text("alias").notNull(),
    aliasKey: text("alias_key").notNull().unique(),
    schoolId: text("school_id").notNull().references(() => schools.id),
    approvedBy: text("approved_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: instant("created_at").notNull().defaultNow(),
}, (table) => [index("school_aliases_school_idx").on(table.schoolId)]);
export const schoolSourceMentions = pgTable(
    "school_source_mentions",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        sourceSnapshotId: uuid("source_snapshot_id").notNull().references(() => sourceSnapshots.id),
        rawName: text("raw_name").notNull(),
        normalizedAlias: text("normalized_alias").notNull(),
        schoolId: text("school_id").references(() => schools.id),
        createdAt: instant("created_at").notNull().defaultNow(),
    },
    (
        table,
    ) => [
        uniqueIndex("school_mentions_snapshot_alias_idx").on(table.sourceSnapshotId, table.normalizedAlias),
        index("school_mentions_school_idx").on(table.schoolId),
    ],
);
export const events = pgTable("events", {
    id: uuid("id").defaultRandom().primaryKey(),
    catalogVersionId: uuid("catalog_version_id").notNull().references(() => catalogVersions.id),
    sourceKey: text("source_key").notNull(),
    sourceEventId: text("source_event_id").notNull(),
    name: text("name").notNull(),
    rawName: text("raw_name").notNull(),
    gender: text("gender").notNull(),
    ageGroup: text("age_group"),
    boatClass: text("boat_class"),
}, (table) => [uniqueIndex("events_version_key_idx").on(table.catalogVersionId, table.sourceKey)]);
export const races = pgTable(
    "races",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        catalogVersionId: uuid("catalog_version_id").notNull().references(() => catalogVersions.id),
        eventId: uuid("event_id").notNull().references(() => events.id),
        sourceKey: text("source_key").notNull(),
        sourceUrl: text("source_url").notNull(),
        sourceSnapshotId: uuid("source_snapshot_id").notNull().references(() => sourceSnapshots.id),
        activeRevisionId: uuid("active_revision_id").references(() => entityRevisions.id),
        raceNumber: integer("race_number"),
        round: text("round").notNull(),
        rawRound: text("raw_round").notNull(),
        scheduledAt: instant("scheduled_at"),
        sourceStatus: text("source_status").notNull(),
        official: boolean("official").notNull(),
        progressionRaw: text("progression_raw").notNull(),
        data: jsonb("data").$type<Race>().notNull(),
    },
    (
        table,
    ) => [
        uniqueIndex("races_version_key_idx").on(table.catalogVersionId, table.sourceKey),
        index("races_event_idx").on(table.eventId),
        index("races_snapshot_idx").on(table.sourceSnapshotId),
    ],
);
export const crewEntries = pgTable("crew_entries", {
    id: uuid("id").defaultRandom().primaryKey(),
    raceId: uuid("race_id").notNull().references(() => races.id),
    sourceKey: text("source_key").notNull(),
    rowIndex: integer("row_index").notNull(),
    schoolId: text("school_id").references(() => schools.id),
    schoolRaw: text("school_raw").notNull(),
    boatRaw: text("boat_raw").notNull(),
    laneRaw: text("lane_raw").notNull(),
    lane: integer("lane"),
}, (table) => [
    uniqueIndex("crew_entries_race_key_idx").on(table.raceId, table.sourceKey),
    index("crew_entries_school_idx").on(table.schoolId),
    check("crew_entries_row_check", sql`${table.rowIndex} >= 0`),
    check("crew_entries_lane_check", sql`${table.lane} is null or ${table.lane} > 0`),
]);
export const results = pgTable("results", {
    id: uuid("id").defaultRandom().primaryKey(),
    entryId: uuid("entry_id").notNull().unique().references(() => crewEntries.id),
    place: integer("place"),
    placeRaw: text("place_raw").notNull(),
    finishMs: integer("finish_ms"),
    finishRaw: text("finish_raw").notNull(),
    status: text("status").notNull(),
    statusRaw: text("status_raw").notNull(),
    splitRaw: text("split_raw").notNull(),
    deltaRaw: text("delta_raw").notNull(),
    rawCells: jsonb("raw_cells").$type<string[]>().notNull(),
}, (table) => [
    check("results_nonnegative_time", sql`${table.finishMs} is null or ${table.finishMs} >= 0`),
    check("results_place_check", sql`${table.place} is null or ${table.place} > 0`),
    check(
        "results_status_check",
        sql`${table.status} in ('finished', 'dns', 'dnf', 'scratch', 'dsq', 'unknown')`,
    ),
]);
export const athleteAppearances = pgTable("athlete_appearances", {
    id: uuid("id").defaultRandom().primaryKey(),
    entryId: uuid("entry_id").notNull().references(() => crewEntries.id),
    appearanceIndex: integer("appearance_index").notNull(),
    rawName: text("raw_name").notNull(),
    displayName: text("display_name").notNull(),
    seat: integer("seat"),
    isCox: boolean("is_cox").notNull(),
    rawAnnotation: text("raw_annotation"),
}, (table) => [
    uniqueIndex("appearances_entry_position_idx").on(table.entryId, table.appearanceIndex),
    check("appearances_position_check", sql`${table.appearanceIndex} >= 0`),
    check("appearances_seat_check", sql`${table.seat} is null or ${table.seat} > 0`),
]);
export const mediaAssets = pgTable("media_assets", {
    id: uuid("id").defaultRandom().primaryKey(),
    schoolId: text("school_id").notNull().references(() => schools.id),
    storageKey: text("storage_key").notNull().unique(),
    mimeType: text("mime_type").notNull(),
    sha256: text("sha256").notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width"),
    height: integer("height"),
    altText: text("alt_text").notNull(),
    attribution: text("attribution"),
    visibility: text("visibility", { enum: ["private_beta", "public_approved", "removed"] }).notNull()
        .default("private_beta"),
    rightsStatus: text("rights_status", {
        enum: ["official_source_unlicensed", "permission_pending", "licensed", "removed"],
    }).notNull().default("permission_pending"),
    rightsNotes: text("rights_notes"),
    removedAt: instant("removed_at"),
    officialSourceUrl: text("official_source_url"),
    acquiredAt: instant("acquired_at").notNull().defaultNow(),
    takedownHistory: jsonb("takedown_history").$type<
        Array<{ at: string; reason: string; actorId: string | null; }>
    >().notNull().default([]),
    uploadedBy: text("uploaded_by").references(() => user.id, { onDelete: "set null" }),
    createdAt: instant("created_at").notNull().defaultNow(),
}, (table) => [
    index("media_assets_school_idx").on(table.schoolId),
    uniqueIndex("media_assets_id_school_idx").on(table.id, table.schoolId),
    check(
        "media_visibility_check",
        sql`${table.visibility} in ('private_beta', 'public_approved', 'removed')`,
    ),
    check(
        "media_rights_check",
        sql`${table.rightsStatus} in ('official_source_unlicensed', 'permission_pending', 'licensed', 'removed')`,
    ),
    check("media_hash_check", sql`${table.sha256} ~ '^[0-9a-f]{64}$'`),
    check(
        "media_size_check",
        sql`${table.byteSize} > 0 and (${table.width} is null or ${table.width} > 0) and (${table.height} is null or ${table.height} > 0)`,
    ),
    check("media_mime_check", sql`${table.mimeType} in ('image/png', 'image/jpeg', 'image/webp')`),
    check(
        "media_public_rights_check",
        sql`${table.visibility} <> 'public_approved' or ${table.rightsStatus} = 'licensed'`,
    ),
    check(
        "media_provisional_check",
        sql`${table.rightsStatus} <> 'official_source_unlicensed' or (${table.visibility} = 'private_beta' and ${table.officialSourceUrl} is not null)`,
    ),
    check(
        "media_removed_check",
        sql`(${table.visibility} = 'removed') = (${table.rightsStatus} = 'removed') and (${table.visibility} = 'removed') = (${table.removedAt} is not null)`,
    ),
]);
export const schoolBrandProfiles = pgTable("school_brand_profiles", {
    schoolId: text("school_id").primaryKey().references(() => schools.id),
    crestAssetId: uuid("crest_asset_id"),
    primaryColor: text("primary_color"),
    secondaryColor: text("secondary_color"),
    rawPrimaryColor: text("raw_primary_color"),
    rawSecondaryColor: text("raw_secondary_color"),
    accessibleTokens: jsonb("accessible_tokens").$type<Record<string, string>>().notNull().default({}),
    paletteSourceUrl: text("palette_source_url"),
    confidence: text("confidence", { enum: ["low", "medium", "high"] }).notNull().default("low"),
    inferred: boolean("inferred").notNull().default(true),
    themeAlgorithmVersion: text("theme_algorithm_version").notNull().default("wcag-aa-v1"),
    updatedBy: text("updated_by").references(() => user.id, { onDelete: "set null" }),
    updatedAt: instant("updated_at").notNull().defaultNow(),
}, (table) => [
    foreignKey({
        name: "school_brand_crest_school_fk",
        columns: [table.crestAssetId, table.schoolId],
        foreignColumns: [mediaAssets.id, mediaAssets.schoolId],
    }),
    check(
        "school_brand_primary_check",
        sql`${table.primaryColor} is null or ${table.primaryColor} ~ '^#[0-9A-Fa-f]{6}$'`,
    ),
    check(
        "school_brand_secondary_check",
        sql`${table.secondaryColor} is null or ${table.secondaryColor} ~ '^#[0-9A-Fa-f]{6}$'`,
    ),
]);
