# Alba Clean-Room Authoring Platform Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Evolve Alba from a browser-local lesson editor into a clean-room, Rise-like authoring and delivery platform with course cover pages, lesson/section navigation, reusable learning blocks, publishing, and LMS-ready exports.

**Architecture:** This is a functional-equivalence program, not a copy of Articulate Rise 360. It may reproduce general authoring patterns observed in the supplied export—cover, left navigation, lessons, hierarchical sections, media and assessment blocks—while using independently written code, Alba branding, original CSS tokens, original icons, and original component behavior. The current static prototype remains the migration base; a modular React application and API are introduced only after the domain model is stable.

**Tech Stack:** Current prototype: static ES modules, Node Test Runner, pdfjs-dist, localStorage. Target: Next.js/React/TypeScript, FastAPI, PostgreSQL, Redis, S3-compatible object storage, Docker, GitHub Actions, OpenAPI, optional Moodle SCORM/LTI integration.

---

## Scope and Clean-Room Boundary

The supplied local Rise export was reviewed only to identify broad, user-facing organization patterns. It shows a course cover, a sidebar with lessons, hierarchical content, and a sequence of text, image, list, interactive, knowledge-check and divider blocks. Its exported runtime, JavaScript, assets, course data, styling and branding are not implementation sources.

Allowed:
- Independently implement course covers, section navigation, content blocks, PDF-to-structure, flipbooks, embeds, knowledge checks, exports and LMS interoperability.
- Use public interoperable standards: HTML, CSS, SCORM 1.2/2004, xAPI, LTI, WCAG and OpenAPI.
- Use original names, visual tokens, components, layouts and source code.

Out of scope:
- Copying proprietary Rise JavaScript, CSS, runtime data models, icons, assets, lesson copy, trademarks, proprietary templates or exact visual arrangement.
- Marketing the result as Rise 360 or as compatible with unpublished/private Rise internals.

---

# Summary of the Technical Approach

Alba will use a course document model as the source of truth. A course contains settings, a cover, ordered lessons, ordered sections, blocks and assets. The authoring UI and learner player consume the same validated document but use separate rendering surfaces. This avoids the current prototype limitation where the first lesson is hard-coded and navigation is inferred only from heading blocks.

The delivery sequence is:

1. Author creates a course and cover.
2. Author creates lessons and sections through a left course outline.
3. Author inserts resources into an active section using typed, independently implemented blocks.
4. Assets are uploaded to object storage; the document stores immutable asset references instead of base64 payloads.
5. Autosave creates revisions and supports recovery.
6. Preview uses the learner player.
7. Publishing creates a versioned HTML package and, optionally, a SCORM or xAPI package for Moodle.

The first production milestone should preserve the current working features—text, images, PDF outline creation, Google Slides, generic iframe, flipbook and HTML export—while migrating their state to the new course document model.

---

# Phase 1 — R: Requirements

## 1. Functional Requirements

### 1.1 Roles

| Role | Main purpose | Permissions |
|---|---|---|
| Author | Creates and edits learning experiences | Own courses, assets, revisions, preview, publish, export |
| Reviewer | Reviews a shared draft | Comment, suggest, approve/reject; no publish unless granted |
| Course administrator | Manages workspace and publishing policy | Users, roles, templates, storage policy, publish settings |
| Learner | Consumes a published course | View content, complete activities, submit answers, resume progress |
| LMS service account | Exchanges course packages and progress | SCORM/xAPI/LTI endpoints only; no authoring UI access |

The current local application implements a single-author, browser-local subset. Authentication, review and learner roles are later milestones.

### 1.2 Authoring Requirements

