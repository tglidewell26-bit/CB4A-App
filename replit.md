# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

### Classic Books Curriculum Generator (`artifacts/classic-books`)
- **Preview path**: `/` (root)
- **Type**: React + Vite web app (frontend-only, no backend)
- **Purpose**: Curriculum generator for classic literature, grades 3–8
- **Features**:
  - Collapsible sidebar with book list and grade-level badges
  - Chapter cards with Ready/Generating status indicators
  - "New book folder" modal with author lookup and Common Core standards preview
  - "Add chapter" modal with file upload (PDF/Word)
  - Sample data: Heidi, Treasure Island, The Call of the Wild
- **Design**: Warm parchment palette, Playfair Display + Source Sans 3 fonts
- **Key files**:
  - `src/App.tsx` — root component and state management
  - `src/components/` — Sidebar, ChapterCard, ActionPill, EmptyState, NewBookModal, AddChapterModal, Label
  - `src/types.ts` — Book, Chapter, ChapterStatus, GradeColors
  - `src/constants.ts` — GRADE_STANDARDS, KNOWN_AUTHORS, SAMPLE_BOOKS, GRADE_COLORS

### API Server (`artifacts/api-server`)
- **Preview path**: `/api`
- **Type**: Express 5 API server

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
