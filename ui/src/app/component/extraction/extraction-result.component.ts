import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe, DecimalPipe, CurrencyPipe } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { BaseComponent } from 'bundle/component';
import { AppService, ExtractionService, ReconciliationService } from 'bundle/service';
import { ExtractedData, ReconciliationResult, ReconciliationStatus } from 'bundle/model';

@Component({
    selector: 'app-extraction-result',
    imports: [
        RouterLink,
        FormsModule,
        DatePipe,
        DecimalPipe,
        CurrencyPipe,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatChipsModule,
        MatTableModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressSpinnerModule,
        MatSnackBarModule
    ],
    templateUrl: './extraction-result.component.html',
    styleUrl: './extraction-result.component.scss'
})
export class ExtractionResultComponent extends BaseComponent implements OnInit {
    sourceDocumentId: string;

    loading = false;
    running = false;
    result: ExtractedData | null = null;

    reconciling = false;
    reconciliation: ReconciliationResult | null = null;
    tbAccountNumberOverride = '';
    showAccountOverride = false;

    displayedColumns = ['name', 'value', 'confidence'];

    constructor(
        appService: AppService,
        private route: ActivatedRoute,
        private extractionService: ExtractionService,
        private reconciliationService: ReconciliationService,
        private snackBar: MatSnackBar,
        private cdr: ChangeDetectorRef
    ) {
        super(appService);
    }

    async ngOnInit(): Promise<void> {
        this.sourceDocumentId = this.route.snapshot.paramMap.get('sourceDocumentId');
        await this.loadResult();
    }

    async loadResult() {
        this.loading = true;
        const res = await this.extractionService.getResult(this.sourceDocumentId);
        this.loading = false;

        this.result = res.success && res.data ? res.data : null;
        this.cdr.detectChanges();

        if (this.result) {
            await this.loadReconciliation();
        }
    }

    async loadReconciliation() {
        const res = await this.reconciliationService.getByExtractedData(this.result.oid as string);
        this.reconciliation = res.success && res.data ? res.data : null;
        this.cdr.detectChanges();
    }

    async runExtraction() {
        this.running = true;
        const res = await this.extractionService.run(this.sourceDocumentId);
        this.running = false;

        if (res.success) {
            this.snackBar.open('Extraction complete', 'close', { duration: 3000 });
            await this.loadResult();
        } else {
            this.snackBar.open(res.msg || 'Extraction failed', 'close', { duration: 5000 });
        }

        this.cdr.detectChanges();
    }

    async runReconciliation() {
        this.reconciling = true;
        const res = await this.reconciliationService.run(this.result.oid as string, this.tbAccountNumberOverride || undefined);
        this.reconciling = false;

        if (res.success) {
            this.reconciliation = res.data;
            this.showAccountOverride = false;
            this.snackBar.open(`Reconciliation: ${this.statusLabel(res.data.status)}`, 'close', { duration: 3000 });
        } else {
            // ambiguous/missing TB account errors are the one case where the user can self-correct
            // by supplying the account number directly, so surface the input instead of just failing
            this.showAccountOverride = true;
            this.snackBar.open(res.msg || 'Reconciliation failed', 'close', { duration: 7000 });
        }

        this.cdr.detectChanges();
    }

    confidenceClass(confidence: number): string {
        if (confidence >= 0.8) {
            return 'confidence-high';
        }
        if (confidence >= 0.5) {
            return 'confidence-medium';
        }
        return 'confidence-low';
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
}
