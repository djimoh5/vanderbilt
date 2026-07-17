import { Bootstrap, Injectable } from '../config/bootstrap';
import { BaseRepository } from './base.repository';
import { SortOrder } from '../database/operations';
import { ReviewItem, ReviewItemStatus } from '../../model/review-item.model';
import { uniqueid } from '../../model/id.model';

@Injectable()
@Bootstrap()
export class ReviewItemRepository extends BaseRepository {
    constructor() {
        super('review_item');
    }

    getById(reviewItemId: uniqueid): Promise<ReviewItem> {
        return this.context.findOne({ oid: reviewItemId });
    }

    getOpenInbox(propertyIds?: uniqueid[]): Promise<ReviewItem[]> {
        const query: any = { status: ReviewItemStatus.Open };
        if (propertyIds?.length) {
            query.propertyId = { $in: propertyIds };
        }
        return this.context.find(query, null, { sort: { createdAt: SortOrder.Descending } });
    }

    // lets a re-run of reconciliation on the same document refresh the still-open item instead of
    // spawning a duplicate one
    getOpenByExtractedData(extractedDataId: uniqueid): Promise<ReviewItem> {
        return this.context.findOne({ extractedDataId, status: ReviewItemStatus.Open });
    }

    save(item: ReviewItem): Promise<ReviewItem> {
        return super.updateObject(item);
    }
}
