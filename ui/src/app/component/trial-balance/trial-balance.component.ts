import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule, Sort } from '@angular/material/sort';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';

import { BaseComponent } from 'bundle/component';
import { AppService, DocumentService, TrialBalanceService, WorkspaceService } from 'bundle/service';
import { WorkspaceChangedEvent } from 'bundle/event';
import { TrialBalanceSnapshot, TrialBalanceAccountLine } from 'bundle/model';

@Component({
    selector: 'app-trial-balance',
    imports: [
        CurrencyPipe,
        DatePipe,
        MatCardModule,
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

    selectedFile: File | null = null;
    uploading = false;

    loadingSnapshot = false;
    snapshot: TrialBalanceSnapshot | null = null;
    sortedAccounts: TrialBalanceAccountLine[] = [];

    displayedColumns = ['accountNumber', 'accountName', 'balance'];

    constructor(
        appService: AppService,
        public workspaceService: WorkspaceService,
        private documentService: DocumentService,
        private trialBalanceService: TrialBalanceService,
        private snackBar: MatSnackBar,
        private cdr: ChangeDetectorRef
    ) {
        super(appService);
    }

    async ngOnInit(): Promise<void> {
        await this.workspaceService.ready();
        this.subscribeEvent(WorkspaceChangedEvent, () => this.onWorkspaceChanged());
        await this.loadSnapshot();
    }

    private async onWorkspaceChanged() {
        this.clearSelectedFile();
        await this.loadSnapshot();
    }

    private clearSelectedFile() {
        this.selectedFile = null;
        if (this.fileInputRef) {
            this.fileInputRef.nativeElement.value = '';
        }
    }

    async loadSnapshot() {
        this.snapshot = null;
        this.sortedAccounts = [];

        const propertyId = this.workspaceService.currentPropertyId;
        const period = this.workspaceService.currentPeriod;

        if (!propertyId || !period) {
            this.cdr.detectChanges();
            return;
        }

        this.loadingSnapshot = true;
        const res = await this.trialBalanceService.getByPropertyPeriod(propertyId, period);
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
        const propertyId = this.workspaceService.currentPropertyId;
        const period = this.workspaceService.currentPeriod;

        if (!propertyId || !period || !this.selectedFile) {
            return;
        }

        this.uploading = true;

        const uploadInfo = await this.documentService.getUploadInfo(this.selectedFile);
        await this.documentService.uploadFile(uploadInfo.signedRequest, this.selectedFile);
        const res = await this.trialBalanceService.import(propertyId, period, uploadInfo.url);

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
