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

import { AuthService } from '../../service/auth.service';

@Component({
    selector: 'app-one-time-code',
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
    templateUrl: './one-time-code.component.html',
    styleUrl: './one-time-code.component.scss'
})
export class OneTimeCodeComponent extends BaseComponent implements OnInit {
    step: 1 | 2 = 1;
    username = '';
    code = '';
    error: string;
    submitting = false;
    infoMessage: string;

    constructor(appService: AppService, private authService: AuthService, private cdr: ChangeDetectorRef) {
        super(appService);
    }

    ngOnInit(): void { }

    async requestCode() {
        this.error = null;
        this.submitting = true;

        await this.authService.requestLoginCode(this.username);

        this.submitting = false;
        this.infoMessage = 'If an account exists for that email, a code has been sent.';
        this.step = 2;
        this.cdr.detectChanges();
    }

    async verifyCode() {
        this.error = null;
        this.submitting = true;

        const res = await this.authService.verifyLoginCode(this.username, this.code);

        this.submitting = false;

        if (res.success) {
            this.appService.navigate({ path: '' });
        } else {
            this.error = res.msg;
        }

        this.cdr.detectChanges();
    }
}
