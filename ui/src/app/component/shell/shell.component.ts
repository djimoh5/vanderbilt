import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';

import { BaseComponent } from 'bundle/component';
import { AppService, AuthService } from 'bundle/service';

@Component({
    selector: 'app-shell',
    imports: [
        RouterLink,
        RouterLinkActive,
        RouterOutlet,
        MatToolbarModule,
        MatButtonModule,
        MatIconModule,
        MatMenuModule
    ],
    templateUrl: './shell.component.html',
    styleUrl: './shell.component.scss'
})
export class ShellComponent extends BaseComponent implements OnInit {
    constructor(appService: AppService, private authService: AuthService) {
        super(appService);
    }

    ngOnInit(): void { }

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
}
