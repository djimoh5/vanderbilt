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
