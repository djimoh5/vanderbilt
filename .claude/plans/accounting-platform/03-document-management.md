# Plan: Domain 3 — Document Management

## Context

`SourceDocument` upload (xlsx/pdf), S3 storage, versioning on re-upload, property/period tagging. This domain establishes the S3 key convention and upload flow that Domains 2, 4, and 5 all reuse. Tenant scoping is automatic (see Domain 1) — no `tenantId` argument appears anywhere in this domain's methods.

**Upload mechanism:** `S3Service.getUploadInfo` (`server/service/s3.service.ts`) already generates a presigned direct-to-S3 PUT URL — no multer/multipart handling needs to be added to the repo for this. The client uploads the file bytes straight to S3, then registers the resulting key with the server.

**Demoable outcome:** upload a bank statement or mortgage statement, see it listed and downloadable, with version history on re-upload.

---

## S3 key convention

`directory = "${propertyId}/${period}/${docId}"`, filename per version: `v${version}.${ext}`. Full key: `{propertyId}/{period}/{docId}/v{version}.{ext}`. Note `tenantId` is deliberately **not** part of the S3 key — S3 access is already gated by the presigned-URL/API layer, which is tenant-scoped; baking `tenantId` into the key would just be redundant with what `SourceDocument.propertyId` plus the DB-layer tenant check already guarantees, and it keeps keys stable if a property's identifiers are ever reused across a migration.

