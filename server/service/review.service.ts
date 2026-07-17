import { Bootstrap, Injectable } from '../config/bootstrap';
import { ReviewItemRepository } from '../repository/review-item.repository';
import { ExtractionAccuracyRepository } from '../repository/extraction-accuracy.repository';
import { ReconciliationResultRepository } from '../repository/reconciliation-result.repository';
import { ExtractedDataRepository } from '../repository/extracted-data.repository';
import { TrialBalanceRepository } from '../repository/trial-balance.repository';
import { PropertyRoleRepository } from '../repository/property-role.repository';
import { PropertyRepository } from '../repository/property.repository';

import { ApiResponse, ApiErrorResponse, BaseService } from './base.service';
import { AppService } from './app.service';

import { ReviewItem, ReviewItemStatus, ReviewInboxEntry, ReviewItemDetail } from '../../model/review-item.model';
import { ExtractionAccuracy } from '../../model/extraction-accuracy.model';
import { ReconciliationResult } from '../../model/reconciliation-result.model';
import { UniqueId, uniqueid, authid } from '../../model/id.model';
import { Common } from '../../utility/common';

@Injectable()
@Bootstrap()
export class ReviewService extends BaseService {
    constructor(
        appService: AppService,
        private reviewItemRepository: ReviewItemRepository,
        private extractionAccuracyRepository: ExtractionAccuracyRepository,
        private reconciliationResultRepository: ReconciliationResultRepository,
        private extractedDataRepository: ExtractedDataRepository,
        private trialBalanceRepository: TrialBalanceRepository,
        private propertyRoleRepository: PropertyRoleRepository,
        private propertyRepository: PropertyRepository
    ) {
        super(appService);
    }

    // Called from ReconciliationService whenever a run doesn't auto-tie. Re-running reconciliation
    // on the same document replaces its ReconciliationResult (new oid) even when nothing material
    // changed, so this refreshes the still-open item for that document instead of piling up duplicates.
    async createFromReconciliation(reconciliationResultId: uniqueid): Promise<ReviewItem> {
        const result = await this.reconciliationResultRepository.getByObjectId<ReconciliationResult>(reconciliationResultId);

        const existing = await this.reviewItemRepository.getOpenByExtractedData(result.extractedDataId);
        if (existing) {
            existing.reconciliationResultId = reconciliationResultId;
            await this.reviewItemRepository.save(existing);
            return existing;
        }

        const item = new ReviewItem();
        item.oid = UniqueId(Common.uniqueId());
        item.propertyId = result.propertyId;
        item.period = result.period;
        item.reconciliationResultId = reconciliationResultId;
        item.extractedDataId = result.extractedDataId;
        item.status = ReviewItemStatus.Open;
        item.comments = [];
        item.createdAt = Date.now();

        await this.reviewItemRepository.save(item);
        return item;
    }

    async getInbox(userId: authid): Promise<ApiResponse<ReviewInboxEntry[]>> {
        const roles = await this.propertyRoleRepository.getByUser(userId);
        const propertyIds = roles.filter(r => r.propertyId).map(r => r.propertyId);
        const items = await this.reviewItemRepository.getOpenInbox(propertyIds.length ? propertyIds : undefined);

        if (items.length === 0) {
            return new ApiResponse(true, []);
        }

        const [properties, results] = await Promise.all([
            this.propertyRepository.getAll(),
            Promise.all(items.map(item => this.reconciliationResultRepository.getByObjectId<ReconciliationResult>(item.reconciliationResultId)))
        ]);

        const propertyNameById = new Map(properties.map(p => [p.oid as string, p.name]));

        const entries: ReviewInboxEntry[] = items.map((item, i) => ({
            item,
            propertyName: propertyNameById.get(item.propertyId as string) || 'Unknown property',
            tbAccountNumber: results[i] ? results[i].tbAccountNumber : '',
            variance: results[i] ? results[i].variance : 0
        }));

        return new ApiResponse(true, entries);
    }

    async getDetail(reviewItemId: uniqueid): Promise<ApiResponse<ReviewItemDetail>> {
        const item = await this.reviewItemRepository.getById(reviewItemId);
        if (!item) {
            return new ApiErrorResponse('review item not found');
        }

        const [property, reconciliation, extracted, tb] = await Promise.all([
            this.propertyRepository.getById(item.propertyId),
            this.reconciliationResultRepository.getByObjectId<ReconciliationResult>(item.reconciliationResultId),
            this.extractedDataRepository.getById(item.extractedDataId),
            this.trialBalanceRepository.getByPropertyPeriod(item.propertyId, item.period)
        ]);
        const tbLine = tb?.accounts.find(a => a.accountNumber === reconciliation.tbAccountNumber);

        return new ApiResponse(true, { item, propertyName: property?.name || 'Unknown property', reconciliation, extracted, tbLine });
    }

    // no notification is fired here (unlike ChecklistService.assignItem) - Domain 9 only notifies on
    // review items going *stale*, not on initial assignment, so StaleReviewJob is this action's sole consumer
    async assign(reviewItemId: uniqueid, userId: authid): Promise<ApiResponse<ReviewItem>> {
        const item = await this.reviewItemRepository.getById(reviewItemId);
        if (!item) {
            return new ApiErrorResponse('review item not found');
        }

        item.assignedTo = userId;
        await this.reviewItemRepository.save(item);
        return new ApiResponse(true, item);
    }

    async addComment(reviewItemId: uniqueid, userId: authid, text: string): Promise<ApiResponse<ReviewItem>> {
        const item = await this.reviewItemRepository.getById(reviewItemId);
        if (!item) {
            return new ApiErrorResponse('review item not found');
        }

        item.comments.push({ authorId: userId, text, createdAt: Date.now() });
        await this.reviewItemRepository.save(item);
        return new ApiResponse(true, item);
    }

    async resolve(reviewItemId: uniqueid, userId: authid, decision: 'approved' | 'rejected'): Promise<ApiResponse<ReviewItem>> {
        const item = await this.reviewItemRepository.getById(reviewItemId);
        if (!item) {
            return new ApiErrorResponse('review item not found');
        }
        if (item.status !== ReviewItemStatus.Open) {
            return new ApiErrorResponse('review item is already resolved');
        }

        item.status = decision === 'approved' ? ReviewItemStatus.Approved : ReviewItemStatus.Rejected;
        item.resolvedAt = Date.now();
        item.resolvedBy = userId;
        await this.reviewItemRepository.save(item);

        const accuracy = new ExtractionAccuracy();
        accuracy.oid = UniqueId(Common.uniqueId());
        accuracy.reviewItemId = reviewItemId;
        accuracy.extractedDataId = item.extractedDataId;
        accuracy.commentCount = item.comments.length;
        accuracy.wasAiCorrect = item.comments.length === 0;
        accuracy.resolvedAt = Date.now();
        await this.extractionAccuracyRepository.save(accuracy);

        return new ApiResponse(true, item);
    }
}
