# Server PC handoff

## GitHub and files

The canonical remote is `https://github.com/BallisticHog/The-Perfect-Catch.git`. GitHub CLI must
show `BallisticHog` as the active account:

```text
gh auth status
gh auth switch --user BallisticHog
```

On the server PC, clone the repository and select the current feature branch:

```text
git clone https://github.com/BallisticHog/The-Perfect-Catch.git "C:\Personal\The Perfect Catch"
cd /d "C:\Personal\The Perfect Catch"
git switch feat/archived-regatta-beta
pnpm install
refresh-data.bat
live.bat
```

The ignored `.data` directory is deliberately absent from Git. `refresh-data.bat` rebuilds the
archive capture on the server. `live.bat` captures the registered race-day programme.

## Continue with Codex

Install the ChatGPT desktop app on the server PC and sign in to the same OpenAI account. Add
`C:\Personal\The Perfect Catch` as a local project folder and make it the primary folder. Start
a new Codex task there with:

```text
Continue The Perfect Catch from feat/archived-regatta-beta. Read AGENTS.md,
PROJECT-STATUS.md, docs/architecture/product-map.md and
docs/architecture/live-regatta-contract.md before changing anything. The immediate goal is to
verify and deploy the private live regatta beta on this home server.
```

The existing local-only task transcript does not transfer the project folder to another
computer. The repository documents, commits and branch are the durable handoff. If conversation
sync is enabled, the transcript may be visible elsewhere, but the new computer still needs its
own attached checkout.

## Internet exposure

Do not forward port 4318. It is a development preview with a local access shortcut.

Production uses the Compose and Caddy setup in `infra/`. Point the chosen domain at the home's
public address and forward TCP 80 and 443 to the server or Ubuntu VM. Configure the production
environment, Google OAuth origin and callback, migrate the database, bootstrap the invited owner,
then deploy the tested images. Only Caddy publishes ports; PostgreSQL, the app, workers and source
archives remain private.
