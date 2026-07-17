# Plan: Per-Domain Implementation Plans for the Vanderbilt Accounting Platform MVP

## Context

`.claude/plans/accounting-platform-mvp-plan-full.md` lays out a 9-domain MVP (Tenant/Property Foundation → Notifications) for an AI-driven month-end-close reconciliation platform, to be built on top of this repo's existing Angular/Express/MongoDB base. The user wants a **separate, detailed implementation plan per domain** (models, repositories, services, controllers, jobs, AI design, Angular pieces) so each can be reviewed independently before any code is written.

Before drafting those plans I audited the actual codebase against the source doc's architectural claims, because several of its "already exists, just reuse it" assumptions don't hold:

- **Multi-tenancy is now implemented at the DI/database layer** (built by the user during this session, superseding the original "resolved from a CLIENT-ID header" idea from the source doc). `UserAuth` now carries a `tenantId` set at registration; `Injector.get(cls, tenantId)` (`server/config/bootstrap.ts`) builds one `ReflectiveInjector` scope per tenant and sets `DeployConfig.INJECTED_TENANT_ID` right before resolving, so every repository/service/controller constructed within that request is transparently bound to the right tenant — no header, no per-call `tenantId` argument threading. `BaseRepository` (`server/repository/base.repository.ts`) picks up `DeployConfig.INJECTED_TENANT_ID` in its constructor and passes it into `DatabaseContext`, whose `setTenant()` (`server/database/context.ts`) automatically stamps `tenantId` on every insert/update and filters every find/count/sum/page/distinct query by it. **Domain 1's plan below reflects this — no `CLIENT-ID` header, no `TenantScopedRepository` base class; plain `BaseRepository` subclasses are already tenant-safe.**
- **JobRunner has no persisted queue or retry/dead-letter storage.** `server/jobs/job.runner.ts` + `server/lib/pipeline.ts` run an in-memory, sequential, fail-fast pipeline of `Job` instances via CLI (`ts-node`) — there's no DB-backed queue, no automatic retry, no dead-letter table. `JobQueueItem`/`JobStatus`/`JobPriority` exist in `model/job.model.ts` but are unused scaffolding. **Per the user: this is out of scope for these plans — they will self-implement the queue/retry layer.** Domain 4's plan uses the existing `Job`/`JobRunner`/`Pipeline` primitives as-is and does not design persistence/retry.
- **The AI layer (`server/service/ai/*`) and `S3Service` are fully built but have zero business-feature consumers today** — the extraction/reconciliation features will be their first real caller. This is good news (clean interfaces, JSON-schema structured output already supported across all 3 providers) but means there's no in-repo usage example to mirror beyond the deployment jobs.
- **An xlsx parsing utility now exists**: `server/lib/xlsx/xlsx.utility.ts` (`xlsx.fileToWorksheets(buffer, true)`) — added by the user during this session. This directly supports the "generic raw parse, no layout assumptions" approach the source doc calls for.
- **The Angular app (`ui/`) is an unbuilt shell** — only a `HomeComponent`, base service/component classes, and a small custom `bundle/*` framework (routing, event bus, API service with token refresh). There's no existing feature UI to pattern-match; the Angular sections of each plan are necessarily new design, following the shell's conventions (`BaseComponent`, `BaseService.post/get`, `Routes` array, `Cache` utility).
- **`S3Service` already supports presigned direct-to-S3 upload** (`getUploadInfo`) — Document Management (Domain 3) should use this rather than adding multer/multipart upload handling, which doesn't exist in the repo today.

## Output of this plan

Nine separate markdown files, one per domain, written to `.claude/plans/accounting-platform/`:

1. `01-tenant-property-foundation.md`
2. `02-trial-balance-import.md`
3. `03-document-management.md`
4. `04-extraction-pipeline.md`
5. `05-reconciliation-engine.md`
6. `06-review-queue-workflow.md`
7. `07-preclose-checklist.md`
8. `08-period-close-workflow.md`
9. `09-notifications.md`

