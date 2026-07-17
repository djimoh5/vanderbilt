import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { BaseComponent } from 'bundle/component';
import { AppService, DocumentService, WorkspaceService } from 'bundle/service';
import { WorkspaceChangedEvent } from 'bundle/event';
import { SourceDocument, DocType } from 'bundle/model';

interface DocTypeOption { value: DocType; label: string; }
interface DocumentGroup { docType: DocType; label: string; latest: SourceDocument; versions: SourceDocument[]; }

@Component({
    selector: 'app-document-list',
    imports: [
        FormsModule,
        RouterLink,
        DatePipe,
        MatCardModule,
        MatFormFieldModule,
        MatSelectModule,
        MatButtonModule,
        MatIconModule,
        MatExpansionModule,
        MatChipsModule,
        MatTooltipModule,
        MatProgressSpinnerModule,
        MatSnackBarModule
    ],
    templateUrl: './document-list.component.html',
    styleUrl: './document-list.component.scss'
})
export class DocumentListComponent extends BaseComponent implements OnInit {
    @ViewChild('fileInput') fileInputRef: ElementRef<HTMLInputElement>;

    docTypes: DocTypeOption[] = [
        { value: DocType.BankStatement, label: 'Bank Statement' },
        { value: DocType.MortgageStatement, label: 'Mortgage Statement' },
        { value: DocType.InsuranceInvoice, label: 'Insurance Invoice' },
        { value: DocType.ParkingReport, label: 'Parking Report' },
        { value: DocType.TaxBill, label: 'Tax Bill' },
        { value: DocType.YardiRentRoll, label: 'Yardi Rent Roll' },
        { value: DocType.YardiARAging, label: 'Yardi AR Aging' },
        { value: DocType.YardiAPAging, label: 'Yardi AP Aging' },
        { value: DocType.YardiFixedAssets, label: 'Yardi Fixed Assets' },
        { value: DocType.TrialBalance, label: 'Trial Balance' },
        { value: DocType.Other, label: 'Other' }
    ];
    selectedDocType: DocType | null = null;

    selectedFile: File | null = null;
    uploading = false;

    loadingDocs = false;
    documentGroups: DocumentGroup[] = [];

    constructor(
        appService: AppService,
        public workspaceService: WorkspaceService,
        private documentService: DocumentService,
        private snackBar: MatSnackBar,
        private cdr: ChangeDetectorRef
    ) {
        super(appService);
    }

    async ngOnInit(): Promise<void> {
        await this.workspaceService.ready();
        this.subscribeEvent(WorkspaceChangedEvent, () => this.onWorkspaceChanged());
        await this.loadDocuments();
    }

    private async onWorkspaceChanged() {
        this.clearSelectedFile();
        await this.loadDocuments();
    }

    async loadDocuments() {
        this.documentGroups = [];

        const propertyId = this.workspaceService.currentPropertyId;
        const period = this.workspaceService.currentPeriod;

        if (!propertyId || !period) {
            this.cdr.detectChanges();
            return;
        }

        this.loadingDocs = true;
        const res = await this.documentService.getByPropertyPeriod(propertyId, period);
        this.loadingDocs = false;

        if (res.success) {
            this.documentGroups = this.groupByDocType(res.data);
        }

        this.cdr.detectChanges();
    }

    private groupByDocType(docs: SourceDocument[]): DocumentGroup[] {
        const byType = new Map<DocType, SourceDocument[]>();

        for (const doc of docs) {
            if (!byType.has(doc.docType)) {
                byType.set(doc.docType, []);
            }
            byType.get(doc.docType)!.push(doc);
        }

        return Array.from(byType.entries()).map(([docType, versions]) => {
            versions.sort((a, b) => b.version - a.version);
            return { docType, label: this.labelFor(docType), latest: versions[0], versions };
        }).sort((a, b) => a.label.localeCompare(b.label));
    }

    labelFor(docType: DocType): string {
        return this.docTypes.find(d => d.value === docType)?.label || docType;
    }

    onFileSelected(event: Event) {
        const input = event.target as HTMLInputElement;
        this.selectedFile = input.files && input.files.length > 0 ? input.files[0] : null;
    }

    private clearSelectedFile() {
        this.selectedFile = null;
        if (this.fileInputRef) {
            this.fileInputRef.nativeElement.value = '';
        }
    }

    async upload() {
        const propertyId = this.workspaceService.currentPropertyId;
        const period = this.workspaceService.currentPeriod;

        if (!propertyId || !period || !this.selectedDocType || !this.selectedFile) {
            return;
        }

        this.uploading = true;
        const res = await this.documentService.upload(propertyId, period, this.selectedDocType, this.selectedFile);
        this.uploading = false;

        if (res.success) {
            this.clearSelectedFile();
            this.snackBar.open(`Uploaded ${res.data.originalFilename} (v${res.data.version})`, 'close', { duration: 3000 });
            await this.loadDocuments();
        } else {
            this.snackBar.open(res.msg || 'Failed to upload document', 'close', { duration: 5000 });
        }

        this.cdr.detectChanges();
    }

    async download(doc: SourceDocument) {
        const res = await this.documentService.getDownloadUrl(doc.oid as string);

        if (res.success) {
            window.open(res.data, '_blank');
        } else {
            this.snackBar.open(res.msg || 'Failed to get download link', 'close', { duration: 5000 });
        }
    }
}
