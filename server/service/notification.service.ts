import { Bootstrap, Injectable } from '../config/bootstrap';
import { EmailService } from './email.service';
import { AuthRepository } from '../repository/auth.repository';

import { BaseService } from './base.service';
import { AppService } from './app.service';
import { Config } from '../config/config';

import { Email } from '../../model/email.model';
import { ReviewItem } from '../../model/review-item.model';
import { Period } from '../../model/period.model';
import { authid, uniqueid } from '../../model/id.model';

@Injectable()
@Bootstrap()
export class NotificationService extends BaseService {
    constructor(appService: AppService, private emailService: EmailService, private authRepository: AuthRepository) {
        super(appService);
    }

    async notifyChecklistAssigned(_instanceId: uniqueid, _itemKey: string, assignedUserId: authid): Promise<void> {
        const user = await this.authRepository.getByOids([assignedUserId as any]).then(u => u[0]);
        if (!user) return;

        const email: Email = {
            to: [user.username],
            subject: `${Config.APP_NAME}: checklist item assigned to you`,
            html: `<div style="font-size: 16px;">You've been assigned a PreClose Checklist item. <a href="${Config.APP_URL}/checklist">Review it</a>.</div>`
        };
        await this.emailService.sendEmail(email, assignedUserId as string);
    }

    async notifyReviewItemStale(reviewItem: ReviewItem, staleAssignee: authid): Promise<void> {
        const user = await this.authRepository.getByOids([staleAssignee as any]).then(u => u[0]);
        if (!user) return;

        const email: Email = {
            to: [user.username],
            subject: `${Config.APP_NAME}: review item pending too long`,
            html: `<div style="font-size: 16px;">A reconciliation review item on property ${reviewItem.propertyId} (${reviewItem.period}) has been open for a while. <a href="${Config.APP_URL}/review/${reviewItem.oid}">Review it</a>.</div>`
        };
        await this.emailService.sendEmail(email, staleAssignee as string);
    }

    async notifyPeriodLocked(period: Period, recipients: authid[]): Promise<void> {
        if (recipients.length === 0) return;

        const users = await this.authRepository.getByOids(recipients as any);
        if (users.length === 0) return;

        const email: Email = {
            to: users.map(u => u.username),
            subject: `${Config.APP_NAME}: period ${period.period} locked`,
            html: `<div style="font-size: 16px;">Property ${period.propertyId}'s ${period.period} period has been locked by ${period.lockedBy}.</div>`
        };
        await this.emailService.sendEmail(email, period.lockedBy as string);
    }
}