Each file follows the style of the existing approved plans in this repo (`.claude/plans/invite-user.md`, `user-profile.md`): Context → Files to Create/Modify with field lists and method signatures → Key Patterns Reused table → Verification steps. Domains 1–9 additionally include an **Angular** subsection (components/services/routes) since this feature is UI-heavy, and Domains 4–5 include an **AI Design** subsection (prompt/schema strategy, provider routing).

Cross-cutting conventions established once (in Domain 1 for tenancy, Domain 3 for S3 key/versioning, Domain 4/5 for the AI structured-output convention) are referenced by later domains rather than repeated.

---

## Domain-by-domain content specification

### Domain 1 — Tenant / Property / Foundation

**Purpose:** Stand up multi-tenancy from scratch, Tenant/Property CRUD, per-property role scoping, COA template seeding, account activation. Demoable: admin stands up a tenant, adds properties, configures a COA.

**Models** (`model/tenant.model.ts`, `model/property.model.ts`, `model/chart-of-account.model.ts`):
- `Tenant implements BaseModel { oid; name; createdAt; status: TenantStatus }`
- `Property implements BaseModel { oid; tenantId: uniqueid; name; yardiCode?: string; address; status }`
- `PropertyRole implements BaseModel { oid; tenantId; userId: authid; propertyId?: uniqueid /* null = tenant-wide */; role: PropertyRoleType }` (`Accountant | Reviewer | Admin`)
- `ChartOfAccount implements BaseModel { oid; tenantId; accountNumber; name; statementType; category; subCategory; sourceType: 'yardi'|'manual'; isTemplate: boolean }` — platform starter template rows have `tenantId = null`/a reserved template tenant id; seeding copies them into a tenant's working set.
- `AccountActivation implements BaseModel { oid; tenantId; propertyId; accountId: uniqueid; active: boolean }`

