import { Routes, RouterModule } from '@angular/router';

import { HomeComponent } from './component/home/home.component';
import { LoginComponent } from './component/login/login.component';
import { OneTimeCodeComponent } from './component/login/one-time-code.component';
import { ForgotPasswordComponent } from './component/login/forgot-password.component';
import { ShellComponent } from './component/shell/shell.component';
import { PropertyListComponent } from './component/property/property-list.component';
import { CoaConfigComponent } from './component/coa/coa-config.component';
import { TrialBalanceComponent } from './component/trial-balance/trial-balance.component';
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

            //catch all
            { path: '**', component: HomeComponent }
        ]
    }
];

export const routing = RouterModule.forRoot(routes, {
    anchorScrolling: 'enabled'
});
