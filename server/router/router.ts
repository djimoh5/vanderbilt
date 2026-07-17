import { StaticController } from '../controller/static.controller';
import { APIController } from '../controller/api.controller';
import { TenantController } from '../controller/tenant.controller';
import { PropertyController } from '../controller/property.controller';
import { CoaController } from '../controller/coa.controller';
import { TrialBalanceController } from '../controller/trial-balance.controller';
import { DocumentController } from '../controller/document.controller';
import { ExtractionController } from '../controller/extraction.controller';
import { ReconciliationController } from '../controller/reconciliation.controller';
import { TenantConfigController } from '../controller/tenant-config.controller';
import { ReviewController } from '../controller/review.controller';
import { ChecklistController } from '../controller/checklist.controller';
import { PeriodController } from '../controller/period.controller';

import { BaseRouter, RouteInfo } from './base.router';
import {  Config } from '../config/config';

export class Router extends BaseRouter {
    init() {
        let routes: RouteInfo[] = [
            //API Endpoints
            { path: `${this.getBaseUrl()}`, controller: APIController },
            { path: `${this.getBaseUrl()}/tenant`, controller: TenantController },
            { path: `${this.getBaseUrl()}/property`, controller: PropertyController },
            { path: `${this.getBaseUrl()}/coa`, controller: CoaController },
            { path: `${this.getBaseUrl()}/trial-balance`, controller: TrialBalanceController },
            { path: `${this.getBaseUrl()}/document`, controller: DocumentController },
            { path: `${this.getBaseUrl()}/extraction`, controller: ExtractionController },
            { path: `${this.getBaseUrl()}/reconciliation`, controller: ReconciliationController },
            { path: `${this.getBaseUrl()}/tenant-config`, controller: TenantConfigController },
            { path: `${this.getBaseUrl()}/review`, controller: ReviewController },
            { path: `${this.getBaseUrl()}/checklist`, controller: ChecklistController },
            { path: `${this.getBaseUrl()}/period`, controller: PeriodController }
        ];

        //static pages
        if(!Config.SERVERLESS) {
            routes = routes.concat([
                { path: '*', controller: StaticController }
            ]);
        }

        return routes;
    }
}