1. Create, rename, duplicate, archive and restore courses.
2. Create an optional, editable course cover with title, description, call to action, accessible image, theme and estimated duration.
3. Create, rename, reorder, duplicate and delete lessons.
4. Create, rename, reorder, duplicate and delete sections inside a lesson.
5. Present a persistent left outline showing cover, lessons and nested sections; select an outline entry to focus its editor region.
6. Maintain block ordering inside a section with keyboard-accessible move controls and drag-and-drop.
7. Support the following independently implemented blocks:
   - heading and rich text;
   - image with alt text and caption;
   - quote and callout;
   - accordion/disclosure;
   - numbered process/timeline;
   - downloadable attachment;
   - video/web embed;
   - sanitized iframe in a fixed 16:9 frame;
   - Google Slides embed through an explicitly transformed public embed URL;
   - PDF-to-outline conversion;
   - integrated PDF flipbook with accessible previous/next controls;
   - multiple-choice knowledge check with feedback;
   - divider.
8. Add section templates such as “Concept explanation”, “Demonstration”, “Practice”, “Reflection” and “Assessment.” Templates must be Alba-authored JSON fixtures, not copied templates.
9. Import a PDF with text extraction. Detect likely document title, section headings and subheadings from semantic structure where available, then typography/layout heuristics as fallback.
10. Generate source-grounded section summaries. The initial version must state that it is extractive/heuristic unless a configured AI provider produces a separately attributable generated summary.
11. Let authors replace every imported summary, title and placeholder image.
12. Store a course revision on explicit save and autosave after a debounced edit.
13. Show nonblocking save state: saved, saving, offline, failed/retry.
14. Preview with the learner player without authoring controls.
15. Export standalone HTML and versioned course JSON.
16. Export SCORM 1.2 first, then SCORM 2004/xAPI after conformance testing.

### 1.3 Learner Requirements

1. Start at the cover, then enter the first incomplete lesson.
2. Navigate through visible lessons and sections with the left sidebar.
3. Use next/previous lesson controls and preserve reading location.
4. Consume responsive rich media, flipbooks and permitted iframes.
5. Answer knowledge checks and receive configured feedback.
6. Resume progress after refresh or LMS relaunch.
7. Use keyboard navigation, semantic landmarks, visible focus states and text alternatives.
8. Respect course completion policy: manual completion, section completion, required knowledge check, or all lessons completed.

### 1.4 Administrator Requirements

1. Configure workspace branding, supported upload types and maximum file size.
2. Configure sanctioned iframe hosts through an allowlist.
3. Configure PDF OCR/AI providers and retention policy.
4. Inspect publish history, asset usage and export status.
5. Revoke published versions and remove orphaned assets.

## 2. Non-Functional Requirements

| Category | Target |
|---|---|
| Responsiveness | Authoring UI usable from 1024px width; learner output usable from 320px width |
| Performance | Initial published learner shell LCP under 2.5s on typical broadband; author navigation switch under 200ms for locally cached documents |
| Editing latency | Debounced local state update under 50ms; autosave network acknowledgement target under 1s p95 |
| API latency | Read p95 under 300ms; simple document mutation p95 under 500ms excluding file upload and AI/OCR jobs |
| Availability | 99.9% monthly target for authoring/published delivery after production launch |
| Scale | Initial design: 10k workspaces, 100k courses, 1M learner records; horizontally scalable stateless API |
| File handling | Direct multipart upload with checksum, resumable upload for files larger than 20 MB, asynchronous PDF processing |
| Security | HTTPS/TLS 1.2+, secure HttpOnly same-site session cookies or short-lived JWT access token plus refresh token, CSRF protection for cookie flows |
| Authorization | Tenant/workspace isolation, RBAC, object-level checks on every course, revision and asset request |
| Content security | CSP with iframe `frame-src` allowlist; sanitize rich text server-side; reject JavaScript/data URLs except validated image data migration flow |
| Privacy | Configurable data residency, deletion/export request support, audit logs for publish/share actions |
| Accessibility | WCAG 2.2 AA target; semantic headings, keyboard block operations, accessible quiz feedback, captions/transcripts metadata |
| Reliability | Immutable revisions, soft delete, daily database backups, tested restore runbook |
| Observability | Structured logs, request IDs, metrics for latency/error rates/queue depth, alerting for failed publish or PDF jobs |

