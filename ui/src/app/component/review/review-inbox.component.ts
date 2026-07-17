import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CurrencyPipe, DatePipe } from '@angular/common';

import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';

import { BaseComponent } from 'bundle/component';
import { AppService, ReviewService } from 'bundle/service';
import { ReviewInboxEntry } from 'bundle/model';

@Component({
    selector: 'app-review-inbox',
    imports: [
        RouterLink,
        CurrencyPipe,
        DatePipe,
        MatCardModule,
        MatTableModule,
        MatChipsModule,
        MatIconModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatTooltipModule
    ],
    templateUrl: './review-inbox.component.html',
    styleUrl: './review-inbox.component.scss'
})
export class ReviewInboxComponent extends BaseComponent implements OnInit {
    loading = false;
    entries: ReviewInboxEntry[] = [];

    displayedColumns = ['propertyName', 'period', 'tbAccountNumber', 'variance', 'createdAt', 'actions'];

    constructor(appService: AppService, private reviewService: ReviewService, private cdr: ChangeDetectorRef) {
        super(appService);
    }

    async ngOnInit(): Promise<void> {
        await this.loadInbox();
    }

    async loadInbox() {
        this.loading = true;
        const res = await this.reviewService.getInbox();
        this.loading = false;

        this.entries = res.success ? res.data : [];
        this.cdr.detectChanges();
    }
}
