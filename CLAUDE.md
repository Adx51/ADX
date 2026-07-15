# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ADX — a premium, AI-powered wine cellar management platform (web + mobile).
See `README.md` for the product vision and `docs/ARCHITECTURE.md` for design.

## Structure

Monorepo via npm workspaces + Turborepo:

- `apps/api` — NestJS REST API (`/api`), Prisma-backed
- `apps/web` — Next.js 14 (App Router) premium frontend
- `packages/database` — shared Prisma schema, client, and seed

## Commands

Run from the repo root:

- `npm install` — install the whole workspace
- `npm run dev` — run api (:4000) + web (:3000) via Turborepo
- `npm run build` — build all workspaces
- `npm run typecheck` — typecheck all workspaces
- `npm run lint` — lint all workspaces
- `npm run db:generate` — generate the Prisma client (run after schema changes)
- `npm run db:push` — push schema to the database (dev)
- `npm run db:migrate` — create/apply a migration
- `npm run db:seed` — seed demo data

Per-workspace, e.g.: `npm run build -w @adx/api`, `npm run dev -w @adx/web`.

Database requires PostgreSQL with the `vector` extension: `docker compose up -d db`.

## Conventions

- The domain splits **`Wine`** (canonical, AI-enriched once) from **`Bottle`**
  (an owned unit in a cellar). Enrich the wine, not each bottle.
- Physical location: `Cellar → Zone → Rack → Position`; a `Position` holds at
  most one bottle (`bottleId` unique) — moving a bottle reassigns `bottleId`.
- All AI calls go through `OpenAiService`, which degrades gracefully when
  `OPENAI_API_KEY` is unset — never assume the AI is available.
- Auth is provisional: `@CurrentUserId()` reads the `x-user-id` header. Replace
  with a JWT guard populating `req.user`; call sites stay unchanged.

## Git Workflow

- Development branches follow the pattern `claude/<task-description>`
- Push to remote with: `git push -u origin <branch-name>`
- The default branch is `main`
