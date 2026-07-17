import { Bootstrap, Injectable } from '../config/bootstrap';
import { PeriodRepository } from '../repository/period.repository';
import { ReviewItemRepository } from '../repository/review-item.repository';
import { ChecklistInstanceRepository } from '../repository/checklist-instance.repository';
import { PropertyRoleRepository } from '../repository/property-role.repository';
import { NotificationService } from './notification.service';

import { ApiResponse, BaseService } from './base.service';
import { AppService } from './app.service';

import { Period, PeriodStatus } from '../../model/period.model';
import { ChecklistItemStatus } from '../../model/checklist-instance.model';
import { UniqueId, uniqueid, authid } from '../../model/id.model';
import { Common } from '../../utility/common';

@Injectable()
@Bootstrap()
export class PeriodService extends BaseService {
    constructor(
        appService: AppService,
        private periodRepository: PeriodRepository,
        private reviewItemRepository: ReviewItemRepository,
        private checklistInstanceRepository: ChecklistInstanceRepository,
        private propertyRoleRepository: PropertyRoleRepository,
        private notificationService: NotificationService
    ) {
        super(appService);
    }

    async getStatusSummary(propertyId: uniqueid, period: string): Promise<ApiResponse<{ period: Period, openReviewItems: number, openChecklistItems: number }>> {
        let p = await this.periodRepository.getByPropertyPeriod(propertyId, period);
        if (!p) {
            p = new Period();
            p.oid = UniqueId(Common.uniqueId());
            p.propertyId = propertyId;
            p.period = period;
            p.status = PeriodStatus.Open;
            await this.periodRepository.save(p);
        }

        const openReviewItems = (await this.reviewItemRepository.getOpenInbox([propertyId])).filter(i => i.period === period).length;
        const checklist = await this.checklistInstanceRepository.getByPropertyPeriod(propertyId, period);
        const openChecklistItems = checklist ? checklist.responses.filter(r => r.status === ChecklistItemStatus.Unanswered).length : 0;

        return new ApiResponse(true, { period: p, openReviewItems, openChecklistItems });
    }

    async transition(propertyId: uniqueid, period: string, newStatus: PeriodStatus, userId: authid): Promise<ApiResponse<Period>> {
        let p = await this.periodRepository.getByPropertyPeriod(propertyId, period);
        if (!p) {
            p = new Period();
            p.oid = UniqueId(Common.uniqueId());
            p.propertyId = propertyId;
            p.period = period;
        }

        p.status = newStatus;
        if (newStatus === PeriodStatus.Locked) {
            p.lockedBy = userId;
            p.lockedAt = Date.now();
        }

        // deliberately no gating check here - locking with open items is allowed; the "stern warning"
        // is a client-side confirmation in front of this call, not a server-side block
        await this.periodRepository.save(p);

        if (newStatus === PeriodStatus.Locked) {
            const roles = await this.propertyRoleRepository.getByProperty(propertyId);
            const recipients = roles.map(r => r.userId);
            await this.notificationService.notifyPeriodLocked(p, recipients);
        }

        return new ApiResponse(true, p);
    }
}
