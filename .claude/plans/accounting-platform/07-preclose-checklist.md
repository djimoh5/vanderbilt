# Plan: Domain 7 — PreClose Checklist

## Context

Digital replacement for the Excel PreClose Checklist tab: a template of Yes/No/N/A items grouped by category (Cash/Escrows, AR/Prepaids/SLR, AP/Accrued Expenses, Debt/Equity/Sales Tax, GL review, CapEx/Fixed Assets/TI-LC — per the discovery findings), instantiated per property per period, with the manager-comment → accountant-reply → follow-up loop the source doc calls out as the single most important control to preserve. Tenant scoping is automatic (Domain 1).

**Demoable outcome:** replaces the current Excel checklist tab with a trackable, timestamped equivalent.

---

## Files to Create

### 1. `model/checklist-template.model.ts`

```typescript
import { BaseModel } from './shared.model';
import { uniqueid } from './id.model';

export interface ChecklistTemplateItem {
    key: string;
    label: string;
    order: number;
}

export class ChecklistTemplate implements BaseModel {
    oid?: uniqueid;
    category: string; // e.g. 'Cash/Escrows', 'AR/Prepaids/SLR', 'AP/Accrued Expenses', 'Debt/Equity/Sales Tax', 'GL Review', 'CapEx/Fixed Assets/TI-LC'
    items: ChecklistTemplateItem[];
}
```

### 2. `model/checklist-instance.model.ts`

```typescript
import { BaseModel } from './shared.model';
import { authid, uniqueid } from './id.model';

export enum ChecklistItemStatus { Yes = 'yes', No = 'no', NA = 'na', Unanswered = 'unanswered' }

export interface ChecklistComment {
    authorId: authid;
    text: string;
    createdAt: number;
}

export interface ChecklistItemResponse {
    itemKey: string;
    status: ChecklistItemStatus;
    assignedTo?: authid;
    comments: ChecklistComment[];
}

export class ChecklistInstance implements BaseModel {
    oid?: uniqueid;
    propertyId: uniqueid;
    period: string;
    templateId: uniqueid;
    responses: ChecklistItemResponse[];
    createdAt: number;
}
```

### 3. `server/repository/checklist-template.repository.ts`

Collection: `checklist_template`.

```typescript
@Injectable()
@Bootstrap()
export class ChecklistTemplateRepository extends BaseRepository {
    constructor() { super('checklist_template'); }

    getAll(): Promise<ChecklistTemplate[]> { return this.context.find({}); }
    save(template: ChecklistTemplate): Promise<ChecklistTemplate> { return super.updateObject(template); }
}
```

### 4. `server/repository/checklist-instance.repository.ts`

Collection: `checklist_instance`.

```typescript
@Injectable()
@Bootstrap()
export class ChecklistInstanceRepository extends BaseRepository {
    constructor() { super('checklist_instance'); }

    getByPropertyPeriod(propertyId: uniqueid, period: string): Promise<ChecklistInstance> {
        return this.context.findOne({ propertyId, period });
    }

    save(instance: ChecklistInstance): Promise<ChecklistInstance> {
        return this.context.update({ propertyId: instance.propertyId, period: instance.period }, instance, null, { upsert: true });
    }
}
```

### 5. `server/service/checklist.service.ts`

```typescript
@Injectable()
@Bootstrap()
export class ChecklistService extends BaseService {
    constructor(appService: AppService, private checklistTemplateRepository: ChecklistTemplateRepository, private checklistInstanceRepository: ChecklistInstanceRepository) {
        super(appService);
    }

    async instantiateForPeriod(propertyId: uniqueid, period: string): Promise<ApiResponse<ChecklistInstance>> {
        const existing = await this.checklistInstanceRepository.getByPropertyPeriod(propertyId, period);
        if (existing) return new ApiResponse(true, existing);

        const templates = await this.checklistTemplateRepository.getAll();
        const responses: ChecklistItemResponse[] = templates.flatMap(t =>
            t.items.map(item => ({ itemKey: item.key, status: ChecklistItemStatus.Unanswered, comments: [] }))
        );

        const instance = new ChecklistInstance();
        instance.oid = UniqueId(Common.uniqueId());
        instance.propertyId = propertyId;
        instance.period = period;
        instance.templateId = templates[0]?.oid; // or track all applicable template ids if categories are separate documents
        instance.responses = responses;
        instance.createdAt = Date.now();

        await this.checklistInstanceRepository.save(instance);
        return new ApiResponse(true, instance);
    }

    getByPropertyPeriod(propertyId: uniqueid, period: string): Promise<ChecklistInstance> {
        return this.checklistInstanceRepository.getByPropertyPeriod(propertyId, period);
    }

    async updateItemStatus(propertyId: uniqueid, period: string, itemKey: string, status: ChecklistItemStatus, userId: authid): Promise<ApiResponse<ChecklistInstance>> {
        const instance = await this.checklistInstanceRepository.getByPropertyPeriod(propertyId, period);
        const response = instance.responses.find(r => r.itemKey === itemKey);
        response.status = status;
        await this.checklistInstanceRepository.save(instance);
        return new ApiResponse(true, instance);
    }

    async addComment(propertyId: uniqueid, period: string, itemKey: string, userId: authid, text: string): Promise<ApiResponse<ChecklistInstance>> {
        const instance = await this.checklistInstanceRepository.getByPropertyPeriod(propertyId, period);
        const response = instance.responses.find(r => r.itemKey === itemKey);
        response.comments.push({ authorId: userId, text, createdAt: Date.now() });
        await this.checklistInstanceRepository.save(instance);
        return new ApiResponse(true, instance);
    }
}
```

