import { Component, Inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';

import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';

import { ReviewInboxEntry } from 'bundle/model';

export interface LockPeriodDialogData {
    reviewItems: ReviewInboxEntry[];
    checklistItems: string[];
}

@Component({
    selector: 'app-lock-period-dialog',
    imports: [
        CurrencyPipe,
        MatDialogModule,
        MatButtonModule,
        MatIconModule,
        MatListModule
    ],
    templateUrl: './lock-period-dialog.component.html',
    styleUrl: './lock-period-dialog.component.scss'
})
export class LockPeriodDialogComponent {
    constructor(private dialogRef: MatDialogRef<LockPeriodDialogComponent, boolean>, @Inject(MAT_DIALOG_DATA) public data: LockPeriodDialogData) { }

    get hasOutstandingItems(): boolean {
        return this.data.reviewItems.length > 0 || this.data.checklistItems.length > 0;
    }

    cancel() {
        this.dialogRef.close(false);
    }

    confirm() {
        this.dialogRef.close(true);
    }
}
