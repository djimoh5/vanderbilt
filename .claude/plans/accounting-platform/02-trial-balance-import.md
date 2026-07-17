# Plan: Domain 2 — Trial Balance Import

## Context

The Trial Balance is the anchor every schedule reconciles against, so — per the source plan — this domain is deliberately **not** run through the AI extraction pipeline (Domain 4). Yardi's TB export has a fixed, known column layout, so a direct, deterministic mapping is simpler and more reliable than an AI interpretation step. This domain depends on Domain 1 and reuses the `xlsx` utility at `server/lib/xlsx/xlsx.utility.ts`.

Tenant scoping needs no special handling here — every repository is a plain `BaseRepository` subclass; `DatabaseContext.setTenant()` auto-stamps/filters `tenantId` on every read/write (see Domain 1). No method in this domain accepts or passes a `tenantId` argument.

**Demoable outcome:** upload a TB export, see it rendered per-account, per-period.

---

## Files to Create

### 1. `model/trial-balance.model.ts`

```typescript
import { BaseModel } from './shared.model';
import { authid, uniqueid } from './id.model';

export interface TrialBalanceAccountLine {
    accountNumber: string;
    accountName: string;
    balance: number;
}

export class TrialBalanceSnapshot implements BaseModel {
    oid?: uniqueid;
    propertyId: uniqueid;
    period: string;              // 'YYYY-MM'
    accounts: TrialBalanceAccountLine[];
    importedAt: number;
    importedBy: authid;
}
```

### 2. `server/repository/trial-balance.repository.ts`

Collection: `trial_balance_snapshot`.

```typescript
@Injectable()
@Bootstrap()
export class TrialBalanceRepository extends BaseRepository {
    constructor() { super('trial_balance_snapshot'); }

    getByPropertyPeriod(propertyId: uniqueid, period: string): Promise<TrialBalanceSnapshot> {
        return this.context.findOne({ propertyId, period });
    }

    save(snapshot: TrialBalanceSnapshot): Promise<TrialBalanceSnapshot> {
        // upsert on the property+period combination — a re-import replaces the snapshot for that period
        return this.context.update({ propertyId: snapshot.propertyId, period: snapshot.period }, snapshot, null, { upsert: true });
    }
}
```

`tenantId` is never part of the query here — `DatabaseContext.setTenant()` already scopes both the `findOne` lookup and the `update` filter to the caller's tenant, so this upsert can't accidentally cross tenant lines even though the query object only names `propertyId`/`period`.

*Note: unlike `SourceDocument` (Domain 3), a TB re-import for the same period **overwrites** rather than versions — the TB is a snapshot of a Yardi report, not a document with review history. If an audit trail of TB re-imports becomes necessary later, add a `version` field and stop upserting; not needed for MVP.*

### 3. `server/service/trial-balance.service.ts`

```typescript
@Injectable()
@Bootstrap()
export class TrialBalanceService extends BaseService {
    constructor(appService: AppService, private trialBalanceRepository: TrialBalanceRepository) { super(appService); }

    async importFromWorkbook(buffer: Buffer, propertyId: uniqueid, period: string, userId: authid): Promise<ApiResponse<TrialBalanceSnapshot>> {
        const sheet = xlsx.fileToWorksheet<{ 'Account Number': string, 'Account Name': string, 'Balance': number }>(buffer.toString('binary'));

        const accounts: TrialBalanceAccountLine[] = sheet.data
            .filter(row => row['Account Number'])
            .map(row => ({
                accountNumber: String(row['Account Number']).trim(),
                accountName: row['Account Name'],
                balance: Number(row['Balance']) || 0
            }));

        if (accounts.length === 0) {
            return new ApiErrorResponse('no account rows found in workbook — check column headers match "Account Number" / "Account Name" / "Balance"');
        }

        const snapshot = new TrialBalanceSnapshot();
        snapshot.oid = UniqueId(Common.uniqueId());
        snapshot.propertyId = propertyId;
        snapshot.period = period;
        snapshot.accounts = accounts;
        snapshot.importedAt = Date.now();
        snapshot.importedBy = userId;

        await this.trialBalanceRepository.save(snapshot);
        return new ApiResponse(true, snapshot);
    }

    getByPropertyPeriod(propertyId: uniqueid, period: string): Promise<TrialBalanceSnapshot> {
        return this.trialBalanceRepository.getByPropertyPeriod(propertyId, period);
    }
}
```