*Template structure simplification note: modeling each category as a separate `ChecklistTemplate` document (one per category) vs. a single template document with all categories nested is an open call — the schema above assumes multiple category documents (`templateId` on the instance would need to become `templateIds: uniqueid[]` in that case). Either way, the instance flattens all items into one `responses` array grouped by category for rendering.*

### 6. `server/controller/checklist.controller.ts`

```typescript
@Injectable()
@Bootstrap()
export class ChecklistController extends BaseController {
    constructor(private checklistService: ChecklistService) { super(); }

    async init(_req: Request) {}

    @Post('instantiate')
    async instantiate(req: Request, res: Response) {
        const { propertyId, period } = req.body;
        const data = await this.checklistService.instantiateForPeriod(UniqueId(propertyId), period);
        res.send(data);
    }

    @Get(':propertyId/:period')
    async getByPropertyPeriod(req: Request, res: Response) {
        const data = await this.checklistService.getByPropertyPeriod(UniqueId(req.query.propertyId), req.query.period);
        this.sendSuccess(res, data);
    }

    @Post(':propertyId/:period/item/:key')
    async updateItemStatus(req: Request, res: Response) {
        const { status } = req.body;
        const data = await this.checklistService.updateItemStatus(UniqueId(req.query.propertyId), req.query.period, req.query.key, status, req.session.user.oid);
        res.send(data);
    }

    @Post(':propertyId/:period/item/:key/comment')
    async addComment(req: Request, res: Response) {
        const { text } = req.body;
        if (!text) return this.sendError(res, 'text is required');
        const data = await this.checklistService.addComment(UniqueId(req.query.propertyId), req.query.period, req.query.key, req.session.user.oid, text);
        res.send(data);
    }
}
```

---

## Files to Modify

### `server/router/router.ts`

Add `{ path: `${this.getBaseUrl()}/checklist`, controller: ChecklistController }`.

### Checklist template seed data

A one-time seed script (`server/jobs/seed-checklist-template.job.ts`, run via `ts-node` like `onboard.job.ts`) inserts the platform's default checklist categories/items discovered during the Vanderbilt file review (Cash/Escrows, AR/Prepaids/SLR, AP/Accrued Expenses, Debt/Equity/Sales Tax, GL Review, CapEx/Fixed Assets/TI-LC). Not a live HTTP endpoint.

---

## Angular

### `ui/src/app/service/checklist.service.ts`

```typescript
@Injectable()
export class ChecklistService extends BaseService {
    constructor(apiService: ApiService, appService: AppService) { super(apiService, appService, ''); }

    instantiate(propertyId: string, period: string): Promise<ApiResponse<ChecklistInstance>> {
        return this.post('checklist/instantiate', { propertyId, period });
    }

    getByPropertyPeriod(propertyId: string, period: string): Promise<ApiResponse<ChecklistInstance>> {
        return this.get(`checklist/${propertyId}/${period}`);
    }

    updateItemStatus(propertyId: string, period: string, itemKey: string, status: string): Promise<ApiResponse<ChecklistInstance>> {
        return this.post(`checklist/${propertyId}/${period}/item/${itemKey}`, { status });
    }

    addComment(propertyId: string, period: string, itemKey: string, text: string): Promise<ApiResponse<ChecklistInstance>> {
        return this.post(`checklist/${propertyId}/${period}/item/${itemKey}/comment`, { text });
    }
}
```

### Components

- `ChecklistComponent` — grouped by category, Yes/No/N/A controls per item, inline comment thread matching the manager-comment/accountant-reply loop.

Routes: `{ path: 'checklist/:propertyId/:period', component: ChecklistComponent }`.

---

## Key Patterns Reused

| What | Where |
|------|-------|
| Automatic tenant scoping — no `tenantId` in any method here | Domain 1 |
| Upsert-on-natural-key (`propertyId`+`period`) | `server/repository/invite.repository.ts:20` pattern |
| Comment-thread shape mirrors `ReviewItem.comments` | Domain 6 (`model/review-item.model.ts`) |
| Angular `BaseService.post/get` | `ui/src/app/service/auth.service.ts` |

## Verification

1. `POST /api/checklist/instantiate` for a property/period → confirm all seeded template items appear, grouped by category, all `status: 'unanswered'`.
2. Mark an item "No" → confirm status persists via `GET /api/checklist/:propertyId/:period`.
3. Add a manager comment on that item, then an accountant reply → confirm both appear in `comments` with correct `authorId`/timestamps, in order.
4. Mark the item resolved "Yes" → confirm the full comment thread is preserved (not cleared) alongside the final status.
5. Instantiate the same property/period twice → confirm the second call returns the **existing** instance, not a fresh blank one (no duplicate instances per property/period).
6. As a user in a different tenant, confirm `GET /api/checklist/:propertyId/:period` for the first tenant's property returns nothing (automatic isolation).
