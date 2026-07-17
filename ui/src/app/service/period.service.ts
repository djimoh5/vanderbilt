import { Injectable } from '@angular/core';
import { ApiService } from './api.service';
import { AppService } from './app.service';
import { BaseService, ApiResponse } from './base.service';

import { Period } from 'bundle/model';

export interface PeriodStatusSummary {
    period: Period;
    openReviewItems: number;
    openChecklistItems: number;
}

@Injectable()
export class PeriodService extends BaseService {
    constructor(apiService: ApiService, appService: AppService) {
        super(apiService, appService, '');
    }

    getStatusSummary(propertyId: string, period: string): Promise<ApiResponse<PeriodStatusSummary>> {
        return this.get(`period/${propertyId}/${period}`);
    }

    transition(propertyId: string, period: string, status: string): Promise<ApiResponse<Period>> {
        return this.post(`period/${propertyId}/${period}/transition`, { status });
    }
}
