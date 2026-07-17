# Plan: Domain 5 — Reconciliation Engine

## Context

Compares `ExtractedData` (Domain 4) — or a Yardi-exported schedule via the same pipeline, just a different `docType` — against the `TrialBalanceSnapshot` (Domain 2). **This is the core product differentiator**: everything before it is plumbing, everything after it is workflow around it. Tenant scoping is automatic (Domain 1) — no `tenantId` argument anywhere in this domain.

**Demoable outcome:** the core "does this tie out" logic runs end-to-end for one doc type. Recommended starting slice: **bank statements** — direct 1:1 TB mapping, consistent format, and per the discovery findings, all four Northbridge bank accounts are known to reconcile to exactly $0.00 variance, making them a clean end-to-end test case.

---

## Files to Create

### 1. `model/tenant-config.model.ts`

```typescript
import { BaseModel } from './shared.model';
import { uniqueid } from './id.model';
import { DocType } from './source-document.model';

export class TenantConfig implements BaseModel {
    oid?: uniqueid;
    varianceTolerance: { dollar: number; percent: number };
    docTypeList: DocType[];
    coaTemplateRef?: uniqueid;
}
```

Single global per-tenant tolerance for MVP (per source doc decision) — not per-account-category.

### 2. `model/reconciliation-result.model.ts`

```typescript
import { BaseModel } from './shared.model';
import { uniqueid } from './id.model';

export enum ReconciliationStatus { AutoTied = 'auto-tied', NeedsReview = 'needs-review', Discrepancy = 'discrepancy' }

export class ReconciliationResult implements BaseModel {
    oid?: uniqueid;
    propertyId: uniqueid;
    period: string;
    extractedDataId: uniqueid;
    tbAccountNumber: string;
    tbBalance: number;
    extractedTotal: number;
    variance: number;
    variancePercent: number;
    status: ReconciliationStatus;
    toleranceUsed: { dollar: number; percent: number };
    aiExplanation?: string; // populated only when the AI comparison step runs (non-deterministic doc types)
}
```

### 3. `server/repository/tenant-config.repository.ts`

Collection: `tenant_config`.

```typescript
@Injectable()
@Bootstrap()
export class TenantConfigRepository extends BaseRepository {
    constructor() { super('tenant_config'); }

    get(): Promise<TenantConfig> { return this.context.findOne({}); }
    save(config: TenantConfig): Promise<TenantConfig> { return super.updateObject(config); }
}
```

One document per tenant — `get()` needs no query filter beyond the automatic tenant scoping, since there's exactly one config row per tenant.

### 4. `server/repository/reconciliation-result.repository.ts`

Collection: `reconciliation_result`.

```typescript
@Injectable()
@Bootstrap()
export class ReconciliationResultRepository extends BaseRepository {
    constructor() { super('reconciliation_result'); }

    getByPropertyPeriod(propertyId: uniqueid, period: string): Promise<ReconciliationResult[]> {
        return this.context.find({ propertyId, period });
    }

    getByExtractedData(extractedDataId: uniqueid): Promise<ReconciliationResult> {
        return this.context.findOne({ extractedDataId });
    }

    save(result: ReconciliationResult): Promise<ReconciliationResult> {
        return this.context.update({ extractedDataId: result.extractedDataId }, result, null, { upsert: true });
    }
}
```

### 5. `server/service/reconciliation.service.ts`

