import { NgModule } from '@angular/core';

import { AppService } from './app.service';
import { RouterService } from './router.service';
import { ApiService, ApiTokenService } from './api.service';
import { AuthService } from './auth.service';
import { DocumentService } from './document.service';
import { PropertyService } from './property.service';
import { WorkspaceService } from './workspace.service';
import { CoaService } from './coa.service';
import { TrialBalanceService } from './trial-balance.service';
import { ExtractionService } from './extraction.service';
import { ReconciliationService } from './reconciliation.service';
import { ReviewService } from './review.service';
import { ChecklistService } from './checklist.service';

@NgModule({
    providers: [
        AppService,
        RouterService,
        ApiService,
        ApiTokenService,
        AuthService,
        DocumentService,
        PropertyService,
        WorkspaceService,
        CoaService,
        TrialBalanceService,
        ExtractionService,
        ReconciliationService,
        ReviewService,
        ChecklistService
    ]
})
export class ServiceModule {}