*Exact header names ("Account Number" / "Account Name" / "Balance") are a placeholder — confirm against the real Northbridge TB tab headers before implementation; `xlsx.fileToWorksheet` returns `headers: string[]` precisely so this can be validated/adapted per the actual export.*

### 4. `server/controller/trial-balance.controller.ts`

```typescript
@Injectable()
@Bootstrap()
export class TrialBalanceController extends BaseController {
    constructor(private trialBalanceService: TrialBalanceService, private s3Service: S3Service) { super(); }

    async init(_req: Request) {}

    @Post('import')
    async import(req: Request, res: Response) {
        const { propertyId, period, s3Key } = req.body; // s3Key from Domain 3's presigned-upload flow
        if (!propertyId || !period || !s3Key) {
            return this.sendError(res, 'propertyId, period, and s3Key are required');
        }

        const raw = await this.s3Service.getRawObjectByUrl(this.s3Service.buildUrl(s3Key, Config.DOCUMENT_BUCKET));
        if (!raw.success) return this.sendError(res, 'could not read uploaded file');

        const data = await this.trialBalanceService.importFromWorkbook(raw.data.content, UniqueId(propertyId), period, req.session.user.oid);
        res.send(data);
    }

    @Get(':propertyId/:period')
    async getByPropertyPeriod(req: Request, res: Response) {
        const data = await this.trialBalanceService.getByPropertyPeriod(UniqueId(req.query.propertyId), req.query.period);
        this.sendSuccess(res, data);
    }
}
```

Upload flow: the client uses Domain 3's `POST /api/document/upload-url` (presigned S3 URL, `docType: 'TrialBalance'`) to get the file onto S3, then calls `POST /api/trial-balance/import` with the resulting `s3Key` — the TB workbook is fetched server-side and parsed. This avoids inventing a second upload mechanism for what is functionally the same "get an xlsx file onto S3" step as every other document.

---

## Files to Modify

### `server/router/router.ts`

Add `{ path: `${this.getBaseUrl()}/trial-balance`, controller: TrialBalanceController }` to the `routes` array.

---

## Angular

### `ui/src/app/service/trial-balance.service.ts`

```typescript
@Injectable()
export class TrialBalanceService extends BaseService {
    constructor(apiService: ApiService, appService: AppService) { super(apiService, appService, ''); }

    import(propertyId: string, period: string, s3Key: string): Promise<ApiResponse<TrialBalanceSnapshot>> {
        return this.post('trial-balance/import', { propertyId, period, s3Key });
    }

    getByPropertyPeriod(propertyId: string, period: string): Promise<ApiResponse<TrialBalanceSnapshot>> {
        return this.get(`trial-balance/${propertyId}/${period}`);
    }
}
```

### Components

- `TrialBalanceUploadComponent` — period picker + file input; drives the shared presigned-upload flow (Domain 3), then calls `import()`.
- `TrialBalanceGridComponent` — renders `TrialBalanceSnapshot.accounts` as a sortable per-account grid.

Routes: `{ path: 'trial-balance/:propertyId/:period', component: TrialBalanceGridComponent }`.

---

## Key Patterns Reused

| What | Where |
|------|-------|
| `xlsx.fileToWorksheet<T>(binaryData)` raw parse | `server/lib/xlsx/xlsx.utility.ts` |
| Automatic tenant scoping — no `tenantId` in any query/method signature | Domain 1 (`server/database/context.ts`) |
| Upsert-on-natural-key via `context.update(query, obj, null, { upsert: true })` | `server/repository/invite.repository.ts:20` |
| `S3Service.getRawObjectByUrl` for server-side file fetch | `server/service/s3.service.ts` |
| Angular `BaseService.post/get` | `ui/src/app/service/auth.service.ts` |

## Verification

1. Upload the real Northbridge TB export (via Domain 3's upload-url flow) and call `POST /api/trial-balance/import` with the resulting key.
2. `GET /api/trial-balance/:propertyId/:period` → confirm all ~143 active/non-zero Northbridge accounts appear with the correct balances (cross-check a handful against the known workbook, e.g. the four bank accounts that reconcile to $0.00 variance per the discovery findings).
3. Re-import the same period → confirm the snapshot is replaced (one document per property+period, not duplicated).
4. Import with a malformed/empty workbook → confirm a clear error response rather than a silently empty snapshot.
5. As a user in a different tenant, `GET /api/trial-balance/:propertyId/:period` for the first tenant's property oid → confirm nothing is returned (automatic tenant isolation, not an explicit check in this domain's code).