```typescript
@Injectable()
@Bootstrap()
export class ReconciliationService extends BaseService {
    constructor(
        appService: AppService,
        private reconciliationResultRepository: ReconciliationResultRepository,
        private tenantConfigRepository: TenantConfigRepository,
        private extractedDataRepository: ExtractedDataRepository,
        private trialBalanceRepository: TrialBalanceRepository,
        private accountActivationRepository: AccountActivationRepository,
        private reviewService: ReviewService, // Domain 6
        private aiService: AIService
    ) { super(appService); }

    async reconcile(extractedDataId: uniqueid): Promise<ApiResponse<ReconciliationResult>> {
        const extracted = await this.extractedDataRepository.getById(extractedDataId);
        const config = await this.tenantConfigRepository.get();
        const tb = await this.trialBalanceRepository.getByPropertyPeriod(extracted.propertyId, this.currentPeriod(extracted));

        const tbAccountNumber = this.resolveAccountForDocType(extracted.docType);
        const tbLine = tb.accounts.find(a => a.accountNumber === tbAccountNumber);
        const extractedTotal = this.sumRelevantFields(extracted);

        const variance = extractedTotal - tbLine.balance;
        const variancePercent = tbLine.balance !== 0 ? Math.abs(variance / tbLine.balance) : (variance !== 0 ? 1 : 0);

        const withinTolerance = Math.abs(variance) <= config.varianceTolerance.dollar || variancePercent <= config.varianceTolerance.percent;

        const result = new ReconciliationResult();
        result.oid = UniqueId(Common.uniqueId());
        result.propertyId = extracted.propertyId;
        result.period = this.currentPeriod(extracted);
        result.extractedDataId = extractedDataId;
        result.tbAccountNumber = tbAccountNumber;
        result.tbBalance = tbLine.balance;
        result.extractedTotal = extractedTotal;
        result.variance = variance;
        result.variancePercent = variancePercent;
        result.toleranceUsed = config.varianceTolerance;
        result.status = withinTolerance ? ReconciliationStatus.AutoTied : ReconciliationStatus.Discrepancy;

        if (!withinTolerance && this.isNonDeterministicDocType(extracted.docType)) {
            result.aiExplanation = await this.explainVarianceWithAI(extracted, tbLine);
        }

        await this.reconciliationResultRepository.save(result);

        if (result.status !== ReconciliationStatus.AutoTied) {
            await this.reviewService.createFromReconciliation(result.oid);
        }

        return new ApiResponse(true, result);
    }

    getByPropertyPeriod(propertyId: uniqueid, period: string): Promise<ReconciliationResult[]> {
        return this.reconciliationResultRepository.getByPropertyPeriod(propertyId, period);
    }

    getTenantConfig(): Promise<TenantConfig> { return this.tenantConfigRepository.get(); }

    async updateTenantConfig(dollar: number, percent: number): Promise<ApiResponse<TenantConfig>> {
        let config = await this.tenantConfigRepository.get();
        if (!config) { config = new TenantConfig(); config.oid = UniqueId(Common.uniqueId()); }
        config.varianceTolerance = { dollar, percent };
        await this.tenantConfigRepository.save(config);
        return new ApiResponse(true, config);
    }

    private resolveAccountForDocType(docType: DocType): string {
        // docType → TB account mapping, seeded via Domain 1's AccountActivation/ChartOfAccount category tagging
        // e.g. DocType.BankStatement → the property's active 'Cash' category account(s)
        throw new Error('not yet implemented — depends on category mapping seeded in Domain 1');
    }

    private sumRelevantFields(extracted: ExtractedData): number {
        // e.g. for a bank statement, sum the 'endingBalance' field; docType-specific field selection
        return extracted.fields.find(f => f.name === 'endingBalance')?.value as number || 0;
    }

    private isNonDeterministicDocType(docType: DocType): boolean {
        return ![DocType.BankStatement, DocType.MortgageStatement].includes(docType);
    }

    private async explainVarianceWithAI(extracted: ExtractedData, tbLine: TrialBalanceAccountLine): Promise<string> {
        const conversation = new AIConversation(extracted.oid, {
            role: 'system',
            content: 'You are reconciling a supporting schedule against a Trial Balance account. Explain in one or two sentences why the balances might differ, given the extracted fields and the TB balance.'
        });
        conversation.add({ role: 'user', content: JSON.stringify({ extractedFields: extracted.fields, tbBalance: tbLine.balance }) });

        const message = await this.aiService.executeConversation(conversation, { model: 'gpt-5-mini' }, extracted.propertyId as any);
        return message.content as string;
    }

    private currentPeriod(extracted: ExtractedData): string {
        // period isn't currently on ExtractedData — either add it there (propagated from SourceDocument at extraction time)
        // or look it up via extracted.sourceDocumentId. Flagging as an implementation detail to settle, not a blocker.
        throw new Error('see note above');
    }
}
```

*Two implementation details intentionally left open (marked with `throw`/comments above) since they depend on decisions made while building Domain 1's COA category tagging and Domain 4's `ExtractedData` shape: (1) the exact `docType` → TB account-category mapping, (2) whether `period` is propagated onto `ExtractedData` directly or looked up via its `SourceDocument`. Neither changes this domain's overall shape.*

