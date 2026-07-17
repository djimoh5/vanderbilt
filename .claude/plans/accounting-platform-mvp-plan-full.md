# Vanderbilt Property Accounting Automation Platform — MVP Plan

*Full version with project background, for use as Claude Code context.*

---

## Part A — Executive Summary / Project Background

### The client and the problem

We are building accounting automation software for a client, Vanderbilt (a commercial real estate operator/property management company). The immediate working example throughout discovery has been **Northbridge Centre** (Yardi property code `pbnor001`), a 294,493 SF office property in West Palm Beach, FL, owned by Northbridge Property Owner LLC. Vanderbilt manages this and other properties through **Yardi**, the industry-standard property management/accounting ERP. Yardi is the system of record (the General Ledger); everything reviewed so far has been the accountant's *month-end close workpapers* — Excel files built around Yardi exports, not the ERP itself.

The eventual goal is a SaaS platform that could serve Vanderbilt and potentially other property management companies with a similar workflow ("Vanderbilt-like" customers), not just a single-client tool.

### What we learned about their accounting process

**Vocabulary established (for context — developer is not an accountant but knows basics):**
- **General Ledger (GL)** — the permanent transaction record, lives in Yardi.
- **Chart of Accounts (COA)** — the numbered account classification system.
- **Trial Balance (TB)** — a period snapshot of every GL account's balance; the anchor everything else reconciles to.
- **Schedule** (aka supporting schedule/workpaper) — a separate calculation justifying why an account balance is what it is. Some are Yardi-generated (Rent Roll, AR Aging, AP Aging, Fixed Assets, Job Cost, Retainage, Security Deposits), others are manual (Escrows, Prepaid Insurance, Prepaid Tax, AR-Other, AP-Other, Accrued Expenses, Mortgage, Sales Tax, Contribution/Distribution, Parking Revenue, Internal Rent, Management Fee detail, Deferred Maintenance, Billbacks).
- **Tie out / reconcile** — confirming a schedule's total matches its TB account balance. This is the core discipline of the close.
- **Month-end close** — finalizing a period's books; checklist-driven, two-tier (Jorge = accountant, Eric = reviewer).
- **Accrual basis** — Northbridge books on accrual.

**The two-tier close process:**
1. Yardi generates period-end reports (TB, Budget Comparison, Rent Roll, AR/AP Aging, Fixed Assets).
2. The accountant builds/updates manual schedules from outside documents (insurance invoices, loan statements, parking reports, tax bills).
3. Every schedule — Yardi-generated or manual — gets reconciled to its TB account.
4. A **PreClose Checklist** is worked through by category (Cash/Escrows, AR/Prepaids/SLR, AP/Accrued Expenses, Debt/Equity/Sales Tax, GL review, CapEx/Fixed Assets/TI-LC), each item marked Yes/No/N/A.
5. **Critical control — the loop-back / verify-until-clean gate:** if any tie-out fails or a checklist item is "No," it triggers Manager Comment → Accountant Reply → Follow-up, and the item goes back through reconciliation until resolved. Nothing proceeds until everything ties out and the reviewer signs off. **This loop-back mechanism was flagged early on as the single most important insight for software scoping** — it's not a linear pipeline, it needs state tracking, an audit trail of who commented/replied, and a hard stop gating downstream work.
6. Only after clean sign-off does the **Reporting Package** get assembled (Exec Summary, Stacking Plan, Leasing Reports, Balance Sheet, Budget Comparison w/ and w/o straight-line rent, 12-month statement, Tenancy Schedule, Aged Delinquencies, AP Aging, Accrued Expenses Detail, Payment Register, TI/LC Schedule, Bank Statements/Reconciliations, Lender Escrow Reconciliation, Management Fee Calculation).

### What we found in the actual files

