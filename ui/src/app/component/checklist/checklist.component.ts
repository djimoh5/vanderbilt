import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DatePipe } from '@angular/common';

import { BaseComponent, SaveStatusComponent } from 'bundle/component';
import { AppService, WorkspaceService, ChecklistService, AuthService, SaveStatusService } from 'bundle/service';
import { WorkspaceChangedEvent } from 'bundle/event';
import { ChecklistTemplate, ChecklistInstance, ChecklistItemResponse, ChecklistItemStatus } from 'bundle/model';

interface CategoryItemRow {
    key: string;
    label: string;
    order: number;
    response: ChecklistItemResponse;
}

interface CategoryGroup {
    category: string;
    order: number;
    rows: CategoryItemRow[];
}

@Component({
    selector: 'app-checklist',
    imports: [
        FormsModule,
        DatePipe,
        MatCardModule,
        MatExpansionModule,
        MatButtonToggleModule,
        MatIconModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressSpinnerModule,
        MatProgressBarModule,
        MatSnackBarModule,
        SaveStatusComponent
    ],
    providers: [SaveStatusService],
    templateUrl: './checklist.component.html',
    styleUrl: './checklist.component.scss'
})
export class ChecklistComponent extends BaseComponent implements OnInit {
    templates: ChecklistTemplate[] = [];
    instance: ChecklistInstance | null = null;

    loading = false;
    starting = false;

    newCommentByKey: { [key: string]: string } = {};
    postingCommentKey: string | null = null;

    readonly ChecklistItemStatus = ChecklistItemStatus;

    constructor(
        appService: AppService,
        public workspaceService: WorkspaceService,
        private checklistService: ChecklistService,
        private authService: AuthService,
        private snackBar: MatSnackBar,
        private cdr: ChangeDetectorRef,
        public saveStatus: SaveStatusService
    ) {
        super(appService);
    }

    async ngOnInit(): Promise<void> {
        await this.workspaceService.ready();
        await this.loadTemplates();
        this.subscribeEvent(WorkspaceChangedEvent, () => this.loadInstance());
        await this.loadInstance();
    }

    private async loadTemplates() {
        const res = await this.checklistService.getTemplates();
        this.templates = res.success ? res.data : [];
    }

    async loadInstance() {
        this.instance = null;

        const propertyId = this.workspaceService.currentPropertyId;
        const period = this.workspaceService.currentPeriod;

        if (!propertyId || !period) {
            this.cdr.detectChanges();
            return;
        }

        this.loading = true;
        const res = await this.checklistService.getByPropertyPeriod(propertyId, period);
        this.loading = false;

        this.instance = res.success && res.data ? res.data : null;
        this.cdr.detectChanges();
    }

    async startChecklist() {
        const propertyId = this.workspaceService.currentPropertyId;
        const period = this.workspaceService.currentPeriod;

        if (!propertyId || !period) {
            return;
        }

        this.starting = true;
        const res = await this.checklistService.instantiate(propertyId, period);
        this.starting = false;

        if (res.success) {
            this.instance = res.data;
        } else {
            this.snackBar.open(res.msg || 'Failed to start checklist', 'close', { duration: 5000 });
        }

        this.cdr.detectChanges();
    }

    get categoryGroups(): CategoryGroup[] {
        if (!this.instance) {
            return [];
        }

        const responseByKey = new Map(this.instance.responses.map(r => [r.itemKey, r]));

        return this.templates
            .map(template => ({
                category: template.category,
                order: template.order,
                rows: template.items
                    .map(item => ({ key: item.key, label: item.label, order: item.order, response: responseByKey.get(item.key) }))
                    .filter(row => !!row.response)
                    .sort((a, b) => a.order - b.order)
            }))
            .sort((a, b) => a.order - b.order);
    }

    get answeredCount(): number {
        return this.instance ? this.instance.responses.filter(r => r.status !== ChecklistItemStatus.Unanswered).length : 0;
    }

    get totalCount(): number {
        return this.instance ? this.instance.responses.length : 0;
    }

    get completionPercent(): number {
        return this.totalCount === 0 ? 0 : Math.round((this.answeredCount / this.totalCount) * 100);
    }

    isOwnComment(authorId: string): boolean {
        return authorId === this.authService.currentUserId;
    }

    async updateStatus(itemKey: string, status: ChecklistItemStatus) {
        const propertyId = this.workspaceService.currentPropertyId;
        const period = this.workspaceService.currentPeriod;

        this.saveStatus.start();
        const res = await this.checklistService.updateItemStatus(propertyId, period, itemKey, status);

        if (res.success) {
            this.instance = res.data;
            this.saveStatus.success();
        } else {
            this.saveStatus.fail();
            this.snackBar.open(res.msg || 'Failed to update status', 'close', { duration: 5000 });
        }

        this.cdr.detectChanges();
    }

    async addComment(itemKey: string) {
        const text = (this.newCommentByKey[itemKey] || '').trim();
        if (!text) {
            return;
        }

        const propertyId = this.workspaceService.currentPropertyId;
        const period = this.workspaceService.currentPeriod;

        this.postingCommentKey = itemKey;
        const res = await this.checklistService.addComment(propertyId, period, itemKey, text);
        this.postingCommentKey = null;

        if (res.success) {
            this.instance = res.data;
            this.newCommentByKey[itemKey] = '';
        } else {
            this.snackBar.open(res.msg || 'Failed to add comment', 'close', { duration: 5000 });
        }

        this.cdr.detectChanges();
    }
}
