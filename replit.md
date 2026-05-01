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
  - Chapter cards with Ready/Generating/Error status indicators and animated progress bar
  - "New book folder" modal with author lookup and Common Core standards preview
  - "Add chapter" modal with PDF/Word file upload — real file content sent via FormData
  - AI-powered curriculum generation: Claude claude-sonnet-4-6 generates Student Workbook and Teacher Guide HTML
  - "Student workbook" and "Teacher guide" buttons open a preview modal with printable/downloadable content
  - Auto-polling for chapters in "generating" status (4s interval) to detect when AI finishes
  - Regenerate button triggers new AI generation for existing chapters
  - Delete book functionality with confirmation modal (fully API-backed)
  - Delete chapter functionality (fully API-backed)
  - Edit book: "✎ Edit" button in top bar opens pre-filled modal to update title, author, or grade
  - Edit chapter: pencil button on each chapter card opens modal to update title, page range, or chapter number
  - Books and chapters fully persisted in PostgreSQL via API
- **State management**: React Query (TanStack Query) with generated API hooks from `@workspace/api-client-react`
- **Design**: Warm parchment palette, Playfair Display + Source Sans 3 fonts
- **Key files**:
  - `src/App.tsx` — root component; chapter polling, file-upload via FormData fetch
  - `src/main.tsx` — QueryClientProvider setup
  - `src/components/` — Sidebar, ChapterCard, ActionPill, EmptyState, NewBookModal, AddChapterModal, Label, ContentPreviewModal
  - `src/types.ts` — Book, Chapter, ChapterStatus (includes "error"), GradeColors
  - `src/constants.ts` — GRADE_STANDARDS, KNOWN_AUTHORS, GRADE_COLORS

### API Server (`artifacts/api-server`)
- **Preview path**: `/api`
- **Type**: Express 5 API server
- **AI Integration**: Anthropic Claude claude-sonnet-4-6 via Replit AI Integrations (`@workspace/integrations-anthropic-ai`)
- **File parsing**: `pdf-parse` for PDFs, `mammoth` for Word docs, `multer` for uploads
- **Routes**:
  - `GET /api/healthz` — health check
  - `GET /api/books` — list all books with chapter counts
  - `POST /api/books` — create a new book
  - `PATCH /api/books/:bookId` — update a book's title, author, or grade (grade validated 3–8)
  - `DELETE /api/books/:bookId` — delete a book (cascades to chapters)
  - `GET /api/books/:bookId/chapters` — list chapters for a book (returns hasWorkbook/hasTeacherGuide booleans)
  - `POST /api/books/:bookId/chapters` — create a chapter + upload file (multipart/form-data); triggers async AI generation when file text is extracted
  - `PATCH /api/books/:bookId/chapters/:chapterId` — update a chapter's title, pages, or num
  - `DELETE /api/books/:bookId/chapters/:chapterId` — delete a chapter (scoped by bookId)
  - `GET /api/books/:bookId/chapters/:chapterId/workbook` — get generated student workbook HTML
  - `GET /api/books/:bookId/chapters/:chapterId/teacher-guide` — get generated teacher guide HTML
  - `POST /api/books/:bookId/chapters/:chapterId/regenerate` — trigger re-generation with existing extracted text
- **Key files**:
  - `src/routes/books.ts` — thin HTTP handlers (validation + delegation to storage/, ai/, generation/, vocabulary/)
  - `src/storage/` — Drizzle queries (`books.ts`, `chapters.ts`)
  - `src/ai/` — Claude SDK re-export (`anthropic.ts`) and book-level character database orchestrator (`characterDatabase.ts`)
  - `src/generation/` — workbook + teacher guide pipeline: `sectionSchema.ts`, `templateRenderers.ts`, `htmlSanitizer.ts`, `questionClassifier.ts` (positive higher-order patterns), `workbookValidators.ts` (warn-only question-type checks), `studentWorkbook.ts`, `teacherGuide.ts`
  - `src/prompts/` — every Claude prompt: `workbookSectionPrompts.ts`, `teacherGuidePrompts.ts`, `characterDatabasePrompt.ts`, `vocabularyEnrichmentPrompt.ts`, `gradeGuidance.ts`
  - `src/vocabulary/` — TypeScript port of the former Python pipeline: `gradeWordPools.ts` (per-grade target lists), `selector.ts` + `enricher.ts` (token intersection + first-page sentence quote), `teacherGuideEnrichment.ts` (Claude kid-friendly definitions), `cefrjVocabularyProfile.ts`, `index.ts`
  - `src/pdf/textExtractor.ts` — PDF and DOCX text extraction (PyMuPDF footer-page extractor still shells out to `workbook_generator/pdf_footer_page_extractor.py`, the only remaining Python file)
  - `src/lib/logger.ts` — Pino logger

## Database Schema (`lib/db`)

### Tables
- **`books`**: id (serial PK), title, author, grade, created_at
- **`chapters`**: id (serial PK), book_id (FK → books.id, cascade delete), num, title, pages, status, date, file, extracted_text, workbook_content, teacher_guide_content, created_at
  - `status`: "pending" | "generating" | "ready" | "error"
  - `extracted_text`: raw text parsed from uploaded PDF/Word file
  - `workbook_content`: AI-generated Student Workbook HTML
  - `teacher_guide_content`: AI-generated Teacher Guide HTML

### Seeded Data
Three sample books (Heidi, Treasure Island, The Call of the Wild) with sample chapters are seeded at database creation time.

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
