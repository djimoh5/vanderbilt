import { BaseModel } from './shared.model';
import { uniqueid } from './id.model';

// Passive log only - not used for anything active in MVP, cheap to capture now for future
// confidence-threshold tuning.
export class ExtractionAccuracy implements BaseModel {
    oid?: uniqueid;
    reviewItemId: uniqueid;
    extractedDataId: uniqueid;
    commentCount: number;
    wasAiCorrect: boolean; // true iff commentCount === 0 at resolution
    resolvedAt: number;
}