New config key needed: `Config.DOCUMENT_BUCKET` in `server/config/config.base.ts` — no business-facing bucket config exists today (only deployment's `DeployConfig.BUCKET`, explicitly for deploy scripts only).

---

## Files to Create

### 1. `model/source-document.model.ts`

```typescript
import { BaseModel } from './shared.model';
import { authid, uniqueid } from './id.model';

export enum DocType {
    BankStatement = 'bank_statement',
    MortgageStatement = 'mortgage_statement',
    InsuranceInvoice = 'insurance_invoice',
    ParkingReport = 'parking_report',
    TaxBill = 'tax_bill',
    YardiRentRoll = 'yardi_rent_roll',
    YardiARAging = 'yardi_ar_aging',
    YardiAPAging = 'yardi_ap_aging',
    YardiFixedAssets = 'yardi_fixed_assets',
    TrialBalance = 'trial_balance',
    Other = 'other'
}

export class SourceDocument implements BaseModel {
    oid?: uniqueid;
    propertyId: uniqueid;
    period: string;             // 'YYYY-MM'
    docType: DocType;
    s3Key: string;
    version: number;
    originalFilename: string;
    contentType: string;
    uploadedBy: authid;
    uploadedAt: number;
    supersedes?: uniqueid;      // prior version's oid, if any
}
```

`docType` is user-selected at upload (per source doc decision) — not auto-classified for MVP.

### 2. `server/repository/source-document.repository.ts`

Collection: `source_document`.

```typescript
@Injectable()
@Bootstrap()
export class SourceDocumentRepository extends BaseRepository {
    constructor() { super('source_document'); }

    getById(docId: uniqueid): Promise<SourceDocument> { return this.context.findOne({ oid: docId }); }

    getLatestByPropertyPeriodType(propertyId: uniqueid, period: string, docType: DocType): Promise<SourceDocument> {
        return this.context.findOne({ propertyId, period, docType }, null, { sort: { version: -1 } } as any);
    }

    getVersionHistory(propertyId: uniqueid, period: string, docType: DocType): Promise<SourceDocument[]> {
        return this.context.find({ propertyId, period, docType });
    }

    getByPropertyPeriod(propertyId: uniqueid, period: string): Promise<SourceDocument[]> {
        return this.context.find({ propertyId, period });
    }

    save(doc: SourceDocument): Promise<SourceDocument> { return super.updateObject(doc); }
}
```

### 3. `server/service/document.service.ts`

```typescript
@Injectable()
@Bootstrap()
export class DocumentService extends BaseService {
    constructor(appService: AppService, private sourceDocumentRepository: SourceDocumentRepository, private s3Service: S3Service) {
        super(appService);
    }

    async getUploadUrl(propertyId: uniqueid, period: string, docType: DocType, originalFilename: string, contentType: string): Promise<ApiResponse<S3UploadInfo & { docId: string }>> {
        const docId = UniqueId(Common.uniqueId());
        const existing = await this.sourceDocumentRepository.getLatestByPropertyPeriodType(propertyId, period, docType);
        const version = (existing?.version || 0) + 1;
        const ext = originalFilename.split('.').pop();
        const directory = `${propertyId}/${period}/${existing?.oid || docId}`;

        const uploadInfo = await this.s3Service.getUploadInfo(Config.DOCUMENT_BUCKET, directory, `v${version}.${ext}`, contentType, false);
        return new ApiResponse(true, { ...uploadInfo, docId: existing?.oid || docId });
    }

    async register(docId: uniqueid, propertyId: uniqueid, period: string, docType: DocType, s3Key: string, originalFilename: string, contentType: string, userId: authid): Promise<ApiResponse<SourceDocument>> {
        const existing = await this.sourceDocumentRepository.getLatestByPropertyPeriodType(propertyId, period, docType);

        const doc = new SourceDocument();
        doc.oid = existing ? UniqueId(Common.uniqueId()) : docId; // new version = new document row, not an overwrite
        doc.propertyId = propertyId;
        doc.period = period;
        doc.docType = docType;
        doc.s3Key = s3Key;
        doc.version = (existing?.version || 0) + 1;
        doc.originalFilename = originalFilename;
        doc.contentType = contentType;
        doc.uploadedBy = userId;
        doc.uploadedAt = Date.now();
        doc.supersedes = existing?.oid;

        await this.sourceDocumentRepository.save(doc);
        return new ApiResponse(true, doc);
    }

    getByPropertyPeriod(propertyId: uniqueid, period: string): Promise<SourceDocument[]> {
        return this.sourceDocumentRepository.getByPropertyPeriod(propertyId, period);
    }

    getVersionHistory(propertyId: uniqueid, period: string, docType: DocType): Promise<SourceDocument[]> {
        return this.sourceDocumentRepository.getVersionHistory(propertyId, period, docType);
    }

    async getDownloadUrl(docId: uniqueid): Promise<ApiResponse<string>> {
        const doc = await this.sourceDocumentRepository.getById(docId);
        if (!doc) return new ApiErrorResponse('document not found');
        return this.s3Service.getDisplayUrl(Config.DOCUMENT_BUCKET, '', doc.s3Key, doc.originalFilename);
    }
}
```

Each re-upload creates a **new** `SourceDocument` row with an incremented `version` and `supersedes` pointing at the prior one — never an overwrite, preserving the full audit trail the PreClose Checklist process already depends on (per source doc decision).

### 4. `server/controller/document.controller.ts`

```typescript
@Injectable()
@Bootstrap()
export class DocumentController extends BaseController {
    constructor(private documentService: DocumentService) { super(); }

    async init(_req: Request) {}

    @Post('upload-url')
    async getUploadUrl(req: Request, res: Response) {
        const { propertyId, period, docType, filename, contentType } = req.body;
        if (!propertyId || !period || !docType || !filename) return this.sendError(res, 'propertyId, period, docType, and filename are required');
        const data = await this.documentService.getUploadUrl(UniqueId(propertyId), period, docType, filename, contentType);
        res.send(data);
    }

    @Post('')
    async register(req: Request, res: Response) {
        const { docId, propertyId, period, docType, s3Key, originalFilename, contentType } = req.body;
        const data = await this.documentService.register(UniqueId(docId), UniqueId(propertyId), period, docType, s3Key, originalFilename, contentType, req.session.user.oid);
        res.send(data);
    }

    @Get(':propertyId/:period')
    async getByPropertyPeriod(req: Request, res: Response) {
        const data = await this.documentService.getByPropertyPeriod(UniqueId(req.query.propertyId), req.query.period);
        this.sendSuccess(res, data);
    }

    @Get(':id/download')
    async download(req: Request, res: Response) {
        const data = await this.documentService.getDownloadUrl(UniqueId(req.query.id));
        res.send(data);
    }

    @Get(':propertyId/:period/:docType/versions')
    async getVersions(req: Request, res: Response) {
        const data = await this.documentService.getVersionHistory(UniqueId(req.query.propertyId), req.query.period, req.query.docType);
        this.sendSuccess(res, data);
    }
}
```

---

## Files to Modify

### `server/config/config.base.ts`

Add `static DOCUMENT_BUCKET = '';` alongside the existing `AWS_ACCESS_KEY`/`AWS_ACCESS_SECRET` keys.

### `server/router/router.ts`

Add `{ path: `${this.getBaseUrl()}/document`, controller: DocumentController }`.

---

## Angular

### `ui/src/app/service/document.service.ts`

```typescript
@Injectable()
export class DocumentService extends BaseService {
    constructor(apiService: ApiService, appService: AppService) { super(apiService, appService, ''); }

    async upload(propertyId: string, period: string, docType: string, file: File): Promise<ApiResponse<SourceDocument>> {
        const urlRes = await this.post<{ signedRequest: string, url: string, docId: string }>('document/upload-url', {
            propertyId, period, docType, filename: file.name, contentType: file.type
        });
        if (!urlRes.success) return urlRes as any;

        await fetch(urlRes.data.signedRequest, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });

        return this.post('document', {
            docId: urlRes.data.docId, propertyId, period, docType,
            s3Key: this.extractKey(urlRes.data.url), originalFilename: file.name, contentType: file.type
        });
    }

    getByPropertyPeriod(propertyId: string, period: string): Promise<ApiResponse<SourceDocument[]>> {
        return this.get(`document/${propertyId}/${period}`);
    }

    getVersionHistory(propertyId: string, period: string, docType: string): Promise<ApiResponse<SourceDocument[]>> {
        return this.get(`document/${propertyId}/${period}/${docType}/versions`);
    }

    private extractKey(url: string): string {
        return url.split('.amazonaws.com/')[1];
    }
}
```

### Components

- `DocumentUploadComponent` — docType picker (dropdown) + file input; drives the presigned-upload flow above.
- `DocumentListComponent` — per-property/period document list with docType badges.
- `DocumentVersionHistoryComponent` — expandable version list per document, each downloadable.

Routes: `{ path: 'documents/:propertyId/:period', component: DocumentListComponent }`.

---

## Key Patterns Reused

| What | Where |
|------|-------|
| `S3Service.getUploadInfo` — presigned direct-to-S3 upload, no multer needed | `server/service/s3.service.ts` |
| `S3Service.getDisplayUrl` — presigned GET for downloads | `server/service/s3.service.ts` |
| Automatic tenant scoping — no `tenantId` in any method here | Domain 1 |
| New-row-per-version (never overwrite) | this domain — new pattern, no direct precedent in repo, but same spirit as audit-log preservation in `DatabaseContext.auditLog` |
| Angular `BaseService.post/get` | `ui/src/app/service/auth.service.ts` |

## Verification

1. Request an upload URL for a bank statement, `PUT` the file to the returned `signedRequest`, then `POST /api/document` to register it — confirm it appears via `GET /api/document/:propertyId/:period`.
2. Re-upload the same `docType`/`period`/`propertyId` → confirm a **new** `SourceDocument` row is created (`version: 2`, `supersedes` set to the first row's `oid`), not an overwrite.
3. `GET /api/document/:propertyId/:period/:docType/versions` → confirm both versions listed, both individually downloadable via `GET /api/document/:id/download`.
4. Confirm the S3 object key matches `{propertyId}/{period}/{docId}/v{version}.{ext}`.
5. As a user in a different tenant, attempt `GET /api/document/:id/download` for the first tenant's document id → confirm not found (automatic tenant isolation on the `source_document` lookup).