## 3. Critical Use Cases

### Use Case A: Build and publish a sectioned course

1. Author signs in and selects “New course.”
2. System creates a draft course and default lesson.
3. Author selects “Generate cover,” edits title, description, image and start label.
4. Author selects “New section,” names it, then inserts text, images and a learning check.
5. Author repeats for the remaining sections; the sidebar outline updates immediately.
6. Author enters Preview and validates navigation/interactive blocks.
7. System validates required fields, inaccessible assets and untrusted embeds.
8. Author selects Publish, chooses HTML or SCORM and receives a versioned publish record.
9. Learner delivery uses the immutable published version; later edits remain draft-only until republished.

### Use Case B: Convert a PDF into editable course content

1. Author adds “PDF → structure” to an active section.
2. Author uploads a PDF.
3. API stores original asset and creates an asynchronous extraction job.
4. Worker extracts text; if required and allowed, runs OCR.
5. Worker identifies title/subtitles, returns confidence metadata and source spans.
6. Worker generates source-grounded suggested summaries and image placeholders.
7. Author sees a proposed outline, accepts/reorders/edits it, then inserts it into the selected section.
8. The final block document records source asset and original page references for traceability.

### Use Case C: Learner resumes a published LMS course

1. Moodle launches a SCORM package or opens the hosted learner URL.
2. Learner player loads the immutable course version and reads prior completion/progress state.
3. Player opens the saved lesson/section or first incomplete section.
4. Learner consumes resources and answers required knowledge checks.
5. Player writes progress after meaningful events and on unload.
6. Completion and score are sent to the LMS in the selected standard.

---

# Phase 2 — E: Structure

## 1. Domain Model and Database Schema

PostgreSQL is recommended for the transactional source of truth. Use UUID primary keys, UTC timestamps, `created_at`, `updated_at`, `deleted_at` soft-delete fields where appropriate, and `workspace_id` on all tenant-owned tables.

### Core tables

#### workspaces

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | Tenant boundary |
| name | VARCHAR(160) | Display name |
| slug | CITEXT UNIQUE | URL-safe workspace identity |
| settings | JSONB | Branding, embedding policy, retention settings |

#### users

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | User identity |
| email | CITEXT UNIQUE | Verified sign-in address |
| display_name | VARCHAR(160) | UI display name |
| password_hash | TEXT nullable | Null for SSO-only accounts |
| status | ENUM | active, invited, disabled |

#### workspace_memberships

`workspace_id` + `user_id` unique. `role` enum: owner, admin, author, reviewer, learner.

#### courses

| Field | Type | Notes |
|---|---|---|
| id | UUID PK | Course identity |
| workspace_id | UUID FK | Tenant scope |
| owner_id | UUID FK users | Primary author |
| title | VARCHAR(255) | Course title |
| description | TEXT | Plain-text summary |
| status | ENUM | draft, published, archived |
| theme | JSONB | Original Alba design tokens only |
| cover | JSONB | eyebrow, action_label, asset_id, color treatment |
| current_revision_id | UUID FK course_revisions nullable | Draft head |

#### course_revisions

Immutable snapshots. `document JSONB NOT NULL` is a validated representation of lessons, sections and blocks. Store a SHA-256 hash to detect changes. `revision_number` is monotonic per course.

#### lessons

Normalized projection for querying/navigation. Fields: `id`, `course_id`, `revision_id`, `position`, `title`, `slug`, `settings JSONB`.

#### sections

Fields: `id`, `lesson_id`, `position`, `title`, `slug`, `summary`, `visibility`, `settings JSONB`. One lesson has many ordered sections.

#### blocks

Fields: `id`, `section_id`, `position`, `block_type`, `payload JSONB`, `schema_version`, `source_asset_id nullable`.

Block payload examples:

```json
{
  "blockType": "knowledge_check",
  "question": "¿Cuál afirmación es correcta?",
  "answers": [
    {"id": "a1", "text": "...", "isCorrect": true, "feedback": "..."}
  ],
  "required": true
}
```

