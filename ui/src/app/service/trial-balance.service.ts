import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { AppService } from './app.service';
import { BaseService, ApiResponse } from './base.service';

import { TrialBalanceSnapshot } from 'bundle/model';

@Injectable()
export class TrialBalanceService extends BaseService {
    constructor(apiService: ApiService, appService: AppService) {
        super(apiService, appService, '');
    }

    import(propertyId: string, period: string, url: string): Promise<ApiResponse<TrialBalanceSnapshot>> {
        return this.post('trial-balance/import', { propertyId, period, url });
    }

    getByPropertyPeriod(propertyId: string, period: string): Promise<ApiResponse<TrialBalanceSnapshot>> {
        return this.get(`trial-balance/${propertyId}/${period}`);
    }
}
