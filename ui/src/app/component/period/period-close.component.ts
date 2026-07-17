import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { DatePipe } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog } from '@angular/material/dialog';

import { BaseComponent } from 'bundle/component';
import { AppService, WorkspaceService, PeriodService, PeriodStatusSummary, ReviewService, ChecklistService } from 'bundle/service';
import { WorkspaceChangedEvent } from 'bundle/event';
import { PeriodStatus, ChecklistItemStatus } from 'bundle/model';

import { LockPeriodDialogComponent, LockPeriodDialogData } from './lock-period-dialog.component';

@Component({
    selector: 'app-period-close',
    imports: [
        DatePipe,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatChipsModule,
        MatProgressSpinnerModule,
        MatSnackBarModule
    ],
    templateUrl: './period-close.component.html',
    styleUrl: './period-close.component.scss'
})
export class PeriodCloseComponent extends BaseComponent implements OnInit {
    loading = false;
    transitioning = false;
    summary: PeriodStatusSummary | null = null;

    readonly PeriodStatus = PeriodStatus;

    constructor(
        appService: AppService,
        public workspaceService: WorkspaceService,
        private periodService: PeriodService,
        private reviewService: ReviewService,
        private checklistService: ChecklistService,
        private dialog: MatDialog,
        private snackBar: MatSnackBar,
        private cdr: ChangeDetectorRef
    ) {
        super(appService);
    }

    async ngOnInit(): Promise<void> {
        await this.workspaceService.ready();
        this.subscribeEvent(WorkspaceChangedEvent, () => this.loadSummary());
        await this.loadSummary();
    }

    async loadSummary() {
        this.summary = null;

        const propertyId = this.workspaceService.currentPropertyId;
        const period = this.workspaceService.currentPeriod;

        if (!propertyId || !period) {
            this.cdr.detectChanges();
            return;
        }

        this.loading = true;
        const res = await this.periodService.getStatusSummary(propertyId, period);
        this.loading = false;

        this.summary = res.success ? res.data : null;
        this.cdr.detectChanges();
    }

    statusClass(status: PeriodStatus): string {
        switch (status) {
            case PeriodStatus.Open: return 'status-open';
            case PeriodStatus.InReview: return 'status-in-review';
            case PeriodStatus.Locked: return 'status-locked';
            default: return '';
        }
    }

    statusLabel(status: PeriodStatus): string {
        switch (status) {
            case PeriodStatus.Open: return 'Open';
            case PeriodStatus.InReview: return 'In Review';
            case PeriodStatus.Locked: return 'Locked';
            default: return status;
        }
    }

    async moveToInReview() {
        await this.doTransition(PeriodStatus.InReview);
    }

    async openLockConfirm() {
        const propertyId = this.workspaceService.currentPropertyId;
        const period = this.workspaceService.currentPeriod;

        const [inboxRes, checklistRes, templatesRes] = await Promise.all([
            this.reviewService.getInbox(),
            this.checklistService.getByPropertyPeriod(propertyId, period),
            this.checklistService.getTemplates()
        ]);

        const reviewItems = (inboxRes.success ? inboxRes.data : [])
            .filter(entry => entry.item.propertyId === propertyId && entry.item.period === period);

        const labelByKey = new Map<string, string>();
        (templatesRes.success ? templatesRes.data : []).forEach(t => t.items.forEach(i => labelByKey.set(i.key, i.label)));

        const instance = checklistRes.success ? checklistRes.data : null;
        const checklistItems = instance
            ? instance.responses.filter(r => r.status === ChecklistItemStatus.Unanswered).map(r => labelByKey.get(r.itemKey) || r.itemKey)
            : [];

        const data: LockPeriodDialogData = { reviewItems, checklistItems };
        const confirmed = await this.dialog.open(LockPeriodDialogComponent, { width: '480px', data }).afterClosed().toPromise();

        if (confirmed) {
            await this.doTransition(PeriodStatus.Locked);
        }
    }

    private async doTransition(status: PeriodStatus) {
        const propertyId = this.workspaceService.currentPropertyId;
        const period = this.workspaceService.currentPeriod;

        this.transitioning = true;
        const res = await this.periodService.transition(propertyId, period, status);
        this.transitioning = false;

        if (res.success) {
            this.snackBar.open(`Period marked ${this.statusLabel(status)}`, 'close', { duration: 3000 });
            await this.loadSummary();
        } else {
            this.snackBar.open(res.msg || 'Failed to update period status', 'close', { duration: 5000 });
        }

        this.cdr.detectChanges();
    }
}
