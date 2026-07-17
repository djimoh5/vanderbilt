import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatListModule } from '@angular/material/list';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';

import { BaseComponent } from 'bundle/component';
import { AppService, AuthService, WorkspaceService } from 'bundle/service';
import { WorkspaceChangedEvent } from 'bundle/event';
import { Months, Years, MonthOption } from 'bundle/utility';

interface NavItem {
    path: string;
    label: string;
    icon: string;
}

@Component({
    selector: 'app-shell',
    imports: [
        RouterLink,
        RouterLinkActive,
        RouterOutlet,
        MatToolbarModule,
        MatIconModule,
        MatMenuModule,
        MatDividerModule,
        MatSidenavModule,
        MatListModule,
        MatButtonModule,
        MatTooltipModule
    ],
    templateUrl: './shell.component.html',
    styleUrl: './shell.component.scss'
})
export class ShellComponent extends BaseComponent implements OnInit {
    months: MonthOption[] = Months;
    years: number[] = Years;

    sidenavExpanded = true;

    navItems: NavItem[] = [
        { path: '/properties', label: 'Properties', icon: 'apartment' },
        { path: '/coa', label: 'Chart of Accounts', icon: 'account_tree' },
        { path: '/trial-balance', label: 'Trial Balance', icon: 'account_balance' },
        { path: '/documents', label: 'Documents', icon: 'description' },
        { path: '/reconciliation', label: 'Reconciliation', icon: 'sync_alt' },
        { path: '/checklist', label: 'Checklist', icon: 'playlist_add_check' },
        { path: '/review', label: 'Review', icon: 'rate_review' },
        { path: '/period', label: 'Period Close', icon: 'lock' }
    ];

    selectedPropertyId = '';
    selectedMonth: number | null = null;
    selectedYear: number | null = null;

    constructor(appService: AppService, private authService: AuthService, public workspaceService: WorkspaceService, private cdr: ChangeDetectorRef) {
        super(appService);
    }

    async ngOnInit(): Promise<void> {
        await this.workspaceService.ready();
        this.syncFromWorkspace();
        this.subscribeEvent(WorkspaceChangedEvent, () => {
            this.syncFromWorkspace();
            this.cdr.detectChanges();
        });
        this.cdr.detectChanges();
    }

    private syncFromWorkspace() {
        this.selectedPropertyId = this.workspaceService.currentPropertyId;
        this.selectedMonth = this.workspaceService.currentMonth;
        this.selectedYear = this.workspaceService.currentYear;
    }

    get selectedPropertyName(): string {
        const property = this.workspaceService.properties.find(p => p.oid === this.selectedPropertyId);
        return property ? property.name : 'Select property';
    }

    get selectedMonthLabel(): string {
        const month = this.months.find(m => m.value === this.selectedMonth);
        return month ? month.label.slice(0, 3) : '';
    }

    selectProperty(propertyId: string) {
        this.selectedPropertyId = propertyId;
        this.workspaceService.setProperty(propertyId);
        this.cdr.detectChanges();
    }

    selectMonth(month: number) {
        this.selectedMonth = month;
        this.onPeriodSelectionChange();
    }

    selectYear(year: number) {
        this.selectedYear = year;
        this.onPeriodSelectionChange();
    }

    onPeriodMenuOpened() {
        // mat-menu content is portal-projected into an overlay attached to the
        // document, not the component's own view, so a plain DOM query is more
        // reliable here than @ViewChild (which needs a CD pass to refresh).
        setTimeout(() => {
            document.querySelector('.year-list .period-chip-active')?.scrollIntoView({ block: 'center' });
        }, 50);
    }

    private onPeriodSelectionChange() {
        if (!this.selectedMonth || !this.selectedYear) {
            return;
        }

        this.workspaceService.setPeriod(this.selectedMonth, this.selectedYear);
        this.cdr.detectChanges();
    }

    get username(): string {
        return this.authService.currentUsername;
    }

    get initials(): string {
        return this.username ? this.username.trim().charAt(0).toUpperCase() : '?';
    }

    logout() {
        this.authService.disconnect();
        this.appService.navigate({ path: 'login' });
    }

    toggleSidenav() {
        this.sidenavExpanded = !this.sidenavExpanded;
    }
}
