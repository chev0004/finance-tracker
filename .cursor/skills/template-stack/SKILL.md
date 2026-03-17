---
name: template-stack
description: Describes the Next.js 16 template stack (React 19, Tailwind v4, Biome, Bun), conventions, and how to add pages/components. Use when doing greenfield work, scaffolding new features, or when the agent needs to understand project structure and conventions.
---

# Template Stack

## Stack

| Technology | Version | Notes |
|------------|---------|-------|
| Next.js | 16 | App Router |
| React | 19 | React Compiler enabled |
| Tailwind CSS | v4 | PostCSS-based |
| Biome | 2.x | Lint + format (no ESLint/Prettier) |
| Bun | - | Package manager and runtime |

## Scripts

- `bun dev` - development server
- `bun build` - production build
- `bun start` - production server
- `bun lint` - run lint checks
- `bun lint:fix` - fix lint issues
- `bun format` - format code
- `bun type-check` - TypeScript check

## Project Structure

```
src/
  app/
    layout.tsx      # Root layout
    page.tsx        # Home route
    globals.css     # Tailwind + CSS variables
    loading.tsx     # Route-level loading UI
    error.tsx       # Route-level error boundary
    not-found.tsx   # 404 page
```

## Conventions (Required)

1. **Read README.md first**: documents setup, scripts, Biome config, commit rules.
2. **Match existing patterns**: inspect similar files before adding new ones.
3. **Respect Biome**: no ESLint/Prettier overrides; follow `biome.json`.
4. **Comment policy**: no comments for trivial code. Section separators (`// --- Auth ---`) and rare complex-logic comments only.

## Biome Rules (Summary)

- 2-space indent, 80-char line width, single quotes
- Auto-organize imports
- Default exports allowed only in `src/app/**` and `src/pages/**`
- Next.js: use `next/image` not `<img>`, no `<head>` in pages
- Tailwind: `useSortedClasses` enforces class ordering

## Adding Pages

App Router: each route is a folder under `src/app/` with a `page.tsx`:

```
src/app/
  page.tsx              → /
  about/page.tsx        → /about
  blog/[slug]/page.tsx  → /blog/:slug
```

**page.tsx** - default export, the route UI.
**layout.tsx** - optional, wraps child routes (shared chrome).
**loading.tsx** - optional, Suspense fallback for the route.
**error.tsx** - optional, error boundary (must be `'use client'`).

## Adding Components

**Before creating**: Search for existing components that could be reused or extended. Avoid duplicating similar components.

**Prefer components over inline JSX**: Anything that can be reused (buttons, cards, form fields, layouts) should be a proper component, not raw markup in a page.

**Structure** (under `src/components/`):

```
src/components/
  ui/           # Primitives: Button, Input, Card, Modal, etc.
  features/     # Feature-specific: AuthForm, ProductCard, NavBar, etc.
```

- Route-specific, one-off UI: colocate in the route folder (e.g. `src/app/dashboard/Chart.tsx`).
- Shared primitives → `ui/`. Feature compositions → `features/`.
- Use default exports only in app/pages; named exports elsewhere.

## Tailwind v4

- Entry: `@import "tailwindcss";` in `globals.css`
- Theme tokens: define in `@theme inline { ... }` using CSS variables
- Use `var(--color-name)` for semantic tokens (e.g. `text-foreground`)