### 6. `server/controller/reconciliation.controller.ts`

```typescript
@Injectable()
@Bootstrap()
export class ReconciliationController extends BaseController {
    constructor(private reconciliationService: ReconciliationService) { super(); }

    async init(_req: Request) {}

    @Get(':propertyId/:period')
    async getByPropertyPeriod(req: Request, res: Response) {
        const data = await this.reconciliationService.getByPropertyPeriod(UniqueId(req.query.propertyId), req.query.period);
        this.sendSuccess(res, data);
    }

    @Post(':extractedDataId/run')
    async run(req: Request, res: Response) {
        const data = await this.reconciliationService.reconcile(UniqueId(req.query.extractedDataId));
        res.send(data);
    }
}
```

### 7. `server/controller/tenant-config.controller.ts`

```typescript
@Injectable()
@Bootstrap()
export class TenantConfigController extends BaseController {
    constructor(private reconciliationService: ReconciliationService) { super(); }

    async init(_req: Request) {}

    @Get('')
    async get(_req: Request, res: Response) {
        const data = await this.reconciliationService.getTenantConfig();
        this.sendSuccess(res, data);
    }

    @Post('')
    async update(req: Request, res: Response) {
        const { dollar, percent } = req.body;
        const data = await this.reconciliationService.updateTenantConfig(dollar, percent);
        res.send(data);
    }
}
```

---

## Files to Modify

### `server/router/router.ts`

Add `{ path: `${this.getBaseUrl()}/reconciliation`, controller: ReconciliationController }` and `{ path: `${this.getBaseUrl()}/tenant-config`, controller: TenantConfigController }`.

---

## Angular

### `ui/src/app/service/reconciliation.service.ts`

```typescript
@Injectable()
export class ReconciliationService extends BaseService {
    constructor(apiService: ApiService, appService: AppService) { super(apiService, appService, ''); }

    getByPropertyPeriod(propertyId: string, period: string): Promise<ApiResponse<ReconciliationResult[]>> {
        return this.get(`reconciliation/${propertyId}/${period}`);
    }

    run(extractedDataId: string): Promise<ApiResponse<ReconciliationResult>> {
        return this.post(`reconciliation/${extractedDataId}/run`, {});
    }
}
```

### Components

- `ReconciliationSummaryComponent` — per-property/period tie-out status board: one row per `docType`/account, status badge (auto-tied / needs-review / discrepancy), variance amount.
- `ToleranceConfigComponent` — dollar + percent tolerance inputs, calls `GET`/`POST /api/tenant-config`.

Routes: `{ path: 'reconciliation/:propertyId/:period', component: ReconciliationSummaryComponent }`, `{ path: 'settings/tolerance', component: ToleranceConfigComponent }`.

---

## Key Patterns Reused

| What | Where |
|------|-------|
| `AIService.executeConversation` (variance explanation, non-deterministic doc types) | `server/service/ai/base-ai.service.ts` |
| Upsert-on-natural-key (`extractedDataId`) | `server/repository/invite.repository.ts:20` pattern |
| Automatic tenant scoping — no `tenantId` in any method here | Domain 1 |
| `Domain 4`'s `ExtractedData` as the sole input to reconciliation | Domain 4 |

## Verification

1. Set tenant tolerance to `{ dollar: 0, percent: 0 }`, run reconciliation on a bank statement `ExtractedData` whose `endingBalance` exactly matches the TB cash account balance → confirm `status: 'auto-tied'`.
2. Alter the TB balance (or the extracted value) to create a $50 variance → confirm `status: 'discrepancy'` and a `ReviewItem` is created (Domain 6).
3. Loosen tolerance to `{ dollar: 100, percent: 0 }` and re-run the same $50-variance case → confirm `status: 'auto-tied'` this time.
4. Run reconciliation on a non-deterministic doc type (e.g. an insurance schedule) with a variance → confirm `aiExplanation` is populated on the `ReconciliationResult`.
5. `GET /api/reconciliation/:propertyId/:period` → confirm all reconciled accounts for the period render on `ReconciliationSummaryComponent`.
6. As a user in a different tenant, confirm `GET /api/tenant-config` returns that tenant's own tolerance, not the first tenant's (automatic isolation, single-document-per-tenant collection).
