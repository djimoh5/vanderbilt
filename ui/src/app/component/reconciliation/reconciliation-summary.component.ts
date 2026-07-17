import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrencyPipe, PercentPipe } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { BaseComponent } from 'bundle/component';
import { AppService, WorkspaceService, ReconciliationService } from 'bundle/service';
import { WorkspaceChangedEvent } from 'bundle/event';
import { ReconciliationResult, ReconciliationStatus } from 'bundle/model';

@Component({
    selector: 'app-reconciliation-summary',
    imports: [
        RouterLink,
        CurrencyPipe,
        PercentPipe,
        MatCardModule,
        MatTableModule,
        MatChipsModule,
        MatIconModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatTooltipModule
    ],
    templateUrl: './reconciliation-summary.component.html',
    styleUrl: './reconciliation-summary.component.scss'
})
export class ReconciliationSummaryComponent extends BaseComponent implements OnInit {
    loading = false;
    results: ReconciliationResult[] = [];

    displayedColumns = ['tbAccountNumber', 'tbBalance', 'extractedTotal', 'variance', 'status', 'actions'];

    constructor(appService: AppService, public workspaceService: WorkspaceService, private reconciliationService: ReconciliationService, private cdr: ChangeDetectorRef) {
        super(appService);
    }

    async ngOnInit(): Promise<void> {
        await this.workspaceService.ready();
        this.subscribeEvent(WorkspaceChangedEvent, () => this.loadResults());
        await this.loadResults();
    }

    async loadResults() {
        this.results = [];

        const propertyId = this.workspaceService.currentPropertyId;
        const period = this.workspaceService.currentPeriod;

        if (!propertyId || !period) {
            this.cdr.detectChanges();
            return;
        }

        this.loading = true;
        const res = await this.reconciliationService.getByPropertyPeriod(propertyId, period);
        this.loading = false;

        if (res.success) {
            this.results = res.data;
        }

        this.cdr.detectChanges();
    }

    statusClass(status: ReconciliationStatus): string {
        switch (status) {
            case ReconciliationStatus.AutoTied: return 'status-tied';
            case ReconciliationStatus.NeedsReview: return 'status-review';
            case ReconciliationStatus.Discrepancy: return 'status-discrepancy';
            default: return '';
        }
    }

    statusLabel(status: ReconciliationStatus): string {
        switch (status) {
            case ReconciliationStatus.AutoTied: return 'Auto-Tied';
            case ReconciliationStatus.NeedsReview: return 'Needs Review';
            case ReconciliationStatus.Discrepancy: return 'Discrepancy';
            default: return status;
        }
    }

    readonly ReconciliationStatus = ReconciliationStatus;
}
