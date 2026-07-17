import { Component, OnInit, ChangeDetectorRef } from '@angular/core';

import { MatCardModule } from '@angular/material/card';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { BaseComponent, SaveStatusComponent } from 'bundle/component';
import { AppService, CoaService, SaveStatusService, WorkspaceService } from 'bundle/service';
import { WorkspaceChangedEvent } from 'bundle/event';
import { ChartOfAccount } from 'bundle/model';
import { Common } from 'bundle/utility';

@Component({
    selector: 'app-coa-config',
    imports: [
        MatCardModule,
        MatExpansionModule,
        MatSlideToggleModule,
        MatIconModule,
        MatProgressSpinnerModule,
        MatSnackBarModule,
        SaveStatusComponent
    ],
    providers: [SaveStatusService],
    templateUrl: './coa-config.component.html',
    styleUrl: './coa-config.component.scss'
})
export class CoaConfigComponent extends BaseComponent implements OnInit {
    accounts: ChartOfAccount[] = [];
    accountsByCategory: { category: string, accounts: ChartOfAccount[] }[] = [];
    activeAccountIds = new Set<string>();

    loadingAccounts = false;

    constructor(appService: AppService, public workspaceService: WorkspaceService, private coaService: CoaService, private snackBar: MatSnackBar, private cdr: ChangeDetectorRef, public saveStatus: SaveStatusService) {
        super(appService);
    }

    async ngOnInit(): Promise<void> {
        await this.workspaceService.ready();
        this.subscribeEvent(WorkspaceChangedEvent, () => this.onPropertyChange());
        await this.onPropertyChange();
    }

    async onPropertyChange() {
        const propertyId = this.workspaceService.currentPropertyId;

        if (!propertyId) {
            this.cdr.detectChanges();
            return;
        }

        this.loadingAccounts = true;

        const [accountsRes, activationsRes] = await Promise.all([
            this.coaService.getByTenant(),
            this.coaService.getActivations(propertyId)
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
        this.saveStatus.start();
        const res = await this.coaService.setActivation(this.workspaceService.currentPropertyId, account.oid as string, active);

        if (res.success) {
            if (active) {
                this.activeAccountIds.add(account.oid as string);
            } else {
                this.activeAccountIds.delete(account.oid as string);
            }
            this.saveStatus.success();
        } else {
            this.saveStatus.fail();
            this.snackBar.open(res.msg || 'Failed to update activation', 'close', { duration: 5000 });
        }

        this.cdr.detectChanges();
    }
}
