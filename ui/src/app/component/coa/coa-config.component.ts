import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { BaseComponent } from 'bundle/component';
import { AppService, PropertyService, CoaService } from 'bundle/service';
import { Property, ChartOfAccount } from 'bundle/model';
import { Common } from 'bundle/utility';

@Component({
    selector: 'app-coa-config',
    imports: [
        FormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatSelectModule,
        MatExpansionModule,
        MatSlideToggleModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatSnackBarModule
    ],
    templateUrl: './coa-config.component.html',
    styleUrl: './coa-config.component.scss'
})
export class CoaConfigComponent extends BaseComponent implements OnInit {
    properties: Property[] = [];
    selectedPropertyId = '';

    accounts: ChartOfAccount[] = [];
    accountsByCategory: { category: string, accounts: ChartOfAccount[] }[] = [];
    activeAccountIds = new Set<string>();

    loadingProperties = false;
    loadingAccounts = false;

    constructor(appService: AppService, private propertyService: PropertyService, private coaService: CoaService, private snackBar: MatSnackBar, private cdr: ChangeDetectorRef) {
        super(appService);
    }

    async ngOnInit(): Promise<void> {
        this.loadingProperties = true;
        const res = await this.propertyService.getAll();
        this.loadingProperties = false;

        if (res.success) {
            this.properties = res.data;

            if (this.properties.length > 0) {
                this.selectedPropertyId = this.properties[0].oid as string;
                await this.onPropertyChange();
                return;
            }
        }

        this.cdr.detectChanges();
    }

    async onPropertyChange() {
        if (!this.selectedPropertyId) {
            return;
        }

        this.loadingAccounts = true;

        const [accountsRes, activationsRes] = await Promise.all([
            this.coaService.getByTenant(),
            this.coaService.getActivations(this.selectedPropertyId)
        ]);

        this.loadingAccounts = false;

        if (accountsRes.success) {
            this.accounts = accountsRes.data;
            this.accountsByCategory = Common.objectToArray(Common.multiArrayToHashTable(this.accounts, 'category'))
                .map(entry => ({ category: entry.key, accounts: entry.value as ChartOfAccount[] }));
        }

        this.activeAccountIds = new Set((activationsRes.success ? activationsRes.data : []).filter(a => a.active).map(a => a.accountId as string));
        this.cdr.detectChanges();
    }

    isActive(accountId: string): boolean {
        return this.activeAccountIds.has(accountId);
    }

    async toggleAccount(account: ChartOfAccount, active: boolean) {
        const res = await this.coaService.setActivation(this.selectedPropertyId, account.oid as string, active);

        if (res.success) {
            if (active) {
                this.activeAccountIds.add(account.oid as string);
            } else {
                this.activeAccountIds.delete(account.oid as string);
            }
        } else {
            this.snackBar.open(res.msg || 'Failed to update activation', 'close', { duration: 5000 });
        }

        this.cdr.detectChanges();
    }
}
