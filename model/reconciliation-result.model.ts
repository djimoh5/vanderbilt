import { BaseModel } from './shared.model';
import { uniqueid } from './id.model';

export enum ReconciliationStatus { AutoTied = 'auto-tied', NeedsReview = 'needs-review', Discrepancy = 'discrepancy' }

export class ReconciliationResult implements BaseModel {
    oid?: uniqueid;
    propertyId: uniqueid;
    period: string;
    extractedDataId: uniqueid;
    sourceDocumentId: uniqueid; // denormalized from ExtractedData, so the UI can link back to the source document/extraction page
    tbAccountNumber: string;
    tbBalance: number;
    extractedTotal: number;
    variance: number;
    variancePercent: number;
    status: ReconciliationStatus;
    toleranceUsed: { dollar: number; percent: number };
    aiExplanation?: string; // populated only when the AI comparison step runs (non-deterministic doc types)
}
