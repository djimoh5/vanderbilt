import { BaseModel } from './shared.model';
import { authid, uniqueid } from './id.model';
import { ReconciliationResult } from './reconciliation-result.model';
import { ExtractedData } from './extracted-data.model';
import { TrialBalanceAccountLine } from './trial-balance.model';

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
    extractedDataId: uniqueid; // denormalized from ReconciliationResult, so a re-run can be matched back to the still-open item for this document instead of spawning a duplicate
    status: ReviewItemStatus;
    comments: ReviewComment[];
    assignedTo?: authid;
    createdAt: number;
    resolvedAt?: number;
    resolvedBy?: authid;
}

// Lightweight row for the global inbox list - avoids making the UI re-derive account/variance
// from a separate per-row detail fetch, while getDetail() remains the single full-detail source.
export interface ReviewInboxEntry {
    item: ReviewItem;
    propertyName: string;
    tbAccountNumber: string;
    variance: number;
}

export interface ReviewItemDetail {
    item: ReviewItem;
    propertyName: string;
    reconciliation: ReconciliationResult;
    extracted: ExtractedData;
    tbLine: TrialBalanceAccountLine;
}
