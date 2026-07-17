# Plan: Domain 8 — Period Close Workflow

## Context

A `Period` state machine (Open → In Review → Locked) per property, tying Domains 6 (Review Queue) and 7 (PreClose Checklist) together into a single close status view. Locking is a **manual action, not auto-gated** — per the source doc, a property can be locked even with unresolved `ReviewItem`s or checklist items outstanding, but the UI must show a stern warning first. This preserves human judgment/override while still surfacing risk — it is *not* this domain's job to block the lock server-side. Tenant scoping is automatic (Domain 1).

**Demoable outcome:** the full month-end close lifecycle, from open period to locked period, with all remaining open items visible before lock.

---

## Files to Create

### 1. `model/period.model.ts`

```typescript
import { BaseModel } from './shared.model';
import { authid, uniqueid } from './id.model';

export enum PeriodStatus { Open = 'open', InReview = 'in-review', Locked = 'locked' }

export class Period implements BaseModel {
    oid?: uniqueid;
    propertyId: uniqueid;
    period: string;
    status: PeriodStatus;
    lockedBy?: authid;
    lockedAt?: number;
}
```

### 2. `server/repository/period.repository.ts`

Collection: `period`.

```typescript
@Injectable()
@Bootstrap()
export class PeriodRepository extends BaseRepository {
    constructor() { super('period'); }

    getByPropertyPeriod(propertyId: uniqueid, period: string): Promise<Period> {
        return this.context.findOne({ propertyId, period });
    }

    save(p: Period): Promise<Period> {
        return this.context.update({ propertyId: p.propertyId, period: p.period }, p, null, { upsert: true });
    }
}
```

### 3. `server/service/period.service.ts`

```typescript
@Injectable()
@Bootstrap()
export class PeriodService extends BaseService {
    constructor(
        appService: AppService,
        private periodRepository: PeriodRepository,
        private reviewItemRepository: ReviewItemRepository,
        private checklistInstanceRepository: ChecklistInstanceRepository
    ) { super(appService); }

    async getStatusSummary(propertyId: uniqueid, period: string): Promise<ApiResponse<{ period: Period, openReviewItems: number, openChecklistItems: number }>> {
        let p = await this.periodRepository.getByPropertyPeriod(propertyId, period);
        if (!p) {
            p = new Period();
            p.oid = UniqueId(Common.uniqueId());
            p.propertyId = propertyId;
            p.period = period;
            p.status = PeriodStatus.Open;
            await this.periodRepository.save(p);
        }

        const openReviewItems = (await this.reviewItemRepository.getOpenInbox([propertyId])).filter(i => i.period === period).length;
        const checklist = await this.checklistInstanceRepository.getByPropertyPeriod(propertyId, period);
        const openChecklistItems = checklist ? checklist.responses.filter(r => r.status === ChecklistItemStatus.Unanswered).length : 0;

        return new ApiResponse(true, { period: p, openReviewItems, openChecklistItems });
    }

    async transition(propertyId: uniqueid, period: string, newStatus: PeriodStatus, userId: authid): Promise<ApiResponse<Period>> {
        const p = await this.periodRepository.getByPropertyPeriod(propertyId, period) || (() => {
            const np = new Period();
            np.oid = UniqueId(Common.uniqueId());
            np.propertyId = propertyId;
            np.period = period;
            return np;
        })();

        p.status = newStatus;
        if (newStatus === PeriodStatus.Locked) {
            p.lockedBy = userId;
            p.lockedAt = Date.now();
        }

        // deliberately no gating check here — locking with open items is allowed;
        // the "stern warning" is a client-side confirmation in front of this call, not a server-side block
        await this.periodRepository.save(p);
        return new ApiResponse(true, p);
    }
}
```

### 4. `server/controller/period.controller.ts`

```typescript
@Injectable()
@Bootstrap()
export class PeriodController extends BaseController {
    constructor(private periodService: PeriodService) { super(); }

    async init(_req: Request) {}

    @Get(':propertyId/:period')
    async getStatusSummary(req: Request, res: Response) {
        const data = await this.periodService.getStatusSummary(UniqueId(req.query.propertyId), req.query.period);
        res.send(data);
    }

    @Post(':propertyId/:period/transition')
    async transition(req: Request, res: Response) {
        const { status } = req.body;
        if (!['open', 'in-review', 'locked'].includes(status)) return this.sendError(res, 'invalid status');
        const data = await this.periodService.transition(UniqueId(req.query.propertyId), req.query.period, status, req.session.user.oid);
        res.send(data);
    }
}
```

---

## Files to Modify

### `server/router/router.ts`

Add `{ path: `${this.getBaseUrl()}/period`, controller: PeriodController }`.

---

## Angular

### `ui/src/app/service/period.service.ts`

```typescript
@Injectable()
export class PeriodService extends BaseService {
    constructor(apiService: ApiService, appService: AppService) { super(apiService, appService, ''); }

    getStatusSummary(propertyId: string, period: string): Promise<ApiResponse<any>> {
        return this.get(`period/${propertyId}/${period}`);
    }

    transition(propertyId: string, period: string, status: string): Promise<ApiResponse<Period>> {
        return this.post(`period/${propertyId}/${period}/transition`, { status });
    }
}
```

### Components

- `PeriodCloseComponent` — status dashboard combining `openReviewItems`/`openChecklistItems` counts (from `getStatusSummary`) with a "Lock Period" button. Clicking it opens a confirmation modal listing the specific outstanding items (not just counts) before calling `transition(..., 'locked')` — the warning lives entirely client-side; the server never refuses the transition.

Routes: `{ path: 'period/:propertyId/:period', component: PeriodCloseComponent }`.

---

## Key Patterns Reused

| What | Where |
|------|-------|
| Automatic tenant scoping — no `tenantId` in any method here | Domain 1 |
| Upsert-on-natural-key (`propertyId`+`period`) | `server/repository/invite.repository.ts:20` pattern |
| Reads from Domain 6 (`ReviewItemRepository`) and Domain 7 (`ChecklistInstanceRepository`) without introducing new gating logic in either | Domains 6, 7 |

## Verification

1. `GET /api/period/:propertyId/:period` for a period with open review items and unanswered checklist items → confirm both counts are non-zero and a `Period` in `Open` status is lazily created if none existed.
2. Attempt to lock via `POST /api/period/:propertyId/:period/transition` `{ status: 'locked' }` while items are still open → confirm the transition **succeeds** (no server-side block) — the warning is purely a client-side confirmation step.
3. Confirm `PeriodCloseComponent`'s lock button surfaces the client-side warning modal listing the specific outstanding items before submitting the transition call.
4. After locking, `GET /api/period/:propertyId/:period` → confirm `status: 'locked'`, `lockedBy`, and `lockedAt` are set.
5. As a user in a different tenant, confirm `GET /api/period/:propertyId/:period` for the first tenant's property returns nothing / a fresh `Open` period rather than the first tenant's locked state (automatic isolation).