```json
{
  "blockType": "iframe",
  "src": "https://approved.example.edu/embed/123",
  "title": "Simulación de práctica",
  "ratio": "16:9",
  "sandbox": ["allow-scripts", "allow-forms"]
}
```

#### assets

Fields: `id`, `workspace_id`, `uploaded_by`, `storage_key`, `filename`, `content_type`, `byte_size`, `sha256`, `alt_text`, `status`, `metadata JSONB`.

`metadata` stores width/height/duration/page_count. Assets are referenced by ID, never kept as large base64 strings in a course document in production.

#### processing_jobs

Fields: `id`, `workspace_id`, `asset_id`, `job_type`, `status`, `input JSONB`, `result JSONB`, `error_code`, `attempts`, `started_at`, `completed_at`. Types include `pdf_extract`, `pdf_ocr`, `pdf_outline`, `asset_transcode`, `publish_package`.

#### publishes

Fields: `id`, `course_id`, `revision_id`, `format`, `status`, `storage_key`, `public_url nullable`, `created_by`, `manifest JSONB`, `published_at`.

#### learner_enrollments and learner_progress

Progress is keyed by `course_publish_id`, learner identity and optionally LMS registration. Store lesson/section pointer, block state, score, completion state, suspended data and `last_seen_at`.

#### audit_events

Append-only: workspace, actor, entity type/id, action, redacted metadata, IP/user agent where allowed.

### Referential Integrity

- Workspace owns courses, assets, jobs, publishes and memberships.
- Course owns revisions; publish references an immutable revision.
- Revision owns lessons; lesson owns sections; section owns blocks.
- A block may reference an asset but never deletes it directly.
- Asset deletion is blocked while referenced by non-deleted revisions or published packages.

## 2. Site Map and Navigation Flow

### Author application

```text
/sign-in
/workspaces
/workspaces/:workspaceSlug/courses
/workspaces/:workspaceSlug/courses/new
/workspaces/:workspaceSlug/courses/:courseId/edit
  ├─ Cover editor
  ├─ Left outline: Cover → Lessons → Sections
  ├─ Active section canvas
  ├─ Block library
  ├─ Inspector / design panel
  ├─ Version history
  ├─ Preview
  └─ Publish/export
/workspaces/:workspaceSlug/assets
/workspaces/:workspaceSlug/settings
```

### Learner application

```text
/c/:publicSlug
  ├─ Cover
  ├─ Left navigation (lessons and sections)
  ├─ Active section
  ├─ Previous/next progression
  ├─ Completion state
  └─ Optional certificate/result page
```

### Required authoring navigation behavior

- Selecting a lesson replaces the active section list without losing unsaved edits.
- Selecting a section scrolls/focuses the active editor canvas.
- “New section” inserts immediately after the selected section; when no section is selected, it appends to the current lesson.
- Moving a section updates sibling `position` values transactionally.
- The cover is a top-level outline item, never a content block.
- The player sidebar uses course metadata and section structure, not text-heading parsing.

## 3. Original Alba UI/UX System

Do not replicate another product pixel-for-pixel. Establish an original Alba system:

### Tokens

```css
--alba-ink: #18322b;
--alba-moss: #527461;
--alba-paper: #faf8f1;
--alba-surface: #ffffff;
--alba-line: #dfe5db;
--alba-accent: #c75c35;
--alba-radius-sm: 8px;
--alba-radius-md: 12px;
--alba-space-1: 4px;
--alba-space-4: 16px;
--alba-space-8: 32px;
```

### Reusable components

