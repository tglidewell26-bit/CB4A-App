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
- **Type**: React + Vite web app
- **Purpose**: Curriculum generator for classic literature, grades 3–8
- **Features**:
  - Collapsible sidebar with book list, grade-level badges, and real-time chapter counts from DB
  - Chapter cards with Ready/Generating status indicators
  - "New book folder" modal with author lookup and Common Core standards preview
  - "Add chapter" modal with optional file upload (PDF/Word)
  - Books and chapters fully persisted in PostgreSQL via API
- **State management**: React Query (TanStack Query) with generated API hooks from `@workspace/api-client-react`
- **Design**: Warm parchment palette, Playfair Display + Source Sans 3 fonts
- **Key files**:
  - `src/App.tsx` — root component; uses `useListBooks`, `useCreateBook`, `useListChapters`, `useCreateChapter` hooks
  - `src/main.tsx` — QueryClientProvider setup
  - `src/components/` — Sidebar, ChapterCard, ActionPill, EmptyState, NewBookModal, AddChapterModal, Label
  - `src/types.ts` — Book, Chapter, ChapterStatus, GradeColors (UI types)
  - `src/constants.ts` — GRADE_STANDARDS, KNOWN_AUTHORS, GRADE_COLORS (SAMPLE_BOOKS seeded to DB at setup)

### API Server (`artifacts/api-server`)
- **Preview path**: `/api`
- **Type**: Express 5 API server
- **Routes**:
  - `GET /api/healthz` — health check
  - `GET /api/books` — list all books with chapter counts
  - `POST /api/books` — create a new book
  - `DELETE /api/books/:bookId` — delete a book
  - `GET /api/books/:bookId/chapters` — list chapters for a book
  - `POST /api/books/:bookId/chapters` — create a chapter for a book

## Database Schema (`lib/db`)

### Tables
- **`books`**: id (serial PK), title, author, grade, created_at
- **`chapters`**: id (serial PK), book_id (FK → books.id, cascade delete), num, title, pages, status, date, file, created_at

### Seeded Data
Three sample books (Heidi, Treasure Island, The Call of the Wild) with sample chapters are seeded at database creation time.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
