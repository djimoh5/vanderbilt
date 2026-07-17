import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CurrencyPipe, DatePipe } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';

import { BaseComponent } from 'bundle/component';
import { AppService, PropertyService, DocumentService, TrialBalanceService } from 'bundle/service';
import { Property, TrialBalanceSnapshot, TrialBalanceAccountLine } from 'bundle/model';

@Component({
    selector: 'app-trial-balance',
    imports: [
        FormsModule,
        CurrencyPipe,
        DatePipe,
        MatCardModule,
        MatFormFieldModule,
        MatSelectModule,
        MatButtonModule,
        MatIconModule,
        MatTableModule,
        MatSortModule,
        MatProgressSpinnerModule,
        MatSnackBarModule,
        MatChipsModule
    ],
    templateUrl: './trial-balance.component.html',
    styleUrl: './trial-balance.component.scss'
})
export class TrialBalanceComponent extends BaseComponent implements OnInit {
    @ViewChild('fileInput') fileInputRef: ElementRef<HTMLInputElement>;

    properties: Property[] = [];
    selectedPropertyId = '';

    months = [
        { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
        { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
        { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
        { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' }
    ];
    years = Array.from({ length: 2050 - 2010 + 1 }, (_, i) => 2010 + i);

    selectedMonth: number | null = null;
    selectedYear: number | null = null;

    get period(): string {
        if (!this.selectedMonth || !this.selectedYear) {
            return '';
        }
        return `${this.selectedYear}-${String(this.selectedMonth).padStart(2, '0')}`;
    }

    selectedFile: File | null = null;
    uploading = false;

    loadingSnapshot = false;
    snapshot: TrialBalanceSnapshot | null = null;
    sortedAccounts: TrialBalanceAccountLine[] = [];

    displayedColumns = ['accountNumber', 'accountName', 'balance'];

    constructor(
        appService: AppService,
        private propertyService: PropertyService,
        private documentService: DocumentService,
        private trialBalanceService: TrialBalanceService,
        private snackBar: MatSnackBar,
        private cdr: ChangeDetectorRef
    ) {
        super(appService);
    }

    async ngOnInit(): Promise<void> {
        const res = await this.propertyService.getAll();

        if (res.success) {
            this.properties = res.data;

            if (this.properties.length > 0) {
                this.selectedPropertyId = this.properties[0].oid as string;
            }
        }

        this.cdr.detectChanges();
    }

    async onSelectionChange() {
        this.selectedFile = null;
        if (this.fileInputRef) {
            this.fileInputRef.nativeElement.value = '';
        }

        await this.loadSnapshot();
    }

    async loadSnapshot() {
        this.snapshot = null;
        this.sortedAccounts = [];

        if (!this.selectedPropertyId || !this.period) {
            return;
        }

        this.loadingSnapshot = true;
        const res = await this.trialBalanceService.getByPropertyPeriod(this.selectedPropertyId, this.period);
        this.loadingSnapshot = false;

        if (res.success && res.data) {
            this.snapshot = res.data;
            this.sortedAccounts = [...res.data.accounts];
        }

        this.cdr.detectChanges();
    }

    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        this.selectedFile = input.files && input.files.length > 0 ? input.files[0] : null;
    }

    async upload() {
        if (!this.selectedPropertyId || !this.period || !this.selectedFile) {
            return;
        }

        this.uploading = true;

        const uploadInfo = await this.documentService.getUploadInfo(this.selectedFile);
        await this.documentService.uploadFile(uploadInfo.signedRequest, this.selectedFile);
        const res = await this.trialBalanceService.import(this.selectedPropertyId, this.period, uploadInfo.url);

        this.uploading = false;

        if (res.success) {
            this.snapshot = res.data;
            this.sortedAccounts = [...res.data.accounts];
            this.selectedFile = null;
            if (this.fileInputRef) {
                this.fileInputRef.nativeElement.value = '';
            }
            this.snackBar.open(`Imported ${res.data.accounts.length} accounts`, 'close', { duration: 3000 });
        } else {
            this.snackBar.open(res.msg || 'Failed to import trial balance', 'close', { duration: 5000 });
        }

        this.cdr.detectChanges();
    }

    sortAccounts(sort: Sort) {
        const accounts = [...(this.snapshot ? this.snapshot.accounts : [])];

        if (!sort.active || sort.direction === '') {
            this.sortedAccounts = accounts;
            return;
        }

        const dir = sort.direction === 'asc' ? 1 : -1;
        this.sortedAccounts = accounts.sort((a, b) => {
            const aVal = a[sort.active as keyof TrialBalanceAccountLine];
            const bVal = b[sort.active as keyof TrialBalanceAccountLine];
            if (typeof aVal === 'number' && typeof bVal === 'number') {
                return (aVal - bVal) * dir;
            }
            return String(aVal).localeCompare(String(bVal)) * dir;
        });
    }
}