- `CourseOutline`: tree view with roving tab index, reorder handles and completion markers.
- `CoverEditor` / `CoverPlayer`: original visual treatment, cover image overlay, content contrast validation.
- `LessonCanvas`: selects active lesson/section, renders ordered blocks.
- `SectionHeader`: title, optional objective, progress indicator.
- `BlockFrame`: author controls, duplicate/move/delete menu, validation state.
- `BlockLibrary`: searchable, grouped block insertion list.
- `EmbedFrame`: fixed ratio, host policy validation, loading/error view.
- `FlipbookPlayer`: page canvas, previous/next, page jump, accessible labels and PDF download fallback.
- `KnowledgeCheck`: deterministic answer selection, feedback and completion reporting.
- `SaveState`: nonblocking autosave state.
- `PublishDialog`: export format, accessibility validation, asset validation and release notes.

### Accessibility rules

- Heading blocks cannot skip from h1 to h4 in exported learner HTML.
- All image blocks require alt text before publishing unless marked decorative.
- Iframes require a human-readable title.
- Icon-only controls require `aria-label`.
- Sidebar and canvas are landmarks with skip links.
- Color is never the only signal for errors/completion.

---

# Phase 3 — A: Architecture

## 1. Recommended Stack

### Frontend: Next.js + React + TypeScript

Use Next.js App Router for server-rendered shell pages, React for the authoring canvas and learner player, TypeScript for validated course-document contracts and Zustand or Redux Toolkit for local editing state. Use TanStack Query for API caching and optimistic revision updates.

Why: the project needs both authoring and public delivery surfaces, reliable routing, structured component composition, typed API contracts and a clean path to hosted static/course delivery.

### Backend: Python FastAPI

Use FastAPI for a typed REST API, OpenAPI generation, asynchronous job orchestration hooks and document validation with Pydantic. PDF/OCR work is naturally supported in Python worker processes. Keep the API stateless.

Alternative: a TypeScript NestJS backend is acceptable if the team is all-TypeScript. Avoid a microservice split until independently scalable worker workloads justify it.

### Data and asynchronous work

- PostgreSQL: transactional data, JSONB documents and relational authorization.
- Redis: rate limits, sessions/queues, cache and job status fan-out.
- Celery/RQ/Arq workers: PDF parsing/OCR, preview generation, export builds.
- S3-compatible storage: Cloudflare R2, AWS S3 or MinIO; use signed upload/download URLs.

### Rich text and rendering

Use a structured AST (TipTap/ProseMirror JSON or Lexical JSON), not arbitrary raw HTML. Server-render/export after sanitization. Store schema versions and write migrations for block payload changes.

## 2. System Architecture

Start as a modular monolith with clear bounded modules:

```text
Web application (Next.js)
    │ HTTPS / REST / signed upload URLs
API (FastAPI)
    ├─ Identity and authorization module
    ├─ Courses and revisions module
    ├─ Assets module
    ├─ Publish/export module
    ├─ Learner progress module
    └─ Policy/validation module
    │
PostgreSQL  Redis  S3-compatible storage
    │
Worker queue
    ├─ PDF extraction/OCR
    ├─ Course package builder
    └─ Media processing
```

The author client persists validated document commands, not arbitrary DOM mutations. Example commands: `CreateSection`, `MoveBlock`, `UpdateBlockPayload`, `AttachAsset`, `PublishRevision`. Every command authorizes the current user and creates a new revision record or a draft update with revision history.

Use REST for CRUD and publishing. Use WebSocket or Server-Sent Events only for job status, collaborative presence and long-running PDF/publish progress. Do not introduce GraphQL until a demonstrated need for cross-resource client queries exists.

## 3. REST API Specification

All APIs are versioned under `/api/v1`. Responses include a `requestId`. Errors use RFC 9457 problem details.

### Courses

```http
POST /api/v1/workspaces/{workspaceId}/courses
Content-Type: application/json

{
  "title": "Diseño de experiencias de aprendizaje",
  "description": "Curso introductorio",
  "createCover": true
}
```

```json
{
  "id": "b269f833-91be-4e14-a7be-c278745c4b42",
  "status": "draft",
  "revision": 1,
  "cover": {"enabled": true, "eyebrow": "Curso autoguiado"}
}
```

