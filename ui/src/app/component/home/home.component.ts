import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

import { BaseComponent } from 'bundle/component';
import { AppService, AuthService } from 'bundle/service';

@Component({
	selector: 'app-home',
	imports: [RouterLink, MatCardModule, MatIconModule],
	templateUrl: './home.component.html',
	styleUrl: './home.component.scss',
})
export class HomeComponent extends BaseComponent implements OnInit {
	constructor(appService: AppService, private authService: AuthService) {
		super(appService);
	}

	ngOnInit(): void { }

	get username(): string {
		return this.authService.currentUsername;
	}
}