**Tenancy plumbing (already implemented by the user this session — described here for reference, not new work):**
- `model/auth.model.ts`: `UserAuth` constructor now takes `tenantId: uniqueid` as a third argument.
- `server/config/bootstrap.ts`: `Injector.get<T>(cls, tenantId?)` keys its cached `ReflectiveInjector` instances by `tenantId` and sets the static `DeployConfig.INJECTED_TENANT_ID = tenantId` immediately before resolving — every class constructed in that call graph (controller → services → repositories) is implicitly bound to that tenant for its lifetime.
- `server/lib/session.ts`: `Session.tenantId` is populated from `UserAuth.tenantId` on `start()`/token resume and embedded in the JWT payload (`SessionTokenData.tenantId`).
- `server/controller/base.controller.ts`: `addToRouter` resolves the per-request controller via `Injector.get(<any>this.constructor, req.session.tenantId)` — this is the only place tenant scoping is "wired in," and it already exists.
- `server/repository/base.repository.ts` / `server/database/context.ts`: `BaseRepository` reads `DeployConfig.INJECTED_TENANT_ID` into `this.tenantId` at construction and forwards it to `DatabaseContext`; `DatabaseContext.setTenant()` auto-stamps `tenantId` on insert/update and auto-filters it into find/count/sum/max/page/distinct queries. **No repository-level opt-in is required** — a plain `class FooRepository extends BaseRepository` is already tenant-isolated.
- **Signup flow (confirmed by the user, not a gap):** there is no separate "create a tenant" endpoint. A user signs up through the existing `POST /api/auth/create`; when no caller is authenticated, `AuthService.persistAuth()` mints a fresh `tenantId = Common.uniqueId()` for the new `UserAuth` and immediately creates a matching `Tenant` document with that same id. Because this anonymous request runs in the default `''` DI scope, `DatabaseContext.setTenant()` would otherwise overwrite the persisted `_tid` field with `''` on insert — so the new `UserAuth` object must set `_tid` to the minted `tenantId` directly first (`setTenant()` only auto-stamps when `_tid` isn't already set) to keep it. `AuthService.invite()`/`register()` gain an optional `tenantId` parameter: present (the calling/inviting user's own `req.session.tenantId`) when an authenticated tenant member is adding a teammate, absent only for the one brand-new-tenant signup case.
- **Global/template data:** rows that must be visible across all tenants (the platform's starter COA template) need `IDatabaseContextOptions.searchGlobalObjects: true` on read (already supported — matches `{ _tid: current } OR { _tid: null }`) and the same `_tid`-already-set escape to bypass auto-stamping on insert. `ChartOfAccountRepository` needs both: `searchGlobalObjects: true` in its `super()` call (`RepositoryOptions` already forwards this through to `contextOptions`, mirroring `AuthRepository`), and template rows inserted with no `_tid` set (or explicitly `null`).

**Repositories** (plain `BaseRepository` subclasses — no special base class needed): `tenant.repository.ts` (`tenant`), `property.repository.ts` (`property`), `property-role.repository.ts` (`property_role`), `chart-of-account.repository.ts` (`chart_of_account`, constructed with `{ searchGlobalObjects: true }` to see template rows), `account-activation.repository.ts` (`account_activation`).

*(`TenantRepository` itself stores the `Tenant` documents that *define* tenants — it's the one collection that legitimately isn't tenant-scoped data. Since `DatabaseContext` auto-stamps `tenantId` on every insert once `options.tenantId` is set, and `Tenant.oid` — not `tenantId` — is a tenant's own primary key, `TenantRepository` should be constructed with a connection/options that bypasses tenant-stamping, or its writes should run under the pre-tenant `''`-scoped injector the way the initial signup path already does.)*

**Services:** `tenant.service.ts` (create tenant + seed default `TenantConfig`), `property.service.ts` (CRUD, role assignment — still needed for per-property authorization; unrelated to tenant *resolution*, which is now automatic), `chart-of-account.service.ts` (seed template → tenant COA, activate/deactivate per property).

**Controller:** `tenant.controller.ts` — just `GET /api/tenant` (current tenant details); no signup endpoint, since signup is the existing `POST /api/auth/create` (modified to thread `tenantId`, per above). `property.controller.ts` at `/api/property` — CRUD + `POST /:id/role`; `coa.controller.ts` at `/api/coa` — `GET /`, `POST /activation`. None of these need a tenant-membership check in the controller itself — `req.session.tenantId` is already trustworthy by the time a handler runs.

**Angular:** `PropertyService` (loads properties for the current user's tenant — no client-side tenant selection needed, since a `UserAuth` belongs to exactly one tenant and the JWT already carries it), `PropertyListComponent` (with a property switcher for users who have roles on multiple properties within their one tenant), `CoaConfigComponent`. No `CLIENT-ID` header or tenant-switcher UI — the client sends only the existing `Authorization` bearer token.

**Verification:** sign up a new tenant via `POST /api/tenant/signup` → confirm a `Tenant` doc and an Admin `UserAuth` (with matching `tenantId`) are created → create a property → seed COA → activate accounts for the property. Then sign up a **second**, unrelated tenant and confirm `GET /api/property` under that user's session returns zero properties (not the first tenant's) — proving isolation is automatic via `DatabaseContext`, with no explicit filtering written in `PropertyRepository` at all.

---

### Domain 2 — Trial Balance Import

**Purpose:** Structured (non-AI) TB snapshot upload per property/period — the anchor everything else reconciles to.

**Model** (`model/trial-balance.model.ts`): `TrialBalanceSnapshot implements BaseModel { oid; tenantId; propertyId; period: string /* YYYY-MM */; accounts: { accountNumber; balance; linkedScheduleType? }[]; importedAt; importedBy }`

**Repository:** `trial-balance.repository.ts` (`trial_balance_snapshot`) — `getByPropertyPeriod(propertyId, period)`, `save(...)`.

**Service:** `trial-balance.service.ts` — `importFromWorkbook(buffer, propertyId, period, userId)`: `xlsx.fileToWorksheets(buffer, true)` (reuse `server/lib/xlsx/xlsx.utility.ts`), map the TB tab's known columns (account number, name, balance) deterministically — **not** the AI-interpretation path, since TB structure is fixed/Yardi-standard per the source doc ("intentionally simple... not the AI pipeline").

**Controller:** `trial-balance.controller.ts` at `/api/trial-balance` — `POST /import` (multipart-free: body carries base64 or the client uses the Domain 3 presigned-upload flow then passes the S3 key), `GET /:propertyId/:period`.

**Angular:** `TrialBalanceUploadComponent`, `TrialBalanceGridComponent` (per-account, per-period view).

**Verification:** upload a real Northbridge TB export, confirm all ~143 active accounts render with correct balances per account.

---

### Domain 3 — Document Management

**Purpose:** `SourceDocument` upload (xlsx/pdf), S3 storage, versioning on re-upload, property/period tagging.

**S3 key convention (established here, reused by Domains 4–5):** `{tenantId}/{propertyId}/{period}/{docId}/{version}.{ext}` — pass `directory = `${tenantId}/${propertyId}/${period}/${docId}`` into the existing `S3Service.getUploadInfo(bucket, directory, origFileName, fileType, isPublic)` / `S3Service.put(...)`. New config key needed: `Config.DOCUMENT_BUCKET` in `server/config/config.base.ts` (no business bucket config exists today — only deployment's `DeployConfig.BUCKET`).

**Upload flow (reuses existing presigned-URL pattern, no multer needed):** client calls `POST /api/document/upload-url` → server returns `S3UploadInfo` (`signedRequest`, `url`, `filename`) via `S3Service.getUploadInfo` → client `PUT`s the file directly to S3 → client calls `POST /api/document` with the returned key + metadata to create the `SourceDocument` record.

**Model** (`model/source-document.model.ts`): `SourceDocument implements BaseModel { oid; tenantId; propertyId; period; docType: DocType; s3Key; version: number; originalFilename; contentType; uploadedBy; uploadedAt; supersedes?: uniqueid /* prior version's oid */ }`. `DocType` enum: `BankStatement | MortgageStatement | InsuranceInvoice | ParkingReport | TaxBill | YardiRentRoll | YardiARAging | YardiAPAging | ... | Other` (user-selected at upload, per source doc decision #2 in Part A).

**Repository:** `source-document.repository.ts` (`source_document`) — `getByPropertyPeriod`, `getVersionHistory(docId)`, `save`.

**Service:** `document.service.ts` — `getUploadUrl(...)`, `register(s3Key, metadata)` (creates new version if `docType`+`period`+`propertyId` match an existing doc — sets `supersedes`, never overwrites), `download(docId)` (via `S3Service.getRawObjectByUrl`/`getDisplayUrl`).

**Controller:** `document.controller.ts` at `/api/document` — `POST /upload-url`, `POST /`, `GET /:propertyId/:period`, `GET /:id/download`, `GET /:id/versions`.

**Angular:** `DocumentUploadComponent` (docType picker + file input, drives the presigned-upload flow), `DocumentListComponent`, `DocumentVersionHistoryComponent`.

**Verification:** upload a bank statement, re-upload the same doc type/period → confirm a new version row is created (old one preserved, both downloadable), confirm S3 key follows the tenant/property/period/doc convention.

---

### Domain 4 — Extraction Pipeline

**Purpose:** Turn a `SourceDocument` into normalized `ExtractedData` with per-field confidence, via the existing `Job`/`AIService` primitives. No job-queue/retry design here (per user, self-implemented separately) — just the extraction logic that a `Job.run()` calls.

**AI structured-output convention (established here, reused by Domain 5):** build an `AICompletionOptions.responseFormat = { type: 'json_schema', json_schema: { name, schema, strict: true } }` describing the normalized `ExtractedData` shape (fields + per-field `confidence: number`), call `AIService.executeConversation`/`executeFunctionCall` with `authId` = the uploading user's oid, model chosen per `docType` (configurable, default a cheaper model for well-structured `docType`s, higher-capability model as fallback on low confidence).

**Two converging paths into the same AI step:**
- **Excel:** `xlsx.fileToWorksheets(buffer, true)` (raw parse, no layout assumptions) → dump headers+rows as the user-message content → AI interprets using `docType` as a hint.
- **PDF:** send document content to AI directly, **hardcoded to ChatGPT** (`model: 'gpt-5.2'`) — not provider-selectable for this doc type. `ChatGPTService` passes messages straight through to OpenAI's API with no mapping step today; OpenAI expects PDF content as `{ type: 'file', file: { filename, file_data: 'data:application/pdf;base64,...' } }`, while our shared `AIMessage.content` shape only carries `{ type: 'file', file?: string }` (raw base64). New, scoped work: add a small mapping step in `chatgpt.service.ts` to wrap the raw base64 into that shape before sending. Claude/Gemini are untouched.

**Model** (`model/extracted-data.model.ts`): `ExtractedData implements BaseModel { oid; tenantId; propertyId; sourceDocumentId: uniqueid; docType; fields: { name; value; confidence: number }[]; overallConfidence; extractedAt; aiModel: AIModel }`

**Job:** `server/jobs/extraction.job.ts extends Job` — constructor-injects `AIService`, `S3Service`, `SourceDocumentRepository`, `ExtractedDataRepository`; `run(context)` fetches the doc from S3, branches xlsx/pdf, calls AI, persists `ExtractedData`, `this.done({ success })`. Triggered from `document.service.ts` after `register()` (in-process call for MVP, matching "JobRunner ... triggerable via n8n or cron" — actual trigger mechanism left to the user's queue implementation).

**Repository:** `extracted-data.repository.ts` (`extracted_data`).

**Service:** `extraction.service.ts` — orchestrates job invocation, exposes `getBySourceDocument(docId)`.

**Controller:** `extraction.controller.ts` at `/api/extraction` — `POST /:sourceDocumentId/run` (manual re-trigger), `GET /:sourceDocumentId`.

**Angular:** `ExtractionResultComponent` (structured fields + confidence badges, no TB comparison yet — per source doc's Domain 4 demo scope).

**Verification:** upload a bank statement, trigger extraction, confirm `ExtractedData` fields + confidence scores render, independent of any TB comparison.

---

### Domain 5 — Reconciliation Engine

**Purpose:** Compare `ExtractedData` (or a Yardi-exported schedule via the same pipeline, different `docType`) against `TrialBalanceSnapshot`. **This is the core product differentiator.**

**Model** (`model/reconciliation-result.model.ts`): `ReconciliationResult implements BaseModel { oid; tenantId; propertyId; period; extractedDataId; tbAccountNumber; tbBalance; extractedTotal; variance; variancePercent; status: 'auto-tied'|'needs-review'|'discrepancy'; toleranceUsed: { dollar; percent } }`

**Model** (`model/tenant-config.model.ts`): `TenantConfig implements BaseModel { oid; tenantId; varianceTolerance: { dollar: number; percent: number }; docTypeList: DocType[]; coaTemplateRef: uniqueid }` — single global per-tenant tolerance for MVP (per source doc decision).

**Service:** `reconciliation.service.ts` — `reconcile(extractedDataId)`: loads `ExtractedData`, resolves the linked TB account (via `docType`→account-category mapping seeded in Domain 1's COA activation), computes variance against `TenantConfig.varianceTolerance`, sets `status`, persists `ReconciliationResult`. If `status !== 'auto-tied'`, calls into Domain 6 to create a `ReviewItem`.

**AI role here:** for docTypes where the "TB account" isn't a single deterministic number (e.g. free-form schedules), an AI comparison step (same `AICompletionOptions.responseFormat` JSON-schema convention as Domain 4) explains *why* a variance exists — surfaced to the reviewer, not auto-resolving.

**Repository:** `reconciliation-result.repository.ts` (`reconciliation_result`), `tenant-config.repository.ts` (`tenant_config`).

**Controller:** `reconciliation.controller.ts` at `/api/reconciliation` — `GET /:propertyId/:period`, `POST /:extractedDataId/run`, tenant config `GET/PUT /api/tenant-config`.

**Angular:** `ReconciliationSummaryComponent` (per-property/period tie-out status board), `ToleranceConfigComponent`.

**Recommended first `docType` slice (per source doc's open question):** bank statements — direct 1:1 TB mapping, consistent format. Plan explicitly sequences this first; other docTypes follow the same code path.

**Verification:** run reconciliation on a bank statement with a known $0 variance (per the discovery findings, all 4 bank accounts tie exactly) → confirm `auto-tied`; intentionally alter the TB balance → confirm `discrepancy` and a `ReviewItem` is created.

---

### Domain 6 — Review Queue & Workflow

**Purpose:** Human-facing exception queue. Two views (global inbox, contextual side-by-side) over the same underlying data — no duplicated logic (per source doc decision).

**Model** (`model/review-item.model.ts`): `ReviewItem implements BaseModel { oid; tenantId; propertyId; period; reconciliationResultId; status: 'open'|'approved'|'rejected'; comments: { authorId; text; createdAt }[]; assignedTo?; resolvedAt?; resolvedBy? }`

**Model** (`model/extraction-accuracy.model.ts`): `ExtractionAccuracy implements BaseModel { oid; tenantId; reviewItemId; extractedDataId; commentCount: number; wasAiCorrect: boolean /* true iff commentCount === 0 at resolution */ }` — passive log only, written on `ReviewItem` resolution, per source doc decision #5 in Part A.

**Repository:** `review-item.repository.ts` (`review_item`), `extraction-accuracy.repository.ts` (`extraction_accuracy`).

**Service:** `review.service.ts` — `createFromReconciliation(reconciliationResultId)`, `addComment(reviewItemId, userId, text)`, `resolve(reviewItemId, userId, decision)` (writes `ExtractionAccuracy` based on final `comments.length`), `getInbox(tenantId, propertyScope)` (description-only projection), `getDetail(reviewItemId)` (full `ReconciliationResult` + `ExtractedData` + TB side-by-side).

**Controller:** `review.controller.ts` at `/api/review` — `GET /inbox`, `GET /:id`, `POST /:id/comment`, `POST /:id/resolve`.

**Angular:** `ReviewInboxComponent` (global list), `ReviewDetailComponent` (side-by-side, respond/approve — both driven by the same `ReviewService.getDetail` call so the two views share one data source, per the source doc's explicit no-duplication requirement).

**Verification:** force a `discrepancy` reconciliation → confirm it appears in the inbox → open detail view, approve with zero comments → confirm `ExtractionAccuracy.wasAiCorrect = true`; repeat with 1+ comments before resolving → confirm `false`.

---

### Domain 7 — PreClose Checklist

**Purpose:** Digital replacement for the Excel PreClose Checklist tab — manager comment → accountant reply → follow-up loop.

**Model** (`model/checklist-template.model.ts`): `ChecklistTemplate implements BaseModel { oid; tenantId; category: string /* Cash/Escrows, AR/Prepaids/SLR, ... */; items: { key; label; order }[] }`
**Model** (`model/checklist-instance.model.ts`): `ChecklistInstance implements BaseModel { oid; tenantId; propertyId; period; templateId; responses: { itemKey; status: 'yes'|'no'|'na'; assignedTo?; comments: { authorId; text; createdAt }[] }[] }`

**Repository:** `checklist-template.repository.ts` (`checklist_template`), `checklist-instance.repository.ts` (`checklist_instance`).

**Service:** `checklist.service.ts` — `instantiateForPeriod(propertyId, period)` (clones the tenant's template), `updateItemStatus(instanceId, itemKey, status, userId)`, `addComment(instanceId, itemKey, userId, text)`.

**Controller:** `checklist.controller.ts` at `/api/checklist` — `GET /:propertyId/:period`, `POST /instantiate`, `POST /:id/item/:key`, `POST /:id/item/:key/comment`.

**Angular:** `ChecklistComponent` (grouped by category, Yes/No/N/A controls + inline comment thread matching the manager-comment/accountant-reply loop).

**Verification:** instantiate a checklist for a period, mark an item "No" with a manager comment, add an accountant reply, mark resolved "Yes" — confirm full thread persists and is timestamped.

---

### Domain 8 — Period Close Workflow

**Purpose:** `Period` state machine tying Domains 6 & 7 together; manual lock with a non-blocking warning (per source doc decision — loop-back gate informs UI, doesn't hard-block).

**Model** (`model/period.model.ts`): `Period implements BaseModel { oid; tenantId; propertyId; period: string; status: 'open'|'in-review'|'locked'; lockedBy?; lockedAt? }`

**Repository:** `period.repository.ts` (`period`).

**Service:** `period.service.ts` — `getStatusSummary(propertyId, period)` (aggregates open `ReviewItem` count + open checklist items — read-only, doesn't gate), `transition(propertyId, period, newStatus, userId)` (allows `locked` even with open items — the warning is a UI-layer confirmation, not a server-side block, per source doc decision #6 in Part A).

**Controller:** `period.controller.ts` at `/api/period` — `GET /:propertyId/:period`, `POST /:propertyId/:period/transition`.

**Angular:** `PeriodCloseComponent` (status dashboard: open review items + checklist items + a "Lock Period" button that shows a stern confirmation modal listing outstanding items before submitting the transition).

**Verification:** with open `ReviewItem`s and checklist items outstanding, attempt to lock → confirm warning modal lists them → confirm lock still succeeds on confirmation.

---

### Domain 9 — Notifications

**Purpose:** Mandrill-triggered emails for checklist assignment, stale review items, period locked. Cross-cutting, wired in last.

**Service:** `notification.service.ts` — wraps `EmailService.sendEmail` (reusing the exact pattern in `server/service/auth.service.ts`'s login-code email), no new queuing infrastructure (existing single-retry-on-5xx in `EmailService.post` is sufficient for MVP). Methods: `notifyChecklistAssigned(instanceId, itemKey, userId)`, `notifyReviewItemStale(reviewItemId)` (age threshold from `TenantConfig` or a fixed default), `notifyPeriodLocked(propertyId, period)`.

**Trigger points:** called directly from `checklist.service.ts` (on assignment), `period.service.ts` (on lock transition); the "stale review item" check is a periodic sweep — implemented as a `Job` (`server/jobs/stale-review.job.ts`) left to the user's own scheduling mechanism, consistent with the Domain 4 job-queue note.

**Controller:** none required — notifications are triggered server-side, not user-invoked endpoints.

**Verification:** assign a checklist item → confirm email received (or redirected to `Config.EMAIL.admin` in non-release env, per existing `EmailService` safety net); lock a period → confirm notification email logged in `email_log`.

---

## Key Patterns Reused (applies across all 9 domains)

| Pattern | Source |
|---|---|
| `@Injectable() @Bootstrap()` on repo/service/job, constructor-injected deps | every existing repository/service/job |
| Plain `extends BaseRepository` — tenant scoping is automatic via `DeployConfig.INJECTED_TENANT_ID` + `DatabaseContext.setTenant()`, no special base class | `server/repository/base.repository.ts`, `server/database/context.ts` |
| `context.update(query, obj, null, { upsert: true })` | `server/repository/invite.repository.ts:20` |
| Controllers never call repositories directly, only services | CLAUDE.md + `api.controller.ts` |
| New controller registered in `Router.init()`'s `RouteInfo[]` | `server/router/router.ts` |
| `AIService.executeConversation`/`executeFunctionCall` + `responseFormat: json_schema` | `server/service/ai/base-ai.service.ts`, `model/ai.model.ts:271-277` |
| `S3Service.getUploadInfo` (presigned direct upload), `getRawObjectByUrl` (fetch for AI) | `server/service/s3.service.ts` |
| `xlsx.fileToWorksheets(buffer, true)` | `server/lib/xlsx/xlsx.utility.ts` |
| `EmailService.sendEmail` + non-release safe-redirect | `server/service/auth.service.ts` login-code email |
| `Job extends ... run(context) { this.done({...}) }` | `server/jobs/onboard.job.ts` |
| Angular: `BaseComponent`/`BaseService`, `Routes` array, `Cache` for client-side state | `ui/src/app/component/base.component.ts`, `ui/src/app/service/auth.service.ts` |

## Verification (for this planning task itself)

Once approved, I'll write the 9 files listed above to `.claude/plans/accounting-platform/`, matching the depth/format of `.claude/plans/invite-user.md` (concrete field lists, method signatures, code where it clarifies a non-obvious pattern, a verification checklist per domain). No code will be modified in the actual application — this is a documentation/planning deliverable only.
