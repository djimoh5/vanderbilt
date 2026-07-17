import { NgModule } from '@angular/core';

import { AppService } from './app.service';
import { RouterService } from './router.service';
import { ApiService, ApiTokenService } from './api.service';
import { AuthService } from './auth.service';
import { DocumentService } from './document.service';
import { PropertyService } from './property.service';
import { CoaService } from './coa.service';
import { TrialBalanceService } from './trial-balance.service';

@NgModule({
    providers: [
        AppService,
        RouterService,
        ApiService,
        ApiTokenService,
        AuthService,
        DocumentService,
        PropertyService,
        CoaService,
        TrialBalanceService
    ]
})
export class ServiceModule {}