- Built a full **Chart of Accounts map** from the TB tab: 666 total accounts in the portfolio-wide COA template, only ~143 (~21%) active/non-zero for Northbridge specifically — confirming the COA is shared across Vanderbilt's whole portfolio, not built per-property. Categorized by statement type, category, subcategory, and likely Yardi-vs-manual source. Delivered as a formatted Excel workbook (Full COA tab + Category Summary tab).
- Found the **TB tab's "Link to Schedule" column is broken** — most cells throw `#REF!` errors, meaning the automated tie-out between TB and supporting schedules is currently non-functional in the workbook, and someone is presumably reconciling manually instead. This is a concrete pain point around fragile Excel-based tooling.
- Also found a **noteworthy structural quirk**: a large "Investments in Real Estate" account block (accounts 1710–1712) inside Northbridge's TB that's actually entity/portfolio-level (investments in ~33 other named properties), not Northbridge-specific — worth asking the client about directly.
- Confirmed via a **complete, valid Reporting Package PDF** (a re-upload after an earlier corrupted/mislabeled export) that the underlying reconciliation controls *do* work correctly when not blocked by broken tooling — e.g., the Lender Escrow Reconciliation ties the loan servicer's statement to the GL exactly (zero variance), and all four bank accounts reconcile to $0.00 difference. This is an important distinction: **the accounting process/controls are sound; it's specifically the Excel automation (formula links) that's broken.**
- Reviewed the **Management Fee Calculation** detail — a manual, transaction-level schedule (every tenant receipt feeding a 3% fee-pool calculation) — as an example of what "manual schedule" means in practice at Vanderbilt.
- Built a Mermaid flowchart of the full close process reflecting the loop-back gate structure described above.
- Produced a discovery question list for the actual Vanderbilt meeting, organized around: time sinks, communication breakdowns, data/system reliability, and risk/control — with a rough effort/impact hypothesis framework (e.g., fixing the broken TB-to-schedule tie-out and digitizing the checklist as likely low-effort/high-impact; Management Fee automation and a unified schedule repository as higher-effort/high-impact).

### Client meeting outcome — direction for the software

Following the client meeting, key scoping decisions were made:

1. **Management Fee calculation is explicitly out of scope for now** — not part of MVP.
2. **The manual-schedule automation focus is document ingestion + AI-based extraction/OCR**, not manual schedule-building UI. Documents (bank statements, mortgage statements, etc.) are uploaded and the system extracts structured data automatically.
3. **The core product goal: take ~90% of the "does this tie out" review process away from humans and make it AI-driven.** Both Yardi-generated schedules and manual-document-derived schedules get compared against the TB by the same AI-driven reconciliation logic; only exceptions surface to a human reviewer.
4. **Multi-property and multi-tenant from day one** — this may become a SaaS platform sold to multiple property-management companies, not just Vanderbilt.
5. Documents are mostly **Excel and PDF, downloaded directly from bank/lender portals** (not scanned paper).
6. **Yardi integration for MVP is manual Excel export/upload** (download from Yardi, upload to the platform); direct Yardi API integration is a future phase but the architecture should not need rework to add it later (just a new extraction source).

### Developer's existing base architecture (all new work builds on this)

- **Stack:** Angular, TypeScript, Node.js, Express, MongoDB.
- Already has: API controller/routing layer, base authentication endpoints (login, registration, forgot password), a **base repository + DbContext service pattern**, a **JobRunner pattern with queue + retry/dead-letter logic** (triggerable via n8n or cron), an **AI layer already connected to ChatGPT, Gemini, and Claude** (model selectable per use case), a **LlamaIndex-based RAG pipeline** (likely not needed for MVP), and a **Mandrill API service** for transactional email.
- **Storage preference: AWS S3, all the way.**
- **Multi-tenancy pattern:** shared collections (not DB-per-tenant) with `tenantId` on *every* document — even ones already scoped by `propertyId` — so tenant isolation can be enforced at the database query construction level as a blanket rule, not per-collection logic. Resolved from a session `tenantId` header via existing auth middleware, consistent with developer's typical SaaS pattern.
- **Single Angular app** (not per-tenant builds), with a tenant/property switcher in-app.

### Key architectural decisions made during planning

