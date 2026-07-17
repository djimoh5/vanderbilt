# Plan: Domain 6 — Review Queue & Workflow

## Context

Human-facing exception queue: `ReviewItem` records are generated from non-auto-tied `ReconciliationResult`s (Domain 5). Two views — a global inbox and a contextual side-by-side detail — render the **same** underlying data (no duplicated logic, per source doc decision). `ExtractionAccuracy` is a passive log capturing whether a reviewer resolved an item with zero comments (implicit "AI was correct" signal) or with back-and-forth (implicit "AI needed correction"). Tenant scoping is automatic (Domain 1).

**Demoable outcome:** the full "surface exception → human resolves" loop.

---

## Files to Create

### 1. `model/review-item.model.ts`

```typescript
import { BaseModel } from './shared.model';
import { authid, uniqueid } from './id.model';

export enum ReviewItemStatus { Open = 'open', Approved = 'approved', Rejected = 'rejected' }

export interface ReviewComment {
    authorId: authid;
    text: string;
    createdAt: number;
}

export class ReviewItem implements BaseModel {
    oid?: uniqueid;
    propertyId: uniqueid;
    period: string;
    reconciliationResultId: uniqueid;
    status: ReviewItemStatus;
    comments: ReviewComment[];
    assignedTo?: authid;
    createdAt: number;
    resolvedAt?: number;
    resolvedBy?: authid;
}
```

### 2. `model/extraction-accuracy.model.ts`

```typescript
import { BaseModel } from './shared.model';
import { uniqueid } from './id.model';

export class ExtractionAccuracy implements BaseModel {
    oid?: uniqueid;
    reviewItemId: uniqueid;
    extractedDataId: uniqueid;
    commentCount: number;
    wasAiCorrect: boolean; // true iff commentCount === 0 at resolution
    resolvedAt: number;
}
```

Passive log only — not used for anything active in MVP (per source doc), cheap to capture now for future confidence-threshold tuning.

### 3. `server/repository/review-item.repository.ts`

Collection: `review_item`.

```typescript
@Injectable()
@Bootstrap()
export class ReviewItemRepository extends BaseRepository {
    constructor() { super('review_item'); }

    getById(id: uniqueid): Promise<ReviewItem> { return this.context.findOne({ oid: id }); }

    getOpenInbox(propertyIds?: uniqueid[]): Promise<ReviewItem[]> {
        const query: any = { status: ReviewItemStatus.Open };
        if (propertyIds?.length) { query.propertyId = { $in: propertyIds }; }
        return this.context.find(query, null, { sort: { createdAt: -1 } } as any);
    }

    save(item: ReviewItem): Promise<ReviewItem> { return super.updateObject(item); }
}
```

`propertyIds` scoping is for the user's own property-role assignments (Domain 1's `PropertyRole`) — a reviewer only sees properties they have a role on; tenant isolation itself is still automatic underneath this filter, not a replacement for it.

### 4. `server/repository/extraction-accuracy.repository.ts`

Collection: `extraction_accuracy`.

```typescript
@Injectable()
@Bootstrap()
export class ExtractionAccuracyRepository extends BaseRepository {
    constructor() { super('extraction_accuracy'); }

    save(log: ExtractionAccuracy): Promise<ExtractionAccuracy> { return super.updateObject(log); }
}
```

### 5. `server/service/review.service.ts`

```typescript
@Injectable()
@Bootstrap()
export class ReviewService extends BaseService {
    constructor(
        appService: AppService,
        private reviewItemRepository: ReviewItemRepository,
        private extractionAccuracyRepository: ExtractionAccuracyRepository,
        private reconciliationResultRepository: ReconciliationResultRepository,
        private extractedDataRepository: ExtractedDataRepository,
        private trialBalanceRepository: TrialBalanceRepository,
        private propertyRoleRepository: PropertyRoleRepository
    ) { super(appService); }

    async createFromReconciliation(reconciliationResultId: uniqueid): Promise<ReviewItem> {
        const result = await this.reconciliationResultRepository.getById(reconciliationResultId as any);

        const item = new ReviewItem();
        item.oid = UniqueId(Common.uniqueId());
        item.propertyId = result.propertyId;
        item.period = result.period;
        item.reconciliationResultId = reconciliationResultId;
        item.status = ReviewItemStatus.Open;
        item.comments = [];
        item.createdAt = Date.now();

        await this.reviewItemRepository.save(item);
        return item;
    }

    async getInbox(userId: authid): Promise<ApiResponse<ReviewItem[]>> {
        const roles = await this.propertyRoleRepository.getByUser(userId);
        const propertyIds = roles.filter(r => r.propertyId).map(r => r.propertyId);
        const items = await this.reviewItemRepository.getOpenInbox(propertyIds.length ? propertyIds : undefined);
        return new ApiResponse(true, items);
    }

    async getDetail(reviewItemId: uniqueid): Promise<ApiResponse<{ item: ReviewItem, reconciliation: ReconciliationResult, extracted: ExtractedData, tbLine: TrialBalanceAccountLine }>> {
        const item = await this.reviewItemRepository.getById(reviewItemId);
        const reconciliation = await this.reconciliationResultRepository.getById(item.reconciliationResultId as any);
        const extracted = await this.extractedDataRepository.getById(reconciliation.extractedDataId);
        const tb = await this.trialBalanceRepository.getByPropertyPeriod(item.propertyId, item.period);
        const tbLine = tb.accounts.find(a => a.accountNumber === reconciliation.tbAccountNumber);

        return new ApiResponse(true, { item, reconciliation, extracted, tbLine });
    }

    async addComment(reviewItemId: uniqueid, userId: authid, text: string): Promise<ApiResponse<ReviewItem>> {
        const item = await this.reviewItemRepository.getById(reviewItemId);
        item.comments.push({ authorId: userId, text, createdAt: Date.now() });
        await this.reviewItemRepository.save(item);
        return new ApiResponse(true, item);
    }

    async resolve(reviewItemId: uniqueid, userId: authid, decision: 'approved' | 'rejected'): Promise<ApiResponse<ReviewItem>> {
        const item = await this.reviewItemRepository.getById(reviewItemId);
        item.status = decision === 'approved' ? ReviewItemStatus.Approved : ReviewItemStatus.Rejected;
        item.resolvedAt = Date.now();
        item.resolvedBy = userId;
        await this.reviewItemRepository.save(item);

        const accuracy = new ExtractionAccuracy();
        accuracy.oid = UniqueId(Common.uniqueId());
        accuracy.reviewItemId = reviewItemId;
        accuracy.extractedDataId = (await this.reconciliationResultRepository.getById(item.reconciliationResultId as any)).extractedDataId;
        accuracy.commentCount = item.comments.length;
        accuracy.wasAiCorrect = item.comments.length === 0;
        accuracy.resolvedAt = Date.now();
        await this.extractionAccuracyRepository.save(accuracy);

        return new ApiResponse(true, item);
    }
}
```

