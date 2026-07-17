import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { AppService } from './app.service';
import { BaseService, ApiResponse } from './base.service';

import { ReconciliationResult, TenantConfig } from 'bundle/model';

@Injectable()
export class ReconciliationService extends BaseService {
    constructor(apiService: ApiService, appService: AppService) {
        super(apiService, appService, '');
    }

    getByPropertyPeriod(propertyId: string, period: string): Promise<ApiResponse<ReconciliationResult[]>> {
        return this.get(`reconciliation/${propertyId}/${period}`);
    }

    getByExtractedData(extractedDataId: string): Promise<ApiResponse<ReconciliationResult>> {
        return this.get(`reconciliation/${extractedDataId}`);
    }

    run(extractedDataId: string, tbAccountNumber?: string): Promise<ApiResponse<ReconciliationResult>> {
        return this.post(`reconciliation/${extractedDataId}/run`, tbAccountNumber ? { tbAccountNumber } : {});
    }

    getTenantConfig(): Promise<ApiResponse<TenantConfig>> {
        return this.get('tenant-config');
    }

    updateTenantConfig(dollar: number, percent: number): Promise<ApiResponse<TenantConfig>> {
        return this.post('tenant-config', { dollar, percent });
    }
}
