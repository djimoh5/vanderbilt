import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { BaseComponent, SaveStatusComponent } from 'bundle/component';
import { AppService, ReconciliationService, SaveStatusService } from 'bundle/service';

@Component({
    selector: 'app-tolerance-config',
    imports: [
        FormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatSnackBarModule,
        SaveStatusComponent
    ],
    providers: [SaveStatusService],
    templateUrl: './tolerance-config.component.html',
    styleUrl: './tolerance-config.component.scss'
})
export class ToleranceConfigComponent extends BaseComponent implements OnInit {
    loading = false;
    saving = false;

    dollar: number = 0;
    percent: number = 0;

    constructor(appService: AppService, private reconciliationService: ReconciliationService, private snackBar: MatSnackBar, public saveStatus: SaveStatusService, private cdr: ChangeDetectorRef) {
        super(appService);
    }

    async ngOnInit(): Promise<void> {
        this.loading = true;
        const res = await this.reconciliationService.getTenantConfig();
        this.loading = false;

        if (res.success && res.data) {
            this.dollar = res.data.varianceTolerance?.dollar ?? 0;
            this.percent = (res.data.varianceTolerance?.percent ?? 0) * 100;
        }

        this.cdr.detectChanges();
    }

    async save() {
        this.saving = true;
        this.saveStatus.start();

        const res = await this.reconciliationService.updateTenantConfig(this.dollar, this.percent / 100);

        this.saving = false;

        if (res.success) {
            this.saveStatus.success();
        } else {
            this.saveStatus.fail();
            this.snackBar.open(res.msg || 'Failed to save tolerance', 'close', { duration: 5000 });
        }

        this.cdr.detectChanges();
    }
}
