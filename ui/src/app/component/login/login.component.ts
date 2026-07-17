import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { BaseComponent } from 'bundle/component';
import { AppService } from 'bundle/service';
import { UserAuth, UniqueId } from 'bundle/model';

import { AuthService } from '../../service/auth.service';

@Component({
    selector: 'app-login',
    imports: [
        FormsModule,
        RouterLink,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatButtonModule,
        MatIconModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './login.component.html',
    styleUrl: './login.component.scss'
})
export class LoginComponent extends BaseComponent implements OnInit {
    username = '';
    password = '';
    mode: 'login' | 'signup' = 'login';
    error: string;
    submitting = false;
    infoMessage: string;

    constructor(appService: AppService, private authService: AuthService, private cdr: ChangeDetectorRef) {
        super(appService);
    }

    ngOnInit(): void {
        this.subscribeQueryParams((params) => {
            if (params['reset']) {
                this.infoMessage = 'Password updated, please log in.';
            }
        });
    }

    async submit() {
        this.error = null;
        this.submitting = true;

        const res = this.mode === 'login'
            ? await this.authService.authenticate({ username: this.username, password: this.password } as UserAuth)
            : await this.authService.create(new UserAuth(this.username, this.password, UniqueId('')));

        this.submitting = false;

        if (res.success) {
            this.appService.navigate({ path: '' });
        } else {
            this.error = res.msg;
        }

        this.cdr.detectChanges();
    }

    toggleMode() {
        this.mode = this.mode === 'login' ? 'signup' : 'login';
        this.error = null;
    }
}