```http
GET /api/v1/courses/{courseId}?include=draft
PATCH /api/v1/courses/{courseId}
```

```json
{
  "title": "Diseño de experiencias de aprendizaje",
  "cover": {
    "enabled": true,
    "eyebrow": "Curso autoguiado",
    "actionLabel": "Iniciar",
    "assetId": "f88d5d73-08ea-4bb0-8b83-34a9d8c2e0e8"
  }
}
```

### Lessons and sections

```http
POST /api/v1/courses/{courseId}/lessons
{
  "title": "Fundamentos",
  "afterLessonId": null
}

POST /api/v1/lessons/{lessonId}/sections
{
  "title": "Conceptos esenciales",
  "afterSectionId": null
}

PATCH /api/v1/sections/{sectionId}
{
  "title": "Conceptos esenciales",
  "position": 2
}
```

Response example:

```json
{
  "id": "3677b51f-45ca-4d6f-a699-5e44b3a88170",
  "lessonId": "a3d1...",
  "position": 2,
  "title": "Conceptos esenciales",
  "updatedAt": "2026-10-16T13:05:00Z"
}
```

### Blocks

```http
POST /api/v1/sections/{sectionId}/blocks
{
  "type": "iframe",
  "position": 3,
  "payload": {
    "src": "https://video.example.edu/embed/42",
    "title": "Demostración",
    "ratio": "16:9"
  }
}

PATCH /api/v1/blocks/{blockId}
{
  "payload": {
    "question": "¿Qué decisión es adecuada?",
    "answers": []
  }
}

POST /api/v1/blocks/{blockId}/move
{
  "targetSectionId": "3677b51f-45ca-4d6f-a699-5e44b3a88170",
  "position": 1
}
```

### Assets and PDF processing

```http
POST /api/v1/workspaces/{workspaceId}/assets/upload-intents
{
  "filename": "manual.pdf",
  "contentType": "application/pdf",
  "byteSize": 2581100,
  "sha256": "..."
}
```

Returns signed URL and asset ID. Client uploads directly to storage, then:

```http
POST /api/v1/assets/{assetId}/process
{
  "operation": "pdf_outline",
  "targetSectionId": "3677...",
  "summaryMode": "source_grounded"
}
```

```json
{
  "jobId": "d3f4...",
  "status": "queued"
}
```

```http
GET /api/v1/jobs/{jobId}
```

### Preview/publish/export

```http
POST /api/v1/courses/{courseId}/preview
{ "revisionId": "..." }

POST /api/v1/courses/{courseId}/publishes
{
  "revisionId": "...",
  "format": "scorm_1_2",
  "publicAccess": false
}
```

```json
{
  "id": "d606...",
  "status": "building",
  "format": "scorm_1_2"
}
```

### Learner progress

```http
GET /api/v1/learner/publishes/{publishId}/state
PUT /api/v1/learner/publishes/{publishId}/state
{
  "lessonId": "...",
  "sectionId": "...",
  "completion": "in_progress",
  "blockState": {"quiz-1": {"selected": 2, "correct": true}}
}
```

## 4. Infrastructure and Deployment

### Environments

- `local`: Docker Compose, local Postgres/Redis/MinIO.
- `staging`: isolated managed database/bucket, test identity provider, seeded test courses.
- `production`: managed PostgreSQL with PITR, Redis, object storage, API containers, worker containers and CDN.

### Suggested initial cloud implementation

| Concern | Recommended service |
|---|---|
| Web | Vercel or containerized Next.js on Cloud Run/ECS |
| API/workers | Cloud Run, ECS Fargate or Fly.io Machines |
| Database | Supabase Postgres, Neon or AWS RDS PostgreSQL |
| Object storage | Cloudflare R2 or AWS S3 |
| Queue/cache | Upstash Redis or managed Redis |
| CDN/WAF | Cloudflare |
| Observability | Sentry + OpenTelemetry + managed logs |
| Secrets | Cloud provider secrets manager |

### Containers

