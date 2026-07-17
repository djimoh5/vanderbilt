import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { AppService } from './app.service';
import { BaseService, ApiResponse } from './base.service';

import { ChartOfAccount, AccountActivation } from 'bundle/model';

@Injectable()
export class CoaService extends BaseService {
    constructor(apiService: ApiService, appService: AppService) {
        super(apiService, appService, '');
    }

    getByTenant(): Promise<ApiResponse<ChartOfAccount[]>> {
        return this.get('coa');
    }

    setActivation(propertyId: string, accountId: string, active: boolean): Promise<ApiResponse<AccountActivation>> {
        return this.post('coa/activation', { propertyId, accountId, active });
    }

    getActivations(propertyId: string): Promise<ApiResponse<AccountActivation[]>> {
        return this.get(`coa/activation/${propertyId}`);
    }
}
