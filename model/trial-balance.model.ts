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