- `web`: Next.js production image.
- `api`: FastAPI/Uvicorn image.
- `worker`: PDF/export worker image with Poppler/OCR dependencies isolated from API.
- `nginx` only if not handled by platform ingress.

### CI/CD

1. Pull request: formatting, type checking, unit tests, API schema validation, dependency/security scan, integration tests using ephemeral Postgres.
2. Merge to main: build immutable images, publish to registry, deploy staging, run smoke suite.
3. Manual promotion: deploy production with database migration gate and health check rollback.
4. Nightly: accessibility regression scan, SCORM package smoke test against a local LMS test harness.

### Backup and recovery

- PostgreSQL point-in-time recovery and daily snapshot.
- Versioned object storage with lifecycle policy.
- Quarterly restore drill of a course, assets and published package.

---

# Implementation Plan

## Task 1: Establish the canonical course document schema

**Objective:** Replace the first-lesson-only document assumptions with typed lessons, sections, blocks and cover settings.

**Files:**
- Create: `src/domain/course.ts`
- Create: `src/domain/course.schema.ts`
- Create: `src/domain/course.test.ts`
- Migrate: `model.js` to a compatibility adapter until React migration begins.

**Steps:**
1. Write tests for course creation, cover creation, lesson creation and nested section ordering.
2. Implement Zod/Pydantic-equivalent validators and immutable document command functions.
3. Add schema version field and migration tests from the current localStorage `alba-course-v1` document.
4. Verify serialization/deserialization does not lose existing PDF, Slides, iframe or flipbook block data.

**Validation:** `npm test` and a fixture migration test with a saved current-course JSON.

## Task 2: Make the course outline authoritative

**Objective:** Render left navigation from lessons and sections instead of heading text inference.

**Files:**
- Modify: `app.js` during prototype phase, then `src/features/course-outline/*`
- Modify: `styles.css`
- Test: `test/course-outline.test.js`

**Steps:**
1. Write failing tests for ordered outline items and active selection.
2. Implement create/rename/reorder/delete lesson and section commands.
3. Add an accessible tree outline with Cover, lessons and sections.
4. Add keyboard focus and scroll/focus behavior.
5. Preserve heading-based navigation only as a temporary migration fallback.

**Validation:** keyboard-only interaction, mobile layout, and unit tests for reordering.

## Task 3: Complete cover authoring and player rendering

**Objective:** Support an original Alba cover on draft, preview and HTML export surfaces.

**Files:**
- Modify: `model.js`, `app.js`, `styles.css`, `export-html.js`
- Create: `test/cover.test.js`

**Steps:**
1. Test cover off/on state, title/description/action text and asset reference.
2. Add image upload rather than URL-only cover selection.
3. Add contrast validation for cover copy.
4. Render equivalent cover behavior in preview/export.
5. Include cover as an accessible sidebar route.

**Validation:** cover remains readable with and without an image; exported HTML opens independently.

## Task 4: Extract block implementations into a registry

**Objective:** Make all blocks independently typed, validated, renderable and exportable.

**Files:**
- Create: `src/blocks/registry.ts`
- Create: `src/blocks/{text,image,accordion,iframe,flipbook,knowledge-check}/`
- Modify: `export-html.js`
- Test: one test file per block type.

**Steps:**
1. Define `BlockDefinition` with default payload, validator, editor component, player component and exporter.
2. Move existing blocks one at a time, retaining behavior behind contract tests.
3. Add URL allowlist validation to iframe/embeds.
4. Add iframe title requirement and 16:9 layout test.
5. Add flipbook PDF fallback download and accessible page controls.

**Validation:** snapshot/DOM tests, URL safety tests and standalone HTML export tests.

## Task 5: Replace local base64 assets with asset records

**Objective:** Enable scalable files and reliable exports.

**Files:**
- Create: `api/app/assets/*`
- Create: `web/src/features/assets/*`
- Modify: block payloads to store asset IDs.
- Test: `api/tests/assets/*`

