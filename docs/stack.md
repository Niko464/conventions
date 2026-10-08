# How a TypeScript project is built

The one description of the stack for Niko464's TypeScript projects. Decided in [#7](https://github.com/Niko464/conventions/issues/7).

## Layout

- pnpm workspaces with Turborepo: `apps/web`, `apps/api`, `packages/schemas`, plus `packages/<domain>` when one is needed.
- `turbo.json` declares task order (`dependsOn`), so no root script chains builds by hand. Turbo's cache skips unchanged packages, locally and on the VPS runner.

## Backend

- NestJS is the only backend, also behind a Next.js frontend.
- PostgreSQL through Prisma (`@prisma/adapter-pg`). Dev, CI and previews run Postgres in `docker compose`; production uses a hosted Postgres (usually Neon), never a self-hosted one.
- Media through the S3 API only. Dev, CI and previews run SeaweedFS in `docker compose`; production uses external storage (usually AWS S3), never a self-hosted one. Switching is configuration (`S3_*` env vars), not code.
- Auth: our own DB-backed session cookies (httpOnly), passwords hashed with argon2. No auth vendor.

## API contract

- Each endpoint is written once, as an [oRPC](https://orpc.unnoq.com) contract with Zod schemas in `packages/schemas`.
- Nest implements the contract (`@orpc/nest`); the compiler fails when a handler returns the wrong shape.
- The web calls through the same contract, fully typed, with TanStack Query options from `@orpc/tanstack-query`. No hand-written fetch types, no generated client.

## Frontend

- React. TanStack Query loads all server data.
- A project that needs SEO uses Next.js (App Router):
  - Server components call Nest, so every page arrives as full HTML.
  - Public pages are cached with `revalidate` (ISR); `revalidatePath` refreshes one at once after an admin change. Pages that depend on the logged-in user render per request.
  - TanStack Query is installed, for client components that mutate or refetch, seeded from the server with `prefetchQuery` and `HydrationBoundary`.
  - Next only renders: no API routes, no server actions that touch data.
- Any other project uses React Router. Loaders start each query with `queryClient.ensureQueryData`; components read it with `useQuery`.
- UI: shadcn/ui on Tailwind v4, checked by `@shadcn/lint`. Effects only through `@niko464/react-kit`. Animations with Motion, when a project animates.

## Tooling

- Strict TypeScript, ESLint 10 with `@niko464/eslint-config`, Prettier.
- Pre-commit hooks run the same lint as CI.
- Tests with Vitest and Testing Library.
- CI on pull requests only, on the project's VPS runner.

## Fleet sandboxes

Every ticket's sandbox runs the project's tests against a real Postgres, with its own database, as saas_wedding_venues does:

- `.sandcastle/project.yaml` starts the compose Postgres with `services:` (e.g. `docker compose up --detach --wait postgres`), and sets `TEST_DATABASE_URL` in `env:` to `postgresql://…@host.docker.internal:5432/<name>_test_{{ISSUE}}`, so parallel sandboxes never share a database.
- The compose Postgres listens beyond `127.0.0.1`, so sandboxes reach it through `host.docker.internal`.
- The test setup uses `TEST_DATABASE_URL` when it is set, creating and migrating that database, instead of starting its own container.
