CREATE TABLE IF NOT EXISTS "user" (
    id text PRIMARY KEY, name text NOT NULL, email text NOT NULL UNIQUE,
    email_verified boolean NOT NULL DEFAULT false, image text,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS session (
    id text PRIMARY KEY, token text NOT NULL UNIQUE, expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    ip_address text, user_agent text, user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS session_user_idx ON session(user_id);
CREATE INDEX IF NOT EXISTS session_expiry_idx ON session(expires_at);
CREATE TABLE IF NOT EXISTS account (
    id text PRIMARY KEY, account_id text NOT NULL, provider_id text NOT NULL,
    user_id text NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    access_token text, refresh_token text, id_token text, access_token_expires_at timestamptz,
    refresh_token_expires_at timestamptz, scope text, password text,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT google_identity_only_check CHECK (provider_id <> 'google' OR (access_token IS NULL AND refresh_token IS NULL AND id_token IS NULL AND access_token_expires_at IS NULL AND refresh_token_expires_at IS NULL))
);
CREATE INDEX IF NOT EXISTS account_user_idx ON account(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS account_provider_account_idx ON account(provider_id, account_id);
CREATE TABLE IF NOT EXISTS verification (
    id text PRIMARY KEY, identifier text NOT NULL, value text NOT NULL, expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_identifier_idx ON verification(identifier);
CREATE TABLE IF NOT EXISTS access_grants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email_normalized text NOT NULL UNIQUE,
    user_id text UNIQUE REFERENCES "user"(id) ON DELETE SET NULL, google_subject text UNIQUE,
    role text NOT NULL DEFAULT 'viewer' CONSTRAINT access_grants_role_check CHECK (role IN ('viewer', 'admin')),
    status text NOT NULL DEFAULT 'active' CONSTRAINT access_grants_status_check CHECK (status IN ('active', 'revoked')),
    granted_at timestamptz NOT NULL DEFAULT now(), granted_by_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
    revoked_at timestamptz, revoked_by_user_id text REFERENCES "user"(id) ON DELETE SET NULL, notes text,
    CONSTRAINT access_grants_email_check CHECK (email_normalized = lower(btrim(email_normalized)) AND email_normalized !~ '[[:space:]]'),
    CONSTRAINT access_grants_revocation_check CHECK ((status = 'active' AND revoked_at IS NULL AND revoked_by_user_id IS NULL) OR (status = 'revoked' AND revoked_at IS NOT NULL))
);
CREATE TABLE IF NOT EXISTS security_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id text REFERENCES "user"(id) ON DELETE SET NULL,
    action text NOT NULL, outcome text NOT NULL DEFAULT 'success' CONSTRAINT security_events_outcome_check CHECK (outcome IN ('success', 'denied', 'failure')),
    target_id text, metadata jsonb NOT NULL DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS security_events_created_idx ON security_events(created_at);
CREATE INDEX IF NOT EXISTS security_events_actor_idx ON security_events(actor_id);
CREATE TABLE IF NOT EXISTS site_release_state (
    id text PRIMARY KEY DEFAULT 'global' CONSTRAINT release_singleton_check CHECK (id = 'global'),
    mode text NOT NULL DEFAULT 'private_beta' CONSTRAINT release_mode_check CHECK (mode IN ('private_beta', 'public')),
    privacy_approved_at timestamptz, privacy_approved_by_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
    privacy_approval_scope text, privacy_approval_evidence jsonb,
    crest_rights_approved_at timestamptz, crest_rights_approved_by_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
    crest_rights_approval_scope text, crest_rights_approval_evidence jsonb,
    public_released_at timestamptz, public_released_by_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
    updated_by text REFERENCES "user"(id) ON DELETE SET NULL, updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT release_approval_check CHECK (mode = 'private_beta' OR (
        privacy_approved_at IS NOT NULL AND privacy_approved_by_user_id IS NOT NULL AND privacy_approval_scope IS NOT NULL AND privacy_approval_evidence IS NOT NULL AND
        crest_rights_approved_at IS NOT NULL AND crest_rights_approved_by_user_id IS NOT NULL AND crest_rights_approval_scope IS NOT NULL AND crest_rights_approval_evidence IS NOT NULL AND
        public_released_at IS NOT NULL AND public_released_by_user_id IS NOT NULL
    ))
);
INSERT INTO site_release_state (id) VALUES ('global') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS import_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), regatta_key text NOT NULL, status text NOT NULL DEFAULT 'running',
    parser_version text NOT NULL, started_at timestamptz NOT NULL DEFAULT now(), finished_at timestamptz,
    issues jsonb NOT NULL DEFAULT '[]', expected_races integer, parsed_races integer NOT NULL DEFAULT 0,
    manifest_hash text, requested_by text REFERENCES "user"(id) ON DELETE SET NULL,
    CONSTRAINT import_runs_status_check CHECK (status IN ('running', 'validated', 'published', 'unchanged', 'failed')),
    CONSTRAINT import_runs_counts_check CHECK (parsed_races >= 0 AND (expected_races IS NULL OR expected_races >= 0))
);
CREATE INDEX IF NOT EXISTS import_runs_regatta_started_idx ON import_runs(regatta_key, started_at);
CREATE TABLE IF NOT EXISTS source_documents (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_key text NOT NULL UNIQUE, url text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS source_snapshots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_document_id uuid NOT NULL REFERENCES source_documents(id),
    source_key text NOT NULL, url text NOT NULL, sha256 text NOT NULL,
    raw_bytes bytea NOT NULL, decoded_html text NOT NULL, encoding text NOT NULL,
    response_headers jsonb NOT NULL, fetched_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT source_snapshots_hash_check CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT source_snapshots_encoding_check CHECK (encoding = 'windows-1252'),
    CONSTRAINT source_snapshots_bytes_check CHECK (octet_length(raw_bytes) > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS source_snapshots_revision_idx ON source_snapshots(source_key, sha256);
CREATE INDEX IF NOT EXISTS source_snapshots_latest_idx ON source_snapshots(source_key, fetched_at);
CREATE INDEX IF NOT EXISTS source_snapshots_document_idx ON source_snapshots(source_document_id);
CREATE TABLE IF NOT EXISTS source_fetches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), import_run_id uuid NOT NULL REFERENCES import_runs(id),
    document_id uuid REFERENCES source_snapshots(id), url text NOT NULL, status_code integer,
    response_headers jsonb NOT NULL DEFAULT '{}', error text, fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS source_fetches_run_idx ON source_fetches(import_run_id);
CREATE INDEX IF NOT EXISTS source_fetches_document_idx ON source_fetches(document_id);
CREATE TABLE IF NOT EXISTS catalog_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), import_run_id uuid NOT NULL REFERENCES import_runs(id),
    regatta_key text NOT NULL, manifest_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS catalog_versions_manifest_idx ON catalog_versions(regatta_key, manifest_hash);
CREATE INDEX IF NOT EXISTS catalog_versions_run_idx ON catalog_versions(import_run_id);
CREATE TABLE IF NOT EXISTS entity_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_type text NOT NULL, entity_key text NOT NULL,
    catalog_version_id uuid NOT NULL REFERENCES catalog_versions(id), source_snapshot_id uuid NOT NULL REFERENCES source_snapshots(id),
    parser_version text NOT NULL, normalized_hash text NOT NULL, data jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS entity_revisions_version_key_idx ON entity_revisions(catalog_version_id, entity_type, entity_key);
CREATE INDEX IF NOT EXISTS entity_revisions_snapshot_idx ON entity_revisions(source_snapshot_id);
CREATE TABLE IF NOT EXISTS regattas (
    id text PRIMARY KEY, name text NOT NULL, source_name text NOT NULL, source_url text NOT NULL,
    starts_on date NOT NULL, ends_on date NOT NULL, venue text NOT NULL,
    active_version_id uuid REFERENCES catalog_versions(id), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS schools (
    id text PRIMARY KEY, name text NOT NULL, short_name text, description text, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS school_aliases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), alias text NOT NULL, alias_key text NOT NULL UNIQUE,
    school_id text NOT NULL REFERENCES schools(id), approved_by text REFERENCES "user"(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS school_aliases_school_idx ON school_aliases(school_id);
CREATE TABLE IF NOT EXISTS school_source_mentions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), source_snapshot_id uuid NOT NULL REFERENCES source_snapshots(id),
    raw_name text NOT NULL, normalized_alias text NOT NULL, school_id text REFERENCES schools(id), created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS school_mentions_snapshot_alias_idx ON school_source_mentions(source_snapshot_id, normalized_alias);
CREATE INDEX IF NOT EXISTS school_mentions_school_idx ON school_source_mentions(school_id);
CREATE TABLE IF NOT EXISTS events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), catalog_version_id uuid NOT NULL REFERENCES catalog_versions(id),
    source_key text NOT NULL, source_event_id text NOT NULL, name text NOT NULL, raw_name text NOT NULL,
    gender text NOT NULL, age_group text, boat_class text
);
CREATE UNIQUE INDEX IF NOT EXISTS events_version_key_idx ON events(catalog_version_id, source_key);
CREATE TABLE IF NOT EXISTS races (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), catalog_version_id uuid NOT NULL REFERENCES catalog_versions(id),
    event_id uuid NOT NULL REFERENCES events(id), source_key text NOT NULL, source_url text NOT NULL,
    source_snapshot_id uuid NOT NULL REFERENCES source_snapshots(id), active_revision_id uuid REFERENCES entity_revisions(id), race_number integer, round text NOT NULL,
    raw_round text NOT NULL, scheduled_at timestamptz, source_status text NOT NULL, official boolean NOT NULL,
    progression_raw text NOT NULL, data jsonb NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS races_version_key_idx ON races(catalog_version_id, source_key);
