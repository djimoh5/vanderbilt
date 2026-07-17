import { Component } from '@angular/core';

import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

import { SaveStatusService } from '../../service/save-status.service';

@Component({
    selector: 'app-save-status',
    imports: [MatIconModule, MatProgressSpinnerModule],
    templateUrl: './save-status.component.html',
    styleUrl: './save-status.component.scss'
})
export class SaveStatusComponent {
    constructor(public saveStatus: SaveStatusService) { }
}
