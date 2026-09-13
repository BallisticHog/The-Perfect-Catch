# The Perfect Catch

The Perfect Catch is a private, self-hosted South African school rowing results catalogue. The first vertical slice imports the 2026 SA Schools Championships and presents its regattas, events, races, crews, schools, and published athlete appearances through an invited-account experience.

This repository is the canonical rebuild. `C:\Personal\the-catch` is historical reference material and must remain read-only.

## Workspace

```text
apps/
    web/             Next.js application
    worker/          Import and background jobs
packages/
    domain/          Rowing concepts and normalization
    db/              Drizzle schema, migrations, repositories
    ingestion/       Fetching, decoding, parsing, revisions
    ui/              Catch components and theme system
infra/
    compose/         Docker Compose and Caddy
docs/                Product, architecture, source, and operations contracts
.agents/skills/      Repository-specific Codex skills
```

## Local setup

Prerequisites are Node.js 20.9 or newer, pnpm 10, Docker Desktop, and Git.

```text
pnpm install
pnpm check
```

Copy `.env.example` to an untracked `.env` file before running services. Credentials and invited email addresses must never be committed.

## Delivery

Work is developed on feature branches. Every change must pass formatting, linting, type checks, tests, builds, and the U+2014 content check before review. The repository owner reviews and merges pull requests.
