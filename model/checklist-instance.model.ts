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
    templateIds: uniqueid[]; // one per category document, since ChecklistTemplate is split one-document-per-category
    responses: ChecklistItemResponse[];
    createdAt: number;
}
