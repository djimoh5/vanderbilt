import { Bootstrap, Injectable } from '../config/bootstrap';
import { ReconciliationResultRepository } from '../repository/reconciliation-result.repository';
import { TenantConfigRepository } from '../repository/tenant-config.repository';
import { ExtractedDataRepository } from '../repository/extracted-data.repository';
import { TrialBalanceRepository } from '../repository/trial-balance.repository';
import { ChartOfAccountRepository } from '../repository/chart-of-account.repository';
import { AccountActivationRepository } from '../repository/account-activation.repository';
import { AIService } from './ai/ai.service';
import { ReviewService } from './review.service';

import { ApiResponse, ApiErrorResponse, BaseService } from './base.service';
import { AppService } from './app.service';

import { ReconciliationResult, ReconciliationStatus } from '../../model/reconciliation-result.model';
import { TenantConfig } from '../../model/tenant-config.model';
import { TrialBalanceAccountLine } from '../../model/trial-balance.model';
import { ExtractedData } from '../../model/extracted-data.model';
import { DocType } from '../../model/source-document.model';
import { AIConversation } from '../../model/ai.model';
import { UniqueId, uniqueid, authid } from '../../model/id.model';
import { Common } from '../../utility/common';

const DEFAULT_TOLERANCE = { dollar: 0, percent: 0 };

// docType -> Chart of Account category, used to auto-resolve which TB line a document reconciles against.
// When a property has more than one active account in that category (e.g. several bank accounts all
// tagged 'Cash'), auto-resolution is ambiguous - there's no field on SourceDocument/ExtractedData today
// that says which specific real-world account a given upload belongs to - so the caller must pass an
// explicit tbAccountNumber override in that case.
const DOC_TYPE_CATEGORY: { [key in DocType]?: string } = {
    [DocType.BankStatement]: 'Cash',
    [DocType.MortgageStatement]: 'Liabilities',
    [DocType.TaxBill]: 'Operating Expenses',
    [DocType.InsuranceInvoice]: 'Operating Expenses',
    [DocType.ParkingReport]: 'Revenue'
};

// Domain 4's extraction prompt doesn't enforce a fixed field vocabulary, so the AI is free to name the
// comparable total however it likes (observed in practice: "Ending Balance" vs "endingBalance" vs
// "Closing Balance"). Match case/whitespace-insensitively against a per-docType candidate list instead
// of a single exact field name.
const FIELD_CANDIDATES: { [key in DocType]?: string[] } = {
    [DocType.BankStatement]: ['ending balance', 'closing balance', 'current balance', 'balance'],
    [DocType.MortgageStatement]: ['principal balance', 'outstanding balance', 'unpaid principal balance', 'balance'],
    [DocType.TaxBill]: ['amount due', 'total due', 'total', 'amount'],
    [DocType.InsuranceInvoice]: ['amount due', 'total due', 'premium', 'total', 'amount'],
    [DocType.ParkingReport]: ['total revenue', 'total income', 'total']
};

// Bank/mortgage statements are a direct, unambiguous dollar comparison - a miss is a real discrepancy.
// Everything else compares an AI-extracted total against a TB line with more interpretive slack (e.g. an
// insurance invoice's "amount due" isn't always the same thing as the TB's accrued balance), so a miss
// there is routed to NeedsReview with an AI-generated explanation instead of a hard Discrepancy.
function isNonDeterministicDocType(docType: DocType): boolean {
    return ![DocType.BankStatement, DocType.MortgageStatement].includes(docType);
}

