import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { DatePipe, CurrencyPipe, DecimalPipe } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';

import { BaseComponent } from 'bundle/component';
import { AppService, ReviewService, AuthService } from 'bundle/service';
import { ReviewItemDetail, ReviewItemStatus } from 'bundle/model';

@Component({
    selector: 'app-review-detail',
    imports: [
        RouterLink,
        FormsModule,
        DatePipe,
        CurrencyPipe,
        DecimalPipe,
        MatCardModule,
        MatButtonModule,
        MatIconModule,
        MatChipsModule,
        MatTableModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressSpinnerModule,
        MatSnackBarModule,
        MatTooltipModule
    ],
    templateUrl: './review-detail.component.html',
    styleUrl: './review-detail.component.scss'
})
export class ReviewDetailComponent extends BaseComponent implements OnInit {
    reviewItemId: string;

    loading = false;
    detail: ReviewItemDetail | null = null;

    newComment = '';
    posting = false;
    resolving = false;
    assigning = false;

    displayedColumns = ['name', 'value', 'confidence'];

    readonly ReviewItemStatus = ReviewItemStatus;

    constructor(
        appService: AppService,
        private route: ActivatedRoute,
        private reviewService: ReviewService,
        private authService: AuthService,
        private snackBar: MatSnackBar,
        private cdr: ChangeDetectorRef
    ) {
        super(appService);
    }

    async ngOnInit(): Promise<void> {
        this.reviewItemId = this.route.snapshot.paramMap.get('id');
        await this.loadDetail();
    }

    async loadDetail() {
        this.loading = true;
        const res = await this.reviewService.getDetail(this.reviewItemId);
        this.loading = false;

        this.detail = res.success && res.data ? res.data : null;
        this.cdr.detectChanges();
    }

    isOwnComment(authorId: string): boolean {
        return authorId === this.authService.currentUserId;
    }

    isAssignedToMe(assignedTo: string | undefined): boolean {
        return assignedTo === this.authService.currentUserId;
    }

    async assignToMe() {
        this.assigning = true;
        const res = await this.reviewService.assign(this.reviewItemId);
        this.assigning = false;

        if (res.success) {
            this.detail = { ...this.detail, item: res.data };
            this.snackBar.open('Assigned to you', 'close', { duration: 3000 });
        } else {
            this.snackBar.open(res.msg || 'Failed to assign item', 'close', { duration: 5000 });
        }

        this.cdr.detectChanges();
    }

    async addComment() {
        if (!this.newComment.trim()) {
            return;
        }

        this.posting = true;
        const res = await this.reviewService.addComment(this.reviewItemId, this.newComment.trim());
        this.posting = false;

        if (res.success) {
            this.newComment = '';
            this.detail = { ...this.detail, item: res.data };
        } else {
            this.snackBar.open(res.msg || 'Failed to add comment', 'close', { duration: 5000 });
        }

        this.cdr.detectChanges();
    }

    async resolve(decision: 'approved' | 'rejected') {
        this.resolving = true;
        const res = await this.reviewService.resolve(this.reviewItemId, decision);
        this.resolving = false;

        if (res.success) {
            this.detail = { ...this.detail, item: res.data };
            this.snackBar.open(decision === 'approved' ? 'Approved' : 'Rejected', 'close', { duration: 3000 });
        } else {
            this.snackBar.open(res.msg || 'Failed to resolve review item', 'close', { duration: 5000 });
        }

        this.cdr.detectChanges();
    }

    statusClass(status: ReviewItemStatus): string {
        switch (status) {
            case ReviewItemStatus.Open: return 'status-open';
            case ReviewItemStatus.Approved: return 'status-approved';
            case ReviewItemStatus.Rejected: return 'status-rejected';
            default: return '';
        }
    }

    statusLabel(status: ReviewItemStatus): string {
        switch (status) {
            case ReviewItemStatus.Open: return 'Open';
            case ReviewItemStatus.Approved: return 'Approved';
            case ReviewItemStatus.Rejected: return 'Rejected';
            default: return status;
        }
    }
}