**Steps:**
1. Add signed-upload intent API and checksum validation.
2. Implement direct upload and asset finalization.
3. Migrate image/PDF imports to asset IDs.
4. Add reference tracking and prevent deletion of published assets.
5. Add asset metadata extraction workers.

**Validation:** upload image/PDF, reload the course, publish/export and verify resource URLs resolve.

## Task 6: Move PDF processing to an asynchronous worker

**Objective:** Produce editable, source-grounded outlines without blocking the browser.

**Files:**
- Create: `worker/pdf_pipeline.py`
- Create: `api/app/jobs/*`
- Create: `api/tests/pdf_pipeline_test.py`
- Modify: `app.js` PDF block behavior.

**Steps:**
1. Create extraction job state machine and progress endpoint.
2. Implement text-layer extraction; OCR fallback only for authorized scanned PDFs.
3. Preserve heading confidence/page coordinates in result JSON.
4. Generate extractive source-grounded drafts; add explicit optional AI provider interface later.
5. Add review/accept UI that creates editable sections/blocks rather than writing directly to a draft.

**Validation:** text PDF, scan/OCR failure, malformed PDF, 100-page PDF and cancellation tests.

## Task 7: Introduce learner player and progress service

**Objective:** Separate authoring canvas from learner delivery.

**Files:**
- Create: `web/src/app/c/[slug]/page.tsx`
- Create: `api/app/progress/*`
- Create: `web/src/features/player/*`
- Test: learner navigation and quiz persistence.

**Steps:**
1. Create immutable publish reader endpoint.
2. Render cover/sidebar/lesson/section player layout.
3. Store local progress for anonymous preview and authenticated progress for learners.
4. Add previous/next and completion policy.
5. Validate no author editing controls appear in player mode.

**Validation:** reload-resume flow, keyboard navigation and mobile viewport test.

## Task 8: Add publication formats and Moodle integration

**Objective:** Deliver a dependable LMS package and public HTML output.

**Files:**
- Create: `worker/publish/*`
- Create: `api/app/publishes/*`
- Create: `api/tests/scorm_test.py`

**Steps:**
1. Define versioned publish manifest.
2. Generate self-contained HTML first.
3. Add SCORM 1.2 adapter and test it using a local LMS sandbox.
4. Implement completion, score and suspend data mapping.
5. Add signed public delivery URLs and publish rollback.

**Validation:** import test package into a Moodle test course; completion/score/resume pass.

---

# Risks, Trade-offs and Decisions

1. **Pixel-identical imitation is intentionally excluded.** It creates intellectual-property and maintenance risk. Use clean-room functional equivalence and original Alba visual system.
2. **Static prototype vs full stack:** do not turn the current one-file editor into a backend by incremental patches. Freeze it as a migration baseline and introduce typed boundaries.
3. **PDF summaries:** a deterministic extractor cannot truly paraphrase. If AI generation is added, make provider, source excerpts, consent, cost and review state explicit.
4. **Base64 in localStorage:** works for demos but fails with larger PDFs and cannot support collaboration. Asset storage migration is a prerequisite for production.
5. **SCORM:** package behavior must be tested against the target Moodle version; do not claim compatibility before an actual import/launch/completion test.
6. **Iframe security:** broad arbitrary iframe support conflicts with CSP/security. Use workspace-approved hosts with a transparent fallback link.

# Acceptance Criteria for the First Production-Ready Release

- An author can create a course cover, at least three lessons and nested sections from a persistent left outline.
- An author can add/reorder the listed resource blocks inside an active section.
- Drafts survive refresh and are revisioned.
- A learner can navigate cover → lessons → sections, complete a quiz and resume after refresh.
- The published player has no author controls and passes baseline keyboard/landmark/accessibility checks.
- HTML export opens independently.
- A SCORM 1.2 package has been imported, launched, resumed and completed in a Moodle test instance.
- Every code path is independently authored; no proprietary Rise assets, source code, runtime payload or exact design copy is incorporated.