- **Excel extraction is NOT deterministic/pre-coded per format.** Given real-world variation in bank/lender export formats, the correct approach is: generic raw parse via a Node xlsx library (no layout assumptions) → send the raw structured dump to the AI layer along with a `docType` hint → AI performs the actual field interpretation/normalization. This mirrors the PDF path (AI OCR/extraction), so **Excel and PDF converge into the same AI-interpretation step** and produce the same normalized `ExtractedData` output — confidence scoring applies uniformly to both.
- **Doc type is user-selected at upload** for MVP (not auto-classified) — auto-classification deferred to post-MVP.
- **Reconciliation tolerance is a single global per-tenant setting** (dollar + percent) for MVP, not per-account-category — category-level tolerance is a future refinement.
- **Document versioning on re-upload** (not overwrite) — cheap in S3, preserves the audit trail the PreClose Checklist process already cares about.
- **"AI accuracy" signal is inferred from human review behavior**, not a separate rating step: if a reviewer approves a `ReviewItem` with **zero comments**, that's logged as an implicit "AI was correct" signal; if there's back-and-forth (1+ comments) before approval/rejection, that's logged as "AI needed correction." Captured via a lightweight `ExtractionAccuracy` log — not used for anything active in MVP, but cheap to capture now and seeds future confidence-threshold tuning.
- **Review Queue has two linked views**: a global inbox (all open `ReviewItem`s across the user's property scope, description-only, for fast triage) and a contextual/inline view (reached by clicking through, or by navigating to the specific schedule/TB account) showing the full side-by-side source-document-vs-TB comparison with respond/approve actions. Both render the same underlying `ReviewItem` + `ReconciliationResult` data — no duplicated logic.
- **Period locking is a manual action, not auto-gated.** A property's `Period` can be locked even with unresolved `ReviewItem`s or checklist items outstanding, but the UI must show a stern warning before allowing it — this preserves human judgment/override while still surfacing risk.
- **JobRunner already has retry/dead-letter handling** — the extraction pipeline should use the existing pattern rather than defining its own failure handling.

---

## Part B — MVP Plan

### 1. Goals

- Replace the Excel-based month-end close workpaper process with a system that automatically reconciles supporting schedules to the Trial Balance.
- Take ~90% of the manual "does this tie out" review off the accountant/reviewer by having AI perform the comparison, and only surface exceptions to a human.
- Support multiple properties per tenant, and multiple tenants (SaaS-ready) from day one.
- Build on existing base architecture: Angular / TypeScript / Node / Express / MongoDB, existing repository + DbContext layer, existing auth, existing JobRunner (with retry/dead-letter), existing AI layer (ChatGPT/Gemini/Claude), existing Mandrill email service, AWS S3 for storage.

### 2. Architecture Summary

- **Multi-tenancy:** shared collections, `tenantId` on every document, resolved from session tenantId via existing auth middleware. All queries scoped by `tenantId` (+ `propertyId` where applicable) at the repository level.
- **Storage:** S3, keyed `{tenantId}/{propertyId}/{period}/{docId}.{ext}`, with versioning on re-upload.
- **Async processing:** existing JobRunner (queue + retry/dead-letter) triggers extraction jobs; can be invoked via upload event or n8n/cron schedule.
- **AI layer:** existing multi-model connector (Claude/GPT/Gemini). Used for (a) interpreting raw-parsed Excel data, (b) OCR/extraction from PDFs, (c) reconciliation comparison logic. Both Excel and PDF extraction converge into the same AI interpretation step — Excel gets a deterministic raw parse first (cheap), PDF goes straight to AI OCR, but both produce the same normalized `ExtractedData` shape.
- **Client:** single Angular app, tenant/property switcher in-app

### 3. Core Data Model (all collections carry `tenantId`; most carry `propertyId`)

| Collection | Purpose |
|---|---|
| `Tenant` | Paying customer (e.g., a property management company) |
| `Property` | A managed property, belongs to a Tenant |
| `User` | Belongs to a Tenant, roles scoped per-property |
| `ChartOfAccount` | Per-tenant COA (seeded from a platform starter template) |
| `AccountActivation` | Per-property activation/category of a COA account |
| `TrialBalanceSnapshot` | Per-property, per-period TB (imported) |
| `SourceDocument` | Uploaded file (xlsx/pdf), S3 key, docType, period, versioned |
| `ExtractionJob` | JobRunner-tracked job: raw-parse and/or AI interpretation |
| `ExtractedData` | Normalized structured output + per-field confidence |
| `ReconciliationResult` | ExtractedData vs. TB account: variance + status |
| `ReviewItem` | Human-facing queue record, links to a ReconciliationResult, has comment thread |
| `ExtractionAccuracy` | Passive log: was a ReviewItem approved with no comments (AI correct) or corrected (AI wrong) |
| `ChecklistTemplate` / `ChecklistInstance` | PreClose Checklist, per property per period, question-level status + comment threads |
| `Period` | Close state machine per property: Open / In Review / Locked |
| `TenantConfig` | Per-tenant settings: variance tolerance ($ + %), doc-type list, COA template ref |

### 4. MVP Feature Domains (build order)

#### Domain 1 — Tenant / Property / Foundation
Extends existing auth. Tenant model, Property CRUD, role scoping per property, COA template seeding into a tenant's working COA, account activation per property.
*Demoable on its own:* an admin can stand up a new tenant, add properties, and configure a COA.

#### Domain 2 — Trial Balance Import
CSV/Excel upload of a TB snapshot per property per period. Intentionally simple (structured import, not the AI pipeline) since TB itself is the anchor everything else compares against.
*Demoable:* upload a TB, see it rendered per-account, per-period.

#### Domain 3 — Document Management
`SourceDocument` upload (xlsx/pdf) with docType selection, S3 storage, versioning on re-upload, property/period tagging.
*Demoable:* upload a bank statement or mortgage statement, see it listed and downloadable.

#### Domain 4 — Extraction Pipeline
JobRunner-triggered extraction: generic raw xlsx parse or PDF OCR, both feeding into AI interpretation using `docType` as a hint. Produces `ExtractedData` with per-field confidence.
*Demoable:* upload a document, see structured extracted fields with confidence scores, without any TB comparison yet.

#### Domain 5 — Reconciliation Engine
Compares `ExtractedData` (from Domain 4) or a Yardi-exported schedule (same pipeline, different docType) against the relevant `TrialBalanceSnapshot` account. Applies single global tenant tolerance ($ + %) from `TenantConfig`. Produces `ReconciliationResult` with status: auto-tied / needs-review / discrepancy.
*Demoable:* the core "does this tie out" logic runs end-to-end for one doc type (recommend starting with bank statements, given format consistency and direct TB mapping).
**This is the core product differentiator — everything before it is plumbing, everything after it is workflow around it.**

#### Domain 6 — Review Queue & Workflow
`ReviewItem` generation from non-auto-tied `ReconciliationResult`s. Two views: global inbox (description-only list across properties in scope) and contextual view (side-by-side source doc data vs. TB, with respond/approve). Comment thread on each item. `ExtractionAccuracy` logging based on comment count at resolution (0 comments = implicit AI-correct signal).
*Demoable:* the full "surface exception → human resolves" loop.

#### Domain 7 — PreClose Checklist
Digital version of the existing checklist: template + per-period instance, question-level Yes/No/N/A, assignee, comment thread (manager comment → accountant reply → resolution).
*Demoable:* replaces the current Excel checklist tab with a trackable, timestamped equivalent.

#### Domain 8 — Period Close Workflow
`Period` state machine (Open → In Review → Locked) per property. Locking is a manual action; if unresolved `ReviewItem`s or checklist items exist, show a stern warning but allow lock. Ties Domains 6 and 7 together into a single close status view.
*Demoable:* the full month-end close lifecycle, from open period to locked period, with all remaining open items visible before lock.

#### Domain 9 — Notifications
Mandrill-triggered emails: checklist item assigned, review item pending too long, period locked. Cross-cutting, wired in once Domains 6–8 exist.

### 5. Post-MVP (Tier 2 / Tier 3 — not sequenced yet)

- Additional doc types beyond bank/mortgage statements (insurance, tax bills, AP invoices)
- AI-drafted variance commentary (human-approved) for Budget Comparison
- Reporting Package auto-assembly
- Yardi API integration (replacing manual Excel export/upload) — architecture already supports this as a new `extractorType`/source, so it's additive, not a rework
- Confidence threshold auto-tuning using the `ExtractionAccuracy` log
- Category-level (vs. global) variance tolerance
- Multi-tenant admin/billing layer if pursuing external SaaS sale
- Management Fee calculation automation (explicitly deferred, not MVP)
- Auto-classification of document type at upload (vs. user-selected)

### 6. Open Questions / Assumptions Log

- Which doc type should Domain 5 (Reconciliation Engine) target first for the initial demoable slice — bank statements assumed as the starting point given format consistency, but worth confirming as implementation begins.
- DB-per-tenant vs. shared-collection multi-tenancy: shared collections confirmed for MVP; revisit if enterprise data-isolation requirements emerge.
- Exact confidence/variance threshold values (the numeric tolerance itself) not yet defined — architecture supports configurability, but starting defaults need to be set.
