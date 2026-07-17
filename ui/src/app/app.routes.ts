import { Routes, RouterModule } from '@angular/router';

import { HomeComponent } from './component/home/home.component';
import { LoginComponent } from './component/login/login.component';
import { OneTimeCodeComponent } from './component/login/one-time-code.component';
import { ForgotPasswordComponent } from './component/login/forgot-password.component';
import { ShellComponent } from './component/shell/shell.component';
import { PropertyListComponent } from './component/property/property-list.component';
import { CoaConfigComponent } from './component/coa/coa-config.component';
import { TrialBalanceComponent } from './component/trial-balance/trial-balance.component';
import { DocumentListComponent } from './component/document/document-list.component';
import { ExtractionResultComponent } from './component/extraction/extraction-result.component';
import { ReconciliationSummaryComponent } from './component/reconciliation/reconciliation-summary.component';
import { ToleranceConfigComponent } from './component/settings/tolerance-config.component';
import { ReviewInboxComponent } from './component/review/review-inbox.component';
import { ReviewDetailComponent } from './component/review/review-detail.component';
import { ChecklistComponent } from './component/checklist/checklist.component';
import { PeriodCloseComponent } from './component/period/period-close.component';
import { authGuard } from './guard/auth.guard';

export const routes: Routes = [
    //unauthenticated routes
    { path: 'login', component: LoginComponent },
    { path: 'login/code', component: OneTimeCodeComponent },
    { path: 'password/reset', component: ForgotPasswordComponent },

    //authenticated app shell
    {
        path: '',
        component: ShellComponent,
        canActivate: [authGuard],
        children: [
            { path: '', component: HomeComponent },
            { path: 'properties', component: PropertyListComponent },
            { path: 'coa', component: CoaConfigComponent },
            { path: 'trial-balance', component: TrialBalanceComponent },
            { path: 'documents', component: DocumentListComponent },
            { path: 'extraction/:sourceDocumentId', component: ExtractionResultComponent },
            { path: 'reconciliation', component: ReconciliationSummaryComponent },
            { path: 'settings/tolerance', component: ToleranceConfigComponent },
            { path: 'review', component: ReviewInboxComponent },
            { path: 'review/:id', component: ReviewDetailComponent },
            { path: 'checklist', component: ChecklistComponent },
            { path: 'period', component: PeriodCloseComponent },

            //catch all
            { path: '**', component: HomeComponent }
        ]
    }
];

export const routing = RouterModule.forRoot(routes, {
    anchorScrolling: 'enabled'
});
