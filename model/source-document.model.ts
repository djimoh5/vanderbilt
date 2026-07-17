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
