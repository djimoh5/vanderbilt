import { BaseModel } from './shared.model';
import { uniqueid } from './id.model';

export enum StatementType { BalanceSheet = 'balance_sheet', IncomeStatement = 'income_statement' }
export enum AccountSourceType { Yardi = 'yardi', Manual = 'manual' }

export class ChartOfAccount implements BaseModel {
    oid?: uniqueid;
    accountNumber: string;
    name: string;
    statementType: StatementType;
    category: string;             // e.g. 'Cash', 'AR', 'Fixed Assets'
    subCategory?: string;
    sourceType: AccountSourceType;
    isTemplate: boolean;          // true only on the platform starter-template rows
}

export class AccountActivation implements BaseModel {
    oid?: uniqueid;
    propertyId: uniqueid;
    accountId: uniqueid;          // ChartOfAccount.oid
    active: boolean;
}