CREATE INDEX IF NOT EXISTS races_event_idx ON races(event_id);
CREATE INDEX IF NOT EXISTS races_snapshot_idx ON races(source_snapshot_id);
CREATE TABLE IF NOT EXISTS crew_entries (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), race_id uuid NOT NULL REFERENCES races(id), source_key text NOT NULL,
    row_index integer NOT NULL, school_id text REFERENCES schools(id), school_raw text NOT NULL,
    boat_raw text NOT NULL, lane_raw text NOT NULL, lane integer,
    CONSTRAINT crew_entries_row_check CHECK (row_index >= 0),
    CONSTRAINT crew_entries_lane_check CHECK (lane IS NULL OR lane > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS crew_entries_race_key_idx ON crew_entries(race_id, source_key);
CREATE INDEX IF NOT EXISTS crew_entries_school_idx ON crew_entries(school_id);
CREATE TABLE IF NOT EXISTS results (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entry_id uuid NOT NULL UNIQUE REFERENCES crew_entries(id),
    place integer, place_raw text NOT NULL, finish_ms integer CONSTRAINT results_nonnegative_time CHECK (finish_ms IS NULL OR finish_ms >= 0),
    finish_raw text NOT NULL, status text NOT NULL, status_raw text NOT NULL, split_raw text NOT NULL,
    delta_raw text NOT NULL, raw_cells jsonb NOT NULL,
    CONSTRAINT results_place_check CHECK (place IS NULL OR place > 0),
    CONSTRAINT results_status_check CHECK (status IN ('finished', 'dns', 'dnf', 'scratch', 'dsq', 'unknown'))
);
CREATE TABLE IF NOT EXISTS athlete_appearances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entry_id uuid NOT NULL REFERENCES crew_entries(id), appearance_index integer NOT NULL,
    raw_name text NOT NULL, display_name text NOT NULL, seat integer, is_cox boolean NOT NULL, raw_annotation text,
    CONSTRAINT appearances_position_check CHECK (appearance_index >= 0),
    CONSTRAINT appearances_seat_check CHECK (seat IS NULL OR seat > 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS appearances_entry_position_idx ON athlete_appearances(entry_id, appearance_index);
CREATE TABLE IF NOT EXISTS media_assets (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), school_id text NOT NULL REFERENCES schools(id), storage_key text NOT NULL UNIQUE, mime_type text NOT NULL,
    sha256 text NOT NULL, byte_size integer NOT NULL, width integer, height integer, alt_text text NOT NULL, attribution text,
    visibility text NOT NULL DEFAULT 'private_beta' CONSTRAINT media_visibility_check CHECK (visibility IN ('private_beta', 'public_approved', 'removed')),
    rights_status text NOT NULL DEFAULT 'permission_pending' CONSTRAINT media_rights_check CHECK (rights_status IN ('official_source_unlicensed', 'permission_pending', 'licensed', 'removed')), rights_notes text, removed_at timestamptz,
    official_source_url text, acquired_at timestamptz NOT NULL DEFAULT now(), takedown_history jsonb NOT NULL DEFAULT '[]',
    uploaded_by text REFERENCES "user"(id) ON DELETE SET NULL, created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT media_hash_check CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT media_size_check CHECK (byte_size > 0 AND (width IS NULL OR width > 0) AND (height IS NULL OR height > 0)),
    CONSTRAINT media_mime_check CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
    CONSTRAINT media_public_rights_check CHECK (visibility <> 'public_approved' OR rights_status = 'licensed'),
    CONSTRAINT media_provisional_check CHECK (rights_status <> 'official_source_unlicensed' OR (visibility = 'private_beta' AND official_source_url IS NOT NULL)),
    CONSTRAINT media_removed_check CHECK ((visibility = 'removed') = (rights_status = 'removed') AND (visibility = 'removed') = (removed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS media_assets_school_idx ON media_assets(school_id);
CREATE UNIQUE INDEX IF NOT EXISTS media_assets_id_school_idx ON media_assets(id, school_id);
CREATE TABLE IF NOT EXISTS school_brand_profiles (
    school_id text PRIMARY KEY REFERENCES schools(id), crest_asset_id uuid,
    primary_color text, secondary_color text, raw_primary_color text, raw_secondary_color text,
    accessible_tokens jsonb NOT NULL DEFAULT '{}', palette_source_url text, confidence text NOT NULL DEFAULT 'low',
    inferred boolean NOT NULL DEFAULT true, theme_algorithm_version text NOT NULL DEFAULT 'wcag-aa-v1',
    updated_by text REFERENCES "user"(id) ON DELETE SET NULL,
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT school_brand_crest_school_fk FOREIGN KEY (crest_asset_id, school_id) REFERENCES media_assets(id, school_id),
    CONSTRAINT school_brand_primary_check CHECK (primary_color IS NULL OR primary_color ~ '^#[0-9A-Fa-f]{6}$'),
    CONSTRAINT school_brand_secondary_check CHECK (secondary_color IS NULL OR secondary_color ~ '^#[0-9A-Fa-f]{6}$')
);
INSERT INTO schools (id, name) VALUES ('st-dunstans-college', 'St Dunstan''s College') ON CONFLICT DO NOTHING;
INSERT INTO school_aliases (alias, alias_key, school_id) VALUES
    ('St Dunstans College', 'st dunstans college', 'st-dunstans-college'),
    ('St Dunstans High School', 'st dunstans high school', 'st-dunstans-college')
ON CONFLICT DO NOTHING;
INSERT INTO school_brand_profiles (
    school_id, primary_color, secondary_color, raw_primary_color, raw_secondary_color,
    accessible_tokens, palette_source_url, confidence, inferred, theme_algorithm_version
) VALUES (
    'st-dunstans-college', '#253573', '#996A28', '#253573', '#996A28',
    '{"accent":"#253573","onAccent":"#FFFFFF","accentSoft":"#E5E7EE","onAccentSoft":"#062B5B","secondary":"#996A28","onSecondary":"#FFFFFF"}',
    'https://stdunstans.co.za/vision', 'low', true, 'wcag-aa-v1'
) ON CONFLICT DO NOTHING;
