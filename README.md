# Finance Tracker

Personal finance tracking. Next.js 16, React 19, TypeScript, Tailwind CSS v4, Better Auth with Drizzle and Turso, Biome, and Husky (commitlint, lint-staged, pre-push checks).

## Quick Start

```bash
bun install
bun dev
```

Open [http://localhost:3000](http://localhost:3000).

## Auth Setup

Auth uses [Better Auth](https://www.better-auth.com/) with Drizzle and Turso. Add to `.env`:

- `DATABASE_URL` and `DATABASE_AUTH_TOKEN` (Turso)
- `BETTER_AUTH_SECRET` (e.g. `openssl rand -base64 32`)
- `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL` (e.g. `http://localhost:3000`)

Run `bun db:push` to sync the schema to your database.

For production deploys, set the same keys in your host's environment with your live URL for `BETTER_AUTH_URL` and `NEXT_PUBLIC_APP_URL`.

## Scripts

- `bun dev` - dev server
- `bun build` - production build
- `bun start` - production server
- `bun lint` / `bun lint:fix` - Biome lint
- `bun format` - Biome format
- `bun type-check` - TypeScript
- `bun db:push` - push Drizzle schema
- `bun db:generate` - generate Drizzle migrations

## Tooling

Formatting and linting live in `biome.json`; pre-commit runs Biome on staged TS/JS/JSON/CSS via lint-staged. Commits follow [Conventional Commits](https://www.conventionalcommits.org/) (enforced by Commitlint).
