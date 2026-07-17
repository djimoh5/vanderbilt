# Plan: Domain 4 — Extraction Pipeline

## Context

Turns a `SourceDocument` (Domain 3) into normalized `ExtractedData` with per-field confidence, using the existing `AIService` facade (`server/service/ai/ai.service.ts`) and `Job`/`JobRunner` primitives (`server/jobs/job.runner.ts`, `server/lib/pipeline.ts`). **No job-queue/retry/dead-letter design here** — per the user, that persistence layer is being self-implemented separately; this plan only covers the extraction logic a `Job.run()` calls, using the existing `Job` base class as-is.

Tenant scoping is automatic (Domain 1) — no `tenantId` argument in any method here.

**Demoable outcome:** upload a document, trigger extraction, see structured fields with confidence scores — no TB comparison yet (that's Domain 5).

---

## AI structured-output convention (established here, reused by Domain 5)

Build an `AICompletionOptions.responseFormat = { type: 'json_schema', json_schema: { name, schema, strict: true } }` describing the normalized output shape, then call `AIService.executeConversation(conversation, options, authId)` (`server/service/ai/base-ai.service.ts`). The response's `message.json` is already parsed by `BaseAIService.executeConversation` when `responseFormat.type === 'json_schema'` — no manual JSON parsing needed in this domain's code. Model is chosen per `docType` via `options.model` (e.g. a cheaper model like `gpt-5-mini` for well-structured bank statements, escalate to a stronger model on low confidence — left as a tunable default, not hardcoded).

## Two converging paths into the same AI step

- **Excel:** `xlsx.fileToWorksheets(buffer, true)` (`server/lib/xlsx/xlsx.utility.ts`) — raw parse, no layout assumptions — dump `headers` + `data` rows as the user-message content, with `docType` as a hint in the system/user prompt. Model choice is open (per-`docType` tunable, e.g. `gpt-5-mini`).
- **PDF:** send document content to the AI directly, **hardcoded to ChatGPT** (`model: 'gpt-5.2'`) regardless of whatever model handles the Excel path — not provider-selectable for this doc type. `ChatGPTService` (`server/service/ai/chatgpt.service.ts`) passes `messages` straight through to OpenAI's `/v1/chat/completions` with no mapping step today, unlike Claude/Gemini which each have their own `mapMessages`. OpenAI's API expects a PDF content part shaped `{ type: 'file', file: { filename, file_data: 'data:application/pdf;base64,...' } }` — our shared `AIMessage.content` shape only carries `{ type: 'file', file?: string }` (raw base64). **New work needed:** add a small mapping step to `ChatGPTService.getTextCompletions`/`getFunctionCall` that wraps any `{ type: 'file', file: string }` content block into OpenAI's expected `{ filename, file_data }` object shape before sending — mirroring (in miniature) the mapping Claude/Gemini already do for their own wire formats. Claude/Gemini are untouched by this domain.

---

## Files to Create

### 1. `model/extracted-data.model.ts`

```typescript
import { BaseModel } from './shared.model';
import { uniqueid } from './id.model';
import { DocType } from './source-document.model';
import { AIModel } from './ai.model';

export interface ExtractedField {
    name: string;
    value: string | number;
    confidence: number; // 0-1
}

export class ExtractedData implements BaseModel {
    oid?: uniqueid;
    propertyId: uniqueid;
    sourceDocumentId: uniqueid;
    docType: DocType;
    fields: ExtractedField[];
    overallConfidence: number;
    extractedAt: number;
    aiModel: AIModel;
}
```

### 2. `server/repository/extracted-data.repository.ts`

Collection: `extracted_data`.

```typescript
@Injectable()
@Bootstrap()
export class ExtractedDataRepository extends BaseRepository {
    constructor() { super('extracted_data'); }

    getBySourceDocument(sourceDocumentId: uniqueid): Promise<ExtractedData> {
        return this.context.findOne({ sourceDocumentId });
    }

    save(data: ExtractedData): Promise<ExtractedData> {
        return this.context.update({ sourceDocumentId: data.sourceDocumentId }, data, null, { upsert: true });
    }
}
```

Upsert on `sourceDocumentId` — re-running extraction on the same document (e.g. after a prompt/model change) replaces the prior result rather than accumulating duplicates.

### 3. `server/jobs/extraction.job.ts`

```typescript
@Injectable()
@Bootstrap()
export class ExtractionJob extends Job {
    private sourceDocumentId: uniqueid;

    constructor(private aiService: AIService, private s3Service: S3Service, private sourceDocumentRepository: SourceDocumentRepository, private extractedDataRepository: ExtractedDataRepository) {
        super('ExtractionJob');
    }

    setSourceDocument(sourceDocumentId: uniqueid) { this.sourceDocumentId = sourceDocumentId; }

    async run(_context: { data?: any }) {
        try {
            const doc = await this.sourceDocumentRepository.getById(this.sourceDocumentId);
            const raw = await this.s3Service.getRawObjectByUrl(this.s3Service.buildUrl(doc.s3Key, Config.DOCUMENT_BUCKET));
            if (!raw.success) { return this.done({ success: false, msg: 'could not fetch document from S3' }); }

            const isExcel = doc.contentType.includes('spreadsheet') || doc.originalFilename.match(/\.xlsx?$/i);
            const extracted = isExcel
                ? await this.extractFromExcel(raw.data.content, doc)
                : await this.extractFromPdf(raw.data.content, doc);

            await this.extractedDataRepository.save(extracted);
            this.done({ success: true, data: { extractedDataId: extracted.oid } });
        }
        catch (err) {
            this.done({ success: false, data: err, msg: err.message });
        }
    }

    private async extractFromExcel(buffer: Buffer, doc: SourceDocument): Promise<ExtractedData> {
        const sheets = xlsx.fileToWorksheets(buffer, true);
        const dump = sheets.map(s => `Sheet: ${s.sheet.name}\nHeaders: ${s.headers.join(', ')}\n${JSON.stringify(s.data)}`).join('\n\n');
        return this.callExtractionAI(dump, doc);
    }

    private async extractFromPdf(buffer: Buffer, doc: SourceDocument): Promise<ExtractedData> {
        // PDF path is hardcoded to ChatGPT — requires the chatgpt.service.ts file-content-block mapping described above
        const base64 = buffer.toString('base64');
        return this.callExtractionAI(null, doc, base64);
    }

    private async callExtractionAI(textDump: string, doc: SourceDocument, fileBase64?: string): Promise<ExtractedData> {
        const conversation = new AIConversation(doc.oid, {
            role: 'system',
            content: `Extract structured field data from this ${doc.docType} document. Return fields with a name, value, and confidence (0-1) for each.`
        });
        conversation.add({
            role: 'user',
            content: fileBase64 ? [{ type: 'file', file: fileBase64 }] : textDump
        });

        const responseFormat = {
            type: 'json_schema' as const,
            json_schema: {
                name: 'extracted_data',
                schema: {
                    type: 'object' as const,
                    properties: {
                        fields: {
                            type: 'array' as const,
                            items: { type: 'object', properties: { name: { type: 'string' }, value: { type: 'string' }, confidence: { type: 'number' } } }
                        },
                        overallConfidence: { type: 'number' as const }
                    },
                    required: ['fields', 'overallConfidence']
                },
                strict: true
            }
        };

        const model = fileBase64 ? 'gpt-5.2' : 'gpt-5-mini'; // PDF path forced to ChatGPT; Excel path uses the tunable default
        const message = await this.aiService.executeConversation(conversation, { model, responseFormat }, doc.uploadedBy);

        const extracted = new ExtractedData();
        extracted.oid = UniqueId(Common.uniqueId());
        extracted.propertyId = doc.propertyId;
        extracted.sourceDocumentId = doc.oid;
        extracted.docType = doc.docType;
        extracted.fields = message.json.fields;
        extracted.overallConfidence = message.json.overallConfidence;
        extracted.extractedAt = Date.now();
        extracted.aiModel = model;
        return extracted;
    }
}
```

Triggered in-process from `DocumentService.register()` for MVP (`Injector.get(ExtractionJob).setSourceDocument(doc.oid); job.run({})` or wrapped in a single-job `JobRunner` pipeline) — actual queuing/retry/dead-letter is the user's own separate work, not designed here.

### 4. `server/service/extraction.service.ts`

```typescript
@Injectable()
@Bootstrap()
export class ExtractionService extends BaseService {
    constructor(appService: AppService, private extractedDataRepository: ExtractedDataRepository) { super(appService); }

    getBySourceDocument(sourceDocumentId: uniqueid): Promise<ExtractedData> {
        return this.extractedDataRepository.getBySourceDocument(sourceDocumentId);
    }
}
```

### 5. `server/controller/extraction.controller.ts`

```typescript
@Injectable()
@Bootstrap()
export class ExtractionController extends BaseController {
    constructor(private extractionService: ExtractionService) { super(); }

    async init(_req: Request) {}

    @Post(':sourceDocumentId/run')
    async run(req: Request, res: Response) {
        const job = Injector.get(ExtractionJob, req.session.tenantId);
        job.setSourceDocument(UniqueId(req.query.sourceDocumentId));
        await job.run({});
        this.sendSuccess(res, job.result);
    }

    @Get(':sourceDocumentId')
    async getResult(req: Request, res: Response) {
        const data = await this.extractionService.getBySourceDocument(UniqueId(req.query.sourceDocumentId));
        this.sendSuccess(res, data);
    }
}
```

`Injector.get(ExtractionJob, req.session.tenantId)` explicitly re-resolves the job within the current tenant's own DI scope — matching the pattern already established for the one legitimate `Injector.get(...)` call site in Domain 1's signup flow, since a controller-injected constructor dependency would already be correctly scoped too; being explicit here just makes the job's tenant context unambiguous at the one call site that isn't a plain controller method.

---

## Files to Modify

### `server/router/router.ts`

Add `{ path: `${this.getBaseUrl()}/extraction`, controller: ExtractionController }`.

### `server/service/ai/chatgpt.service.ts`

Add a small mapping step (in `getTextCompletions`/`getFunctionCall`, before building `ChatGPTAPICallConfig`) that transforms any message content block shaped `{ type: 'file', file: string }` into OpenAI's expected `{ type: 'file', file: { filename: 'document.pdf', file_data: `data:application/pdf;base64,${content}` } }`. This is the only AI-provider change this domain needs — Claude and Gemini are untouched, since PDF extraction is hardcoded to ChatGPT.

---

## Angular

### `ui/src/app/service/extraction.service.ts`

```typescript
@Injectable()
export class ExtractionService extends BaseService {
    constructor(apiService: ApiService, appService: AppService) { super(apiService, appService, ''); }

    run(sourceDocumentId: string): Promise<ApiResponse<any>> { return this.post(`extraction/${sourceDocumentId}/run`, {}); }
    getResult(sourceDocumentId: string): Promise<ApiResponse<ExtractedData>> { return this.get(`extraction/${sourceDocumentId}`); }
}
```

### Components

- `ExtractionResultComponent` — structured field list with confidence badges (color-coded by threshold), a "Re-run extraction" button. No TB comparison UI yet — that's Domain 5/6.

Routes: `{ path: 'extraction/:sourceDocumentId', component: ExtractionResultComponent }`.

---

## Key Patterns Reused

| What | Where |
|------|-------|
| `AIService.executeConversation` + `responseFormat: json_schema` | `server/service/ai/base-ai.service.ts`, `model/ai.model.ts:271-277` |
| `xlsx.fileToWorksheets(buffer, true)` | `server/lib/xlsx/xlsx.utility.ts` |
| `S3Service.getRawObjectByUrl` for server-side file fetch | `server/service/s3.service.ts` |
| `Job extends ... run(context) { this.done({...}) }` | `server/jobs/onboard.job.ts` |
| `Injector.get(cls, tenantId)` for explicit tenant-scoped resolution outside a controller | Domain 1 (`server/config/bootstrap.ts`) |
| Automatic tenant scoping — no `tenantId` in any method here | Domain 1 |

## Verification

1. Upload a bank statement (Domain 3), `POST /api/extraction/:sourceDocumentId/run` → confirm `ExtractedData` persisted with fields + confidence scores, independent of any TB comparison.
2. `GET /api/extraction/:sourceDocumentId` → confirm the structured result renders in `ExtractionResultComponent`.
3. Re-run extraction on the same document → confirm the `extracted_data` row is replaced (upsert on `sourceDocumentId`), not duplicated.
4. Upload a PDF mortgage statement, run extraction → confirm it routes through ChatGPT (`aiModel: 'gpt-5.2'` on the resulting `ExtractedData`) and the new `chatgpt.service.ts` file-content-block mapping actually returns structured fields, not an empty/garbled response.
5. As a user in a different tenant, `GET /api/extraction/:sourceDocumentId` for the first tenant's document → confirm nothing returned (automatic tenant isolation).