function normalizeFieldName(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

@Injectable()
@Bootstrap()
export class ReconciliationService extends BaseService {
    constructor(
        appService: AppService,
        private reconciliationResultRepository: ReconciliationResultRepository,
        private tenantConfigRepository: TenantConfigRepository,
        private extractedDataRepository: ExtractedDataRepository,
        private trialBalanceRepository: TrialBalanceRepository,
        private chartOfAccountRepository: ChartOfAccountRepository,
        private accountActivationRepository: AccountActivationRepository,
        private aiService: AIService,
        private reviewService: ReviewService
    ) {
        super(appService);
    }

    async reconcile(extractedDataId: uniqueid, userId: authid, tbAccountNumberOverride?: string): Promise<ApiResponse<ReconciliationResult>> {
        const extracted = await this.extractedDataRepository.getById(extractedDataId);
        if (!extracted) {
            return new ApiErrorResponse('extracted data not found');
        }

        const tb = await this.trialBalanceRepository.getByPropertyPeriod(extracted.propertyId, extracted.period);
        if (!tb) {
            return new ApiErrorResponse(`no Trial Balance imported for ${extracted.period} yet`);
        }

        const accountRes = await this.resolveAccountForDocType(extracted.propertyId, extracted.docType, tbAccountNumberOverride);
        if (!accountRes.success) {
            return new ApiErrorResponse(accountRes.msg);
        }
        const tbAccountNumber = accountRes.data;

        const tbLine = tb.accounts.find(a => a.accountNumber === tbAccountNumber);
        if (!tbLine) {
            return new ApiErrorResponse(`Trial Balance has no account ${tbAccountNumber} for ${extracted.period}`);
        }

        const extractedTotal = this.sumRelevantFields(extracted);

        const config = await this.tenantConfigRepository.get();
        const tolerance = (config && config.varianceTolerance) || DEFAULT_TOLERANCE;

        const variance = extractedTotal - tbLine.balance;
        const variancePercent = tbLine.balance !== 0 ? Math.abs(variance / tbLine.balance) : (variance !== 0 ? 1 : 0);
        const withinTolerance = Math.abs(variance) <= tolerance.dollar || variancePercent <= tolerance.percent;

        const result = new ReconciliationResult();
        result.oid = UniqueId(Common.uniqueId());
        result.propertyId = extracted.propertyId;
        result.period = extracted.period;
        result.extractedDataId = extractedDataId;
        result.sourceDocumentId = extracted.sourceDocumentId;
        result.tbAccountNumber = tbAccountNumber;
        result.tbBalance = tbLine.balance;
        result.extractedTotal = extractedTotal;
        result.variance = variance;
        result.variancePercent = variancePercent;
        result.toleranceUsed = tolerance;

        if (withinTolerance) {
            result.status = ReconciliationStatus.AutoTied;
        }
        else if (isNonDeterministicDocType(extracted.docType)) {
            result.status = ReconciliationStatus.NeedsReview;
            result.aiExplanation = await this.explainVarianceWithAI(extracted, tbLine, userId);
        }
        else {
            result.status = ReconciliationStatus.Discrepancy;
        }

        await this.reconciliationResultRepository.save(result);

        if (result.status !== ReconciliationStatus.AutoTied) {
            await this.reviewService.createFromReconciliation(result.oid);
        }

        return new ApiResponse(true, result);
    }

    getByPropertyPeriod(propertyId: uniqueid, period: string): Promise<ReconciliationResult[]> {
        return this.reconciliationResultRepository.getByPropertyPeriod(propertyId, period);
    }

    getByExtractedData(extractedDataId: uniqueid): Promise<ReconciliationResult> {
        return this.reconciliationResultRepository.getByExtractedData(extractedDataId);
    }

    async getTenantConfig(): Promise<TenantConfig> {
        const config = await this.tenantConfigRepository.get();
        if (config) {
            return config;
        }

        const fallback = new TenantConfig();
        fallback.varianceTolerance = DEFAULT_TOLERANCE;
        fallback.docTypeList = [];
        return fallback;
    }

    async updateTenantConfig(dollar: number, percent: number): Promise<ApiResponse<TenantConfig>> {
        let config = await this.tenantConfigRepository.get();
        if (!config) {
            config = new TenantConfig();
            config.oid = UniqueId(Common.uniqueId());
            config.docTypeList = [];
        }
        config.varianceTolerance = { dollar, percent };
        await this.tenantConfigRepository.save(config);
        return new ApiResponse(true, config);
    }

    private async resolveAccountForDocType(propertyId: uniqueid, docType: DocType, override?: string): Promise<ApiResponse<string>> {
        if (override) {
            return new ApiResponse(true, override);
        }

        const category = DOC_TYPE_CATEGORY[docType];
        if (!category) {
            return new ApiErrorResponse(`no default Chart of Accounts category mapped for document type "${docType}" - pass tbAccountNumber explicitly`);
        }

        const [accounts, activations] = await Promise.all([
            this.chartOfAccountRepository.getByTenant(),
            this.accountActivationRepository.getByProperty(propertyId)
        ]);

        const activeIds = new Set(activations.filter(a => a.active).map(a => a.accountId as string));
        const candidates = accounts.filter(a => a.category === category && activeIds.has(a.oid as string));

        if (candidates.length === 0) {
            return new ApiErrorResponse(`no active "${category}" account found for this property - activate one on the Chart of Accounts page, or pass tbAccountNumber explicitly`);
        }
        if (candidates.length > 1) {
            return new ApiErrorResponse(`multiple active "${category}" accounts found (${candidates.map(a => a.accountNumber).join(', ')}) - pass tbAccountNumber explicitly to disambiguate`);
        }

        return new ApiResponse(true, candidates[0].accountNumber);
    }

    private sumRelevantFields(extracted: ExtractedData): number {
        const candidates = (FIELD_CANDIDATES[extracted.docType] || ['total', 'balance', 'amount']).map(normalizeFieldName);
        const match = extracted.fields.find(f => candidates.includes(normalizeFieldName(f.name)));

        if (!match) {
            return 0;
        }

        const numeric = typeof match.value === 'number' ? match.value : parseFloat(String(match.value).replace(/[^0-9.-]/g, ''));
        return isNaN(numeric) ? 0 : numeric;
    }

    private async explainVarianceWithAI(extracted: ExtractedData, tbLine: TrialBalanceAccountLine, userId: authid): Promise<string> {
        const conversation = new AIConversation(extracted.oid, {
            role: 'system',
            content: 'You are reconciling a supporting schedule against a Trial Balance account. Explain in one or two sentences why the balances might differ, given the extracted fields and the TB balance.'
        });
        conversation.add({ role: 'user', content: JSON.stringify({ extractedFields: extracted.fields, tbBalance: tbLine.balance }) });

        const message = await this.aiService.executeConversation(conversation, { model: 'gpt-5.4-mini' }, userId);
        return (message.content as string) || '';
    }
}
