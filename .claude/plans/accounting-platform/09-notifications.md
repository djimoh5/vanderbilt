# Plan: Domain 9 — Notifications

## Context

Mandrill-triggered emails for checklist item assignment, stale review items, and period lock — cross-cutting, wired in once Domains 6–8 exist. Reuses the existing `EmailService` (`server/service/email.service.ts`) exactly as `AuthService` already does for login-code/invite emails — no new queuing infrastructure, since `EmailService.post()`'s existing single-retry-on-5xx/408 is sufficient for MVP notification volume. Tenant scoping is automatic (Domain 1); notifications don't introduce any new tenant-scoped data beyond what `email_log` already captures per-send.

**Demoable outcome:** assigning a checklist item, letting a review item go stale, and locking a period each produce a real (or dev-redirected) email, visible in `email_log`.

---

## Files to Create

### `server/service/notification.service.ts`

```typescript
@Injectable()
@Bootstrap()
export class NotificationService extends BaseService {
    constructor(appService: AppService, private emailService: EmailService, private authRepository: AuthRepository) {
        super(appService);
    }

    async notifyChecklistAssigned(instanceId: uniqueid, itemKey: string, assignedUserId: authid): Promise<void> {
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
        const users = await this.authRepository.getByOids(recipients as any);
        const email: Email = {
            to: users.map(u => u.username),
            subject: `${Config.APP_NAME}: period ${period.period} locked`,
            html: `<div style="font-size: 16px;">Property ${period.propertyId}'s ${period.period} period has been locked by ${period.lockedBy}.</div>`
        };
        await this.emailService.sendEmail(email, period.lockedBy as string);
    }
}
```

Mirrors the exact pattern already used for login-code emails in `server/service/auth.service.ts` — a plain `Email` object built inline, sent via `EmailService.sendEmail`. No template system needed for MVP (the existing generic Mandrill `main-template`/`sendTemplate` path is available later if richer formatting is wanted).

### `server/jobs/stale-review.job.ts`

```typescript
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

            for (const item of stale) {
                if (item.assignedTo) {
                    await this.notificationService.notifyReviewItemStale(item, item.assignedTo);
                }
            }

            this.done({ success: true, data: { notified: stale.length } });
        }
        catch (err) {
            this.done({ success: false, data: err, msg: err.message });
        }
    }
}
```

*Scheduling this job (cron/n8n/etc.) is the user's own separate work, consistent with Domain 4's note — this plan only covers the job's own logic, not how/when it's triggered. It also only checks the single tenant it's resolved under (via `Injector.get(StaleReviewJob, tenantId)`), so a scheduler would need to loop over all tenants, or this job's scope expands to a cross-tenant sweep — an open question to resolve when the scheduling mechanism itself is designed, out of scope here.*

---

## Files to Modify

### `server/service/checklist.service.ts` (Domain 7)

`updateItemStatus`/a new `assignItem` method calls `notificationService.notifyChecklistAssigned(instanceId, itemKey, assignedUserId)` when an item's `assignedTo` is set.

### `server/service/period.service.ts` (Domain 8)

`transition(...)` calls `notificationService.notifyPeriodLocked(period, recipients)` when `newStatus === PeriodStatus.Locked` — `recipients` sourced from the property's `PropertyRole` assignments (Domain 1).

---

## Angular

No dedicated UI — notifications are server-triggered side effects of actions already covered by Domains 7/8's components (assigning a checklist item, locking a period). No new routes/components.

---

## Key Patterns Reused

| What | Where |
|------|-------|
| `EmailService.sendEmail` + non-release safe-redirect (`Config.EMAIL.admin`) | `server/service/auth.service.ts` login-code/invite emails |
| `email_log` auditing of every send | `server/repository/email-log.repository.ts` |
| `Job extends ... run(context) { this.done({...}) }` | `server/jobs/onboard.job.ts` |
| Automatic tenant scoping — no `tenantId` in any method here | Domain 1 |

## Verification

1. Assign a checklist item to a user (Domain 7) → confirm an email is sent (or redirected to `Config.EMAIL.admin` in non-release environments, per `EmailService`'s existing safety net) and logged in `email_log`.
2. Lock a period (Domain 8) → confirm a "period locked" email is sent to the property's role-assigned users and logged.
3. Manually run `StaleReviewJob` (`ts-node jobs/stale-review.app.ts` style entry point) against a review item older than the threshold with an assignee → confirm a stale-notification email is sent; confirm a review item younger than the threshold produces no email.
4. Confirm none of this domain's code references `tenantId` directly — email recipients are resolved via `AuthRepository`/`PropertyRoleRepository`, both automatically tenant-scoped.
