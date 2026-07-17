import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { BaseComponent } from 'bundle/component';
import { AppService, PropertyService, AuthService, WorkspaceService } from 'bundle/service';
import { Property, PropertyRoleType } from 'bundle/model';

@Component({
    selector: 'app-property-list',
    imports: [
        FormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatButtonModule,
        MatIconModule,
        MatListModule,
        MatChipsModule,
        MatProgressSpinnerModule,
        MatSnackBarModule
    ],
    templateUrl: './property-list.component.html',
    styleUrl: './property-list.component.scss'
})
export class PropertyListComponent extends BaseComponent implements OnInit {
    properties: Property[] = [];
    loading = false;

    newPropertyName = '';
    newPropertyYardiCode = '';
    creatingProperty = false;

    inviteUsername = '';
    invitingTeammate = false;
    lastInvitedOid: string;

    assignPropertyId = '';
    assignUserId = '';
    assignRole: PropertyRoleType = PropertyRoleType.Accountant;
    assigningRole = false;

    roleTypes = [PropertyRoleType.Admin, PropertyRoleType.Accountant, PropertyRoleType.Reviewer];

    constructor(appService: AppService, private propertyService: PropertyService, private workspaceService: WorkspaceService, private authService: AuthService, private snackBar: MatSnackBar, private cdr: ChangeDetectorRef) {
        super(appService);
    }

    async ngOnInit(): Promise<void> {
        await this.loadProperties();
    }

    async loadProperties() {
        this.loading = true;
        const res = await this.propertyService.getAll();
        this.loading = false;

        if (res.success) {
            this.properties = res.data;
        }

        this.cdr.detectChanges();
    }

    async createProperty() {
        if (!this.newPropertyName) {
            return;
        }

        this.creatingProperty = true;
        const res = await this.propertyService.create(this.newPropertyName, this.newPropertyYardiCode || undefined);
        this.creatingProperty = false;

        if (res.success) {
            this.newPropertyName = '';
            this.newPropertyYardiCode = '';
            this.snackBar.open('Property created', 'close', { duration: 3000 });
            await this.loadProperties();
            await this.workspaceService.refreshProperties();
        } else {
            this.snackBar.open(res.msg || 'Failed to create property', 'close', { duration: 5000 });
        }

        this.cdr.detectChanges();
    }

    async inviteTeammate() {
        if (!this.inviteUsername) {
            return;
        }

        this.invitingTeammate = true;
        const res = await this.authService.invite(this.inviteUsername);
        this.invitingTeammate = false;

        if (res.success) {
            this.lastInvitedOid = res.data.oid;
            this.assignUserId = res.data.oid;
            this.inviteUsername = '';
            this.snackBar.open('Invite sent', 'close', { duration: 3000 });
        } else {
            this.snackBar.open(res.msg || 'Failed to send invite', 'close', { duration: 5000 });
        }

        this.cdr.detectChanges();
    }

    async submitAssignRole() {
        if (!this.assignPropertyId || !this.assignUserId || !this.assignRole) {
            return;
        }

        this.assigningRole = true;
        const res = await this.propertyService.assignRole(this.assignPropertyId, this.assignUserId, this.assignRole);
        this.assigningRole = false;

        if (res.success) {
            this.snackBar.open('Role assigned', 'close', { duration: 3000 });
        } else {
            this.snackBar.open(res.msg || 'Failed to assign role', 'close', { duration: 5000 });
        }

        this.cdr.detectChanges();
    }
}
