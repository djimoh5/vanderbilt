import { Bootstrap, Injectable } from '../config/bootstrap';
import { Job } from '../../model/job.model';

import { ReviewItemRepository } from '../repository/review-item.repository';
import { NotificationService } from '../service/notification.service';

@Injectable()
@Bootstrap()
export class StaleReviewJob extends Job {
    private static STALE_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000; // 3 days, hardcoded default for MVP

    constructor(private reviewItemRepository: ReviewItemRepository, private notificationService: NotificationService) {
        super('StaleReviewJob');
    }

    async run(_context: { data?: any }) {
        try {
            const openItems = await this.reviewItemRepository.getOpenInbox();
            const stale = openItems.filter(i => Date.now() - i.createdAt > StaleReviewJob.STALE_THRESHOLD_MS);

            // "notified" tracks emails actually sent, not every stale item found - a stale item with
            // no assignee is skipped, and reporting stale.length here would overcount
            let notified = 0;
            for (const item of stale) {
                if (item.assignedTo) {
                    await this.notificationService.notifyReviewItemStale(item, item.assignedTo);
                    notified++;
                }
            }

            this.done({ success: true, data: { notified, staleTotal: stale.length } });
        }
        catch (err) {
            this.done({ success: false, data: err, msg: err.message });
        }
    }
}