`getDetail` is the single source of truth both UI views render from — the global inbox lists `ReviewItem.propertyId`/`period`/`status` only (a lightweight projection of `getOpenInbox`'s results), while the contextual view calls `getDetail` for the full side-by-side. No separate "inline view" data-fetching logic exists — both paths terminate in the same repository/service methods.

### 6. `server/controller/review.controller.ts`

```typescript
@Injectable()
@Bootstrap()
export class ReviewController extends BaseController {
    constructor(private reviewService: ReviewService) { super(); }

    async init(_req: Request) {}

    @Get('inbox')
    async getInbox(req: Request, res: Response) {
        const data = await this.reviewService.getInbox(req.session.user.oid);
        res.send(data);
    }

    @Get(':id')
    async getDetail(req: Request, res: Response) {
        const data = await this.reviewService.getDetail(UniqueId(req.query.id));
        res.send(data);
    }

    @Post(':id/comment')
    async addComment(req: Request, res: Response) {
        const { text } = req.body;
        if (!text) return this.sendError(res, 'text is required');
        const data = await this.reviewService.addComment(UniqueId(req.query.id), req.session.user.oid, text);
        res.send(data);
    }

    @Post(':id/resolve')
    async resolve(req: Request, res: Response) {
        const { decision } = req.body;
        if (!['approved', 'rejected'].includes(decision)) return this.sendError(res, 'decision must be approved or rejected');
        const data = await this.reviewService.resolve(UniqueId(req.query.id), req.session.user.oid, decision);
        res.send(data);
    }
}
```

---

## Files to Modify

### `server/router/router.ts`

Add `{ path: `${this.getBaseUrl()}/review`, controller: ReviewController }`.

---

## Angular

### `ui/src/app/service/review.service.ts`

```typescript
@Injectable()
export class ReviewService extends BaseService {
    constructor(apiService: ApiService, appService: AppService) { super(apiService, appService, ''); }

    getInbox(): Promise<ApiResponse<ReviewItem[]>> { return this.get('review/inbox'); }
    getDetail(id: string): Promise<ApiResponse<any>> { return this.get(`review/${id}`); }
    addComment(id: string, text: string): Promise<ApiResponse<ReviewItem>> { return this.post(`review/${id}/comment`, { text }); }
    resolve(id: string, decision: 'approved' | 'rejected'): Promise<ApiResponse<ReviewItem>> { return this.post(`review/${id}/resolve`, { decision }); }
}
```

### Components

- `ReviewInboxComponent` — global list, description-only (property, period, account, variance), click-through to detail.
- `ReviewDetailComponent` — full side-by-side: extracted fields vs. TB line, variance, comment thread, respond/approve/reject actions. Both this component and `ReviewInboxComponent`'s click-through route to the same detail view/data source — no separate "inline" component duplicating the fetch logic.

Routes: `{ path: 'review', component: ReviewInboxComponent }`, `{ path: 'review/:id', component: ReviewDetailComponent }`.

---

## Key Patterns Reused

| What | Where |
|------|-------|
| Automatic tenant scoping — no `tenantId` in any method here | Domain 1 |
| `PropertyRole`-based per-property authorization (distinct from tenant scoping) | Domain 1 |
| Single shared data-fetch (`getDetail`) backing both UI views | source doc's explicit no-duplication requirement |
| Angular `BaseService.post/get` | `ui/src/app/service/auth.service.ts` |

## Verification

1. Force a `discrepancy` reconciliation (Domain 5) → confirm a `ReviewItem` appears in `GET /api/review/inbox`.
2. Open the detail view (`GET /api/review/:id`) → confirm it shows the same `ReconciliationResult`/`ExtractedData`/TB line data as the inbox entry references, not a separately-fetched copy.
3. Approve with **zero** comments → confirm `ExtractionAccuracy.wasAiCorrect = true`.
4. On a second item, add 1+ comments before approving → confirm `ExtractionAccuracy.wasAiCorrect = false`.
5. As a user with a `PropertyRole` on only one property, confirm `GET /api/review/inbox` shows only that property's items, even though other properties in the same tenant have open review items too.
6. As a user in a different tenant, confirm `GET /api/review/inbox` returns nothing from the first tenant (automatic isolation, independent of the property-role filter).
